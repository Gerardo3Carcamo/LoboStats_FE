import { HttpErrorResponse } from '@angular/common/http';
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
  RegressionAnalysisRequest,
  RegressionCoefficient,
  RegressionModelKey,
  RegressionModelSpec,
  RegressionResult,
} from '../../../models/analysis';
import { DatasetColumn } from '../../../models/dataset';
import { AnalysisHistoryDialog } from '../../../shared/analysis-history/analysis-history-dialog';

type StatusKind = 'info' | 'success' | 'error';
type PlotPoint = { x: number; y: number; label: string };

const FALLBACK_MODELS: RegressionModelSpec[] = [
  model('linear', 'Regresión lineal', 'Respuesta continua', 'Ajusta uno o más predictores.'),
  model('fitted_line', 'Línea ajustada', 'Respuesta continua', 'Explora una relación lineal, cuadrática o cúbica.'),
  model('stepwise', 'Regresión escalonada', 'Selección de modelo', 'Agrega o elimina términos por significancia.'),
  model('best_subsets', 'Mejores subconjuntos', 'Selección de modelo', 'Compara los mejores modelos de cada tamaño.'),
  model('pls', 'Mínimos cuadrados parciales', 'Selección de modelo', 'Extrae componentes para predictores colineales.'),
  model('binary_logistic', 'Logística binaria', 'Respuesta categórica', 'Modela la probabilidad de un evento.'),
  model('ordinal_logistic', 'Logística ordinal', 'Respuesta categórica', 'Respeta el orden natural de las categorías.'),
  model('nominal_logistic', 'Logística nominal', 'Respuesta categórica', 'Compara categorías sin un orden natural.'),
];

const CONTINUOUS_MODELS = new Set<RegressionModelKey>([
  'linear',
  'fitted_line',
  'stepwise',
  'best_subsets',
  'pls',
]);

const NUMERIC_ONLY_MODELS = new Set<RegressionModelKey>([
  'fitted_line',
  'stepwise',
  'best_subsets',
  'pls',
]);

@Component({
  selector: 'app-regression',
  imports: [AnalysisHistoryDialog, RouterLink],
  templateUrl: './regression.html',
  styleUrl: './regression.scss',
})
export class Regression {
  protected readonly store = inject(WorkspaceStore);
  private readonly persistence = inject(WorkspacePersistenceService);
  private readonly analysisApi = inject(AnalysisApi);
  private readonly productTour = inject(ProductTourService);
  private readonly resultHeading = viewChild<ElementRef<HTMLElement>>('resultHeading');
  private readonly historyDialog = viewChild.required<AnalysisHistoryDialog>('historyDialog');

  protected readonly catalog = signal<RegressionModelSpec[]>(FALLBACK_MODELS);
  protected readonly selectedModel = signal<RegressionModelKey>('linear');
  protected readonly response = signal(this.store.columns().find(isNumeric)?.key ?? '');
  protected readonly predictors = signal<string[]>(
    this.store
      .columns()
      .filter((column) => isNumeric(column) && column.key !== this.response())
      .slice(0, 2)
      .map((column) => column.key),
  );
  protected readonly categoricalPredictors = signal<string[]>([]);
  protected readonly interactions = signal<string[]>([]);
  protected readonly degree = signal(1);
  protected readonly includeIntercept = signal(true);
  protected readonly confidencePercent = signal(95);
  protected readonly selectionMethod = signal<'forward' | 'backward' | 'stepwise'>('stepwise');
  protected readonly alphaToEnter = signal(0.15);
  protected readonly alphaToRemove = signal(0.15);
  protected readonly bestModelsPerSize = signal(2);
  protected readonly components = signal(2);
  protected readonly scalePls = signal(true);
  protected readonly eventValue = signal('');
  protected readonly referenceCategory = signal('');
  protected readonly categoryOrder = signal('');
  protected readonly running = signal(false);
  protected readonly storing = signal(false);
  protected readonly run = signal<AnalysisRun<RegressionResult> | null>(null);
  protected readonly status = signal('Selecciona una respuesta y los predictores del modelo');
  protected readonly statusKind = signal<StatusKind>('info');

  protected readonly categories = computed(() => [
    ...new Set(this.catalog().map((item) => item.category)),
  ]);
  protected readonly currentSpec = computed(
    () => this.catalog().find((item) => item.key === this.selectedModel()) ?? FALLBACK_MODELS[0],
  );
  protected readonly numericColumns = computed(() => this.store.columns().filter(isNumeric));
  protected readonly responseColumns = computed(() =>
    CONTINUOUS_MODELS.has(this.selectedModel()) ? this.numericColumns() : this.store.columns(),
  );
  protected readonly predictorColumns = computed(() => {
    const columns = NUMERIC_ONLY_MODELS.has(this.selectedModel())
      ? this.numericColumns()
      : this.store.columns();
    return columns.filter((column) => column.key !== this.response());
  });
  protected readonly responseValues = computed(() => this.uniqueValues(this.response()));
  protected readonly interactionOptions = computed(() => {
    const numeric = this.predictors().filter((key) =>
      this.numericColumns().some((column) => column.key === key),
    );
    const pairs: { key: string; label: string; values: [string, string] }[] = [];
    for (let left = 0; left < numeric.length; left += 1) {
      for (let right = left + 1; right < numeric.length; right += 1) {
        const values: [string, string] = [numeric[left], numeric[right]];
        pairs.push({ key: values.join('::'), label: values.join(' × '), values });
      }
    }
    return pairs;
  });
  protected readonly isContinuous = computed(() => CONTINUOUS_MODELS.has(this.selectedModel()));
  protected readonly equationPreview = computed(() => {
    const response = this.columnLabel(this.response()) || 'Y';
    if (!this.predictors().length) return `${response} = β₀ + β₁X₁`;
    const terms = this.predictors().map((key, index) => `β${index + 1}·${this.columnLabel(key)}`);
    return `${response} = ${this.includeIntercept() ? 'β₀ + ' : ''}${terms.join(' + ')}`;
  });
  protected readonly canRun = computed(() => {
    if (this.running() || !this.response() || !this.predictors().length) return false;
    if (!this.store.filledRows().length) return false;
    if (this.selectedModel() === 'fitted_line' && this.predictors().length !== 1) return false;
    if (['stepwise', 'best_subsets'].includes(this.selectedModel()) && this.predictors().length < 2) {
      return false;
    }
    if (this.selectedModel() === 'binary_logistic' && !this.eventValue()) return false;
    if (this.selectedModel() === 'ordinal_logistic' && this.orderedCategories().length < 3) {
      return false;
    }
    return true;
  });

  constructor() {
    void this.loadCatalog();
  }

  protected startTour(event: Event): void {
    this.productTour.startRegressionTour(event.currentTarget as HTMLElement);
  }

  protected updateModel(event: Event): void {
    this.selectedModel.set((event.target as HTMLSelectElement).value as RegressionModelKey);
    this.run.set(null);
    this.interactions.set([]);
    queueMicrotask(() => this.reconcileVariables());
  }

  protected updateResponse(event: Event): void {
    this.response.set((event.target as HTMLSelectElement).value);
    this.predictors.update((values) => values.filter((key) => key !== this.response()));
    this.ensureResponseCategories();
  }

  protected togglePredictor(key: string, checked: boolean): void {
    this.predictors.update((values) =>
      checked ? [...new Set([...values, key])] : values.filter((value) => value !== key),
    );
    if (!checked) {
      this.categoricalPredictors.update((values) => values.filter((value) => value !== key));
      this.interactions.update((values) => values.filter((value) => !value.split('::').includes(key)));
    }
  }

  protected toggleCategorical(key: string, checked: boolean): void {
    this.categoricalPredictors.update((values) =>
      checked ? [...new Set([...values, key])] : values.filter((value) => value !== key),
    );
    if (checked) {
      this.interactions.update((values) =>
        values.filter((value) => !value.split('::').includes(key)),
      );
    }
  }

  protected toggleInteraction(key: string, checked: boolean): void {
    this.interactions.update((values) =>
      checked ? [...new Set([...values, key])] : values.filter((value) => value !== key),
    );
  }

  protected updateDegree(event: Event): void {
    this.degree.set(Number((event.target as HTMLSelectElement).value));
  }

  protected updateIntercept(event: Event): void {
    this.includeIntercept.set((event.target as HTMLInputElement).checked);
  }

  protected updateConfidence(event: Event): void {
    this.confidencePercent.set(Number((event.target as HTMLInputElement).value));
  }

  protected updateSelectionMethod(event: Event): void {
    this.selectionMethod.set(
      (event.target as HTMLSelectElement).value as 'forward' | 'backward' | 'stepwise',
    );
  }

  protected updateAlphaEnter(event: Event): void {
    this.alphaToEnter.set(Number((event.target as HTMLInputElement).value));
  }

  protected updateAlphaRemove(event: Event): void {
    this.alphaToRemove.set(Number((event.target as HTMLInputElement).value));
  }

  protected updateBestModels(event: Event): void {
    this.bestModelsPerSize.set(Number((event.target as HTMLInputElement).value));
  }

  protected updateComponents(event: Event): void {
    this.components.set(Number((event.target as HTMLInputElement).value));
  }

  protected updateScalePls(event: Event): void {
    this.scalePls.set((event.target as HTMLInputElement).checked);
  }

  protected updateEventValue(event: Event): void {
    this.eventValue.set((event.target as HTMLSelectElement).value);
  }

  protected updateReferenceCategory(event: Event): void {
    this.referenceCategory.set((event.target as HTMLSelectElement).value);
  }

  protected updateCategoryOrder(event: Event): void {
    this.categoryOrder.set((event.target as HTMLInputElement).value);
  }

  protected async analyze(): Promise<void> {
    if (!this.canRun()) return;
    this.running.set(true);
    this.setStatus('info', 'Guardando la hoja y ajustando el modelo…');
    try {
      let datasetId = this.store.datasetId();
      if (!datasetId || this.store.dirty()) datasetId = (await this.persistence.saveCurrent()).id;
      const analysis = await firstValueFrom(this.analysisApi.regression(datasetId, this.payload()));
      this.run.set(analysis);
      await this.historyDialog().refresh(datasetId);
      this.setStatus('success', `Modelo #${analysis.id} ajustado y guardado`);
      requestAnimationFrame(() => this.resultHeading()?.nativeElement.focus());
    } catch (error) {
      this.setStatus('error', this.describeError(error));
    } finally {
      this.running.set(false);
    }
  }

  protected openHistoryDialog(event: Event): void {
    this.historyDialog().open(event.currentTarget as HTMLElement);
  }

  protected async openHistory(summary: AnalysisRunSummary): Promise<void> {
    if (summary.analysis_type !== 'regression') return;
    this.setStatus('info', `Abriendo modelo #${summary.id}…`);
    try {
      const analysis = await firstValueFrom(this.analysisApi.get<RegressionResult>(summary.id));
      this.run.set(analysis);
      this.setStatus(
        analysis.is_stale ? 'info' : 'success',
        analysis.is_stale
          ? `Modelo #${analysis.id} corresponde a una revisión anterior`
          : `Modelo #${analysis.id} abierto`,
      );
      requestAnimationFrame(() => this.resultHeading()?.nativeElement.focus());
    } catch (error) {
      this.setStatus('error', this.describeError(error));
    }
  }

  protected storeResults(): void {
    const analysis = this.run();
    if (!analysis || this.storing()) return;
    this.storing.set(true);
    try {
      const fitted = this.alignedPredictionValues('fitted');
      const residuals = this.alignedPredictionValues('residual');
      const probabilities = this.alignedPredictionValues('probability');
      const names = [];
      if (fitted.some((value) => value !== null)) {
        names.push(this.store.addComputedColumn(`Ajuste_${analysis.id}`, fitted).name);
      }
      if (residuals.some((value) => value !== null)) {
        names.push(this.store.addComputedColumn(`Residuo_${analysis.id}`, residuals).name);
      }
      if (probabilities.some((value) => value !== null)) {
        names.push(this.store.addComputedColumn(`Probabilidad_${analysis.id}`, probabilities).name);
      }
      this.setStatus(
        names.length ? 'success' : 'info',
        names.length
          ? `Se agregaron ${names.join(', ')} a la hoja`
          : 'Este resultado no contiene una serie numérica almacenable',
      );
    } finally {
      this.storing.set(false);
    }
  }

  protected downloadResult(): void {
    const analysis = this.run();
    if (!analysis) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lobostats-regresion-${analysis.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected fitNumber(key: string): number | null {
    const value = this.run()?.result.fit[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  protected selectionModels(): Record<string, unknown>[] {
    const models = this.run()?.result.selection?.['models'];
    return Array.isArray(models) ? (models as Record<string, unknown>[]) : [];
  }

  protected formatNumber(value: unknown, digits = 5): string {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits: digits }).format(Number(value));
  }

  protected fittedLinePath(): string {
    const plot = this.fittedPlotValues();
    if (!plot.x.length || plot.x.length !== plot.fitted.length) return '';
    const xScale = scale([...plot.x, ...plot.observedX], 42, 678);
    const yScale = scale(
      [...plot.lower, ...plot.upper, ...plot.fitted, ...plot.observedY],
      246,
      18,
    );
    return plot.x
      .map(
        (value, index) =>
          `${index === 0 ? 'M' : 'L'}${xScale(value)},${yScale(plot.fitted[index])}`,
      )
      .join(' ');
  }

  protected fittedBandPath(): string {
    const plot = this.fittedPlotValues();
    if (!plot.x.length || plot.x.length !== plot.lower.length || plot.x.length !== plot.upper.length) {
      return '';
    }
    const xScale = scale([...plot.x, ...plot.observedX], 42, 678);
    const yScale = scale(
      [...plot.lower, ...plot.upper, ...plot.fitted, ...plot.observedY],
      246,
      18,
    );
    const top = plot.x
      .map((value, index) => `${xScale(value)},${yScale(plot.upper[index])}`)
      .join(' L');
    const bottom = [...plot.x]
      .reverse()
      .map((value, reversed) => {
        const index = plot.x.length - reversed - 1;
        return `${xScale(value)},${yScale(plot.lower[index])}`;
      })
      .join(' L');
    return `M${top} L${bottom} Z`;
  }

  protected observedLinePoints(): PlotPoint[] {
    const plot = this.fittedPlotValues();
    if (!plot.observedX.length || plot.observedX.length !== plot.observedY.length) return [];
    const xScale = scale([...plot.x, ...plot.observedX], 42, 678);
    const yScale = scale(
      [...plot.lower, ...plot.upper, ...plot.fitted, ...plot.observedY],
      246,
      18,
    );
    return plot.observedX.map((value, index) => ({
      x: xScale(value),
      y: yScale(plot.observedY[index]),
      label: `${value.toPrecision(4)}, ${plot.observedY[index].toPrecision(4)}`,
    }));
  }

  protected residualPoints(): PlotPoint[] {
    const plot = this.run()?.result.plots['residuals'] as Record<string, unknown> | undefined;
    return scatter(numberArray(plot?.['fitted']), numberArray(plot?.['residual']));
  }

  protected observedFittedPoints(): PlotPoint[] {
    const plot = this.run()?.result.plots['observed_fitted'] as Record<string, unknown> | undefined;
    return scatter(numberArray(plot?.['fitted']), numberArray(plot?.['observed']));
  }

  protected qqPoints(): PlotPoint[] {
    const qq = this.run()?.result.diagnostics['qq_plot'] as Record<string, unknown> | undefined;
    return scatter(numberArray(qq?.['theoretical']), numberArray(qq?.['observed']));
  }

  protected zeroResidualY(): number {
    const plot = this.run()?.result.plots['residuals'] as Record<string, unknown> | undefined;
    const values = numberArray(plot?.['residual']);
    return values.length ? scale(values, 246, 18)(0) : 132;
  }

  private payload(): RegressionAnalysisRequest {
    const payload: RegressionAnalysisRequest = {
      model: this.selectedModel(),
      response: this.response(),
      predictors: this.predictors(),
      categorical_predictors: this.categoricalPredictors(),
      interactions: this.interactions().map((value) => value.split('::')),
      degree: this.degree(),
      include_intercept: this.includeIntercept(),
      confidence_level: this.confidencePercent() / 100,
      selection_method: this.selectionMethod(),
      alpha_to_enter: this.alphaToEnter(),
      alpha_to_remove: this.alphaToRemove(),
      best_models_per_size: this.bestModelsPerSize(),
      components: this.components(),
      scale: this.scalePls(),
    };
    if (this.selectedModel() === 'binary_logistic') payload.event_value = this.eventValue();
    if (this.selectedModel() === 'ordinal_logistic') payload.category_order = this.orderedCategories();
    if (this.selectedModel() === 'nominal_logistic' && this.referenceCategory()) {
      payload.reference_category = this.referenceCategory();
    }
    return payload;
  }

  private orderedCategories(): string[] {
    return this.categoryOrder()
      .split(/[,;]+/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private reconcileVariables(): void {
    const responses = this.responseColumns();
    if (!responses.some((column) => column.key === this.response())) {
      this.response.set(responses[0]?.key ?? '');
    }
    const available = new Set(this.predictorColumns().map((column) => column.key));
    this.predictors.update((values) => values.filter((key) => available.has(key)));
    if (!this.predictors().length) {
      this.predictors.set(this.predictorColumns().slice(0, 2).map((column) => column.key));
    }
    if (this.selectedModel() === 'fitted_line') this.predictors.set(this.predictors().slice(0, 1));
    this.categoricalPredictors.update((values) => values.filter((key) => available.has(key)));
    this.ensureResponseCategories();
  }

  private ensureResponseCategories(): void {
    const values = this.responseValues();
    if (!values.includes(this.eventValue())) this.eventValue.set(values[0] ?? '');
    if (!values.includes(this.referenceCategory())) this.referenceCategory.set(values[0] ?? '');
    this.categoryOrder.set(values.join(', '));
  }

  private uniqueValues(key: string): string[] {
    if (!key) return [];
    return [
      ...new Set(
        this.store
          .rows()
          .map((row) => row[key])
          .filter((value) => value !== null && value !== undefined && value !== '')
          .map(String),
      ),
    ].slice(0, 20);
  }

  private alignedPredictionValues(key: string): (number | null)[] {
    const analysis = this.run();
    if (!analysis) return [];
    const values = Array.from<number | null>({ length: this.store.rows().length }).fill(null);
    for (const row of analysis.result.predictions) {
      const index = Number(row['row']) - 1;
      const value = row[key];
      if (Number.isInteger(index) && index >= 0 && index < values.length && typeof value === 'number') {
        values[index] = value;
      }
    }
    return values;
  }

  private fittedPlotValues(): {
    x: number[];
    fitted: number[];
    lower: number[];
    upper: number[];
    observedX: number[];
    observedY: number[];
  } {
    const plot = this.run()?.result.plots['fitted_line'] as Record<string, unknown> | undefined;
    return {
      x: numberArray(plot?.['x']),
      fitted: numberArray(plot?.['fitted']),
      lower: numberArray(plot?.['prediction_lower']),
      upper: numberArray(plot?.['prediction_upper']),
      observedX: numberArray(plot?.['observed_x']),
      observedY: numberArray(plot?.['observed_y']),
    };
  }

  private columnLabel(key: string): string {
    return this.store.columns().find((column) => column.key === key)?.name ?? key;
  }

  private async loadCatalog(): Promise<void> {
    try {
      const catalog = await firstValueFrom(this.analysisApi.regressionCatalog());
      if (catalog.length) this.catalog.set(catalog);
    } catch {
      // The confirmed Minitab 15 catalog remains available while the API is offline.
    }
  }

  private setStatus(kind: StatusKind, message: string): void {
    this.statusKind.set(kind);
    this.status.set(message);
  }

  private describeError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'No se pudo ajustar el modelo';
    if (error.status === 0) return 'No se pudo conectar con el motor estadístico';
    if (error.status === 422 && typeof error.error?.detail === 'string') return error.error.detail;
    return 'El motor no pudo ajustar el modelo con la configuración indicada';
  }
}

function model(
  key: RegressionModelKey,
  label: string,
  category: string,
  description: string,
): RegressionModelSpec {
  return { key, label, category, description };
}

function isNumeric(column: DatasetColumn): boolean {
  return column.data_type === 'number';
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.map(Number).filter((item) => Number.isFinite(item))
    : [];
}

function scale(values: number[], high: number, low: number): (value: number) => number {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  if (minimum === maximum) return () => (low + high) / 2;
  return (value: number) => high + ((value - minimum) / (maximum - minimum)) * (low - high);
}

function scatter(x: number[], y: number[]): PlotPoint[] {
  if (!x.length || x.length !== y.length) return [];
  const xScale = scale(x, 42, 678);
  const yScale = scale(y, 246, 18);
  return x.map((value, index) => ({
    x: xScale(value),
    y: yScale(y[index]),
    label: `${value.toPrecision(4)}, ${y[index].toPrecision(4)}`,
  }));
}
