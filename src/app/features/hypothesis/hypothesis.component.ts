import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ApiResult } from '../../core/models/dataset.model';
import { AnalysisService } from '../../core/services/analysis.service';
import { DataService } from '../../core/services/data.service';

type TestKind = 'one-sample' | 'independent' | 'paired' | 'anova' | 'chi-square' | 'correlation';

@Component({
  selector: 'app-hypothesis',
  imports: [RouterLink, FormsModule, MatButtonModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule],
  templateUrl: './hypothesis.component.html',
})
export class HypothesisComponent {
  protected readonly data = inject(DataService);
  protected readonly analysis = inject(AnalysisService);
  protected readonly kind = signal<TestKind>('one-sample');
  protected readonly result = signal<ApiResult | null>(null);
  protected alpha = 0.05;
  protected variable = '';
  protected secondVariable = '';
  protected groupVariable = '';
  protected group1 = '';
  protected group2 = '';
  protected hypothesizedMean = 0;

  protected readonly tests: { value: TestKind; label: string; short: string }[] = [
    { value: 'one-sample', label: 't de una muestra', short: 't₁' },
    { value: 'independent', label: 't independiente', short: 't₂' },
    { value: 'paired', label: 't pareada', short: 't↔' },
    { value: 'anova', label: 'ANOVA', short: 'F' },
    { value: 'chi-square', label: 'Chi-cuadrado', short: 'χ²' },
    { value: 'correlation', label: 'Pearson', short: 'r' },
  ];
  protected readonly currentTestLabel = computed(() => this.tests.find((test) => test.value === this.kind())?.label ?? 'Prueba');

  protected selectTest(kind: TestKind): void {
    this.kind.set(kind);
    this.result.set(null);
  }

  protected run(): void {
    const dataset = this.data.dataset();
    if (!dataset) return;
    const payload: Record<string, unknown> = { dataset_id: dataset.id, alpha: this.alpha };
    let endpoint = 'hypothesis/t-test';

    if (this.kind() === 'one-sample') Object.assign(payload, { type: 'one-sample', column: this.variable, popmean: this.hypothesizedMean });
    if (this.kind() === 'independent') Object.assign(payload, { type: 'independent', value_column: this.variable, group_column: this.groupVariable, groups: [this.group1, this.group2] });
    if (this.kind() === 'paired') Object.assign(payload, { type: 'paired', column1: this.variable, column2: this.secondVariable });
    if (this.kind() === 'anova') {
      endpoint = 'hypothesis/anova';
      Object.assign(payload, { value_column: this.variable, group_column: this.groupVariable });
    }
    if (this.kind() === 'chi-square') {
      endpoint = 'hypothesis/chi-square';
      Object.assign(payload, { row_column: this.variable, column_column: this.secondVariable });
    }
    if (this.kind() === 'correlation') {
      endpoint = 'hypothesis/correlation';
      Object.assign(payload, { x: this.variable, y: this.secondVariable });
    }

    this.analysis.run(endpoint, payload).subscribe({ next: (result) => this.result.set(result), error: () => undefined });
  }

  protected canRun(): boolean {
    if (!this.variable) return false;
    if (['paired', 'chi-square', 'correlation'].includes(this.kind())) return Boolean(this.secondVariable);
    if (this.kind() === 'independent') return Boolean(this.groupVariable && this.group1 && this.group2);
    if (this.kind() === 'anova') return Boolean(this.groupVariable);
    return true;
  }

  protected statistic(): unknown {
    const result = this.result();
    const values = this.resultValues();
    return values['statistic'] ?? values['t_statistic'] ?? values['f_statistic'] ?? values['chi_square'] ?? values['coefficient'] ?? values['correlation'] ?? values['r'] ?? result?.['statistic'];
  }

  protected pValue(): number | null {
    const result = this.result();
    const values = this.resultValues();
    const value = values['p_value'] ?? values['pValue'] ?? values['p'] ?? result?.['p_value'];
    return value === undefined || value === null ? null : Number(value);
  }

  protected interpretation(): string {
    const result = this.result();
    const supplied = result?.['interpretation'] ?? result?.['conclusion'];
    if (supplied) return String(supplied);
    const p = this.pValue();
    if (p === null || Number.isNaN(p)) return 'El servidor no devolvió una interpretación concluyente.';
    return p < this.alpha
      ? `Con α = ${this.alpha}, hay evidencia estadística para rechazar la hipótesis nula.`
      : `Con α = ${this.alpha}, no hay evidencia suficiente para rechazar la hipótesis nula.`;
  }

  protected format(value: unknown): string {
    const number = Number(value);
    return value !== null && value !== undefined && Number.isFinite(number)
      ? number.toLocaleString('es', { maximumFractionDigits: 6 }) : '—';
  }

  private resultValues(): Record<string, unknown> {
    const nested = this.result()?.['results'];
    return nested && typeof nested === 'object' ? nested as Record<string, unknown> : {};
  }
}
