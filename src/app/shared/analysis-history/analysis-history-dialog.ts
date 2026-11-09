import { DOCUMENT } from '@angular/common';
import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AnalysisApi } from '../../core/services/analysis-api';
import { AnalysisRunSummary } from '../../models/analysis';

@Component({
  selector: 'app-analysis-history-dialog',
  templateUrl: './analysis-history-dialog.html',
  styleUrl: './analysis-history-dialog.scss',
})
export class AnalysisHistoryDialog {
  readonly datasetId = input<number | null>(null);
  readonly analysisType = input.required<string>();
  readonly title = input('Bitácora de análisis');
  readonly activeId = input<number | null>(null);
  readonly selected = output<AnalysisRunSummary>();

  private readonly document = inject(DOCUMENT);
  private readonly analysisApi = inject(AnalysisApi);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');
  private trigger?: HTMLElement;
  private loadedDatasetId?: number;
  private loadedAnalysisType?: string;
  private nextRequestId = 0;
  protected readonly items = signal<AnalysisRunSummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly hasMore = signal(false);
  protected readonly error = signal('');
  protected readonly search = signal('');
  protected readonly filter = signal('all');
  protected readonly filters = computed(() => {
    const labels = new Map<string, string>();
    for (const item of this.items()) {
      labels.set(item.presentation.filter_key, item.presentation.filter_label);
    }
    return [
      { key: 'all', label: 'Todos' },
      ...[...labels.entries()].map(([key, label]) => ({ key, label })),
    ];
  });
  protected readonly filteredItems = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('es-MX');
    return this.items().filter((item) => {
      if (this.filter() !== 'all' && item.presentation.filter_key !== this.filter()) return false;
      if (!query) return true;
      const presentation = item.presentation;
      return [
        presentation.module,
        presentation.title,
        presentation.detail,
        presentation.result,
        ...presentation.tags,
        item.engine_version,
        String(item.id),
      ].some((value) => value.toLocaleLowerCase('es-MX').includes(query));
    });
  });
  protected readonly groups = computed(() => {
    const groups = new Map<string, AnalysisRunSummary[]>();
    for (const item of this.filteredItems()) {
      const label = this.dateGroup(item.created_at);
      groups.set(label, [...(groups.get(label) ?? []), item]);
    }
    return [...groups.entries()].map(([label, items]) => ({ label, items }));
  });

  open(trigger: HTMLElement): void {
    this.trigger = trigger;
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) dialog.showModal();
    this.document.defaultView?.requestAnimationFrame(() =>
      this.searchInput().nativeElement.focus(),
    );
    if (
      this.datasetId() !== this.loadedDatasetId ||
      this.analysisType() !== this.loadedAnalysisType
    ) {
      void this.refresh();
    }
  }

  async refresh(datasetId = this.datasetId()): Promise<void> {
    this.items.set([]);
    this.hasMore.set(false);
    await this.loadPage(false, datasetId);
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }

  protected onClose(): void {
    const trigger = this.trigger;
    this.trigger = undefined;
    this.document.defaultView?.requestAnimationFrame(() => trigger?.focus());
  }

  protected choose(item: AnalysisRunSummary): void {
    this.selected.emit(item);
    this.dialog().nativeElement.close();
  }

  protected updateSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected setFilter(filter: string): void {
    this.filter.set(filter);
  }

  protected async loadMore(): Promise<void> {
    if (!this.loadingMore()) await this.loadPage(true);
  }

  protected formatTime(value: string): string {
    return new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit' }).format(
      new Date(value),
    );
  }

  private async loadPage(append: boolean, requestedDatasetId?: number | null): Promise<void> {
    const datasetId = requestedDatasetId ?? (append ? this.loadedDatasetId : this.datasetId());
    if (!datasetId) {
      this.loadedDatasetId = undefined;
      this.items.set([]);
      return;
    }
    const requestId = (this.nextRequestId += 1);
    this.error.set('');
    if (append) this.loadingMore.set(true);
    else this.loading.set(true);
    try {
      const history = await firstValueFrom(
        this.analysisApi.list(datasetId, {
          analysisType: this.analysisType(),
          limit: 26,
          beforeId: append ? this.items().at(-1)?.id : undefined,
        }),
      );
      if (requestId !== this.nextRequestId) return;
      const page = history.slice(0, 25);
      this.items.set(append ? [...this.items(), ...page] : page);
      this.hasMore.set(history.length > 25);
      this.loadedDatasetId = datasetId;
      this.loadedAnalysisType = this.analysisType();
    } catch {
      if (requestId === this.nextRequestId) {
        this.error.set('No se pudo cargar la bitácora. Inténtalo de nuevo.');
      }
    } finally {
      if (requestId === this.nextRequestId) {
        this.loading.set(false);
        this.loadingMore.set(false);
      }
    }
  }

  private dateGroup(value: string): string {
    const date = new Date(value);
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const difference = Math.round((startToday - startDate) / 86_400_000);
    if (difference === 0) return 'Hoy';
    if (difference === 1) return 'Ayer';
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date);
  }
}
