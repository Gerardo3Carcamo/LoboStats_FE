export type DataType = 'number' | 'text' | 'date';
export type CellValue = string | number | null;
export type DataRow = Record<string, CellValue>;

export interface DatasetColumn {
  key: string;
  name: string;
  data_type: DataType;
}

export interface DatasetPayload {
  name: string;
  columns: DatasetColumn[];
  rows: DataRow[];
}

export interface Dataset extends DatasetPayload {
  id: number;
  owner_email: string;
  row_count: number;
  created_at: string;
  updated_at: string;
}
