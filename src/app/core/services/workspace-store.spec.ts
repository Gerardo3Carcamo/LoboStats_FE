import { TestBed } from '@angular/core/testing';

import { WorkspaceStore } from './workspace-store';

describe('WorkspaceStore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('adds an aligned computed column and marks the workspace dirty', () => {
    const store = TestBed.inject(WorkspaceStore);
    store.replace(
      [{ key: 'score', name: 'Puntaje', data_type: 'number' }],
      [{ score: 80 }, { score: 90 }],
      'Resultados',
    );

    const column = store.addComputedColumn('CDF Normal', [0.2, 0.8]);

    expect(column.key).toBe('calc_cdf_normal');
    expect(store.columns().at(-1)?.name).toBe('CDF Normal');
    expect(store.rows()[0][column.key]).toBe(0.2);
    expect(store.rows()[1][column.key]).toBe(0.8);
    expect(store.dirty()).toBeTrue();
  });

  it('rejects duplicate computed column names', () => {
    const store = TestBed.inject(WorkspaceStore);
    store.addComputedColumn('Resultado', [1]);

    expect(() => store.addComputedColumn('resultado', [2])).toThrowError(
      'Ya existe una columna con ese nombre',
    );
  });
});
