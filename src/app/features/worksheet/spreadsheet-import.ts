import type { CellValue, DataRow, DatasetColumn, DataType } from '../../models/dataset';

export const MAX_IMPORT_COLUMNS = 500;
export const MAX_IMPORT_ROWS = 100_000;
export const MAX_IMPORT_CELLS = 1_000_000;
const MAX_COLUMN_NAME_LENGTH = 120;
const NUMERIC_PATTERN = /^[+-]?(?:(?:\d+(?:[.,]\d*)?)|(?:[.,]\d+))(?:[eE][+-]?\d+)?$/;

export type DecimalSeparator = '.' | ',';

export interface ImportedTable {
  columns: DatasetColumn[];
  rows: DataRow[];
}

export interface MatrixToTableOptions {
  firstRowIsHeader?: boolean;
  decimalSeparator?: DecimalSeparator;
}

export function parseDelimited(text: string, delimiter?: string): string[][] {
  const separator = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let cellWasQuoted = false;
  let quoteClosed = false;
  let cellCount = 0;

  const pushCell = (): void => {
    row.push(cellWasQuoted ? cell : cell.trim());
    cellCount += 1;
    if (row.length > MAX_IMPORT_COLUMNS) {
      throw new Error(`El archivo supera el límite de ${MAX_IMPORT_COLUMNS} columnas`);
    }
    if (cellCount > MAX_IMPORT_CELLS + MAX_IMPORT_COLUMNS) {
      throw new Error(
        `El archivo supera el límite de ${MAX_IMPORT_CELLS.toLocaleString('es-MX')} celdas`,
      );
    }
    cell = '';
    cellWasQuoted = false;
    quoteClosed = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"' && !quoted && cell === '') {
      quoted = true;
      cellWasQuoted = true;
    } else if (character === '"' && quoted) {
      quoted = false;
      quoteClosed = true;
    } else if (character === '"') {
      throw new Error('El archivo contiene comillas en una posición no válida');
    } else if (character === separator && !quoted) {
      pushCell();
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      pushCell();
      if (row.some((value) => value !== '')) rows.push(row);
      if (rows.length > MAX_IMPORT_ROWS + 1) {
        throw new Error(
          `El archivo supera el límite de ${MAX_IMPORT_ROWS.toLocaleString('es-MX')} filas`,
        );
      }
      row = [];
    } else if (quoteClosed && character.trim() !== '') {
      throw new Error('El archivo contiene texto después de una comilla de cierre');
    } else {
      if (!quoteClosed) cell += character;
    }
  }

  if (quoted) throw new Error('El archivo contiene una celda con comillas sin cerrar');

  pushCell();
  if (row.some((value) => value !== '')) rows.push(row);
  return rows;
}

export function matrixToTable(
  matrix: unknown[][],
  options: MatrixToTableOptions = {},
): ImportedTable {
  if (!matrix.length || !matrix[0]?.length) throw new Error('El archivo no contiene datos');
  const width = matrix.reduce((maximum, row) => Math.max(maximum, row.length), 0);
  if (width > MAX_IMPORT_COLUMNS) {
    throw new Error(`El archivo supera el límite de ${MAX_IMPORT_COLUMNS} columnas`);
  }

  const firstRowIsHeader = options.firstRowIsHeader ?? true;
  const headers = firstRowIsHeader ? matrix[0] : [];
  const rawRows = firstRowIsHeader ? matrix.slice(1) : matrix;
  if (rawRows.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `El archivo supera el límite de ${MAX_IMPORT_ROWS.toLocaleString('es-MX')} filas`,
    );
  }
  if (rawRows.length * width > MAX_IMPORT_CELLS) {
    throw new Error(
      `El archivo supera el límite de ${MAX_IMPORT_CELLS.toLocaleString('es-MX')} celdas`,
    );
  }

  const columns: DatasetColumn[] = Array.from({ length: width }, (_, index) => {
    const values = rawRows.map((row) => row[index]).filter(isFilled);
    const rawName = headers[index];
    const name =
      rawName === null || rawName === undefined || String(rawName).trim() === ''
        ? `C${index + 1}`
        : String(rawName).trim();
    if (name.length > MAX_COLUMN_NAME_LENGTH) {
      throw new Error(
        `El nombre de la columna ${index + 1} supera ${MAX_COLUMN_NAME_LENGTH} caracteres`,
      );
    }

    return {
      key: `c${index + 1}`,
      name,
      data_type: inferType(values, options.decimalSeparator),
    };
  });
  const rows = rawRows
    .filter((row) => row.some(isFilled))
    .map((values) =>
      Object.fromEntries(
        columns.map((column, index) => [
          column.key,
          normalizeCell(values[index], column.data_type, options.decimalSeparator),
        ]),
      ),
    );
  return { columns, rows };
}

export function normalizeCell(
  value: unknown,
  type: DataType,
  decimalSeparator?: DecimalSeparator,
): CellValue {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new Error('La celda contiene una fecha no válida');
    return formatLocalDate(value);
  }

  if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) {
    throw new Error('La celda contiene un entero que supera el rango seguro');
  }

  const text = String(value);
  if (text.trim() === '') return null;

  if (type === 'number') {
    const parsed = parseNumericValue(text, decimalSeparator);
    if (parsed === null) throw new Error(`“${text}” no es un valor numérico válido`);
    return parsed;
  }

  return text;
}

function inferType(values: unknown[], decimalSeparator?: DecimalSeparator): DataType {
  if (values.length && values.every((value) => value instanceof Date)) return 'date';
  if (values.length && values.every((value) => isNumericValue(value, decimalSeparator))) {
    return 'number';
  }
  return 'text';
}

function isNumericValue(value: unknown, decimalSeparator?: DecimalSeparator): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value));
  }
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (/^[+-]?0\d+$/.test(trimmed)) return false;
  if (/^[+-]?\d+$/.test(trimmed) && !Number.isSafeInteger(Number(trimmed))) return false;
  return parseNumericValue(trimmed, decimalSeparator) !== null;
}

function isFilled(value: unknown): boolean {
  return (
    value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '')
  );
}

function parseNumericValue(value: string, decimalSeparator?: DecimalSeparator): number | null {
  const trimmed = value.trim();
  if (decimalSeparator) {
    const escapedSeparator = decimalSeparator === '.' ? '\\.' : ',';
    const pattern = new RegExp(
      `^[+-]?(?:(?:\\d+(?:${escapedSeparator}\\d*)?)|(?:${escapedSeparator}\\d+))(?:[eE][+-]?\\d+)?$`,
    );
    if (!pattern.test(trimmed)) return null;
  } else if (!NUMERIC_PATTERN.test(trimmed)) {
    return null;
  }

  const normalized =
    decimalSeparator === ',' || (!decimalSeparator && trimmed.includes(','))
      ? trimmed.replace(',', '.')
      : trimmed;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  if (Number.isInteger(parsed) && !Number.isSafeInteger(parsed)) return null;
  return parsed;
}

export function detectDelimiter(text: string): string {
  let quoted = false;
  let commas = 0;
  let semicolons = 0;
  let tabs = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') {
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (!quoted && (character === '\n' || character === '\r')) {
      break;
    } else if (!quoted && character === ',') {
      commas += 1;
    } else if (!quoted && character === ';') {
      semicolons += 1;
    } else if (!quoted && character === '\t') {
      tabs += 1;
    }
  }

  if (semicolons > 0 && /\d,\d/.test(text.split(/\r?\n/, 1)[0] ?? '')) return ';';
  if (tabs > commas && tabs > semicolons) return '\t';
  return semicolons > commas ? ';' : ',';
}

export function preserveFormattedExcelValue(raw: unknown, formatted: unknown): unknown {
  if (
    typeof raw === 'number' &&
    Number.isSafeInteger(raw) &&
    typeof formatted === 'string' &&
    /^[+-]?0\d+$/.test(formatted.trim())
  ) {
    return formatted.trim();
  }
  return raw;
}

function formatLocalDate(value: Date): string {
  const pad = (part: number): string => String(part).padStart(2, '0');
  const date = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const time = `${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  return time === '00:00:00' ? date : `${date}T${time}`;
}
