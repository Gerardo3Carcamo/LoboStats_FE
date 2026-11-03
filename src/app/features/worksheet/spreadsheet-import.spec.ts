import {
  detectDelimiter,
  matrixToTable,
  mysqlSnapshotToTable,
  normalizeCell,
  parseDelimited,
  preserveFormattedExcelValue,
} from './spreadsheet-import';

describe('spreadsheet import', () => {
  it('parses quoted CSV cells and CRLF rows', () => {
    const rows = parseDelimited('Nombre,Nota\r\n"Ana, María",10');

    expect(rows).toEqual([
      ['Nombre', 'Nota'],
      ['Ana, María', '10'],
    ]);
  });

  it('ignores tabs inside quoted CSV cells when detecting the delimiter', () => {
    expect(parseDelimited('A,B\n"x\ty",1')).toEqual([
      ['A', 'B'],
      ['x\ty', '1'],
    ]);
  });

  it('preserves whitespace inside quoted cells', () => {
    expect(parseDelimited('A,B\n"  valor  ",1')).toEqual([
      ['A', 'B'],
      ['  valor  ', '1'],
    ]);
  });

  it('rejects a quoted cell that was not closed', () => {
    expect(() => parseDelimited('A,B\n"valor,1')).toThrowError(
      'El archivo contiene una celda con comillas sin cerrar',
    );
  });

  it('rejects text after a quoted cell is closed', () => {
    expect(() => parseDelimited('A,B\n"valor"x,1')).toThrowError(
      'El archivo contiene texto después de una comilla de cierre',
    );
  });

  it('detects semicolon-delimited data', () => {
    const text = 'Nombre;Puntaje\nAna;95';

    expect(detectDelimiter(text)).toBe(';');
    expect(parseDelimited(text)).toEqual([
      ['Nombre', 'Puntaje'],
      ['Ana', '95'],
    ]);
  });

  it('stops parsing when a row exceeds the column limit', () => {
    const row = Array.from({ length: 501 }, (_, index) => `C${index + 1}`).join(',');

    expect(() => parseDelimited(row)).toThrowError('El archivo supera el límite de 500 columnas');
  });

  it('preserves identifiers with leading zeros as text', () => {
    const table = matrixToTable([['Código'], ['001'], ['A02']]);

    expect(table.columns[0].data_type).toBe('text');
    expect(table.rows).toEqual([{ c1: '001' }, { c1: 'A02' }]);
  });

  it('treats an all-numeric identifier column with leading zeros as text', () => {
    const table = matrixToTable([['Matrícula'], ['001'], ['002']]);

    expect(table.columns[0].data_type).toBe('text');
    expect(table.rows).toEqual([{ c1: '001' }, { c1: '002' }]);
  });

  it('normalizes decimal commas in numeric columns', () => {
    const table = matrixToTable([['Medición'], ['1,5'], ['2,0']]);

    expect(table.columns[0].data_type).toBe('number');
    expect(table.rows).toEqual([{ c1: 1.5 }, { c1: 2 }]);
  });

  it('does not interpret a comma as decimal when point is selected', () => {
    const table = matrixToTable([['Medición'], ['1,234'], ['2,345']], {
      decimalSeparator: '.',
    });

    expect(table.columns[0].data_type).toBe('text');
    expect(table.rows).toEqual([{ c1: '1,234' }, { c1: '2,345' }]);
  });

  it('preserves unsafe integer strings as text', () => {
    const table = matrixToTable([['Folio'], ['9007199254740993'], ['9007199254740994']]);

    expect(table.columns[0].data_type).toBe('text');
    expect(table.rows).toEqual([{ c1: '9007199254740993' }, { c1: '9007199254740994' }]);
  });

  it('rejects unsafe integer text in an explicitly numeric column', () => {
    expect(() => normalizeCell('9007199254740993', 'number')).toThrowError(
      '“9007199254740993” no es un valor numérico válido',
    );
  });

  it('normalizes imported dates to ISO text', () => {
    const date = new Date(2026, 8, 28);
    const table = matrixToTable([['Fecha'], [date]]);

    expect(table.columns[0].data_type).toBe('date');
    expect(table.rows).toEqual([{ c1: '2026-09-28' }]);
  });

  it('preserves formatted Excel identifiers with leading zeros', () => {
    expect(preserveFormattedExcelValue(1, '001')).toBe('001');
    expect(preserveFormattedExcelValue(12.5, '12.5')).toBe(12.5);
  });

  it('treats whitespace as a missing value instead of zero', () => {
    expect(normalizeCell('   ', 'number')).toBeNull();
  });

  it('rejects text entered as a numeric value', () => {
    expect(() => normalizeCell('abc', 'number')).toThrowError(
      '“abc” no es un valor numérico válido',
    );
  });

  it('fills missing cells in irregular rows with null', () => {
    const table = matrixToTable([['A', 'B'], ['1'], ['2', '3']]);

    expect(table.rows).toEqual([
      { c1: 1, c2: null },
      { c1: 2, c2: 3 },
    ]);
  });

  it('keeps the first row as data when the file has no headers', () => {
    const table = matrixToTable(
      [
        ['1', '2'],
        ['3', '4'],
      ],
      { firstRowIsHeader: false },
    );

    expect(table.columns.map((column) => column.name)).toEqual(['C1', 'C2']);
    expect(table.rows).toEqual([
      { c1: 1, c2: 2 },
      { c1: 3, c2: 4 },
    ]);
  });

  it('rejects an empty matrix', () => {
    expect(() => matrixToTable([])).toThrowError('El archivo no contiene datos');
  });

  it('converts a typed MySQL snapshot without losing booleans or dates', () => {
    const table = mysqlSnapshotToTable({
      source: { database: 'lab', object: { name: 'mediciones', type: 'table' } },
      columns: [
        mysqlColumn('id', 'number', 'int'),
        mysqlColumn('activo', 'boolean', 'tinyint(1)'),
        mysqlColumn('fecha', 'date', 'date'),
      ],
      rows: [
        { id: '1', activo: true, fecha: '2026-11-02' },
        { id: '2', activo: false, fecha: null },
      ],
      limit: 100_000,
      truncated: false,
      queryDurationMs: 5,
    });

    expect(table.columns).toEqual([
      { key: 'c1', name: 'id', data_type: 'number' },
      { key: 'c2', name: 'activo', data_type: 'text' },
      { key: 'c3', name: 'fecha', data_type: 'date' },
    ]);
    expect(table.rows).toEqual([
      { c1: 1, c2: 'true', c3: '2026-11-02' },
      { c1: 2, c2: 'false', c3: null },
    ]);
  });

  it('preserves unsafe MySQL integers as text', () => {
    const table = mysqlSnapshotToTable({
      source: { database: 'lab', object: { name: 'folios', type: 'table' } },
      columns: [mysqlColumn('folio', 'number', 'bigint')],
      rows: [{ folio: '9007199254740993' }],
      limit: 100_000,
      truncated: false,
      queryDurationMs: 2,
    });

    expect(table.columns[0].data_type).toBe('text');
    expect(table.rows).toEqual([{ c1: '9007199254740993' }]);
  });

  it('preserves high-precision MySQL decimals as text', () => {
    const table = mysqlSnapshotToTable({
      source: { database: 'lab', object: { name: 'exactos', type: 'table' } },
      columns: [mysqlColumn('valor', 'number', 'decimal(20,2)')],
      rows: [{ valor: '123456789012345.67' }],
      limit: 100_000,
      truncated: false,
      queryDurationMs: 2,
    });

    expect(table.columns[0].data_type).toBe('text');
    expect(table.rows).toEqual([{ c1: '123456789012345.67' }]);
  });
});

function mysqlColumn(
  name: string,
  lobostatsType: 'number' | 'text' | 'date' | 'boolean',
  mysqlType: string,
) {
  return {
    name,
    mysqlType,
    lobostatsType,
    nullable: true,
    primaryKey: false,
    ordinalPosition: 1,
  } as const;
}
