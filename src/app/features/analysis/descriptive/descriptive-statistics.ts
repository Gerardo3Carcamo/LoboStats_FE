import { HttpErrorResponse } from '@angular/common/http';
import { KeyValuePipe } from '@angular/common';
import { Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AnalysisApi } from '../../../core/services/analysis-api';
import { ProductTourService } from '../../../core/services/product-tour';
import { WorkspacePersistenceService } from '../../../core/services/workspace-persistence';
import { WorkspaceStore } from '../../../core/services/workspace-store';
import {
  AnalysisRun,
  AnalysisRunSummary,
  DescriptiveAnalysisRequest,
  DescriptiveColumnResult,
  DescriptiveResult,
  EcdfResult,
  NumericSummary,
  QqPlotResult,
} from '../../../models/analysis';
import { AnalysisHistoryDialog } from '../../../shared/analysis-history/analysis-history-dialog';

type StatusKind = 'info' | 'success' | 'error';

@Component({
  selector: 'app-descriptive-statistics',
  imports: [AnalysisHistoryDialog, KeyValuePipe, RouterLink],
  templateUrl: './descriptive-statistics.html',
  styleUrl: './descriptive-statistics.scss',
})
export class DescriptiveStatistics {
  protected readonly store = inject(WorkspaceStore);
  private readonly persistence = inject(WorkspacePersistenceService);
  private readonly analysisApi = inject(AnalysisApi);
  private readonly productTour = inject(ProductTourService);
  private readonly resultHeading = viewChild<ElementRef<HTMLElement>>('resultHeading');
  private readonly historyDialog = viewChild.required<AnalysisHistoryDialog>('historyDialog');

  protected readonly selectedColumns = signal<string[]>(
    this.store
      .columns()
      .filter((column) => column.data_type === 'number')
      .map((column) => column.key),
  );
  protected readonly groupBy = signal<string | null>(null);
  protected readonly confidencePercent = signal(95);
  protected readonly histogramBins = signal(10);
  protected readonly percentileInput = signal('5, 10, 25, 50, 75, 90, 95');
  protected readonly percentiles = computed(() => parsePercentiles(this.percentileInput()));
  protected readonly percentileError = computed(() => {
    const values = this.percentiles();
    if (!values) return 'Usa porcentajes mayores que 0 y menores que 100.';
    if (values.length > 20) return 'Puedes solicitar hasta 20 percentiles.';
    return null;
  });
  protected readonly running = signal(false);
  protected readonly run = signal<AnalysisRun<DescriptiveResult> | null>(null);
  protected readonly status = signal('Selecciona las variables que deseas resumir');
  protected readonly statusKind = signal<StatusKind>('info');
  protected readonly columns = computed(() => this.store.columns());
  protected readonly canRun = computed(
    () =>
      this.selectedColumns().length > 0 &&
      this.store.filledRows().length > 0 &&
      !this.running() &&
      this.percentileError() === null,
  );

  protected startTour(event: Event): void {
    this.productTour.startDescriptiveTour(event.currentTarget as HTMLElement);
  }

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

  protected updatePercentiles(event: Event): void {
    this.percentileInput.set((event.target as HTMLInputElement).value);
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
        percentiles: (this.percentiles() ?? []).map((value) => value / 100),
        histogram_bins: this.histogramBins(),
        frequency_limit: 25,
      };
      const run = await firstValueFrom(this.analysisApi.descriptive(datasetId, payload));
      this.run.set(run);
      await this.historyDialog().refresh(datasetId);
      this.setStatus('success', `Análisis #${run.id} guardado y listo para revisar`);
      this.focusResult();
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
      this.focusResult();
    } catch (error) {
      this.setStatus('error', this.describeError(error));
    }
  }

  protected openHistoryDialog(event: Event): void {
    this.historyDialog().open(event.currentTarget as HTMLElement);
  }

  protected downloadResult(): void {
    const run = this.run();
    if (!run) return;
    this.downloadBlob(
      JSON.stringify(run, null, 2),
      'application/json',
      `lobostats-descriptiva-${run.id}.json`,
    );
  }

  protected downloadTable(): void {
    const run = this.run();
    if (!run) return;
    const percentileKeys = run.result.selection.percentiles.map(percentileKey);
    const headers = [
      'Grupo',
      'Variable',
      'Tipo',
      'Total',
      'Válidos',
      'Faltantes',
      '% faltante',
      'Media',
      'Mediana',
      'Media recortada 10%',
      'Moda',
      'Desv. estándar',
      'Varianza',
      'Error estándar',
      'CV %',
      'Mínimo',
      'Q1',
      'Q3',
      'Máximo',
      'Rango',
      'IQR',
      'MAD',
      'Suma',
      'Asimetría',
      'Curtosis',
      'AD ajustado',
      'p normalidad',
      'Atípicos',
      ...percentileKeys.map((key) => key.toUpperCase()),
    ];
    const rows = run.result.groups.flatMap((group) =>
      group.columns.map((column) => {
        const numeric = column.numeric;
        return [
          group.label,
          column.name,
          this.typeLabel(column.data_type),
          column.total_count,
          column.valid_count,
          column.missing_count,
          column.missing_percentage,
          numeric?.mean,
          numeric?.median,
          numeric?.trimmed_mean,
          numeric?.modes.join(' | '),
          numeric?.std_dev,
          numeric?.variance,
          numeric?.std_error,
          numeric?.coefficient_of_variation,
          numeric?.minimum,
          numeric?.q1,
          numeric?.q3,
          numeric?.maximum,
          numeric?.range,
          numeric?.iqr,
          numeric?.mad,
          numeric?.sum,
          numeric?.skewness,
          numeric?.kurtosis_excess,
          numeric?.normality?.adjusted_statistic,
          numeric?.normality?.p_value,
          numeric?.boxplot.outliers.length,
          ...percentileKeys.map((key) => numeric?.percentiles[key]),
        ];
      }),
    );
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    this.downloadBlob(
      `\uFEFF${csv}`,
      'text/csv;charset=utf-8',
      `lobostats-descriptiva-${run.id}.csv`,
    );
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

  protected typeLabel(type: DescriptiveColumnResult['data_type']): string {
    return { number: 'Numérica', text: 'Texto', date: 'Fecha' }[type];
  }

  protected histogramBinLabel(summary: NumericSummary, index: number, count: number): string {
    const lower = this.formatNumber(summary.histogram.edges[index], 2);
    const upper = this.formatNumber(summary.histogram.edges[index + 1], 2);
    return `${count} observaciones entre ${lower} y ${upper}`;
  }

  protected barHeight(summary: NumericSummary, count: number): number {
    const maximum = Math.max(...summary.histogram.counts, 1);
    return Math.max(2, (count / maximum) * 100);
  }

  protected histogramMaximum(summary: NumericSummary): number {
    return Math.max(...summary.histogram.counts, 0);
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

  protected ecdfPath(ecdf: EcdfResult): string {
    const values = ecdf.values;
    const probabilities = ecdf.probabilities;
    if (!values.length) return '';
    const x = (value: number): number => this.scalePoint(values, value, 18, 282);
    const y = (probability: number): number => 182 - probability * 164;
    let path = `M ${x(values[0])} 182 V ${y(probabilities[0])}`;
    for (let index = 1; index < values.length; index += 1) {
      path += ` H ${x(values[index])} V ${y(probabilities[index])}`;
    }
    return path;
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

  private focusResult(): void {
    const focus = (): void => this.resultHeading()?.nativeElement.focus();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focus);
    else queueMicrotask(focus);
  }

  private downloadBlob(contents: string, type: string, filename: string): void {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
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

function parsePercentiles(value: string): number[] | null {
  const parts = value
    .split(/[;,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return null;
  const values = parts.map(Number);
  if (values.some((item) => !Number.isFinite(item) || item <= 0 || item >= 100)) return null;
  return [...new Set(values)].sort((left, right) => left - right);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function percentileKey(percentile: number): string {
  return `p${Number((percentile * 100).toPrecision(12))}`;
}
