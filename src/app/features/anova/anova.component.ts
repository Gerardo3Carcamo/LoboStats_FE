import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import type { Data, Layout } from 'plotly.js';
import { AnalysisField, AnalysisOperation } from '../../core/models/analysis.model';
import { ApiResult } from '../../core/models/dataset.model';
import { AnalysisService } from '../../core/services/analysis.service';
import { DataService } from '../../core/services/data.service';
import { ResultViewerComponent } from '../../shared/result-viewer/result-viewer.component';
import { PlotlyChartComponent } from '../../shared/plotly-chart/plotly-chart.component';

const ANOVA_OPERATIONS: AnalysisOperation[] = [
  operation('one-way', 'One-way', 'Compara medias de una respuesta entre niveles de un factor.', [variable('value_column', 'Variable de respuesta'), variable('group_column', 'Factor')]),
  operation('two-way', 'Two-way', 'Estima dos efectos principales y su interacción.', [variable('value_column', 'Variable de respuesta'), variable('factor_a', 'Factor A'), variable('factor_b', 'Factor B'), choice('interaction', 'Incluir interacción', [[true, 'Sí'], [false, 'No']], true), choice('typ', 'Tipo de sumas de cuadrados', [[1, 'Tipo I'], [2, 'Tipo II'], [3, 'Tipo III']], 2)]),
  operation('repeated-measures', 'Medidas repetidas', 'Modela observaciones relacionadas del mismo sujeto.', [variable('value', 'Variable de respuesta'), variable('subject', 'Sujeto'), variable('within', 'Factor intra-sujeto')]),
  operation('post-hoc', 'Post-hoc', 'Localiza diferencias después de un contraste global.', [variable('value_column', 'Variable de respuesta'), variable('group_column', 'Factor'), choice('method', 'Método', [['tukey', 'Tukey HSD'], ['bonferroni', 'Bonferroni'], ['scheffe', 'Scheffé']], 'tukey')]),
  operation('main-effects', 'Efectos principales', 'Resume el efecto aislado de cada factor.', [variable('value_column', 'Variable de respuesta'), variable('factor_a', 'Factor A'), variable('factor_b', 'Factor B'), choice('typ', 'Tipo de sumas de cuadrados', [[1, 'Tipo I'], [2, 'Tipo II'], [3, 'Tipo III']], 2)]),
  operation('interaction', 'Interacción', 'Evalúa si el efecto de un factor depende del otro.', [variable('value_column', 'Variable de respuesta'), variable('factor_a', 'Factor A'), variable('factor_b', 'Factor B'), choice('typ', 'Tipo de sumas de cuadrados', [[1, 'Tipo I'], [2, 'Tipo II'], [3, 'Tipo III']], 2)]),
];

@Component({
  selector: 'app-anova',
  imports: [RouterLink, FormsModule, MatButtonModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule, ResultViewerComponent, PlotlyChartComponent],
  templateUrl: './anova.component.html',
})
export class AnovaComponent {
  protected readonly data = inject(DataService);
  protected readonly analysis = inject(AnalysisService);
  protected readonly operations = ANOVA_OPERATIONS;
  protected readonly selectedId = signal(ANOVA_OPERATIONS[0].id);
  protected readonly operation = computed(() => ANOVA_OPERATIONS.find((item) => item.id === this.selectedId()) ?? ANOVA_OPERATIONS[0]);
  protected readonly result = signal<ApiResult | null>(null);
  protected readonly plotData = signal<Data[] | null>(null);
  protected readonly plotLayout = signal<Partial<Layout>>({});
  protected values: Record<string, unknown> = {};
  protected alpha = 0.05;

  constructor() { this.reset(); }

  protected select(id: string): void { this.selectedId.set(id); this.reset(); }

  protected canRun(): boolean {
    return this.operation().fields.every((field) => !field.required || this.values[field.key] !== '' && this.values[field.key] !== undefined);
  }

  protected createPayload(): Record<string, unknown> {
    return { dataset_id: this.data.dataset()?.id, alpha: this.alpha, ...this.values };
  }

  protected run(): void {
    if (!this.data.dataset() || !this.canRun()) return;
    this.analysis.run(this.operation().endpoint, this.createPayload()).subscribe({ next: (result) => { this.result.set(result); this.buildEffectPlot(result); }, error: () => undefined });
  }

  private reset(): void {
    this.values = Object.fromEntries(this.operation().fields.map((field) => [field.key, field.defaultValue ?? '']));
    this.result.set(null);
    this.plotData.set(null);
  }

  private buildEffectPlot(result: ApiResult): void {
    if (!['main-effects', 'interaction'].includes(this.selectedId())) return;
    const results = asRecord(result['results']);
    const cells = Array.isArray(results['cell_means']) ? results['cell_means'].map(asRecord) : [];
    if (!cells.length) return;
    if (this.selectedId() === 'interaction') {
      const levels = [...new Set(cells.map((row) => String(row['factor_b'])))];
      this.plotData.set(levels.map((level) => ({
        type: 'scatter', mode: 'lines+markers', name: level,
        x: cells.filter((row) => String(row['factor_b']) === level).map((row) => String(row['factor_a'])),
        y: cells.filter((row) => String(row['factor_b']) === level).map((row) => Number(row['mean'])),
      })) as Data[]);
      this.plotLayout.set({ title: { text: 'Interacción entre factores' }, xaxis: { title: { text: String(this.values['factor_a']) } }, yaxis: { title: { text: 'Media' } } });
      return;
    }
    const factorMeans = (factor: 'factor_a' | 'factor_b') => [...new Set(cells.map((row) => String(row[factor])))].map((level) => {
      const values = cells.filter((row) => String(row[factor]) === level).map((row) => Number(row['mean']));
      return { level, mean: values.reduce((sum, value) => sum + value, 0) / values.length };
    });
    const a = factorMeans('factor_a'); const b = factorMeans('factor_b');
    this.plotData.set([
      { type: 'scatter', mode: 'lines+markers', name: String(this.values['factor_a']), x: a.map((row) => row.level), y: a.map((row) => row.mean) },
      { type: 'scatter', mode: 'lines+markers', name: String(this.values['factor_b']), x: b.map((row) => row.level), y: b.map((row) => row.mean) },
    ] as Data[]);
    this.plotLayout.set({ title: { text: 'Efectos principales' }, yaxis: { title: { text: 'Media' } } });
  }
}

function variable(key: string, label: string): AnalysisField { return { key, label, type: 'variable', required: true }; }
function choice(key: string, label: string, options: [unknown, string][], defaultValue: unknown): AnalysisField { return { key, label, type: 'choice', required: true, defaultValue, options: options.map(([value, optionLabel]) => ({ value, label: optionLabel })) }; }
function operation(id: string, label: string, description: string, fields: AnalysisField[]): AnalysisOperation {
  return { id, label, description, endpoint: `anova/${id}`, fields };
}

function asRecord(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
