import { computed, effect, Injectable, signal } from '@angular/core';

import { CellValue, DataRow, DatasetColumn, DatasetPayload } from '../../models/dataset';

const EMPTY_ROW_COUNT = 24;
const DEFAULT_COLUMNS: DatasetColumn[] = [
  { key: 'c1', name: 'C1', data_type: 'number' },
  { key: 'c2', name: 'C2', data_type: 'number' },
  { key: 'c3', name: 'C3', data_type: 'number' },
  { key: 'c4', name: 'C4', data_type: 'number' },
];

function blankRows(): DataRow[] {
  return Array.from({ length: EMPTY_ROW_COUNT }, () => ({}));
}

@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  readonly name = signal('Hoja sin título');
  readonly columns = signal<DatasetColumn[]>(DEFAULT_COLUMNS);
  readonly rows = signal<DataRow[]>(blankRows());
  readonly filledRows = computed(() =>
    this.rows().filter((row) => Object.values(row).some(isFilled)),
  );

  constructor() {
    try {
      const cached = localStorage.getItem('lobostats.workspace');
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        if (!isDatasetPayload(parsed)) throw new Error('Invalid cached workspace');
        this.name.set(parsed.name);
        this.columns.set(parsed.columns);
        this.rows.set(
          [...parsed.rows, ...blankRows()].slice(
            0,
            Math.max(EMPTY_ROW_COUNT, parsed.rows.length + 8),
          ),
        );
      }
    } catch {
      try {
        localStorage.removeItem('lobostats.workspace');
      } catch {
        // Storage can be unavailable in private or restricted browser contexts.
      }
    }

    effect(() => {
      try {
        localStorage.setItem('lobostats.workspace', JSON.stringify(this.payload()));
      } catch {
        // Remote saving remains available when browser storage is unavailable.
      }
    });
  }

  updateCell(index: number, key: string, value: CellValue): void {
    this.rows.update((rows) =>
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
    );
  }

  addRow(): void {
    this.rows.update((rows) => [...rows, {}]);
  }

  replace(columns: DatasetColumn[], rows: DataRow[], name?: string): void {
    this.columns.set(columns);
    this.rows.set([...rows, ...blankRows()].slice(0, Math.max(EMPTY_ROW_COUNT, rows.length + 8)));
    if (name) this.name.set(name);
  }

  payload(): DatasetPayload {
    return {
      name: this.name(),
      columns: this.columns(),
      rows: this.filledRows(),
    };
  }
}

function isFilled(value: CellValue): boolean {
  return value !== null && value !== '' && value !== undefined;
}

function isDatasetPayload(value: unknown): value is DatasetPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DatasetPayload>;
  if (typeof candidate.name !== 'string' || !Array.isArray(candidate.columns)) return false;
  if (!Array.isArray(candidate.rows)) return false;

  return candidate.columns.every(
    (column) =>
      !!column &&
      typeof column === 'object' &&
      typeof column.key === 'string' &&
      typeof column.name === 'string' &&
      (column.data_type === 'number' || column.data_type === 'text' || column.data_type === 'date'),
  );
}
