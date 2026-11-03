import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  CellValueChangedEvent,
  ColDef,
  GridReadyEvent,
  ModuleRegistry,
  themeQuartz,
  ValueParserParams,
} from 'ag-grid-community';

import { AgentApiService } from '../../core/services/agent-api';
import { WorkspacePersistenceService } from '../../core/services/workspace-persistence';
import { WorkspaceStore } from '../../core/services/workspace-store';
import { CellValue, DatasetColumn } from '../../models/dataset';
import {
  ImportDelimiter,
  ImportDraft,
  ImportEncoding,
  ImportPreviewDialog,
  WorkbookSheet,
} from './import-preview-dialog';
import {
  DecimalSeparator,
  detectDelimiter,
  ImportedTable,
  MAX_IMPORT_CELLS,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  matrixToTable,
  mysqlSnapshotToTable,
  normalizeCell,
  parseDelimited,
  preserveFormattedExcelValue,
} from './spreadsheet-import';

ModuleRegistry.registerModules([AllCommunityModule]);

type StatusKind = 'info' | 'success' | 'error';
const ALLOWED_FILE_EXTENSIONS = new Set(['csv', 'txt', 'xlsx']);
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const DELIMITERS: Record<ImportDelimiter, string> = {
  comma: ',',
  semicolon: ';',
  tab: '\t',
};

@Component({
  selector: 'app-worksheet',
  imports: [AgGridAngular, ImportPreviewDialog, RouterLink],
  templateUrl: './worksheet.html',
  styleUrl: './worksheet.scss',
})
export class Worksheet {
  protected readonly store = inject(WorkspaceStore);
  private readonly workspacePersistence = inject(WorkspacePersistenceService);
  private readonly agentApi = inject(AgentApiService);
  private readonly importPreview = viewChild<ImportPreviewDialog>('importPreview');
  protected readonly status = signal('Área de trabajo lista');
  protected readonly statusKind = signal<StatusKind>('info');
  protected readonly politeStatus = computed(() =>
    this.statusKind() === 'error' ? '' : this.status(),
  );
  protected readonly errorStatus = computed(() =>
    this.statusKind() === 'error' ? this.status() : '',
  );
  protected readonly saving = signal(false);
  protected readonly importing = signal(false);
  protected readonly importDraft = signal<ImportDraft | null>(null);
  protected readonly agentBusy = this.agentApi.busy;
  private readonly agentStatusEffect = effect(() => {
    const state = this.agentApi.state();
    if (state.phase === 'idle') return;
    const kind: StatusKind =
      state.phase === 'verified'
        ? 'success'
        : state.phase === 'cancelled'
          ? 'info'
          : ['unavailable', 'incompatible', 'error'].includes(state.phase)
            ? 'error'
            : 'info';
    this.setStatus(kind, state.message);
  });
  protected readonly localeText = {
    noRowsToShow: 'No hay datos para mostrar',
    ariaInputEditor: 'Editor de celda',
    ariaLabelCellEditor: 'Editor de celda',
    ariaLabelColumnMenu: 'Menú de columna',
    ariaLabelColumnFilter: 'Filtro de columna',
  };
  protected readonly theme = themeQuartz.withParams({
    accentColor: '#2f6548',
    backgroundColor: '#fffdf8',
    borderColor: '#dedbd1',
    browserColorScheme: 'light',
    fontFamily: 'Inter, Arial, sans-serif',
    fontSize: 13,
    foregroundColor: '#20251f',
    headerBackgroundColor: '#f1efe7',
    headerFontSize: 11,
    headerTextColor: '#62685f',
    oddRowBackgroundColor: '#faf9f4',
    rowBorder: { color: '#ebe8df' },
    spacing: 7,
  });
  protected readonly columnDefs = computed<ColDef[]>(() => [
    {
      headerName: 'Fila',
      valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
      editable: false,
      sortable: false,
      width: 72,
      maxWidth: 72,
      pinned: 'left',
      cellClass: 'row-number',
    },
    ...this.store.columns().map((column) => ({
      field: column.key,
      headerName: column.name,
      editable: true,
      minWidth: 130,
      flex: 1,
      valueParser: (params: ValueParserParams) => this.parseValue(params, column),
    })),
  ]);

  protected rename(event: Event): void {
    this.store.rename((event.target as HTMLInputElement).value.trim() || 'Hoja sin título');
    this.setStatus('info', 'Cambios pendientes de guardar en el servidor');
  }

  protected cellChanged(event: CellValueChangedEvent): void {
    const index = event.node.rowIndex;
    const key = event.colDef.field;
    if (index !== null && key) this.store.updateCell(index, key, event.newValue as CellValue);
    this.setStatus('info', 'Cambios pendientes de guardar en el servidor');
  }

  protected addRow(): void {
    this.store.addRow();
    this.setStatus('info', 'Fila agregada; cambios pendientes de guardar');
  }

  protected gridReady(event: GridReadyEvent): void {
    event.api.setGridAriaProperty('label', 'Datos del conjunto activo');
  }

  protected async handleAgentAction(event: Event): Promise<void> {
    if (this.agentBusy()) {
      await this.agentApi.cancel();
      return;
    }
    await this.connectAgent(event.currentTarget as HTMLElement);
  }

  private async connectAgent(trigger: HTMLElement): Promise<void> {
    const popup = this.openAgentPopup();
    if (!popup) {
      this.setStatus(
        'error',
        'El navegador bloqueó la ventana del agente. Permite ventanas emergentes e inténtalo de nuevo',
      );
      return;
    }

    try {
      const snapshot = await this.agentApi.pair((url) => popup.location.replace(url));
      if (snapshot) {
        const table = mysqlSnapshotToTable(snapshot);
        const sourceName = `${snapshot.source.database}.${snapshot.source.object.name}`;
        this.store.replace(table.columns, table.rows, sourceName);
        this.setStatus(
          snapshot.truncated ? 'info' : 'success',
          snapshot.truncated
            ? `${table.rows.length.toLocaleString('es-MX')} filas importadas desde ${sourceName}; el límite del snapshot fue alcanzado`
            : `${table.rows.length.toLocaleString('es-MX')} filas importadas desde ${sourceName}`,
        );
      }
      popup.close();
    } catch {
      popup.close();
    } finally {
      this.getWindow()?.requestAnimationFrame(() => trigger.focus());
    }
  }

  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || this.importing()) return;

    this.importing.set(true);
    this.setStatus('info', `Leyendo ${file.name}...`);
    try {
      if (file.size > MAX_SOURCE_BYTES) {
        throw new Error('El archivo supera el límite de 10 MB');
      }
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension || !ALLOWED_FILE_EXTENSIONS.has(extension)) {
        throw new Error('Formato no compatible. Selecciona un archivo CSV, TXT o XLSX');
      }

      if (extension === 'csv' || extension === 'txt') {
        const sourceBuffer = await file.arrayBuffer();
        const draft = this.createDelimitedDraft({
          kind: 'delimited',
          fileName: file.name,
          fileSize: file.size,
          datasetName: file.name.replace(/\.[^.]+$/, ''),
          sourceBuffer,
        });
        this.openImportPreview(draft, input);
      } else {
        const sheets = await this.readWorkbookSheets(file);
        const draft = this.refreshDraft({
          kind: 'workbook',
          fileName: file.name,
          fileSize: file.size,
          datasetName: file.name.replace(/\.[^.]+$/, ''),
          encoding: 'utf-8',
          delimiter: 'comma',
          decimalSeparator: '.',
          firstRowIsHeader: true,
          sheets,
          selectedSheet: sheets[0]?.name,
          matrix: [],
          previewRows: [],
          columns: [],
        });
        this.openImportPreview(draft, input);
      }
    } catch (error) {
      this.setStatus(
        'error',
        error instanceof Error ? error.message : 'No se pudo leer el archivo',
      );
    } finally {
      this.importing.set(false);
      input.value = '';
    }
  }

  protected async pasteFromClipboard(event: Event): Promise<void> {
    if (this.importing()) return;

    this.importing.set(true);
    this.setStatus('info', 'Leyendo datos del portapapeles...');
    try {
      const text = await navigator.clipboard.readText();
      const fileSize = new Blob([text]).size;
      if (fileSize > MAX_SOURCE_BYTES) {
        throw new Error('Los datos pegados superan el límite de 10 MB');
      }
      const draft = this.createDelimitedDraft({
        kind: 'clipboard',
        fileName: 'Datos del portapapeles',
        fileSize,
        sourceText: text,
        delimiter: 'tab',
      });
      this.openImportPreview(draft, event.currentTarget as HTMLElement);
    } catch (error) {
      this.setStatus(
        'error',
        error instanceof Error ? error.message : 'El navegador no permitió leer el portapapeles',
      );
    } finally {
      this.importing.set(false);
    }
  }

  protected updateFirstRowIsHeader(firstRowIsHeader: boolean): void {
    this.updateImportDraft({ firstRowIsHeader });
  }

  protected updateDelimiter(delimiter: ImportDelimiter): void {
    this.updateImportDraft({ delimiter });
  }

  protected updateEncoding(encoding: ImportEncoding): void {
    const draft = this.importDraft();
    if (!draft?.sourceBuffer) return;

    try {
      const text = this.decodeBuffer(draft.sourceBuffer, encoding);
      const delimiter = this.delimiterOption(detectDelimiter(text));
      this.updateImportDraft({
        encoding,
        delimiter,
        decimalSeparator: delimiter === 'semicolon' ? ',' : '.',
      });
    } catch {
      this.updateImportDraft({ encoding });
    }
  }

  protected updateDecimalSeparator(decimalSeparator: DecimalSeparator): void {
    this.updateImportDraft({ decimalSeparator });
  }

  protected updateSheet(selectedSheet: string): void {
    this.updateImportDraft({ selectedSheet });
  }

  protected confirmImport(): void {
    const draft = this.importDraft();
    if (!draft?.table) return;

    this.store.replace(draft.table.columns, draft.table.rows, draft.datasetName);
    this.setStatus(
      'success',
      `${draft.table.rows.length} filas importadas desde ${draft.fileName}`,
    );
  }

  protected finishImport(confirmed: boolean): void {
    if (!confirmed) {
      this.setStatus('info', 'Importación cancelada; el conjunto actual no cambió');
    }
    this.importDraft.set(null);
  }

  protected async save(): Promise<void> {
    if (!this.store.filledRows().length) {
      this.setStatus('error', 'Agrega al menos una observación antes de guardar');
      return;
    }
    this.saving.set(true);
    this.setStatus('info', 'Guardando en LoboStats...');
    try {
      const saved = await this.workspacePersistence.saveCurrent();
      this.setStatus(
        'success',
        `Conjunto #${saved.id}, revisión ${saved.revision}, guardado en el servidor`,
      );
    } catch (error) {
      this.setStatus('error', this.describeSaveError(error));
    } finally {
      this.saving.set(false);
    }
  }

  private async readWorkbookSheets(file: File): Promise<WorkbookSheet[]> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    let totalCells = 0;
    const sheets = workbook.SheetNames.flatMap((name) => {
      const sheet = workbook.Sheets[name];
      if (!sheet) return [];

      const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : undefined;
      const rowCount = range ? range.e.r - range.s.r + 1 : 0;
      const columnCount = range ? range.e.c - range.s.c + 1 : 0;
      if (rowCount > MAX_IMPORT_ROWS + 1) {
        throw new Error(`La hoja “${name}” supera el límite de ${MAX_IMPORT_ROWS} filas`);
      }
      if (columnCount > MAX_IMPORT_COLUMNS) {
        throw new Error(`La hoja “${name}” supera el límite de ${MAX_IMPORT_COLUMNS} columnas`);
      }
      totalCells += rowCount * columnCount;
      if (totalCells > MAX_IMPORT_CELLS) {
        throw new Error(
          `El libro supera el límite de ${MAX_IMPORT_CELLS.toLocaleString('es-MX')} celdas`,
        );
      }

      const rawMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: true,
        defval: null,
      });
      const formattedMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: false,
        defval: null,
        dateNF: 'yyyy-mm-dd',
      });
      const matrix = rawMatrix.map((row, rowIndex) =>
        row.map((value, columnIndex) =>
          preserveFormattedExcelValue(value, formattedMatrix[rowIndex]?.[columnIndex]),
        ),
      );

      return [
        {
          name,
          matrix,
        },
      ];
    });
    if (!sheets.length) throw new Error('El libro de Excel no contiene hojas');
    return sheets;
  }

  private createDelimitedDraft(
    source: Pick<
      ImportDraft,
      'kind' | 'fileName' | 'fileSize' | 'datasetName' | 'sourceBuffer' | 'sourceText'
    > & { delimiter?: ImportDelimiter },
  ): ImportDraft {
    const encoding: ImportEncoding = 'utf-8';
    let delimiter = source.delimiter ?? 'comma';
    let decimalSeparator: DecimalSeparator = '.';

    try {
      const text = source.sourceText ?? this.decodeBuffer(source.sourceBuffer, encoding);
      delimiter = source.delimiter ?? this.delimiterOption(detectDelimiter(text));
      decimalSeparator = delimiter === 'semicolon' ? ',' : '.';
    } catch {
      // The preview opens with an actionable encoding error.
    }

    return this.refreshDraft({
      ...source,
      encoding,
      delimiter,
      decimalSeparator,
      firstRowIsHeader: true,
      sheets: [],
      matrix: [],
      previewRows: [],
      columns: [],
    });
  }

  private refreshDraft(draft: ImportDraft): ImportDraft {
    let matrix: unknown[][] = [];

    try {
      if (draft.kind === 'workbook') {
        const sheet = draft.sheets.find((candidate) => candidate.name === draft.selectedSheet);
        if (!sheet) throw new Error('Selecciona una hoja válida del archivo de Excel');
        matrix = sheet.matrix;
      } else {
        const text = draft.sourceText ?? this.decodeBuffer(draft.sourceBuffer, draft.encoding);
        matrix = parseDelimited(text, DELIMITERS[draft.delimiter]);
      }

      const table = matrixToTable(matrix, {
        firstRowIsHeader: draft.firstRowIsHeader,
        decimalSeparator: draft.kind === 'workbook' ? undefined : draft.decimalSeparator,
      });
      return {
        ...draft,
        matrix,
        table,
        previewRows: this.previewRows(table),
        columns: table.columns.map((column) => ({
          key: column.key,
          name: column.name,
          dataType: column.data_type,
          missing: table.rows.reduce((count, row) => count + (row[column.key] === null ? 1 : 0), 0),
        })),
        error: undefined,
      };
    } catch (error) {
      return {
        ...draft,
        matrix,
        table: undefined,
        previewRows: [],
        columns: [],
        error: error instanceof Error ? error.message : 'No se pudo interpretar el origen de datos',
      };
    }
  }

  private updateImportDraft(changes: Partial<ImportDraft>): void {
    const draft = this.importDraft();
    if (!draft) return;
    this.importDraft.set(this.refreshDraft({ ...draft, ...changes }));
  }

  private openImportPreview(draft: ImportDraft, trigger: HTMLElement): void {
    this.importDraft.set(draft);
    this.setStatus('info', 'Revisa la previsualización antes de importar');
    this.getWindow()?.requestAnimationFrame(() => this.importPreview()?.open(trigger));
  }

  private previewRows(table: ImportedTable): CellValue[][] {
    const previewColumns = table.columns.slice(0, 20);
    return table.rows
      .slice(0, 8)
      .map((row) => previewColumns.map((column) => row[column.key] ?? null));
  }

  private decodeBuffer(buffer: ArrayBuffer | undefined, encoding: ImportEncoding): string {
    if (!buffer) throw new Error('No se encontró el contenido del archivo');
    return new TextDecoder(encoding, { fatal: encoding === 'utf-8' }).decode(buffer);
  }

  private delimiterOption(delimiter: string): ImportDelimiter {
    if (delimiter === '\t') return 'tab';
    if (delimiter === ';') return 'semicolon';
    return 'comma';
  }

  private getWindow(): Window | null {
    return typeof window === 'undefined' ? null : window;
  }

  private openAgentPopup(): Window | null {
    let popup: Window | null | undefined;
    try {
      popup = this.getWindow()?.open(
        'about:blank',
        `lobostats-agent-${crypto.randomUUID()}`,
        'popup,width=720,height=720',
      );
      if (!popup) return null;

      popup.opener = null;
      popup.document.title = 'Conectando con LoboStats Agent';
      popup.document.body.textContent = 'Conectando con LoboStats Agent...';
      return popup;
    } catch {
      popup?.close();
      return null;
    }
  }

  private parseValue(params: ValueParserParams, column: DatasetColumn): CellValue {
    try {
      return normalizeCell(params.newValue, column.data_type);
    } catch {
      const row = (params.node?.rowIndex ?? 0) + 1;
      this.setStatus(
        'error',
        `Fila ${row}, ${column.name}: escribe un número válido o deja la celda vacía`,
      );
      return params.oldValue as CellValue;
    }
  }

  private setStatus(kind: StatusKind, message: string): void {
    this.statusKind.set(kind);
    this.status.set(message);
  }

  private describeSaveError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) return 'No se pudo guardar el conjunto de datos';

    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo';
    }
    if (error.status === 401 || error.status === 403) {
      return 'No tienes autorización para guardar este conjunto de datos';
    }
    if (error.status === 413) {
      return 'El conjunto de datos supera el tamaño permitido por el servidor';
    }
    if (error.status === 422) {
      return 'El conjunto contiene datos no válidos. Revisa nombres, filas y columnas';
    }
    if (error.status >= 500) {
      return 'El servidor no pudo guardar los datos. Inténtalo de nuevo más tarde';
    }
    return 'No se pudo guardar el conjunto de datos';
  }
}
