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
  ProbabilityAnalysisRequest,
  ProbabilityDistribution,
  ProbabilityDistributionSpec,
  ProbabilityMode,
  ProbabilityOperation,
  ProbabilityPoint,
  ProbabilityResult,
} from '../../../models/analysis';
import { AnalysisHistoryDialog } from '../../../shared/analysis-history/analysis-history-dialog';

type StatusKind = 'info' | 'success' | 'error';

const CORE_CATALOG: ProbabilityDistributionSpec[] = [
  {
    key: 'binomial',
    label: 'Binomial',
    kind: 'discrete',
    category: 'Frecuentes',
    description: 'Éxitos en un número fijo de ensayos independientes',
    parameters: [
      {
        key: 'trials',
        label: 'Ensayos (n)',
        default: 10,
        minimum: 1,
        maximum: 10_000,
        step: 1,
        integer: true,
        required: true,
      },
      {
        key: 'success_probability',
        label: 'Probabilidad de éxito (p)',
        default: 0.3,
        minimum: 0,
        maximum: 1,
        step: 0.01,
        integer: false,
        required: true,
      },
    ],
  },
  {
    key: 'poisson',
    label: 'Poisson',
    kind: 'discrete',
    category: 'Frecuentes',
    description: 'Eventos contados dentro de un intervalo fijo',
    parameters: [
      {
        key: 'rate',
        label: 'Tasa media (λ)',
        default: 4,
        minimum: 0.000001,
        maximum: 1_000,
        step: 0.1,
        integer: false,
        required: true,
      },
    ],
  },
  {
    key: 'normal',
    label: 'Normal',
    kind: 'continuous',
    category: 'Frecuentes',
    description: 'Mediciones continuas alrededor de una media',
    parameters: [
      {
        key: 'mean',
        label: 'Media (μ)',
        default: 100,
        minimum: null,
        maximum: null,
        step: 0.1,
        integer: false,
        required: true,
      },
      {
        key: 'std_dev',
        label: 'Desviación estándar (σ)',
        default: 15,
        minimum: 0.000001,
        maximum: 1_000_000,
        step: 0.1,
        integer: false,
        required: true,
      },
    ],
  },
];

@Component({
  selector: 'app-probability',
  imports: [AnalysisHistoryDialog, RouterLink],
  templateUrl: './probability.html',
  styleUrl: './probability.scss',
})
export class Probability {
  protected readonly store = inject(WorkspaceStore);
  private readonly persistence = inject(WorkspacePersistenceService);
  private readonly analysisApi = inject(AnalysisApi);
  private readonly productTour = inject(ProductTourService);
  private readonly resultHeading = viewChild<ElementRef<HTMLElement>>('resultHeading');
  private readonly historyDialog = viewChild.required<AnalysisHistoryDialog>('historyDialog');

  protected readonly catalog = signal<ProbabilityDistributionSpec[]>(CORE_CATALOG);
  protected readonly calculationModes: ProbabilityMode[] = ['pdf', 'cdf', 'inverse', 'event'];
  protected readonly distribution = signal<ProbabilityDistribution>('binomial');
  protected readonly parameterValues = signal<Record<string, number>>({
    trials: 10,
    success_probability: 0.3,
  });
  protected readonly parameterColumnKeys = signal<Record<string, string>>({});
  protected readonly calculationMode = signal<ProbabilityMode>('event');
  protected readonly operation = signal<ProbabilityOperation>('exact');
  protected readonly inputSource = signal<'constant' | 'column'>('constant');
  protected readonly inputValue = signal(3);
  protected readonly selectedColumnKey = signal('');
  protected readonly saveToWorksheet = signal(false);
  protected readonly outputColumnName = signal('PMF_Binomial');
  protected readonly lower = signal(3);
  protected readonly upper = signal(5);
  protected readonly running = signal(false);
  protected readonly run = signal<AnalysisRun<ProbabilityResult> | null>(null);
  protected readonly status = signal('Configura un modelo para calcular una probabilidad');
  protected readonly statusKind = signal<StatusKind>('info');
  protected readonly currentSpec = computed(() =>
    this.catalog().find((spec) => spec.key === this.distribution()),
  );
  protected readonly categories = computed(() => [
    ...new Set(this.catalog().map((spec) => spec.category)),
  ]);
  protected readonly isDiscrete = computed(() => this.currentSpec()?.kind === 'discrete');
  protected readonly numericColumns = computed(() =>
    this.store.columns().filter((column) => column.data_type === 'number'),
  );
  protected readonly canRun = computed(() => this.configurationIsValid() && !this.running());

  constructor() {
    void this.loadCatalog();
  }

  protected startTour(event: Event): void {
    this.productTour.startProbabilityTour(event.currentTarget as HTMLElement);
  }

  protected selectDistribution(distribution: ProbabilityDistribution): void {
    this.distribution.set(distribution);
    this.run.set(null);
    const spec = this.currentSpec();
    if (spec) {
      this.parameterValues.set(
        Object.fromEntries(
          spec.parameters
            .filter((parameter) => parameter.kind !== 'column' && parameter.default !== null)
            .map((parameter) => [parameter.key, parameter.default as number]),
        ),
      );
      this.parameterColumnKeys.set({});
    }
    if (this.isDiscrete()) {
      this.operation.set('exact');
      this.lower.set(distribution === 'geometric' ? 1 : 3);
      this.upper.set(5);
    } else {
      this.operation.set('between');
      this.lower.set(distribution === 'normal' ? 85 : 0);
      this.upper.set(distribution === 'normal' ? 115 : 1);
    }
    this.inputValue.set(distribution === 'normal' ? 115 : this.isDiscrete() ? 3 : 1);
    this.refreshOutputName();
    this.setStatus('info', this.exampleText());
  }

  protected updateDistribution(event: Event): void {
    this.selectDistribution((event.target as HTMLSelectElement).value as ProbabilityDistribution);
  }

  protected selectMode(mode: ProbabilityMode): void {
    this.calculationMode.set(mode);
    this.run.set(null);
    if (mode === 'inverse') this.inputValue.set(0.95);
    else if (mode !== 'event') this.inputValue.set(this.distribution() === 'normal' ? 115 : 3);
    if (mode === 'event' && this.distribution() === 'normal') this.operation.set('between');
    this.saveToWorksheet.set(false);
    this.refreshOutputName();
    this.setStatus('info', this.modeDescription());
  }

  protected updateInputSource(event: Event): void {
    this.inputSource.set((event.target as HTMLInputElement).value as 'constant' | 'column');
    if (this.inputSource() === 'column' && !this.selectedColumnKey()) {
      this.selectedColumnKey.set(this.numericColumns()[0]?.key ?? '');
    }
    if (this.inputSource() === 'constant') this.saveToWorksheet.set(false);
  }

  protected updateInputValue(event: Event): void {
    this.inputValue.set(Number((event.target as HTMLInputElement).value));
  }

  protected updateSelectedColumn(event: Event): void {
    this.selectedColumnKey.set((event.target as HTMLSelectElement).value);
  }

  protected updateSaveToWorksheet(event: Event): void {
    this.saveToWorksheet.set((event.target as HTMLInputElement).checked);
  }

  protected updateOutputColumnName(event: Event): void {
    this.outputColumnName.set((event.target as HTMLInputElement).value);
  }

  protected updateOperation(event: Event): void {
    this.operation.set((event.target as HTMLSelectElement).value as ProbabilityOperation);
  }

  protected updateParameter(key: string, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.parameterValues.update((parameters) => ({ ...parameters, [key]: value }));
  }

  protected updateParameterColumn(key: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.parameterColumnKeys.update((columns) => ({ ...columns, [key]: value }));
  }

  protected requiresIntegerInput(): boolean {
    return this.isDiscrete() && this.distribution() !== 'custom_discrete';
  }

  protected requiresNonNegativeInput(): boolean {
    return (
      this.isDiscrete() &&
      this.distribution() !== 'custom_discrete' &&
      this.distribution() !== 'integer_uniform'
    );
  }

  protected updateLower(event: Event): void {
    this.lower.set(Number((event.target as HTMLInputElement).value));
  }

  protected updateUpper(event: Event): void {
    this.upper.set(Number((event.target as HTMLInputElement).value));
  }

  protected async calculate(): Promise<void> {
    if (!this.canRun()) return;
    this.running.set(true);
    this.setStatus('info', 'Guardando el espacio y ejecutando el cálculo...');
    try {
      let datasetId = this.store.datasetId();
      if (!datasetId || this.store.dirty()) {
        const dataset = await this.persistence.saveCurrent();
        datasetId = dataset.id;
      }
      const run = await firstValueFrom(this.analysisApi.probability(datasetId, this.payload()));
      this.run.set(run);
      let storedColumn = '';
      if (
        this.saveToWorksheet() &&
        this.inputSource() === 'column' &&
        run.result.calculations.length
      ) {
        const values = run.result.calculations.map((row) =>
          row.status === 'valid' ? row.result : null,
        );
        storedColumn = this.store.addComputedColumn(this.outputColumnName(), values).name;
      }
      await this.historyDialog().refresh(datasetId);
      this.setStatus(
        'success',
        storedColumn
          ? `Cálculo #${run.id} guardado; se agregó la columna ${storedColumn}`
          : `Cálculo #${run.id} guardado y listo para interpretar`,
      );
      this.focusResult();
    } catch (error) {
      this.setStatus('error', this.describeError(error));
    } finally {
      this.running.set(false);
    }
  }

  protected async openHistory(summary: AnalysisRunSummary): Promise<void> {
    if (summary.analysis_type !== 'probability') return;
    this.setStatus('info', `Abriendo cálculo #${summary.id}...`);
    try {
      const run = this.normalizeRun(
        await firstValueFrom(this.analysisApi.get<ProbabilityResult>(summary.id)),
      );
      this.run.set(run);
      this.setStatus('success', `Cálculo #${run.id} abierto`);
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
    const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lobostats-probabilidad-${run.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected exampleText(): string {
    if (this.distribution() === 'binomial') {
      return 'Ejemplo: éxitos obtenidos en 10 intentos independientes';
    }
    if (this.distribution() === 'poisson') {
      return 'Ejemplo: llamadas recibidas durante una hora';
    }
    if (this.distribution() === 'normal') {
      return 'Ejemplo: puntajes que se concentran alrededor de una media';
    }
    return this.currentSpec()?.description ?? '';
  }

  protected modeDescription(): string {
    return {
      pdf: this.isDiscrete()
        ? 'Calcula la probabilidad de cada valor exacto'
        : 'Evalúa la altura de la función de densidad',
      cdf: 'Calcula la probabilidad acumulada hasta cada valor',
      inverse: 'Convierte una probabilidad acumulada en un cuantil',
      event: 'Combina límites para responder una pregunta de probabilidad',
    }[this.calculationMode()];
  }

  protected modeLabel(mode: ProbabilityMode): string {
    return {
      pdf: this.isDiscrete() ? 'Masa (PMF)' : 'Densidad (PDF)',
      cdf: 'Acumulada (CDF)',
      inverse: 'Inversa',
      event: 'Evento',
    }[mode];
  }

  protected resultIsPercentage(result: ProbabilityResult): boolean {
    return (
      result.mode === 'event' ||
      result.mode === 'cdf' ||
      (result.mode === 'pdf' && result.distribution.kind === 'discrete')
    );
  }

  protected primaryInput(result: ProbabilityResult): number {
    return result.calculations.find((row) => row.status === 'valid')?.input ?? 0;
  }

  protected inverseInterpretation(result: ProbabilityResult): string {
    const probability = this.formatNumber(this.primaryInput(result) * 100, 2);
    const quantile = this.formatNumber(result.result_value, 3);
    return `El ${probability} % de la distribución se encuentra en o por debajo del cuantil ${quantile}.`;
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

  protected chartX(index: number, total: number): number {
    return total <= 1 ? 360 : 54 + (index / (total - 1)) * 612;
  }

  protected chartY(value: number, points: ProbabilityPoint[]): number {
    const maximum = Math.max(...points.map((point) => point.value), Number.EPSILON);
    return 248 - (value / maximum) * 184;
  }

  protected barWidth(points: ProbabilityPoint[]): number {
    return Math.max(2, Math.min(20, (612 / Math.max(points.length, 1)) * 0.7));
  }

  protected curvePath(points: ProbabilityPoint[]): string {
    return points
      .map((point, index) => {
        const command = index === 0 ? 'M' : 'L';
        return `${command}${this.chartX(index, points.length)},${this.chartY(point.value, points)}`;
      })
      .join(' ');
  }

  protected selectedAreaPath(points: ProbabilityPoint[]): string {
    const selected = points
      .map((point, index) => ({ point, index }))
      .filter(({ point }) => point.selected);
    if (!selected.length) return '';
    const first = selected[0];
    const last = selected[selected.length - 1];
    const line = selected
      .map(
        ({ point, index }) =>
          `L${this.chartX(index, points.length)},${this.chartY(point.value, points)}`,
      )
      .join(' ');
    return `M${this.chartX(first.index, points.length)},248 ${line} L${this.chartX(last.index, points.length)},248 Z`;
  }

  protected distributionDescription(distribution: ProbabilityDistribution): string {
    return this.catalog().find((spec) => spec.key === distribution)?.description ?? '';
  }

  private payload(): ProbabilityAnalysisRequest {
    const common = {
      distribution: this.distribution(),
      mode: this.calculationMode(),
    };
    const calculation =
      this.calculationMode() === 'event'
        ? {
            operation: this.operation(),
            lower: this.lower(),
            ...(this.operation() === 'between' ? { upper: this.upper() } : {}),
          }
        : { input: this.probabilityInput() };
    return {
      ...common,
      ...calculation,
      ...this.resolvedParameters(),
    } as ProbabilityAnalysisRequest;
  }

  private configurationIsValid(): boolean {
    if (this.calculationMode() === 'event') {
      const lower = this.lower();
      if (!Number.isFinite(lower)) return false;
      if (
        this.operation() === 'between' &&
        (!Number.isFinite(this.upper()) || lower > this.upper())
      ) {
        return false;
      }
      if (this.requiresIntegerInput()) {
        const bounds = this.operation() === 'between' ? [lower, this.upper()] : [lower];
        if (bounds.some((value) => !Number.isInteger(value))) return false;
        if (this.requiresNonNegativeInput() && bounds.some((value) => value < 0)) return false;
      }
    } else if (this.inputSource() === 'constant') {
      const value = this.inputValue();
      if (!Number.isFinite(value)) return false;
      if (this.calculationMode() === 'inverse' && !(value > 0 && value < 1)) return false;
      if (
        this.calculationMode() !== 'inverse' &&
        this.requiresIntegerInput() &&
        !Number.isInteger(value)
      ) {
        return false;
      }
      if (this.calculationMode() !== 'inverse' && this.requiresNonNegativeInput() && value < 0) {
        return false;
      }
    } else if (!this.selectedColumnKey()) {
      return false;
    }
    const spec = this.currentSpec();
    if (!spec) return false;
    const parametersAreValid = spec.parameters.every((parameter) => {
      if (parameter.kind === 'column') return !!this.parameterColumnKeys()[parameter.key];
      const value = this.parameterValues()[parameter.key];
      if (!Number.isFinite(value)) return false;
      if (parameter.integer && !Number.isInteger(value)) return false;
      if (parameter.minimum !== null && value < parameter.minimum) return false;
      if (parameter.maximum !== null && value > parameter.maximum) return false;
      return true;
    });
    if (!parametersAreValid) return false;
    if (this.distribution() === 'custom_discrete') {
      const parameters = this.resolvedParameters();
      const values = parameters['custom_values'] as number[];
      const probabilities = parameters['custom_probabilities'] as number[];
      return (
        values.length > 0 &&
        values.length === probabilities.length &&
        new Set(values).size === values.length &&
        probabilities.every((value) => value >= 0) &&
        Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-9
      );
    }
    return true;
  }

  private resolvedParameters(): Record<string, number | number[]> {
    if (this.distribution() !== 'custom_discrete') return this.parameterValues();
    const valueKey = this.parameterColumnKeys()['custom_values'];
    const probabilityKey = this.parameterColumnKeys()['custom_probabilities'];
    const values: number[] = [];
    const probabilities: number[] = [];
    for (const row of this.store.rows()) {
      const value = row[valueKey];
      const probability = row[probabilityKey];
      if (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        typeof probability === 'number' &&
        Number.isFinite(probability)
      ) {
        values.push(value);
        probabilities.push(probability);
      }
    }
    return { custom_values: values, custom_probabilities: probabilities };
  }

  private probabilityInput(): ProbabilityAnalysisRequest['input'] {
    if (this.inputSource() === 'constant') {
      return { kind: 'constant', values: [this.inputValue()] };
    }
    const key = this.selectedColumnKey();
    return {
      kind: 'column',
      column_key: key,
      values: this.store.rows().map((row) => {
        const value = row[key];
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
      }),
    };
  }

  private refreshOutputName(): void {
    const distribution = this.currentSpec()?.label ?? this.distribution();
    const mode = { pdf: 'PDF', cdf: 'CDF', inverse: 'InvCDF', event: 'Evento' }[
      this.calculationMode()
    ];
    this.outputColumnName.set(`${mode}_${distribution}`);
  }

  private normalizeRun(run: AnalysisRun<ProbabilityResult>): AnalysisRun<ProbabilityResult> {
    if (run.result.mode) return run;
    const probability = run.result.probability ?? 0;
    return {
      ...run,
      result: {
        ...run.result,
        mode: 'event',
        calculation_label: 'Probabilidad del evento',
        result_value: probability,
        calculations: [
          {
            index: 0,
            input: run.result.event?.lower ?? null,
            result: probability,
            status: 'valid',
            error: null,
          },
        ],
        input: null,
        calculation_formula: run.result.event_formula ?? 'P(A)',
      },
    };
  }

  private focusResult(): void {
    const focus = (): void => this.resultHeading()?.nativeElement.focus();
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focus);
    else queueMicrotask(focus);
  }

  private async loadCatalog(): Promise<void> {
    try {
      const catalog = await firstValueFrom(this.analysisApi.probabilityCatalog());
      if (catalog.length) this.catalog.set(catalog);
    } catch {
      // The three core distributions remain available while the API is unavailable.
    }
  }

  private setStatus(kind: StatusKind, message: string): void {
    this.statusKind.set(kind);
    this.status.set(message);
  }

  private describeError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'No se pudo calcular la probabilidad';
    if (error.status === 0) return 'No se pudo conectar con el motor estadístico';
    if (error.status === 422) {
      const detail = error.error?.detail;
      return typeof detail === 'string' ? detail : 'Los parámetros del modelo no son válidos';
    }
    return 'El motor estadístico no pudo completar el cálculo';
  }
}
