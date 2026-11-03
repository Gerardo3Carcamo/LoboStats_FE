import type { CellValue } from './dataset';

export type AgentColumnType = 'number' | 'text' | 'date' | 'boolean' | 'unsupported';

export interface AgentMysqlColumn {
  name: string;
  mysqlType: string;
  lobostatsType: AgentColumnType;
  nullable: boolean;
  primaryKey: boolean;
  ordinalPosition: number;
}

export interface AgentMysqlSnapshot {
  source: {
    database: string;
    object: { name: string; type: 'table' | 'view' };
  };
  columns: AgentMysqlColumn[];
  rows: Array<Record<string, CellValue | boolean>>;
  limit: number;
  truncated: boolean;
  queryDurationMs: number;
}
