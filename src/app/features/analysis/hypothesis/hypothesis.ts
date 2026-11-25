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
  HypothesisAlternative,
  HypothesisAnalysisRequest,
  HypothesisDesign,
  HypothesisResult,
  HypothesisTestKey,
  HypothesisTestSpec,
} from '../../../models/analysis';
import { DatasetColumn } from '../../../models/dataset';
import { AnalysisHistoryDialog } from '../../../shared/analysis-history/analysis-history-dialog';

type StatusKind = 'info' | 'success' | 'error';

const FALLBACK_TESTS: HypothesisTestSpec[] = [
  test('one_sample_z', 'Z de una muestra', 'Medias', 'one_numeric'),
  test('one_sample_t', 't de una muestra', 'Medias', 'one_numeric'),
  test('two_sample_t', 't de dos muestras', 'Medias', 'grouped_numeric'),
  test('paired_t', 't pareada', 'Medias', 'paired_numeric'),
  test('one_proportion', 'Una proporción', 'Proporciones y tasas', 'one_categorical'),
  test('two_proportions', 'Dos proporciones', 'Proporciones y tasas', 'grouped_categorical'),
  test('one_sample_poisson_rate', 'Tasa Poisson de una muestra', 'Proporciones y tasas', 'one_numeric'),
  test('two_sample_poisson_rate', 'Tasas Poisson de dos muestras', 'Proporciones y tasas', 'grouped_numeric'),
  test('one_variance', 'Una varianza', 'Dispersión', 'one_numeric'),
  test('two_variances', 'Dos varianzas', 'Dispersión', 'grouped_numeric'),
  test('correlation', 'Correlación', 'Asociación', 'paired_numeric'),
  test('chi_square_independence', 'Chi-cuadrado de independencia', 'Asociación', 'paired_categorical'),
  test('normality', 'Normalidad', 'Ajuste y aleatoriedad', 'one_numeric'),
  test('poisson_goodness_of_fit', 'Bondad de ajuste Poisson', 'Ajuste y aleatoriedad', 'one_numeric'),
  test('one_sample_sign', 'Signos de una muestra', 'No paramétricas', 'one_numeric'),
  test('one_sample_wilcoxon', 'Wilcoxon de una muestra', 'No paramétricas', 'one_numeric'),
  test('mann_whitney', 'Mann–Whitney', 'No paramétricas', 'grouped_numeric'),
  test('kruskal_wallis', 'Kruskal–Wallis', 'No paramétricas', 'grouped_numeric'),
  test('mood_median', 'Mediana de Mood', 'No paramétricas', 'grouped_numeric'),
  test('friedman', 'Friedman', 'No paramétricas', 'blocked_numeric'),
  test('runs', 'Prueba de corridas', 'Ajuste y aleatoriedad', 'one_numeric'),
];

const TWO_GROUP_TESTS = new Set<HypothesisTestKey>([
  'two_sample_t',
  'two_proportions',
  'two_sample_poisson_rate',
  'two_variances',
  'mann_whitney',
]);

const NO_NULL_VALUE = new Set<HypothesisTestKey>([
  'normality',
  'chi_square_independence',
  'poisson_goodness_of_fit',
  'kruskal_wallis',
  'mood_median',
  'friedman',
  'runs',
]);

@Component({
  selector: 'app-hypothesis',
  imports: [AnalysisHistoryDialog, RouterLink],
  templateUrl: './hypothesis.html',
  styleUrl: './hypothesis.scss',
})
export class Hypothesis {
  protected readonly store = inject(WorkspaceStore);
  private readonly persistence = inject(WorkspacePersistenceService);
  private readonly analysisApi = inject(AnalysisApi);
  private readonly productTour = inject(ProductTourService);
  private readonly resultHeading = viewChild<ElementRef<HTMLElement>>('resultHeading');
  private readonly historyDialog = viewChild.required<AnalysisHistoryDialog>('historyDialog');

  protected readonly catalog = signal<HypothesisTestSpec[]>(FALLBACK_TESTS);
  protected readonly selectedTest = signal<HypothesisTestKey>('one_sample_t');
  protected readonly column = signal(this.store.columns().find(isNumeric)?.key ?? '');
  protected readonly secondColumn = signal(
    this.store.columns().filter(isNumeric)[1]?.key ?? this.store.columns().find(isNumeric)?.key ?? '',
  );
  protected readonly groupBy = signal(this.store.columns().find((column) => !isNumeric(column))?.key ?? '');
  protected readonly blockBy = signal('');
  protected readonly firstGroup = signal('');
  protected readonly secondGroup = signal('');
  protected readonly hypothesizedValue = signal(0);
  protected readonly knownStdDev = signal(1);
  protected readonly alternative = signal<HypothesisAlternative>('two_sided');
  protected readonly confidencePercent = signal(95);
  protected readonly method = signal('auto');
  protected readonly successValue = signal('');
  protected readonly equalVariances = signal(false);
  protected readonly observationLength = signal(1);
  protected readonly secondObservationLength = signal(1);
  protected readonly sequenceCutoff = signal<number | null>(null);
  protected readonly running = signal(false);
  protected readonly run = signal<AnalysisRun<HypothesisResult> | null>(null);
  protected readonly status = signal('Selecciona una prueba y las variables que deseas contrastar');
  protected readonly statusKind = signal<StatusKind>('info');

  protected readonly categories = computed(() => [
    ...new Set(this.catalog().map((spec) => spec.category)),
  ]);
  protected readonly currentSpec = computed(
    () => this.catalog().find((spec) => spec.key === this.selectedTest()) ?? FALLBACK_TESTS[1],
  );
  protected readonly design = computed(() => this.currentSpec().design);
  protected readonly allColumns = computed(() => this.store.columns());
  protected readonly numericColumns = computed(() => this.store.columns().filter(isNumeric));
  protected readonly responseColumns = computed(() =>
    this.design().includes('categorical') ? this.allColumns() : this.numericColumns(),
  );
  protected readonly needsSecondColumn = computed(() => this.design().startsWith('paired'));
  protected readonly needsGroup = computed(
    () => this.design().startsWith('grouped') || this.design() === 'blocked_numeric',
  );
  protected readonly needsBlock = computed(() => this.design() === 'blocked_numeric');
  protected readonly needsSuccessValue = computed(() =>
    ['one_proportion', 'two_proportions'].includes(this.selectedTest()),
  );
  protected readonly needsNullValue = computed(() => !NO_NULL_VALUE.has(this.selectedTest()));
  protected readonly groupValues = computed(() => this.uniqueValues(this.groupBy()));
  protected readonly selectedFirstGroup = computed(
    () => this.firstGroup() || this.groupValues()[0] || '',
  );
  protected readonly selectedSecondGroup = computed(
    () => this.secondGroup() || this.groupValues()[1] || '',
  );
  protected readonly needsTwoGroups = computed(() => TWO_GROUP_TESTS.has(this.selectedTest()));
  protected readonly eventValues = computed(() => this.uniqueValues(this.column()));
  protected readonly methodOptions = computed(() => methodsFor(this.selectedTest()));
  protected readonly canRun = computed(() => {
    if (this.running() || !this.column() || !this.store.filledRows().length) return false;
    if (this.needsSecondColumn() && !this.secondColumn()) return false;
    if (this.needsGroup() && (!this.groupBy() || this.groupValues().length < 2)) return false;
    if (
      this.needsTwoGroups() &&
      (!this.selectedFirstGroup() ||
        !this.selectedSecondGroup() ||
        this.selectedFirstGroup() === this.selectedSecondGroup())
    ) {
      return false;
    }
    if (this.needsBlock() && !this.blockBy()) return false;
    if (this.needsSuccessValue() && this.successValue() === '') return false;
    if (this.selectedTest() === 'one_sample_z' && this.knownStdDev() <= 0) return false;
    return true;
  });

  constructor() {
    void this.loadCatalog();
  }

  protected startTour(event: Event): void {
    this.productTour.startHypothesisTour(event.currentTarget as HTMLElement);
  }

  protected selectTest(event: Event): void {
    const testKey = (event.target as HTMLSelectElement).value as HypothesisTestKey;
    this.selectedTest.set(testKey);
    this.method.set(methodsFor(testKey)[0]?.value ?? 'auto');
    this.run.set(null);
    queueMicrotask(() => {
      const columns = this.responseColumns();
      if (!columns.some((item) => item.key === this.column())) this.column.set(columns[0]?.key ?? '');
      if (!this.allColumns().some((item) => item.key === this.groupBy())) {
        this.groupBy.set(this.allColumns().find((item) => item.key !== this.column())?.key ?? '');
      }
      this.ensureSuccessValue();
    });
  }

  protected updateColumn(event: Event): void {
    this.column.set((event.target as HTMLSelectElement).value);
    this.ensureSuccessValue();
  }

  protected updateSecondColumn(event: Event): void {
    this.secondColumn.set((event.target as HTMLSelectElement).value);
  }

  protected updateGroupBy(event: Event): void {
    this.groupBy.set((event.target as HTMLSelectElement).value);
    this.firstGroup.set('');
    this.secondGroup.set('');
  }

  protected updateFirstGroup(event: Event): void {
    this.firstGroup.set((event.target as HTMLSelectElement).value);
  }

  protected updateSecondGroup(event: Event): void {
    this.secondGroup.set((event.target as HTMLSelectElement).value);
  }

  protected updateBlockBy(event: Event): void {
    this.blockBy.set((event.target as HTMLSelectElement).value);
  }

  protected updateSuccessValue(event: Event): void {
    this.successValue.set((event.target as HTMLSelectElement).value);
  }

  protected updateHypothesizedValue(event: Event): void {
    this.hypothesizedValue.set(Number((event.target as HTMLInputElement).value));
  }

  protected updateKnownStdDev(event: Event): void {
    this.knownStdDev.set(Number((event.target as HTMLInputElement).value));
  }

  protected updateAlternative(event: Event): void {
    this.alternative.set((event.target as HTMLSelectElement).value as HypothesisAlternative);
  }

  protected updateConfidence(event: Event): void {
    this.confidencePercent.set(Number((event.target as HTMLInputElement).value));
  }

  protected updateMethod(event: Event): void {
    this.method.set((event.target as HTMLSelectElement).value);
  }

  protected updateEqualVariances(event: Event): void {
    this.equalVariances.set((event.target as HTMLInputElement).checked);
  }

  protected updateObservationLength(event: Event): void {
    this.observationLength.set(Number((event.target as HTMLInputElement).value));
  }

  protected updateSecondObservationLength(event: Event): void {
    this.secondObservationLength.set(Number((event.target as HTMLInputElement).value));
  }

  protected updateSequenceCutoff(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.sequenceCutoff.set(value === '' ? null : Number(value));
  }

  protected async analyze(): Promise<void> {
    if (!this.canRun()) return;
    this.running.set(true);
    this.setStatus('info', 'Guardando la hoja y ejecutando el contraste…');
    try {
      let datasetId = this.store.datasetId();
      if (!datasetId || this.store.dirty()) datasetId = (await this.persistence.saveCurrent()).id;
      const analysis = await firstValueFrom(this.analysisApi.hypothesis(datasetId, this.payload()));
      this.run.set(analysis);
      await this.historyDialog().refresh(datasetId);
      this.setStatus(
        'success',
        analysis.result.decision === 'reject'
          ? `Análisis #${analysis.id}: se rechaza H₀`
          : `Análisis #${analysis.id}: no se rechaza H₀`,
      );
      this.focusResult();
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
    if (summary.analysis_type !== 'hypothesis') return;
    this.setStatus('info', `Abriendo análisis #${summary.id}…`);
    try {
      const analysis = await firstValueFrom(this.analysisApi.get<HypothesisResult>(summary.id));
      this.run.set(analysis);
      this.setStatus(
        analysis.is_stale ? 'info' : 'success',
        analysis.is_stale
          ? `Análisis #${analysis.id} corresponde a una revisión anterior`
          : `Análisis #${analysis.id} abierto`,
      );
      this.focusResult();
    } catch (error) {
      this.setStatus('error', this.describeError(error));
    }
  }

  protected downloadResult(): void {
    const analysis = this.run();
    if (!analysis) return;
    const blob = new Blob([JSON.stringify(analysis, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lobostats-hipotesis-${analysis.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected formatNumber(value: unknown, digits = 5): string {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    return new Intl.NumberFormat('es-MX', { maximumFractionDigits: digits }).format(Number(value));
  }

  protected formatDegrees(value: number | number[] | null): string {
    if (Array.isArray(value)) return value.map((item) => this.formatNumber(item, 2)).join(', ');
    return this.formatNumber(value, 2);
  }

  protected detail(key: string): unknown {
    return this.run()?.result.result.details[key];
  }

  protected groups(): Record<string, unknown>[] {
    const groups = this.detail('groups');
    return Array.isArray(groups) ? (groups as Record<string, unknown>[]) : [];
  }

  protected tableRows(): { label: string; observed: unknown[]; expected: unknown[] }[] {
    const details = this.run()?.result.result.details;
    const observed = details?.['observed'];
    const expected = details?.['expected'];
    const rowLabels = details?.['row_labels'];
    if (!Array.isArray(observed) || !Array.isArray(expected)) return [];
    if (observed.length && Array.isArray(observed[0])) {
      return observed.map((row, index) => ({
        label: Array.isArray(rowLabels) ? String(rowLabels[index]) : String(index + 1),
        observed: row as unknown[],
        expected: expected[index] as unknown[],
      }));
    }
    return observed.map((value, index) => ({
      label: Array.isArray(details?.['categories']) ? String(details?.['categories'][index]) : String(index),
      observed: [value],
      expected: [expected[index]],
    }));
  }

  private payload(): HypothesisAnalysisRequest {
    const testKey = this.selectedTest();
    const payload: HypothesisAnalysisRequest = {
      test: testKey,
      column: this.column(),
      hypothesized_value: this.hypothesizedValue(),
      alternative: this.alternative(),
      confidence_level: this.confidencePercent() / 100,
      method: this.method(),
    };
    if (this.needsSecondColumn()) payload.second_column = this.secondColumn();
    if (this.needsGroup()) payload.group_by = this.groupBy();
    if (this.needsBlock()) payload.block_by = this.blockBy();
    if (TWO_GROUP_TESTS.has(testKey)) {
      payload.groups = [this.selectedFirstGroup(), this.selectedSecondGroup()];
    }
    if (this.needsSuccessValue()) payload.success_value = this.successValue();
    if (testKey === 'one_sample_z') payload.known_std_dev = this.knownStdDev();
    if (testKey === 'two_sample_t') payload.equal_variances = this.equalVariances();
    if (testKey.includes('poisson_rate')) {
      payload.observation_length = this.observationLength();
      payload.second_observation_length = this.secondObservationLength();
    }
    if (testKey === 'runs' && this.sequenceCutoff() !== null) {
      payload.sequence_cutoff = this.sequenceCutoff() as number;
    }
    return payload;
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
    ].slice(0, 100);
  }

  private ensureSuccessValue(): void {
    const values = this.eventValues();
    if (!values.includes(this.successValue())) this.successValue.set(values[0] ?? '');
  }

  private async loadCatalog(): Promise<void> {
    try {
      const catalog = await firstValueFrom(this.analysisApi.hypothesisCatalog());
      if (catalog.length) this.catalog.set(catalog);
    } catch {
      // The Minitab 15 fallback catalog keeps the form usable while the API is unavailable.
    }
  }

  private focusResult(): void {
    requestAnimationFrame(() => this.resultHeading()?.nativeElement.focus());
  }

  private setStatus(kind: StatusKind, message: string): void {
    this.statusKind.set(kind);
    this.status.set(message);
  }

  private describeError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'No se pudo ejecutar la prueba';
    if (error.status === 0) return 'No se pudo conectar con el motor estadístico';
    if (error.status === 422 && typeof error.error?.detail === 'string') return error.error.detail;
    return 'El motor no pudo completar la prueba con la configuración indicada';
  }
}

function test(
  key: HypothesisTestKey,
  label: string,
  category: string,
  design: HypothesisDesign,
): HypothesisTestSpec {
  return { key, label, category, design, description: '' };
}

function isNumeric(column: DatasetColumn): boolean {
  return column.data_type === 'number';
}

function methodsFor(testKey: HypothesisTestKey): { value: string; label: string }[] {
  if (testKey === 'normality') {
    return [
      { value: 'anderson_darling', label: 'Anderson–Darling' },
      { value: 'ryan_joiner', label: 'Ryan–Joiner' },
      { value: 'kolmogorov_smirnov', label: 'Kolmogórov–Smirnov' },
    ];
  }
  if (testKey === 'correlation') {
    return [
      { value: 'pearson', label: 'Pearson' },
      { value: 'spearman', label: 'Spearman' },
    ];
  }
  if (['one_proportion', 'two_proportions', 'chi_square_independence'].includes(testKey)) {
    return [
      { value: 'auto', label: 'Automático / aproximación' },
      { value: 'exact', label: 'Exacto' },
      { value: 'normal', label: 'Aproximación normal' },
    ];
  }
  if (testKey.includes('poisson_rate')) {
    return [
      { value: 'exact', label: 'Exacto' },
      { value: 'normal', label: 'Aproximación normal' },
    ];
  }
  return [{ value: 'auto', label: 'Método predeterminado' }];
}
