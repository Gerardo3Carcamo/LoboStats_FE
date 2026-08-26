export type DataValue = string | number | boolean | null;
export type DataRow = Record<string, DataValue>;

export interface DatasetColumn {
  name: string;
  type: string;
  missing: number;
  unique: number;
}

export interface Dataset {
  id: string;
  name: string;
  row_count: number;
  column_count: number;
  columns: DatasetColumn[];
  preview: DataRow[];
}

export interface ManualDataset {
  name: string;
  columns: string[];
  rows: DataValue[][];
}

export type ApiResult = Record<string, unknown>;
