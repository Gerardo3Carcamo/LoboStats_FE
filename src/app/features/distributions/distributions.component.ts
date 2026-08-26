import { JsonPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import type { Data, Layout } from 'plotly.js';
import { DataService } from '../../core/services/data.service';
import { DistributionResponse, DistributionService } from '../../core/services/distribution.service';
import { PlotlyChartComponent } from '../../shared/plotly-chart/plotly-chart.component';

type Mode = 'calculator' | 'identify';
export type DistributionOperation = 'pdf' | 'cdf' | 'sf' | 'ppf' | 'interval' | 'random';

export interface DistributionParameter {
  key: string;
  label: string;
  defaultValue: number;
  hint: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface DistributionDefinition {
  id: string;
  label: string;
  discrete: boolean;
  domain: string;
  parameters: DistributionParameter[];
}

export interface RankingRow {
  distribution: string;
  ad: number | null;
  pValue: number | null;
  aic: number | null;
  bic: number | null;
}

export interface IdentifyView {
  ranking: RankingRow[];
  bestDistribution: string;
  failures: { distribution: string; reason: string }[];
}

const p = (key: string, label: string, defaultValue: number, hint: string, min?: number, step?: number, max?: number): DistributionParameter => ({ key, label, defaultValue, hint, min, step, max });

export const DISTRIBUTIONS: DistributionDefinition[] = [
  { id: 'normal', label: 'Normal', discrete: false, domain: 'x real; desviación > 0', parameters: [p('mean', 'Media (μ)', 0, 'Centro de la distribución'), p('std', 'Desviación (σ)', 1, 'Debe ser mayor que 0', 0.000001)] },
  { id: 't', label: 't de Student', discrete: false, domain: 'x real; gl > 0', parameters: [p('df', 'Grados de libertad', 10, 'Controlan el peso de las colas', 0.000001), p('loc', 'Localización', 0, 'Centro'), p('scale', 'Escala', 1, 'Mayor que 0', 0.000001)] },
  { id: 'chi2', label: 'Chi-cuadrado', discrete: false, domain: 'x ≥ 0; gl > 0', parameters: [p('df', 'Grados de libertad', 4, 'Debe ser mayor que 0', 0.000001), p('loc', 'Localización', 0, 'Desplazamiento'), p('scale', 'Escala', 1, 'Mayor que 0', 0.000001)] },
  { id: 'f', label: 'F de Fisher', discrete: false, domain: 'x ≥ 0; gl₁, gl₂ > 0', parameters: [p('dfn', 'Grados libertad 1', 5, 'Numerador', 0.000001), p('dfd', 'Grados libertad 2', 10, 'Denominador', 0.000001), p('loc', 'Localización', 0, 'Desplazamiento'), p('scale', 'Escala', 1, 'Mayor que 0', 0.000001)] },
  { id: 'binomial', label: 'Binomial', discrete: true, domain: 'x entero entre 0 y n; 0 ≤ p ≤ 1', parameters: [p('n', 'Ensayos (n)', 10, 'Entero no negativo', 0, 1), p('p', 'Probabilidad (p)', 0.5, 'Entre 0 y 1', 0, 0.01, 1), p('loc', 'Localización', 0, 'Desplazamiento entero', undefined, 1)] },
  { id: 'poisson', label: 'Poisson', discrete: true, domain: 'x entero ≥ 0; μ ≥ 0', parameters: [p('mu', 'Tasa (μ)', 3, 'Media de eventos', 0), p('loc', 'Localización', 0, 'Desplazamiento entero', undefined, 1)] },
  { id: 'hypergeom', label: 'Hipergeométrica', discrete: true, domain: 'población M; éxitos n; extracciones N', parameters: [p('M', 'Población (M)', 50, 'Tamaño total', 1, 1), p('n', 'Éxitos en población (n)', 15, 'No mayor que M', 0, 1), p('N', 'Extracciones (N)', 10, 'No mayor que M', 0, 1), p('loc', 'Localización', 0, 'Desplazamiento entero', undefined, 1)] },
  { id: 'exponential', label: 'Exponencial', discrete: false, domain: 'x ≥ localización; escala > 0', parameters: [p('loc', 'Localización', 0, 'Inicio del soporte'), p('scale', 'Escala', 1, 'Inversa de la tasa', 0.000001)] },
  { id: 'gamma', label: 'Gamma', discrete: false, domain: 'x ≥ localización; forma y escala > 0', parameters: [p('shape', 'Forma (a)', 2, 'Debe ser mayor que 0', 0.000001), p('loc', 'Localización', 0, 'Inicio del soporte'), p('scale', 'Escala', 1, 'Mayor que 0', 0.000001)] },
  { id: 'beta', label: 'Beta', discrete: false, domain: 'localización ≤ x ≤ localización + escala', parameters: [p('a', 'Forma α', 2, 'Debe ser mayor que 0', 0.000001), p('b', 'Forma β', 5, 'Debe ser mayor que 0', 0.000001), p('loc', 'Localización', 0, 'Límite inferior'), p('scale', 'Escala', 1, 'Ancho del soporte', 0.000001)] },
  { id: 'weibull', label: 'Weibull', discrete: false, domain: 'x ≥ localización; forma y escala > 0', parameters: [p('shape', 'Forma (c)', 1.5, 'Debe ser mayor que 0', 0.000001), p('loc', 'Localización', 0, 'Inicio del soporte'), p('scale', 'Escala', 1, 'Mayor que 0', 0.000001)] },
  { id: 'lognormal', label: 'Lognormal', discrete: false, domain: 'x > localización; forma y escala > 0', parameters: [p('shape', 'Forma (s)', 0.8, 'Desviación logarítmica', 0.000001), p('loc', 'Localización', 0, 'Desplazamiento'), p('scale', 'Escala', 1, 'Mediana', 0.000001)] },
  { id: 'uniform', label: 'Uniforme', discrete: false, domain: 'localización ≤ x ≤ localización + escala', parameters: [p('loc', 'Límite inferior', 0, 'Inicio del intervalo'), p('scale', 'Amplitud', 1, 'Debe ser mayor que 0', 0.000001)] },
  { id: 'logistic', label: 'Logística', discrete: false, domain: 'x real; escala > 0', parameters: [p('loc', 'Localización', 0, 'Centro'), p('scale', 'Escala', 1, 'Mayor que 0', 0.000001)] },
  { id: 'gumbel_l', label: 'Gumbel izquierda', discrete: false, domain: 'x real; escala > 0', parameters: [p('loc', 'Localización', 0, 'Centro'), p('scale', 'Escala', 1, 'Mayor que 0', 0.000001)] },
  { id: 'gumbel_r', label: 'Gumbel derecha', discrete: false, domain: 'x real; escala > 0', parameters: [p('loc', 'Localización', 0, 'Centro'), p('scale', 'Escala', 1, 'Mayor que 0', 0.000001)] },
];

export const FIT_CANDIDATES = [
  { id: 'normal', label: 'Normal' }, { id: 'lognormal', label: 'Lognormal' },
  { id: 'weibull', label: 'Weibull 2P' }, { id: 'weibull-3p', label: 'Weibull 3P' },
  { id: 'exponential', label: 'Exponencial 1P' }, { id: 'exponential-2p', label: 'Exponencial 2P' },
  { id: 'gamma', label: 'Gamma' }, { id: 'logistic', label: 'Logística' },
  { id: 'gumbel_l', label: 'Gumbel izquierda' }, { id: 'gumbel_r', label: 'Gumbel derecha' },
];

const OPERATIONS: { id: DistributionOperation; label: string; icon: string }[] = [
  { id: 'pdf', label: 'Densidad', icon: 'show_chart' },
  { id: 'cdf', label: 'Acumulada', icon: 'ssid_chart' },
  { id: 'sf', label: 'Cola derecha', icon: 'trending_down' },
  { id: 'ppf', label: 'Cuantil', icon: 'percent' },
  { id: 'interval', label: 'Intervalo', icon: 'code' },
  { id: 'random', label: 'Simulación', icon: 'casino' },
];

export function buildCalculatorPayload(definition: DistributionDefinition, operation: DistributionOperation, values: Record<string, unknown>, parameterValues: Record<string, number>): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    distribution: definition.id,
    params: Object.fromEntries(definition.parameters.map((parameter) => [parameter.key, Number(parameterValues[parameter.key])])),
  };
  if (['pdf', 'cdf', 'sf'].includes(operation)) payload['x'] = Number(values['x']);
  if (operation === 'ppf') payload['q'] = Number(values['q']);
  if (operation === 'interval') payload['confidence'] = Number(values['confidence']);
  if (operation === 'random') {
    payload['size'] = Number(values['size']);
    payload['seed'] = values['seed'] === '' || values['seed'] === null || values['seed'] === undefined ? 0 : Number(values['seed']);
  }
  return payload;
}

export function adaptIdentifyResult(response: DistributionResponse | Record<string, unknown>): IdentifyView {
  const source = record(response['results'] ?? response);
  const ranking = array(source['ranking'] ?? source['candidates'] ?? source['values']).map(record).map((row) => ({
    distribution: String(row['distribution'] ?? row['name'] ?? ''),
    ad: finiteOrNull(row['ad'] ?? row['ad_statistic'] ?? record(row['anderson_darling'])['statistic']),
    pValue: finiteOrNull(row['p_value'] ?? row['p'] ?? record(row['anderson_darling'])['p_value']),
    aic: finiteOrNull(row['aic']),
    bic: finiteOrNull(row['bic']),
  }));
  const best = source['best_distribution'];
  const bestDistribution = typeof best === 'string' ? best : String(record(best)['distribution'] ?? record(best)['name'] ?? ranking[0]?.distribution ?? '');
  const failuresSource = source['failures'];
  const failures = Array.isArray(failuresSource)
    ? failuresSource.map((failure) => typeof failure === 'string' ? { distribution: 'Candidato', reason: failure } : { distribution: String(record(failure)['distribution'] ?? record(failure)['name'] ?? 'Candidato'), reason: String(record(failure)['reason'] ?? record(failure)['error'] ?? 'No se pudo ajustar') })
    : Object.entries(record(failuresSource)).map(([distribution, reason]) => ({ distribution, reason: String(reason) }));
  return { ranking, bestDistribution, failures };
}

export function probabilityPlotTraces(response: DistributionResponse | Record<string, unknown>): Data[] {
  const source = record(response['results'] ?? response);
  const points = xy(source['points'], 'theoretical', 'observed');
  const band = record(source['confidence_band']);
  const bandRows = array(source['confidence_band']).length ? array(source['confidence_band']) : array(band['points']);
  const bandPoints = xy(bandRows, 'theoretical', 'lower');
  const xBand = array(band['x']).map(Number).length ? array(band['x']).map(Number) : bandPoints.x;
  const lower = array(band['lower']).map(Number).length ? array(band['lower']).map(Number) : bandPoints.y;
  const upper = array(band['upper']).map(Number).length ? array(band['upper']).map(Number) : bandRows.map((item) => Number(record(item)['upper']));
  const traces: Data[] = [];
  if (xBand.length && lower.length && upper.length) {
    traces.push({ type: 'scatter', mode: 'lines', name: 'Banda superior', x: xBand, y: upper, line: { width: 0 }, hoverinfo: 'skip', showlegend: false } as Data);
    traces.push({ type: 'scatter', mode: 'lines', name: 'Banda de confianza', x: xBand, y: lower, fill: 'tonexty', fillcolor: 'rgba(98,217,210,.2)', line: { width: 0 }, hoverinfo: 'skip' } as Data);
  }
  if (points.x.length) traces.push({ type: 'scatter', mode: 'markers', name: 'Observaciones', x: points.x, y: points.y, marker: { color: '#187a76', size: 7 } } as Data);
  const line = record(source['reference_line']);
  let lineX = array(line['x']).map(Number);
  let lineY = array(line['y']).map(Number);
  if (!lineX.length && points.x.length) {
    lineX = [Math.min(...points.x), Math.max(...points.x)];
    lineY = lineX.map((value) => Number(line['intercept'] ?? 0) + Number(line['slope'] ?? 1) * value);
  }
  if (lineX.length) traces.push({ type: 'scatter', mode: 'lines', name: 'Referencia', x: lineX, y: lineY, line: { color: '#ef7564', width: 2 } } as Data);
  return traces;
}

export function adaptCurveResult(response: DistributionResponse | Record<string, unknown>): { x: number[]; y: number[] } {
  const source = record(response['results'] ?? response);
  const points = xy(source['points'], 'x', 'y');
  const curveRows = array(source['values']).map(record).filter((row) => row['x'] !== undefined);
  const x = array(source['x']).length ? array(source['x']).map(Number) : curveRows.length ? curveRows.map((row) => Number(row['x'])) : points.x;
  const directY = array(source['y'] ?? source['pdf'] ?? source['pmf'] ?? source['density']);
  const y = directY.length ? directY.map(Number) : curveRows.length ? curveRows.map((row) => Number(row['density'])) : points.y;
  return { x, y };
}

@Component({
  selector: 'app-distributions',
  imports: [JsonPipe, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule, PlotlyChartComponent],
  templateUrl: './distributions.component.html',
  styleUrl: './distributions.component.scss',
})
export class DistributionsComponent {
  protected readonly data = inject(DataService);
  private readonly api = inject(DistributionService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly distributions = DISTRIBUTIONS;
  protected readonly fitCandidates = FIT_CANDIDATES;
  protected readonly operations = OPERATIONS;
  protected readonly mode = signal<Mode>('calculator');
  protected readonly distributionId = signal('normal');
  protected readonly operation = signal<DistributionOperation>('pdf');
  protected readonly definition = computed(() => DISTRIBUTIONS.find((item) => item.id === this.distributionId()) ?? DISTRIBUTIONS[0]);
  protected parameterValues: Record<string, number> = {};
  protected values: Record<string, unknown> = { x: 0, q: 0.95, confidence: 0.95, size: 100, seed: 42, x_min: '', x_max: '', points: 240 };
  protected readonly calculation = signal<DistributionResponse | null>(null);
  protected readonly calculationEntries = computed(() => displayEntries(this.calculation()?.results));
  protected readonly curveData = signal<Data[] | null>(null);
  protected readonly curveLayout = signal<Partial<Layout>>({});
  protected readonly calculating = signal(false);
  protected readonly curveLoading = signal(false);
  protected readonly calculationError = signal<string | null>(null);
  protected readonly curveError = signal<string | null>(null);
  protected column = '';
  protected candidates = FIT_CANDIDATES.filter((item) => !item.id.includes('-')).map((item) => item.id);
  protected bootstrapReps = 100;
  protected readonly identifying = signal(false);
  protected readonly identifyError = signal<string | null>(null);
  protected readonly identification = signal<IdentifyView | null>(null);
  protected fitDistribution = '';
  protected confidence = 0.95;
  protected readonly fitting = signal(false);
  protected readonly fitError = signal<string | null>(null);
  protected readonly fitResult = signal<DistributionResponse | null>(null);
  protected readonly goodnessResult = signal<DistributionResponse | null>(null);
  protected readonly probabilityData = signal<Data[] | null>(null);
  protected readonly probabilityLayout = signal<Partial<Layout>>({});
  private calculationRequest = 0;
  private fitRequest = 0;
  private latestCurveResponse: DistributionResponse | null = null;

  constructor() { this.resetParameters(); }

  protected selectMode(mode: Mode): void { this.mode.set(mode); }
  protected selectDistribution(id: string): void { this.distributionId.set(id); this.resetParameters(); this.calculation.set(null); this.curveData.set(null); }
  protected selectOperation(operation: DistributionOperation): void { this.operation.set(operation); this.calculation.set(null); }
  protected operationLabel(item: { id: DistributionOperation; label: string }): string { return item.id === 'pdf' && this.definition().discrete ? 'Masa (PMF)' : item.label; }

  protected calculate(): void {
    const request = ++this.calculationRequest;
    const payload = buildCalculatorPayload(this.definition(), this.operation(), this.values, this.parameterValues);
    this.latestCurveResponse = null;
    this.calculating.set(true); this.curveLoading.set(true); this.calculationError.set(null); this.curveError.set(null); this.calculation.set(null);
    this.api.request(this.operation(), payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => { if (request === this.calculationRequest) { this.calculation.set(response); if (this.latestCurveResponse) this.buildCurve(this.latestCurveResponse); } },
      error: (error: unknown) => { if (request === this.calculationRequest) { this.calculationError.set(errorMessage(error)); this.calculating.set(false); } },
      complete: () => { if (request === this.calculationRequest) this.calculating.set(false); },
    });
    const curvePayload: Record<string, unknown> = { distribution: this.definition().id, params: payload['params'], points: Number(this.values['points']) };
    if (this.values['x_min'] !== '') curvePayload['x_min'] = Number(this.values['x_min']);
    if (this.values['x_max'] !== '') curvePayload['x_max'] = Number(this.values['x_max']);
    this.api.request('curve', curvePayload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => { if (request === this.calculationRequest) { this.latestCurveResponse = response; this.buildCurve(response); } },
      error: (error: unknown) => { if (request === this.calculationRequest) { this.curveError.set(errorMessage(error)); this.curveLoading.set(false); } },
      complete: () => { if (request === this.calculationRequest) this.curveLoading.set(false); },
    });
  }

  protected identify(): void {
    const dataset = this.data.dataset();
    if (!dataset || !this.column || !this.candidates.length) return;
    this.identifying.set(true); this.identifyError.set(null); this.identification.set(null); this.probabilityData.set(null);
    this.api.request('identify', { dataset_id: dataset.id, column: this.column, candidates: this.candidates, bootstrap_reps: Number(this.bootstrapReps) }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        const view = adaptIdentifyResult(response);
        this.identification.set(view);
        this.fitDistribution = view.bestDistribution;
      },
      error: (error: unknown) => { this.identifyError.set(errorMessage(error)); this.identifying.set(false); },
      complete: () => this.identifying.set(false),
    });
  }

  protected evaluateFit(): void {
    const dataset = this.data.dataset();
    if (!dataset || !this.column || !this.fitDistribution) return;
    const request = ++this.fitRequest;
    const base = { dataset_id: dataset.id, column: this.column, distribution: this.fitDistribution, bootstrap_reps: Number(this.bootstrapReps) };
    this.fitting.set(true); this.fitError.set(null); this.fitResult.set(null); this.goodnessResult.set(null); this.probabilityData.set(null);
    let pending = 3;
    const finished = () => { pending -= 1; if (!pending && request === this.fitRequest) this.fitting.set(false); };
    this.api.request('fit', base).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (result) => { if (request === this.fitRequest) this.fitResult.set(result); }, error: (error: unknown) => { if (request === this.fitRequest) this.fitError.set(errorMessage(error)); finished(); }, complete: finished });
    this.api.request('goodness-of-fit', base).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (result) => { if (request === this.fitRequest) this.goodnessResult.set(result); }, error: (error: unknown) => { if (request === this.fitRequest) this.fitError.set(errorMessage(error)); finished(); }, complete: finished });
    this.api.request('probability-plot', { ...base, confidence: Number(this.confidence) }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        if (request !== this.fitRequest) return;
        this.probabilityData.set(probabilityPlotTraces(result));
        const fitted = record(record(result['results'])['fitted_parameters']);
        this.probabilityLayout.set({ title: { text: `Gráfico de probabilidad · ${this.fitDistribution}` }, xaxis: { title: { text: 'Cuantiles teóricos' } }, yaxis: { title: { text: 'Valores observados' } }, annotations: Object.keys(fitted).length ? [{ text: `Parámetros: ${Object.entries(fitted).map(([key, value]) => `${key}=${format(value)}`).join(', ')}`, xref: 'paper', yref: 'paper', x: 0, y: 1.08, showarrow: false }] : [] });
      },
      error: (error: unknown) => { if (request === this.fitRequest) this.fitError.set(errorMessage(error)); finished(); }, complete: finished,
    });
  }

  protected format = format;

  private resetParameters(): void { this.parameterValues = Object.fromEntries(this.definition().parameters.map((parameter) => [parameter.key, parameter.defaultValue])); }

  private buildCurve(response: DistributionResponse): void {
    const { x, y } = adaptCurveResult(response);
    const discrete = this.definition().discrete;
    const traces: Data[] = [discrete
      ? { type: 'bar', name: 'PMF', x, y, marker: { color: '#62d9d2', line: { color: '#187a76', width: 1 } } } as Data
      : { type: 'scatter', mode: 'lines', name: 'Densidad', x, y, line: { color: '#187a76', width: 3 } } as Data];
    const operation = this.operation();
    let marker: number | null = ['pdf', 'cdf', 'sf'].includes(operation) ? Number(this.values['x']) : operation === 'ppf' ? scalarResult(this.calculation()?.results) : null;
    if (Number.isFinite(marker)) {
      const markerY = interpolate(x, y, marker as number);
      traces.push({ type: 'scatter', mode: 'markers', name: operation === 'ppf' ? 'Cuantil' : 'x', x: [marker], y: [markerY], marker: { color: '#ef7564', size: 11, line: { color: 'white', width: 2 } } } as Data);
    } else marker = null;
    const interval = operation === 'interval' ? intervalResult(this.calculation()?.results) : null;
    const region = interval ?? (marker !== null && ['cdf', 'sf'].includes(operation) ? [operation === 'cdf' ? Math.min(...x) : marker, operation === 'cdf' ? marker : Math.max(...x)] as [number, number] : null);
    if (!discrete && region) {
      const selected = x.map((value, index) => ({ value, y: y[index] })).filter((item) => item.value >= region[0] && item.value <= region[1]);
      traces.unshift({ type: 'scatter', mode: 'lines', name: 'Región', x: selected.map((item) => item.value), y: selected.map((item) => item.y), fill: 'tozeroy', fillcolor: 'rgba(98,217,210,.22)', line: { width: 0 }, hoverinfo: 'skip', showlegend: false } as Data);
    }
    this.curveData.set(traces);
    this.curveLayout.set({ xaxis: { title: { text: 'x' }, zeroline: false }, yaxis: { title: { text: discrete ? 'Probabilidad' : 'Densidad' }, rangemode: 'tozero' }, showlegend: true, legend: { orientation: 'h', y: 1.08 } });
  }
}

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function finiteOrNull(value: unknown): number | null { const number = Number(value); return Number.isFinite(number) ? number : null; }
function format(value: unknown): string { const number = Number(value); return typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(number)) ? new Intl.NumberFormat('es', { maximumSignificantDigits: 7 }).format(number) : String(value ?? '—'); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : 'No se pudo completar la solicitud. Revisa los parámetros.'; }
function xy(value: unknown, xKey: string, yKey: string): { x: number[]; y: number[] } { const rows = array(value); return { x: rows.map((item) => Array.isArray(item) ? Number(item[0]) : Number(record(item)[xKey] ?? record(item)[`${xKey}_quantile`] ?? record(item)['x'])), y: rows.map((item) => Array.isArray(item) ? Number(item[1]) : Number(record(item)[yKey] ?? record(item)[`${yKey}_quantile`] ?? record(item)['sample_quantile'] ?? record(item)['y'])) }; }
function scalarResult(value: unknown): number | null { if (typeof value === 'number') return value; const source = record(value); for (const key of ['value', 'quantile', 'x', 'result']) { const number = finiteOrNull(source[key]); if (number !== null) return number; } return null; }
function intervalResult(value: unknown): [number, number] | null { const source = record(value); const values = Array.isArray(value) ? value : array(source['interval']); const lower = finiteOrNull(source['lower'] ?? values[0]); const upper = finiteOrNull(source['upper'] ?? values[1]); return lower !== null && upper !== null ? [lower, upper] : null; }
function interpolate(x: number[], y: number[], target: number): number { if (!x.length) return 0; let index = 0; for (let i = 1; i < x.length; i += 1) if (Math.abs(x[i] - target) < Math.abs(x[index] - target)) index = i; return y[index] ?? 0; }
function displayEntries(value: unknown): { label: string; value: unknown }[] { if (Array.isArray(value)) return value.length > 12 ? [{ label: 'Muestra', value: `${value.slice(0, 12).map(format).join(', ')}… (${value.length} valores)` }] : value.map((item, index) => ({ label: String(index + 1), value: item })); const source = record(value); return Object.entries(source).filter(([, item]) => typeof item !== 'object' || item === null || Array.isArray(item)).map(([label, item]) => ({ label: label.replaceAll('_', ' '), value: Array.isArray(item) ? `${item.slice(0, 12).map(format).join(', ')}${item.length > 12 ? `… (${item.length} valores)` : ''}` : item })); }
