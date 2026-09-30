import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, inject, input, output, viewChild } from '@angular/core';

import type { CellValue, DataType } from '../../models/dataset';
import type { DecimalSeparator, ImportedTable } from './spreadsheet-import';

export type ImportEncoding = 'utf-8' | 'windows-1252';
export type ImportDelimiter = 'comma' | 'semicolon' | 'tab';
export type ImportKind = 'delimited' | 'workbook' | 'clipboard';

export interface WorkbookSheet {
  name: string;
  matrix: unknown[][];
}

export interface ImportColumnSummary {
  key: string;
  name: string;
  dataType: DataType;
  missing: number;
}

export interface ImportDraft {
  kind: ImportKind;
  fileName: string;
  fileSize: number;
  datasetName?: string;
  sourceBuffer?: ArrayBuffer;
  sourceText?: string;
  encoding: ImportEncoding;
  delimiter: ImportDelimiter;
  decimalSeparator: DecimalSeparator;
  firstRowIsHeader: boolean;
  sheets: WorkbookSheet[];
  selectedSheet?: string;
  matrix: unknown[][];
  table?: ImportedTable;
  previewRows: CellValue[][];
  columns: ImportColumnSummary[];
  error?: string;
}

@Component({
  selector: 'app-import-preview-dialog',
  templateUrl: './import-preview-dialog.html',
  styleUrl: './import-preview-dialog.scss',
})
export class ImportPreviewDialog {
  readonly draft = input.required<ImportDraft>();
  readonly existingRowCount = input(0);
  readonly firstRowIsHeaderChange = output<boolean>();
  readonly delimiterChange = output<ImportDelimiter>();
  readonly decimalSeparatorChange = output<DecimalSeparator>();
  readonly encodingChange = output<ImportEncoding>();
  readonly sheetChange = output<string>();
  readonly confirmed = output<void>();
  readonly closed = output<boolean>();

  private readonly document = inject(DOCUMENT);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');
  private trigger?: HTMLElement;
  private wasConfirmed = false;

  open(trigger: HTMLElement): void {
    this.trigger = trigger;
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) dialog.showModal();
    this.document.defaultView?.requestAnimationFrame(() => this.heading().nativeElement.focus());
  }

  protected cancel(): void {
    this.dialog().nativeElement.close();
  }

  protected confirmSelection(): void {
    if (!this.draft().table) return;
    this.wasConfirmed = true;
    this.confirmed.emit();
    this.dialog().nativeElement.close();
  }

  protected onClose(): void {
    const confirmed = this.wasConfirmed;
    const trigger = this.trigger;
    this.wasConfirmed = false;
    this.trigger = undefined;
    this.closed.emit(confirmed);
    this.document.defaultView?.requestAnimationFrame(() => trigger?.focus());
  }

  protected changeFirstRow(event: Event): void {
    this.firstRowIsHeaderChange.emit((event.target as HTMLInputElement).checked);
  }

  protected changeDelimiter(event: Event): void {
    this.delimiterChange.emit((event.target as HTMLSelectElement).value as ImportDelimiter);
  }

  protected changeEncoding(event: Event): void {
    this.encodingChange.emit((event.target as HTMLSelectElement).value as ImportEncoding);
  }

  protected changeDecimalSeparator(event: Event): void {
    this.decimalSeparatorChange.emit((event.target as HTMLSelectElement).value as DecimalSeparator);
  }

  protected changeSheet(event: Event): void {
    this.sheetChange.emit((event.target as HTMLSelectElement).value);
  }

  protected typeLabel(type: DataType): string {
    if (type === 'number') return 'Numérica';
    if (type === 'date') return 'Fecha';
    return 'Texto';
  }

  protected formatCell(value: CellValue): string {
    return value === null ? '—' : String(value);
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected visibleColumns(): ImportColumnSummary[] {
    return this.draft().columns.slice(0, 24);
  }

  protected previewColumns(): ImportColumnSummary[] {
    return this.draft().columns.slice(0, 20);
  }

  protected interpretationStatus(): string {
    const draft = this.draft();
    if (draft.error) return `La interpretación contiene un error: ${draft.error}`;
    if (!draft.table) return 'No hay una interpretación disponible';
    return `${draft.table.rows.length} filas y ${draft.table.columns.length} columnas detectadas`;
  }
}
