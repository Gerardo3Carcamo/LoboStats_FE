import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ApiResult } from '../../core/models/dataset.model';
import { AnalysisService } from '../../core/services/analysis.service';
import { DataService } from '../../core/services/data.service';

type ResultRow = Record<string, unknown>;

@Component({
  selector: 'app-descriptive',
  imports: [RouterLink, FormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSelectModule],
  templateUrl: './descriptive.component.html',
})
export class DescriptiveComponent {
  protected readonly data = inject(DataService);
  protected readonly analysis = inject(AnalysisService);
  protected selectedColumns: string[] = [];
  protected frequencyColumn = '';
  protected readonly mode = signal<'summary' | 'frequencies'>('summary');
  protected readonly result = signal<ApiResult | null>(null);
  protected readonly resultRows = signal<ResultRow[]>([]);
  protected readonly headers = signal<string[]>([]);

  protected run(): void {
    const dataset = this.data.dataset();
    if (!dataset) return;
    const path = this.mode() === 'summary' ? 'descriptive/summary' : 'descriptive/frequencies';
    this.analysis.run(path, {
      dataset_id: dataset.id,
      ...(this.mode() === 'summary'
        ? (this.selectedColumns.length ? { columns: this.selectedColumns } : {})
        : { column: this.frequencyColumn }),
    }).subscribe({
      next: (result) => {
        this.result.set(result);
        const rows = this.toRows(result);
        this.resultRows.set(rows);
        this.headers.set([...new Set(rows.flatMap((row) => Object.keys(row)))]);
      },
      error: () => undefined,
    });
  }

  protected display(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toLocaleString('es', { maximumFractionDigits: 4 });
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private toRows(result: ApiResult): ResultRow[] {
    const candidate = result['summary'] ?? result['frequencies'] ?? result['data'] ?? result['results'];
    if (Array.isArray(candidate)) return candidate.map((item) => this.asRow(item));
    if (candidate && typeof candidate === 'object') {
      return Object.entries(candidate as Record<string, unknown>).map(([variable, value]) => ({
        variable,
        ...this.asRow(value),
      }));
    }
    return [this.asRow(result)];
  }

  private asRow(value: unknown): ResultRow {
    return value && typeof value === 'object' ? value as ResultRow : { valor: value };
  }
}
