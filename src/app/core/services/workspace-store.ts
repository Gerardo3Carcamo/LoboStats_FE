import { computed, effect, Injectable, signal } from '@angular/core';

import { CellValue, DataRow, Dataset, DatasetColumn, DatasetPayload } from '../../models/dataset';

const EMPTY_ROW_COUNT = 24;
const WORKSPACE_KEY = 'lobostats.workspace';
const REMOTE_WORKSPACE_KEY = 'lobostats.workspace.remote';
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
  readonly datasetId = signal<number | null>(null);
  readonly datasetRevision = signal<number | null>(null);
  readonly datasetContentSha256 = signal<string | null>(null);
  readonly dirty = signal(true);
  readonly filledRows = computed(() =>
    this.rows().filter((row) => Object.values(row).some(isFilled)),
  );

  constructor() {
    try {
      const cached = localStorage.getItem(WORKSPACE_KEY);
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
      const remote = localStorage.getItem(REMOTE_WORKSPACE_KEY);
      if (remote) {
        const parsedRemote: unknown = JSON.parse(remote);
        if (!isRemoteWorkspace(parsedRemote)) throw new Error('Invalid cached remote workspace');
        this.datasetId.set(parsedRemote.id);
        this.datasetRevision.set(parsedRemote.revision);
        this.datasetContentSha256.set(parsedRemote.contentSha256);
        this.dirty.set(parsedRemote.dirty);
      }
    } catch {
      try {
        localStorage.removeItem(WORKSPACE_KEY);
        localStorage.removeItem(REMOTE_WORKSPACE_KEY);
      } catch {
        // Storage can be unavailable in private or restricted browser contexts.
      }
    }

    effect(() => {
      try {
        localStorage.setItem(WORKSPACE_KEY, JSON.stringify(this.payload()));
        const datasetId = this.datasetId();
        const datasetRevision = this.datasetRevision();
        const contentSha256 = this.datasetContentSha256();
        if (datasetId && datasetRevision && contentSha256) {
          localStorage.setItem(
            REMOTE_WORKSPACE_KEY,
            JSON.stringify({
              id: datasetId,
              revision: datasetRevision,
              contentSha256,
              dirty: this.dirty(),
            }),
          );
        } else {
          localStorage.removeItem(REMOTE_WORKSPACE_KEY);
        }
      } catch {
        // Remote saving remains available when browser storage is unavailable.
      }
    });
  }

  updateCell(index: number, key: string, value: CellValue): void {
    this.rows.update((rows) =>
      rows.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
    );
    this.dirty.set(true);
  }

  addRow(): void {
    this.rows.update((rows) => [...rows, {}]);
    this.dirty.set(true);
  }

  rename(name: string): void {
    this.name.set(name);
    this.dirty.set(true);
  }

  replace(columns: DatasetColumn[], rows: DataRow[], name?: string): void {
    this.columns.set(columns);
    this.rows.set([...rows, ...blankRows()].slice(0, Math.max(EMPTY_ROW_COUNT, rows.length + 8)));
    if (name) this.name.set(name);
    this.datasetId.set(null);
    this.datasetRevision.set(null);
    this.datasetContentSha256.set(null);
    this.dirty.set(true);
  }

  markSaved(dataset: Dataset): void {
    this.datasetId.set(dataset.id);
    this.datasetRevision.set(dataset.revision);
    this.datasetContentSha256.set(dataset.content_sha256);
    this.dirty.set(false);
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

interface RemoteWorkspace {
  id: number;
  revision: number;
  contentSha256: string;
  dirty: boolean;
}

function isRemoteWorkspace(value: unknown): value is RemoteWorkspace {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RemoteWorkspace>;
  return (
    Number.isInteger(candidate.id) &&
    Number(candidate.id) > 0 &&
    Number.isInteger(candidate.revision) &&
    Number(candidate.revision) > 0 &&
    typeof candidate.contentSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(candidate.contentSha256) &&
    typeof candidate.dirty === 'boolean'
  );
}
