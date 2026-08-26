import { Component, computed, input } from '@angular/core';
import { adaptStatisticalResponse, findPValue, flattenResult } from '../../core/models/analysis.model';

@Component({
  selector: 'app-result-viewer',
  templateUrl: './result-viewer.component.html',
})
export class ResultViewerComponent {
  readonly value = input.required<unknown>();
  readonly fallbackAlpha = input(0.05);
  protected readonly response = computed(() => adaptStatisticalResponse(this.value()));
  protected readonly entries = computed(() => flattenResult(this.response().results));
  protected readonly pValue = computed(() => findPValue(this.response().results));
  protected readonly alpha = computed(() => this.response().alpha ?? this.fallbackAlpha());
  protected readonly significant = computed(() => this.pValue() !== null && this.pValue()! < this.alpha());

  protected display(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') return value.toLocaleString('es', { maximumFractionDigits: 6 });
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    return String(value);
  }

  protected label(value: string): string {
    return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
  }
}
