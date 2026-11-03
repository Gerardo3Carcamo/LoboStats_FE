import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AnalysisApi } from '../../../core/services/analysis-api';
import { WorkspacePersistenceService } from '../../../core/services/workspace-persistence';
import { WorkspaceStore } from '../../../core/services/workspace-store';
import {
  AnalysisRun,
  AnalysisRunSummary,
  DescriptiveAnalysisRequest,
  DescriptiveColumnResult,
  DescriptiveResult,
  NumericSummary,
  QqPlotResult,
} from '../../../models/analysis';

type StatusKind = 'info' | 'success' | 'error';

@Component({
  selector: 'app-descriptive-statistics',
  imports: [RouterLink],
  templateUrl: './descriptive-statistics.html',
  styleUrl: './descriptive-statistics.scss',
})
export class DescriptiveStatistics {
  protected readonly store = inject(WorkspaceStore);
  private readonly persistence = inject(WorkspacePersistenceService);
  private readonly analysisApi = inject(AnalysisApi);

  protected readonly selectedColumns = signal<string[]>(
    this.store
      .columns()
      .filter((column) => column.data_type === 'number')
      .map((column) => column.key),
  );
  protected readonly groupBy = signal<string | null>(null);
  protected readonly confidencePercent = signal(95);
  protected readonly histogramBins = signal(10);
  protected readonly running = signal(false);
  protected readonly run = signal<AnalysisRun<DescriptiveResult> | null>(null);
  protected readonly history = signal<AnalysisRunSummary[]>([]);
  protected readonly historyLoading = signal(false);
  protected readonly status = signal('Selecciona las variables que deseas resumir');
  protected readonly statusKind = signal<StatusKind>('info');
  protected readonly columns = computed(() => this.store.columns());
  protected readonly canRun = computed(
    () =>
      this.selectedColumns().length > 0 && this.store.filledRows().length > 0 && !this.running(),
  );
  private nextHistoryRequestId = 0;
  private readonly historyEffect = effect(() => {
    const datasetId = this.store.datasetId();
    if (!datasetId) {
      this.nextHistoryRequestId += 1;
      this.history.set([]);
      return;
    }
    void this.loadHistory(datasetId);
  });

  protected toggleColumn(key: string, checked: boolean): void {
    this.selectedColumns.update((columns) =>
      checked ? [...new Set([...columns, key])] : columns.filter((column) => column !== key),
    );
    if (this.groupBy() === key) this.groupBy.set(null);
  }

  protected updateGroupBy(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.groupBy.set(value || null);
  }

  protected updateConfidence(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.confidencePercent.set(Math.min(99.9, Math.max(80, value)));
  }

  protected updateBins(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.histogramBins.set(Math.min(100, Math.max(3, Math.round(value))));
  }

  protected async analyze(): Promise<void> {
    if (!this.canRun()) return;
    this.running.set(true);
    this.setStatus('info', 'Guardando la hoja y calculando estadísticas...');
    try {
      let datasetId = this.store.datasetId();
      if (!datasetId || this.store.dirty()) {
        const dataset = await this.persistence.saveCurrent();
        datasetId = dataset.id;
      }
      const payload: DescriptiveAnalysisRequest = {
        columns: this.selectedColumns(),
        group_by: this.groupBy(),
        confidence_level: this.confidencePercent() / 100,
        percentiles: [0.25, 0.5, 0.75],
        histogram_bins: this.histogramBins(),
        frequency_limit: 25,
      };
      const run = await firstValueFrom(this.analysisApi.descriptive(datasetId, payload));
      this.run.set(run);
      await this.loadHistory(datasetId);
      this.setStatus('success', `Análisis #${run.id} guardado y listo para revisar`);
    } catch (error) {
      this.setStatus('error', this.describeError(error));
    } finally {
      this.running.set(false);
    }
  }

  protected async openHistory(summary: AnalysisRunSummary): Promise<void> {
    if (summary.analysis_type !== 'descriptive') return;
    this.setStatus('info', `Abriendo análisis #${summary.id}...`);
    try {
      const run = await firstValueFrom(this.analysisApi.get<DescriptiveResult>(summary.id));
      this.run.set(run);
      this.setStatus(
        run.is_stale ? 'info' : 'success',
        run.is_stale
          ? `Análisis #${run.id} corresponde a una revisión anterior`
          : `Análisis #${run.id} abierto`,
      );
    } catch (error) {
      this.setStatus('error', this.describeError(error));
    }
  }

  protected downloadResult(): void {
    const run = this.run();
    if (!run) return;
    const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lobostats-descriptiva-${run.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected formatNumber(value: number | null | undefined, digits = 4): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits: digits }).format(value);
  }

  protected formatDate(value: string): string {
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  protected barHeight(summary: NumericSummary, count: number): number {
    const maximum = Math.max(...summary.histogram.counts, 1);
    return Math.max(2, (count / maximum) * 100);
  }

  protected boxPosition(summary: NumericSummary, value: number): number {
    const span = summary.maximum - summary.minimum;
    return span === 0 ? 50 : ((value - summary.minimum) / span) * 100;
  }

  protected qqX(plot: QqPlotResult, value: number): number {
    return this.scalePoint(plot.theoretical, value, 18, 282);
  }

  protected qqY(plot: QqPlotResult, value: number): number {
    return 182 - this.scalePoint(plot.observed, value, 0, 164);
  }

  protected trackColumn(_index: number, column: DescriptiveColumnResult): string {
    return column.key;
  }

  private scalePoint(values: number[], value: number, low: number, high: number): number {
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    if (minimum === maximum) return (low + high) / 2;
    return low + ((value - minimum) / (maximum - minimum)) * (high - low);
  }

  private async loadHistory(datasetId: number): Promise<void> {
    const requestId = (this.nextHistoryRequestId += 1);
    this.historyLoading.set(true);
    try {
      const history = await firstValueFrom(this.analysisApi.list(datasetId));
      if (requestId === this.nextHistoryRequestId) {
        this.history.set(history.filter((item) => item.analysis_type === 'descriptive'));
      }
    } catch {
      // History is secondary; the current worksheet and analysis stay available.
    } finally {
      if (requestId === this.nextHistoryRequestId) this.historyLoading.set(false);
    }
  }

  private setStatus(kind: StatusKind, message: string): void {
    this.statusKind.set(kind);
    this.status.set(message);
  }

  private describeError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'No se pudo ejecutar el análisis';
    if (error.status === 0) return 'No se pudo conectar con el motor estadístico';
    if (error.status === 422) {
      const detail = error.error?.detail;
      return typeof detail === 'string' ? detail : 'La configuración del análisis no es válida';
    }
    return 'El motor estadístico no pudo completar el análisis';
  }
}
