import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { AnalysisCategory, AnalysisOperation } from '../../core/models/analysis.model';
import { ApiResult } from '../../core/models/dataset.model';
import { AnalysisService } from '../../core/services/analysis.service';
import { DataService } from '../../core/services/data.service';
import { ResultViewerComponent } from '../../shared/result-viewer/result-viewer.component';

const CATEGORIES: AnalysisCategory[] = [
  { id: 'basic', label: 'Descriptiva avanzada', operations: [
    { id: 'summary', label: 'Resumen descriptivo', endpoint: 'descriptive/summary', description: 'Calcula tendencia central, dispersión, forma y normalidad.', fields: [variables()] },
    { id: 'frequencies', label: 'Tabla de frecuencias', endpoint: 'descriptive/frequencies', description: 'Cuenta valores y calcula sus porcentajes.', fields: [variable('column')] },
    { id: 'confidence-interval', label: 'Intervalo de confianza', endpoint: 'basic-stats/confidence-interval', description: 'Estima un rango plausible para una media o mediana.', fields: [variable('column'), choiceField('statistic', 'Parámetro', [['mean', 'Media'], ['median', 'Mediana']], 'mean'), number('confidence', 'Confianza', 0.95)] },
    { id: 'z-test', label: 'Z de una muestra', endpoint: 'basic-stats/z-test', description: 'Contrasta una media cuando la desviación poblacional es conocida.', fields: [variable('column'), number('null_mean', 'Media hipotética', 0), number('population_std', 'Desviación poblacional', 1), number('alpha', 'Nivel α', 0.05)] },
    { id: 'by-group', label: 'Resumen por grupos', endpoint: 'basic-stats/by-group', description: 'Compara medidas descriptivas entre niveles.', fields: [variable('value_column', 'Variable numérica'), variable('group_column', 'Variable de grupo')] },
    { id: 'correlation-matrix', label: 'Matriz de correlación', endpoint: 'basic-stats/correlation-matrix', description: 'Explora relaciones entre variables.', fields: [variables(), choiceField('method', 'Método', [['pearson', 'Pearson'], ['spearman', 'Spearman'], ['kendall', 'Kendall']], 'pearson')] },
    { id: 'covariance-matrix', label: 'Matriz de covarianza', endpoint: 'basic-stats/covariance-matrix', description: 'Cuantifica la variación conjunta.', fields: [variables()] },
  ]},
  { id: 'parametric', label: 'Pruebas paramétricas', operations: [
    { id: 't-one', label: 't de una muestra', endpoint: 'hypothesis/t-test', description: 'Contrasta una media frente a un valor conocido.', fields: [variable('column'), number('popmean', 'Media hipotética', 0), hiddenChoice('type', 'one-sample'), number('alpha', 'Nivel α', 0.05)] },
    { id: 't-independent', label: 't independiente', endpoint: 'hypothesis/t-test', description: 'Compara dos grupos independientes con corrección de Welch.', fields: [variable('value_column', 'Variable numérica'), variable('group_column', 'Variable de grupo'), text('group1', 'Grupo 1'), text('group2', 'Grupo 2'), hiddenChoice('type', 'independent'), number('alpha', 'Nivel α', 0.05)] },
    { id: 't-paired', label: 't pareada', endpoint: 'hypothesis/t-test', description: 'Compara dos mediciones relacionadas.', fields: [variable('column1', 'Primera medición'), variable('column2', 'Segunda medición'), hiddenChoice('type', 'paired'), number('alpha', 'Nivel α', 0.05)] },
    { id: 'chi-square', label: 'Chi-cuadrado', endpoint: 'hypothesis/chi-square', description: 'Evalúa asociación entre dos variables categóricas.', fields: [variable('row_column', 'Variable de filas'), variable('column_column', 'Variable de columnas'), number('alpha', 'Nivel α', 0.05)] },
  ]},
  { id: 'variance', label: 'Normalidad y varianzas', operations: [
    { id: 'normality', label: 'Normalidad', endpoint: 'variance/normality', description: 'Evalúa el supuesto de distribución normal.', fields: [variable('column'), choiceField('method', 'Método', [['shapiro', 'Shapiro-Wilk'], ['anderson', 'Anderson-Darling'], ['kolmogorov-smirnov', 'Kolmogorov-Smirnov'], ['dagostino', "D'Agostino-Pearson"]], 'shapiro'), number('alpha', 'Nivel α', 0.05)] },
    { id: 'levene', label: 'Levene', endpoint: 'variance/levene', description: 'Contrasta homogeneidad de varianzas con robustez.', fields: groupedFields() },
    { id: 'bartlett', label: 'Bartlett', endpoint: 'variance/bartlett', description: 'Contrasta varianzas bajo normalidad.', fields: groupedFields() },
  ]},
  { id: 'nonparametric', label: 'No paramétricas', operations: [
    { id: 'mann-whitney', label: 'Mann-Whitney', endpoint: 'nonparametric/mann-whitney', description: 'Compara dos muestras independientes.', fields: [variable('column1', 'Primera muestra'), variable('column2', 'Segunda muestra'), number('alpha', 'Nivel α', 0.05)] },
    { id: 'wilcoxon', label: 'Wilcoxon', endpoint: 'nonparametric/wilcoxon', description: 'Compara dos mediciones relacionadas.', fields: [variable('column1', 'Primera medición'), variable('column2', 'Segunda medición'), number('alpha', 'Nivel α', 0.05)] },
    { id: 'kruskal-wallis', label: 'Kruskal-Wallis', endpoint: 'nonparametric/kruskal-wallis', description: 'Compara tres o más grupos independientes.', fields: groupedFields() },
    { id: 'friedman', label: 'Friedman', endpoint: 'nonparametric/friedman', description: 'Compara mediciones repetidas por rangos.', fields: [variables('columns', 'Mediciones'), number('alpha', 'Nivel α', 0.05)] },
    { id: 'sign-test', label: 'Prueba de signos', endpoint: 'nonparametric/sign-test', description: 'Contrasta una mediana por signos.', fields: [variable('column'), number('median', 'Mediana hipotética', 0), number('alpha', 'Nivel α', 0.05)] },
  ]},
  { id: 'proportion', label: 'Proporciones', operations: [
    { id: 'one-sample', label: 'Una proporción', endpoint: 'proportion/one-sample', description: 'Contrasta una proporción observada a partir de conteos.', fields: [number('successes', 'Éxitos', 60), number('nobs', 'Observaciones', 100), number('null_proportion', 'Proporción hipotética', 0.5), number('alpha', 'Nivel α', 0.05)] },
    { id: 'two-sample', label: 'Dos proporciones', endpoint: 'proportion/two-sample', description: 'Compara proporciones de dos muestras independientes.', fields: [number('successes1', 'Éxitos muestra 1', 60), number('nobs1', 'Tamaño muestra 1', 100), number('successes2', 'Éxitos muestra 2', 45), number('nobs2', 'Tamaño muestra 2', 100), number('alpha', 'Nivel α', 0.05)] },
  ]},
  { id: 'correlation', label: 'Correlación', operations: [
    { id: 'pearson', label: 'Pearson', endpoint: 'hypothesis/correlation', description: 'Mide asociación lineal.', fields: pairFields() },
    { id: 'spearman', label: 'Spearman', endpoint: 'correlation/spearman', description: 'Mide asociación monotónica por rangos.', fields: pairFields() },
    { id: 'kendall', label: 'Kendall', endpoint: 'correlation/kendall', description: 'Mide concordancia ordinal.', fields: pairFields() },
    { id: 'partial', label: 'Correlación parcial', endpoint: 'correlation/partial', description: 'Controla el efecto de otras variables.', fields: [...pairFields(), variables('controls', 'Variables de control')] },
  ]},
  { id: 'power', label: 'Potencia', operations: [
    { id: 't-test', label: 'Potencia de t-test', endpoint: 'power/t-test', description: 'Relaciona tamaño del efecto, muestra y potencia.', fields: powerFields() },
    { id: 'anova', label: 'Potencia de ANOVA', endpoint: 'power/anova', description: 'Planifica potencia para comparación de grupos.', fields: [...powerFields(), number('groups', 'Número de grupos', 3)] },
    { id: 'sample-size', label: 'Tamaño de muestra', endpoint: 'power/sample-size', description: 'Calcula observaciones necesarias.', fields: [choiceField('test', 'Diseño', [['t-test', 't pareada/una muestra'], ['t-test-independent', 't independiente'], ['anova', 'ANOVA']], 't-test-independent'), number('effect_size', 'Tamaño del efecto', 0.5), number('power', 'Potencia objetivo', 0.8), number('alpha', 'Nivel α', 0.05)] },
  ]},
];

@Component({
  selector: 'app-statistics',
  imports: [RouterLink, FormsModule, MatButtonModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule, ResultViewerComponent],
  templateUrl: './statistics.component.html',
})
export class StatisticsComponent {
  protected readonly data = inject(DataService);
  protected readonly analysis = inject(AnalysisService);
  protected readonly categories = CATEGORIES;
  protected readonly categoryId = signal(CATEGORIES[0].id);
  protected readonly operationId = signal(CATEGORIES[0].operations[0].id);
  protected readonly result = signal<ApiResult | null>(null);
  protected values: Record<string, unknown> = {};
  protected readonly category = computed(() => CATEGORIES.find((item) => item.id === this.categoryId()) ?? CATEGORIES[0]);
  protected readonly operation = computed(() => this.category().operations.find((item) => item.id === this.operationId()) ?? this.category().operations[0]);

  constructor() { this.resetValues(this.operation()); }

  protected selectCategory(id: string): void {
    this.categoryId.set(id);
    const operation = CATEGORIES.find((item) => item.id === id)?.operations[0] ?? CATEGORIES[0].operations[0];
    this.operationId.set(operation.id);
    this.resetValues(operation);
  }

  protected selectOperation(id: string): void {
    this.operationId.set(id);
    this.resetValues(this.operation());
  }

  protected canRun(): boolean {
    return this.operation().fields.every((field) => !field.required || (Array.isArray(this.values[field.key]) ? (this.values[field.key] as unknown[]).length > 0 : this.values[field.key] !== '' && this.values[field.key] !== undefined));
  }

  protected createPayload(): Record<string, unknown> {
    const dataset = this.data.dataset();
    const payload: Record<string, unknown> = { dataset_id: dataset?.id, ...Object.fromEntries(Object.entries(this.values).filter(([, value]) => value !== '' && value !== undefined)) };
    if (this.operation().id === 't-independent') {
      payload['groups'] = [payload['group1'], payload['group2']];
      delete payload['group1']; delete payload['group2'];
    }
    if (this.operation().endpoint === 'proportion/two-sample') {
      payload['successes'] = [Number(payload['successes1']), Number(payload['successes2'])];
      payload['nobs'] = [Number(payload['nobs1']), Number(payload['nobs2'])];
      for (const key of ['successes1', 'successes2', 'nobs1', 'nobs2']) delete payload[key];
    }
    return payload;
  }

  protected resultAlpha(): number {
    const value = Number(this.values['alpha']);
    return Number.isFinite(value) ? value : 0.05;
  }

  protected run(): void {
    if (!this.data.dataset() || !this.canRun()) return;
    this.analysis.run(this.operation().endpoint, this.createPayload()).subscribe({ next: (result) => this.result.set(result), error: () => undefined });
  }

  private resetValues(operation: AnalysisOperation): void {
    this.values = Object.fromEntries(operation.fields.map((field) => [field.key, field.defaultValue ?? (field.type === 'variables' ? [] : '')]));
    this.result.set(null);
  }
}

function variable(key: string, label = 'Variable'): import('../../core/models/analysis.model').AnalysisField { return { key, label, type: 'variable', required: true }; }
function variables(key = 'columns', label = 'Variables'): import('../../core/models/analysis.model').AnalysisField { return { key, label, type: 'variables', required: true }; }
function number(key: string, label: string, defaultValue: number): import('../../core/models/analysis.model').AnalysisField { return { key, label, type: 'number', required: true, defaultValue }; }
function text(key: string, label: string): import('../../core/models/analysis.model').AnalysisField { return { key, label, type: 'text', required: true }; }
function choiceField(key: string, label: string, options: [unknown, string][], defaultValue: unknown): import('../../core/models/analysis.model').AnalysisField { return { key, label, type: 'choice', required: true, defaultValue, options: options.map(([value, optionLabel]) => ({ value, label: optionLabel })) }; }
function hiddenChoice(key: string, value: string): import('../../core/models/analysis.model').AnalysisField { return { key, label: '', type: 'choice', required: true, defaultValue: value, options: [{ value, label: value }], hint: 'hidden' }; }
function groupedFields(): import('../../core/models/analysis.model').AnalysisField[] { return [variable('value_column', 'Variable numérica'), variable('group_column', 'Variable de grupo'), number('alpha', 'Nivel α', 0.05)]; }
function pairFields(): import('../../core/models/analysis.model').AnalysisField[] { return [variable('x', 'Variable X'), variable('y', 'Variable Y'), number('alpha', 'Nivel α', 0.05)]; }
function powerFields(): import('../../core/models/analysis.model').AnalysisField[] { return [number('effect_size', 'Tamaño del efecto', 0.5), number('sample_size', 'Tamaño de muestra', 30), number('alpha', 'Nivel α', 0.05)]; }
