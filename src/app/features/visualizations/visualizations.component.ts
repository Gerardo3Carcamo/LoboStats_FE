import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ChartData, ChartOptions, ChartType } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import type { Data, Layout } from 'plotly.js';
import { ApiResult } from '../../core/models/dataset.model';
import { AnalysisService } from '../../core/services/analysis.service';
import { DataService } from '../../core/services/data.service';
import { PlotlyChartComponent } from '../../shared/plotly-chart/plotly-chart.component';

type ChartField = 'column' | 'x_column' | 'y_column' | 'z_column' | 'group_column' | 'size_column' | 'columns';
interface ChartDefinition { id: string; label: string; category: string; fields: ChartField[]; advanced?: boolean; }

const CHARTS: ChartDefinition[] = [
  { id: 'histogram', label: 'Histograma', category: 'Distribución', fields: ['column'] },
  { id: 'boxplot', label: 'Boxplot', category: 'Distribución', fields: ['column', 'group_column'], advanced: true },
  { id: 'qq', label: 'Q-Q', category: 'Distribución', fields: ['column'], advanced: true },
  { id: 'violin', label: 'Violín', category: 'Distribución', fields: ['column', 'group_column'], advanced: true },
  { id: 'dot', label: 'Puntos', category: 'Distribución', fields: ['column'] },
  { id: 'bar', label: 'Barras', category: 'Comparación', fields: ['x_column', 'y_column'] },
  { id: 'pareto', label: 'Pareto', category: 'Comparación', fields: ['column'] },
  { id: 'interval', label: 'Intervalos', category: 'Comparación', fields: ['x_column', 'y_column'] },
  { id: 'scatter', label: 'Dispersión', category: 'Relación', fields: ['x_column', 'y_column'] },
  { id: 'bubble', label: 'Burbujas', category: 'Relación', fields: ['x_column', 'y_column', 'size_column'], advanced: true },
  { id: 'scatter-3d', label: 'Dispersión 3D', category: 'Relación', fields: ['x_column', 'y_column', 'z_column'], advanced: true },
  { id: 'pie', label: 'Circular', category: 'Composición', fields: ['column'] },
  { id: 'line', label: 'Línea', category: 'Series', fields: ['x_column', 'y_column'] },
  { id: 'area', label: 'Área', category: 'Series', fields: ['x_column', 'y_column'] },
  { id: 'pairplot', label: 'Pairplot', category: 'Multivariante', fields: ['columns'], advanced: true },
  { id: 'heatmap', label: 'Mapa de calor', category: 'Multivariante', fields: ['columns'], advanced: true },
];

@Component({
  selector: 'app-visualizations',
  imports: [RouterLink, FormsModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatSelectModule, BaseChartDirective, PlotlyChartComponent],
  providers: [provideCharts(withDefaultRegisterables())],
  templateUrl: './visualizations.component.html',
})
export class VisualizationsComponent {
  protected readonly data = inject(DataService);
  protected readonly analysis = inject(AnalysisService);
  protected readonly charts = CHARTS;
  protected readonly categories = [...new Set(CHARTS.map((chart) => chart.category))];
  protected readonly category = signal(CHARTS[0].category);
  protected readonly kind = signal(CHARTS[0].id);
  protected readonly current = computed(() => CHARTS.find((chart) => chart.id === this.kind()) ?? CHARTS[0]);
  protected readonly available = computed(() => CHARTS.filter((chart) => chart.category === this.category()));
  protected readonly chartData = signal<ChartData | null>(null);
  protected readonly chartType = signal<ChartType>('bar');
  protected readonly plotData = signal<Data[] | null>(null);
  protected readonly plotLayout = signal<Partial<Layout>>({});
  protected values: Record<ChartField, string | string[]> = { column: '', x_column: '', y_column: '', z_column: '', group_column: '', size_column: '', columns: [] };
  protected readonly labels: Record<ChartField, string> = { column: 'Variable', x_column: 'Eje X', y_column: 'Eje Y', z_column: 'Eje Z', group_column: 'Agrupar por (opcional)', size_column: 'Tamaño', columns: 'Variables' };
  protected readonly chartOptions: ChartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#496070', font: { family: 'Manrope' } } } },
    scales: { x: { ticks: { color: '#617483' }, grid: { color: 'rgba(11,19,32,.07)' } }, y: { ticks: { color: '#617483' }, grid: { color: 'rgba(11,19,32,.07)' } } },
  };

  protected selectCategory(category: string): void { this.category.set(category); this.selectKind(CHARTS.find((chart) => chart.category === category)?.id ?? CHARTS[0].id); }
  protected selectKind(kind: string): void { this.kind.set(kind); this.chartData.set(null); this.plotData.set(null); }

  protected canRun(): boolean {
    return this.current().fields.filter((field) => field !== 'group_column').every((field) => Array.isArray(this.values[field]) ? this.values[field].length > 0 : Boolean(this.values[field]));
  }

  protected createPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = { dataset_id: this.data.dataset()?.id, ...Object.fromEntries(this.current().fields.map((field) => [field, this.values[field]]).filter(([, value]) => Array.isArray(value) ? value.length : value)) };
    const move = (from: ChartField, to: string) => { if (payload[from] !== undefined) { payload[to] = payload[from]; delete payload[from]; } };
    if (['boxplot', 'violin'].includes(this.kind())) move('group_column', 'group_by');
    if (['scatter', 'line', 'area'].includes(this.kind())) { move('x_column', 'x'); move('y_column', 'y'); }
    if (this.kind() === 'bar') { move('x_column', 'category'); move('y_column', 'value'); }
    if (['pie', 'pareto'].includes(this.kind())) move('column', 'category');
    if (this.kind() === 'interval') { move('x_column', 'group'); move('y_column', 'value'); }
    if (this.kind() === 'bubble') { move('x_column', 'x'); move('y_column', 'y'); move('size_column', 'size'); }
    if (this.kind() === 'scatter-3d') { move('x_column', 'x'); move('y_column', 'y'); move('z_column', 'z'); }
    return payload;
  }

  protected run(): void {
    if (!this.data.dataset() || !this.canRun()) return;
    this.analysis.run(`charts/${this.kind()}`, this.createPayload()).subscribe({ next: (result) => this.current().advanced ? this.buildPlotly(result) : this.buildChartJs(result), error: () => undefined });
  }

  private buildChartJs(result: ApiResult): void {
    const source = record(result['results'] ?? result);
    this.plotData.set(null);
    if (Array.isArray(source['datasets'])) {
      this.chartType.set((source['type'] as ChartType) ?? this.typeForKind());
      this.chartData.set({ labels: array(source['labels']).map(String), datasets: source['datasets'] } as ChartData);
      return;
    }
    const labels = array(source['labels'] ?? source['bins'] ?? source['bin_edges'] ?? source['categories'] ?? source['x']).map(String);
    const values = array(source['counts'] ?? source['frequencies'] ?? source['values'] ?? source['y']).map(Number);
    if (this.kind() === 'scatter') {
      const points = array(source['points']).map((point) => pointData(point));
      const regression = array(source['regression_line']).map((point) => pointData(point));
      this.chartType.set('scatter');
      this.chartData.set({ datasets: [
        { label: this.current().label, data: points, backgroundColor: '#187a76' },
        { label: 'Regresión', type: 'line', data: regression, borderColor: '#ef7564', pointRadius: 0 },
      ] } as ChartData);
    } else if (['bar', 'pie', 'pareto'].includes(this.kind())) {
      const series = array(source['series']).map(record);
      const seriesLabels = series.map((row) => String(row['category']));
      const seriesValues = series.map((row) => Number(row['value']));
      this.chartType.set(this.typeForKind());
      const datasets: ChartData['datasets'] = [{ label: this.current().label, data: seriesValues, backgroundColor: this.kind() === 'pie' ? ['#187a76', '#62d9d2', '#ef7564', '#7792a4', '#d4b36a'] : 'rgba(98,217,210,.7)', borderColor: '#187a76', borderWidth: 1 }];
      if (this.kind() === 'pareto') datasets.push({ label: 'Acumulado %', type: 'line', data: series.map((row) => Number(row['cumulative_percentage'])), borderColor: '#ef7564', backgroundColor: '#ef7564' });
      this.chartData.set({ labels: seriesLabels, datasets });
    } else if (['line', 'area'].includes(this.kind())) {
      const points = array(source['points']).map(pointData);
      this.chartType.set('line');
      this.chartData.set({ labels: points.map((point) => String(point.x)), datasets: [{ label: this.current().label, data: points.map((point) => point.y), borderColor: '#187a76', backgroundColor: 'rgba(98,217,210,.3)', fill: this.kind() === 'area', tension: .18 }] });
    } else if (this.kind() === 'dot') {
      const points = array(source['points']).map(record);
      this.chartType.set('bar');
      this.chartData.set({ labels: points.map((row) => String(row['value'])), datasets: [{ label: 'Frecuencia', data: points.map((row) => Number(row['count'])), backgroundColor: '#62d9d2' }] });
    } else if (this.kind() === 'interval') {
      const intervals = array(source['intervals']).map(record);
      this.chartType.set('bar');
      this.chartData.set({ labels: intervals.map((row) => String(row['group'])), datasets: [{ label: 'Intervalo de confianza', data: intervals.map((row) => [Number(row['lower']), Number(row['upper'])]), backgroundColor: 'rgba(98,217,210,.55)', borderColor: '#187a76', borderWidth: 2 }] } as ChartData);
    } else {
      this.chartType.set(this.typeForKind());
      this.chartData.set({ labels, datasets: [{ label: this.current().label, data: values, backgroundColor: this.kind() === 'area' ? 'rgba(98,217,210,.3)' : 'rgba(98,217,210,.7)', borderColor: '#187a76', borderWidth: 2, fill: this.kind() === 'area' }] } as ChartData);
    }
  }

  private buildPlotly(result: ApiResult): void {
    const source = record(result['results'] ?? result);
    this.chartData.set(null);
    if (Array.isArray(source['data'])) {
      this.plotData.set(source['data'] as Data[]);
      this.plotLayout.set(record(source['layout']) as Partial<Layout>);
      return;
    }
    let x = array(source['x'] ?? source['theoretical_quantiles'] ?? source['labels']);
    let y = array(source['y'] ?? source['sample_quantiles'] ?? source['values']);
    const points = array(source['points']).map(record);
    if (points.length) { x = points.map((row) => row[String(this.values.x_column)] ?? row['x'] ?? row['theoretical']); y = points.map((row) => row[String(this.values.y_column)] ?? row['y'] ?? row['observed']); }
    const boxGroups = array(source['groups']).map(record);
    const rows = array(source['rows']).map(record);
    const pairColumns = array(source['columns']).map(String);
    const traces = (this.kind() === 'boxplot' ? boxGroups.map((group) => ({ type: 'box', name: String(group['group'] ?? this.values.column), q1: [Number(group['q1'])], median: [Number(group['median'])], q3: [Number(group['q3'])], lowerfence: [Number(group['lower_whisker'])], upperfence: [Number(group['upper_whisker'])], marker: { color: '#187a76' } }))
      : this.kind() === 'violin' ? boxGroups.map((group) => ({ type: 'violin', y: array(group['values']), name: String(group['group'] ?? this.values.column), box: { visible: true }, line: { color: '#187a76' } }))
      : this.kind() === 'heatmap' ? [{ type: 'heatmap', z: array(source['z'] ?? source['matrix']) as number[][], x: array(source['x'] ?? source['columns']), y: array(source['y'] ?? source['columns']), colorscale: 'Teal' }]
      : this.kind() === 'pairplot' ? [{ type: 'splom', dimensions: pairColumns.map((column) => ({ label: column, values: rows.map((row) => Number(row[column])) })), marker: { color: '#187a76', opacity: 0.65, size: 5 } }]
      : this.kind() === 'scatter-3d' ? [{ type: 'scatter3d', mode: 'markers', x, y, z: points.map((row) => row[String(this.values.z_column)] ?? row['z']), marker: { color: '#187a76', size: 5 } }]
      : this.kind() === 'bubble' ? [{ type: 'scatter', mode: 'markers', x, y, marker: { color: '#187a76', opacity: 0.65, sizemode: 'area', size: points.map((row) => Math.max(6, Number(row[String(this.values.size_column)] ?? row['size']))) } }]
      : this.kind() === 'qq' ? [
        { type: 'scatter', mode: 'markers', name: 'Cuantiles', x, y, marker: { color: '#187a76' } },
        { type: 'scatter', mode: 'lines', name: 'Referencia normal', x: [x[0], x.at(-1)], y: [Number(record(source['line'])['slope']) * Number(x[0]) + Number(record(source['line'])['intercept']), Number(record(source['line'])['slope']) * Number(x.at(-1)) + Number(record(source['line'])['intercept'])], line: { color: '#ef7564' } },
      ] : [{ type: 'scatter', mode: 'markers', x, y, marker: { color: '#187a76' } }]) as unknown as Data[];
    this.plotData.set(traces);
    this.plotLayout.set({ title: { text: this.current().label } });
  }

  private typeForKind(): ChartType {
    if (this.kind() === 'pie') return 'pie';
    if (['line', 'area', 'interval'].includes(this.kind())) return 'line';
    return 'bar';
  }
}

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function pointData(value: unknown): { x: number; y: number } { const item = record(value); return Array.isArray(value) ? { x: Number(value[0]), y: Number(value[1]) } : { x: Number(item['x']), y: Number(item['y']) }; }
