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
  ManufacturingAnalysisRequest,
  ManufacturingColumnMapping,
  ManufacturingMode,
  ManufacturingResult,
} from '../../../models/analysis';
import { AnalysisHistoryDialog } from '../../../shared/analysis-history/analysis-history-dialog';

type StatusKind = 'info' | 'success' | 'error';
type MappingKey = keyof ManufacturingColumnMapping;

const MODE_DESCRIPTIONS: Record<ManufacturingMode, string> = {
  summary: 'Una fila resume un turno, orden, máquina o periodo de producción.',
  event_log: 'Cada fila describe un periodo operando, setup, paro o falla.',
  cycle_log: 'Cada fila representa un ciclo, pieza o medición individual.',
};

@Component({
  selector: 'app-manufacturing',
  imports: [AnalysisHistoryDialog, RouterLink],
  templateUrl: './manufacturing.html',
  styleUrl: './manufacturing.scss',
})
export class Manufacturing {
  protected readonly store = inject(WorkspaceStore);
  private readonly persistence = inject(WorkspacePersistenceService);
  private readonly analysisApi = inject(AnalysisApi);
  private readonly productTour = inject(ProductTourService);
  private readonly resultHeading = viewChild<ElementRef<HTMLElement>>('resultHeading');
  private readonly historyDialog = viewChild.required<AnalysisHistoryDialog>('historyDialog');

  protected readonly mode = signal<ManufacturingMode>('summary');
  protected readonly mapping = signal<ManufacturingColumnMapping>({});
  protected readonly timeUnit = signal<'seconds' | 'minutes' | 'hours'>('minutes');
  protected readonly cycleTimeUnit = signal<'seconds' | 'minutes' | 'hours'>('seconds');
  protected readonly idealCycle = signal<number | null>(null);
  protected readonly standardCycle = signal<number | null>(null);
  protected readonly demand = signal<number | null>(null);
  protected readonly opportunities = signal<number | null>(null);
  protected readonly lsl = signal<number | null>(null);
  protected readonly target = signal<number | null>(null);
  protected readonly usl = signal<number | null>(null);
  protected readonly runningValues = signal('Operando, Running');
  protected readonly plannedStopValues = signal('Setup, Paro planeado, Planned stop');
  protected readonly unplannedStopValues = signal('Falla, Paro no planeado, Unplanned stop');
  protected readonly goodValues = signal('OK, Bueno, Good');
  protected readonly running = signal(false);
  protected readonly run = signal<AnalysisRun<ManufacturingResult> | null>(null);
  protected readonly status = signal('Selecciona el formato de la hoja y asigna sus columnas');
  protected readonly statusKind = signal<StatusKind>('info');

  protected readonly columns = computed(() => this.store.columns());
  protected readonly modeDescription = computed(() => MODE_DESCRIPTIONS[this.mode()]);
  protected readonly canRun = computed(() => {
    const mapping = this.mapping();
    if (this.running() || !this.store.filledRows().length) return false;
    if (this.mode() === 'summary') return !!mapping.planned_time;
    if (this.mode() === 'event_log') {
      return !!mapping.event_state && (!!mapping.duration || !!(mapping.period_start && mapping.period_end));
    }
    return !!mapping.cycle_time;
  });

  constructor() {
    this.mapping.set(guessMapping(this.store.columns()));
  }

  protected startTour(event: Event): void {
    this.productTour.startManufacturingTour(event.currentTarget as HTMLElement);
  }

  protected updateMode(event: Event): void {
    this.mode.set((event.target as HTMLSelectElement).value as ManufacturingMode);
    this.run.set(null);
  }

  protected updateMapping(key: MappingKey, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.mapping.update((mapping) => ({ ...mapping, [key]: value || undefined }));
  }

  protected updateTimeUnit(event: Event): void {
    this.timeUnit.set((event.target as HTMLSelectElement).value as 'seconds' | 'minutes' | 'hours');
  }

  protected updateCycleTimeUnit(event: Event): void {
    this.cycleTimeUnit.set(
      (event.target as HTMLSelectElement).value as 'seconds' | 'minutes' | 'hours',
    );
  }

  protected updateNumber(
    target: ReturnType<typeof signal<number | null>>,
    event: Event,
  ): void {
    const value = (event.target as HTMLInputElement).value;
    target.set(value === '' ? null : Number(value));
  }

  protected updateText(
    target: ReturnType<typeof signal<string>>,
    event: Event,
  ): void {
    target.set((event.target as HTMLInputElement).value);
  }

  protected async analyze(): Promise<void> {
    if (!this.canRun()) return;
    this.running.set(true);
    this.setStatus('info', 'Guardando la hoja y reconciliando tiempos, ciclos y conteos…');
    try {
      let datasetId = this.store.datasetId();
      if (!datasetId || this.store.dirty()) datasetId = (await this.persistence.saveCurrent()).id;
      const analysis = await firstValueFrom(
        this.analysisApi.manufacturing(datasetId, this.payload()),
      );
      this.run.set(analysis);
      await this.historyDialog().refresh(datasetId);
      const oee = numeric(analysis.result.oee?.['oee']);
      this.setStatus(
        'success',
        oee === null
          ? `Análisis #${analysis.id} guardado con métricas parciales`
          : `Análisis #${analysis.id}: OEE ${(oee * 100).toFixed(1)} %`,
      );
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
    if (summary.analysis_type !== 'manufacturing') return;
    this.setStatus('info', `Abriendo análisis #${summary.id}…`);
    try {
      const analysis = await firstValueFrom(this.analysisApi.get<ManufacturingResult>(summary.id));
      this.run.set(analysis);
      this.setStatus(
        analysis.is_stale ? 'info' : 'success',
        analysis.is_stale
          ? `Análisis #${analysis.id} corresponde a una revisión anterior`
          : `Análisis #${analysis.id} abierto`,
      );
      requestAnimationFrame(() => this.resultHeading()?.nativeElement.focus());
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
    anchor.download = `lobostats-manufactura-${analysis.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected section(name: keyof ManufacturingResult): Record<string, unknown> | null {
    const value = this.run()?.result[name];
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  protected value(section: keyof ManufacturingResult, key: string): number | null {
    return numeric(this.section(section)?.[key]);
  }

  protected percent(section: keyof ManufacturingResult, key: string): string {
    const value = this.value(section, key);
    return value === null ? '—' : `${this.formatNumber(value * 100, 1)} %`;
  }

  protected formatNumber(value: unknown, digits = 2): string {
    const parsed = numeric(value);
    return parsed === null
      ? '—'
      : new Intl.NumberFormat('es-MX', { maximumFractionDigits: digits }).format(parsed);
  }

  protected timeLedger(): { label: string; value: number | null; kind: string }[] {
    const accounting = this.run()?.result.time_accounting;
    return [
      { label: 'Tiempo programado', value: numeric(accounting?.['planned_minutes']), kind: 'base' },
      { label: 'Paro planeado', value: numeric(accounting?.['planned_stop_minutes']), kind: 'planned' },
      { label: 'Paro no planeado', value: numeric(accounting?.['unplanned_stop_minutes']), kind: 'unplanned' },
      { label: 'Paro sin clasificar', value: numeric(accounting?.['unclassified_stop_minutes']), kind: 'unclassified' },
      { label: 'Pérdida de velocidad', value: numeric(accounting?.['speed_loss_minutes']), kind: 'speed' },
      { label: 'Pérdida por calidad', value: numeric(accounting?.['quality_loss_minutes']), kind: 'quality' },
      { label: 'Tiempo productivo equivalente', value: numeric(accounting?.['productive_equivalent_minutes']), kind: 'productive' },
    ];
  }

  protected ledgerWidth(value: number | null): number {
    const maximum = Math.max(...this.timeLedger().map((item) => item.value ?? 0), 1);
    return value === null ? 0 : Math.max(2, (value / maximum) * 100);
  }

  protected pareto(): Record<string, unknown>[] {
    const value = this.section('downtime')?.['pareto'];
    return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  }

  protected timeline(): Record<string, unknown>[] {
    const value = this.section('downtime')?.['timeline'];
    return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  }

  protected timelineWidth(event: Record<string, unknown>): number {
    const total = this.timeline().reduce((sum, item) => sum + (numeric(item['duration_minutes']) ?? 0), 0);
    return total ? Math.max(1.5, ((numeric(event['duration_minutes']) ?? 0) / total) * 100) : 0;
  }

  protected histogramBars(): { count: number; height: number }[] {
    const histogram = this.section('cycle')?.['histogram'] as Record<string, unknown> | undefined;
    const counts = Array.isArray(histogram?.['counts']) ? histogram?.['counts'].map(Number) : [];
    const maximum = Math.max(...counts, 1);
    return counts.map((count) => ({ count, height: Math.max(2, (count / maximum) * 100) }));
  }

  private payload(): ManufacturingAnalysisRequest {
    return {
      mode: this.mode(),
      mapping: cleanMapping(this.mapping()),
      time_unit: this.timeUnit(),
      cycle_time_unit: this.cycleTimeUnit(),
      running_values: splitValues(this.runningValues()),
      planned_stop_values: splitValues(this.plannedStopValues()),
      unplanned_stop_values: splitValues(this.unplannedStopValues()),
      good_values: splitValues(this.goodValues()),
      targets: compactNumbers({
        ideal_cycle_time: this.idealCycle(),
        standard_cycle_time: this.standardCycle(),
        demand: this.demand(),
        opportunities_per_unit: this.opportunities(),
        lower_specification: this.lsl(),
        target: this.target(),
        upper_specification: this.usl(),
      }),
    };
  }

  private setStatus(kind: StatusKind, message: string): void {
    this.statusKind.set(kind);
    this.status.set(message);
  }

  private describeError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'No se pudo analizar la operación';
    if (error.status === 0) return 'No se pudo conectar con el motor de planta';
    if (error.status === 422 && typeof error.error?.detail === 'string') return error.error.detail;
    return 'El motor no pudo reconciliar los datos con el mapeo indicado';
  }
}

function guessMapping(columns: { key: string; name: string }[]): ManufacturingColumnMapping {
  const normalized = columns.map((column) => ({
    ...column,
    search: normalize(`${column.key} ${column.name}`),
  }));
  const find = (...patterns: RegExp[]): string | undefined =>
    normalized.find((column) => patterns.some((pattern) => pattern.test(column.search)))?.key;
  return {
    line: find(/\blinea\b/, /\bline\b/),
    machine: find(/maquina/, /machine/, /equipo/),
    shift: find(/turno/, /shift/),
    product: find(/producto/, /product/),
    process: find(/proceso/, /operacion/, /process/),
    subgroup: find(/subgrupo/, /lote/, /subgroup/),
    period_start: find(/inicio/, /start/),
    period_end: find(/\bfin\b/, /\bend\b/),
    duration: find(/duracion/, /duration/),
    event_state: find(/estado/, /state/, /status/),
    reason: find(/causa/, /reason/, /motivo/),
    planned_time: find(/tiempo programado/, /planned time/, /programado/),
    operating_time: find(/tiempo operativo/, /operating/, /operativo/),
    planned_downtime: find(/paro planeado/, /planned downtime/),
    unplanned_downtime: find(/paro no planeado/, /unplanned downtime/, /tiempo muerto/),
    ideal_cycle_time: find(/ciclo ideal/, /ideal cycle/),
    standard_cycle_time: find(/ciclo estandar/, /standard cycle/),
    cycle_time: find(/tiempo ciclo/, /tiempo de ciclo/, /cycle time/, /\bciclo\b/),
    demand: find(/demanda/, /demand/),
    first_pass_good_count: find(/primera pasada/, /first pass/),
    good_count: find(/unidades buenas/, /good count/, /\bbuenas\b/),
    total_count: find(/unidades totales/, /total count/, /\btotal\b/),
    scrap_count: find(/scrap/, /rechazo/, /desecho/),
    rework_count: find(/retrabajo/, /rework/),
    defect_count: find(/defectos/, /defects/),
    opportunities: find(/oportunidades/, /opportunities/),
    quality_result: find(/resultado calidad/, /quality result/, /resultado/),
    measurement: find(/medicion/, /measurement/, /diametro/, /peso/),
  };
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function cleanMapping(mapping: ManufacturingColumnMapping): ManufacturingColumnMapping {
  return Object.fromEntries(
    Object.entries(mapping).filter((entry): entry is [string, string] => !!entry[1]),
  );
}

function compactNumbers(
  value: Record<string, number | null>,
): NonNullable<ManufacturingAnalysisRequest['targets']> {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => entry[1] !== null),
  ) as NonNullable<ManufacturingAnalysisRequest['targets']>;
}

function splitValues(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function numeric(value: unknown): number | null {
  const parsed = Number(value);
  return value !== null && value !== undefined && Number.isFinite(parsed) ? parsed : null;
}
