import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AnalysisApi } from '../../../core/services/analysis-api';
import { WorkspacePersistenceService } from '../../../core/services/workspace-persistence';
import { WorkspaceStore } from '../../../core/services/workspace-store';
import { AnalysisRun, RegressionResult } from '../../../models/analysis';
import { Dataset } from '../../../models/dataset';
import { Regression } from './regression';
import { REGRESSION_TOUR_TARGETS } from './regression-tour';

describe('Regression', () => {
  let fixture: ComponentFixture<Regression>;
  let analysisApi: jasmine.SpyObj<AnalysisApi>;
  let persistence: jasmine.SpyObj<WorkspacePersistenceService>;

  const savedDataset: Dataset = {
    id: 11,
    owner_email: 'alumno@uadec.edu.mx',
    name: 'Modelo de ventas',
    columns: [
      { key: 'sales', name: 'Ventas', data_type: 'number' },
      { key: 'traffic', name: 'Tráfico', data_type: 'number' },
      { key: 'income', name: 'Ingreso', data_type: 'number' },
    ],
    rows: [
      { sales: 12, traffic: 3, income: 4 },
      { sales: 18, traffic: 5, income: 6 },
      { sales: 24, traffic: 7, income: 8 },
    ],
    row_count: 3,
    revision: 1,
    content_sha256: 'c'.repeat(64),
    created_at: '2026-11-25T12:00:00Z',
    updated_at: '2026-11-25T12:00:00Z',
  };

  beforeEach(async () => {
    analysisApi = jasmine.createSpyObj<AnalysisApi>('AnalysisApi', [
      'regressionCatalog',
      'regression',
      'list',
      'get',
    ]);
    analysisApi.regressionCatalog.and.returnValue(of([]));
    analysisApi.regression.and.returnValue(of(regressionRun()));
    analysisApi.list.and.returnValue(of([]));
    persistence = jasmine.createSpyObj<WorkspacePersistenceService>('WorkspacePersistenceService', [
      'saveCurrent',
    ]);
    persistence.saveCurrent.and.resolveTo(savedDataset);

    await TestBed.configureTestingModule({
      imports: [Regression],
      providers: [
        provideRouter([]),
        { provide: AnalysisApi, useValue: analysisApi },
        { provide: WorkspacePersistenceService, useValue: persistence },
      ],
    }).compileComponents();

    const store = TestBed.inject(WorkspaceStore);
    store.replace(savedDataset.columns, savedDataset.rows, savedDataset.name);
    fixture = TestBed.createComponent(Regression);
    fixture.autoDetectChanges();
  });

  it('saves the worksheet and fits a linear model', async () => {
    const button = fixture.nativeElement.querySelector('.run-button') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(persistence.saveCurrent).toHaveBeenCalled();
    expect(analysisApi.regression).toHaveBeenCalledWith(
      11,
      jasmine.objectContaining({
        model: 'linear',
        response: 'sales',
        predictors: ['traffic', 'income'],
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('Ventas = 2 + 2·Tráfico + 1·Ingreso');
    expect(fixture.nativeElement.textContent).toContain('0.98');
  });

  it('renders every target required by the guided tour', () => {
    const root = fixture.nativeElement as HTMLElement;
    for (const target of Object.values(REGRESSION_TOUR_TARGETS)) {
      expect(root.querySelector(`[data-tour="${target}"]`))
        .withContext(`Missing data-tour target: ${target}`)
        .not.toBeNull();
    }
  });
});

function regressionRun(): AnalysisRun<RegressionResult> {
  return {
    id: 31,
    dataset_id: 11,
    dataset_revision: 1,
    dataset_sha256: 'c'.repeat(64),
    analysis_type: 'regression',
    status: 'completed',
    engine_version: 'regression-1.0',
    parameters: {},
    warnings: [],
    created_at: '2026-11-25T12:00:00Z',
    is_stale: false,
    result: {
      dataset: {
        id: 11,
        name: 'Modelo de ventas',
        revision: 1,
        content_sha256: 'c'.repeat(64),
        row_count: 3,
      },
      model: {
        key: 'linear',
        label: 'Regresión lineal',
        category: 'Respuesta continua',
        response: 'sales',
        predictors: ['traffic', 'income'],
      },
      equation: 'Ventas = 2 + 2·Tráfico + 1·Ingreso',
      fit: {
        n: 3,
        r_squared: 0.98,
        adjusted_r_squared: 0.96,
        predicted_r_squared: 0.91,
      },
      coefficients: [
        { term: 'Constante', coefficient: 2, p_value: 0.04 },
        { term: 'Tráfico', coefficient: 2, p_value: 0.01 },
        { term: 'Ingreso', coefficient: 1, p_value: 0.03 },
      ],
      anova: [],
      diagnostics: {},
      predictions: [
        { row: 1, observed: 12, fitted: 12, residual: 0 },
        { row: 2, observed: 18, fitted: 18, residual: 0 },
        { row: 3, observed: 24, fitted: 24, residual: 0 },
      ],
      plots: {
        observed_fitted: { observed: [12, 18, 24], fitted: [12, 18, 24] },
        residuals: { fitted: [12, 18, 24], residual: [0, 0, 0] },
      },
      guidance: ['Revise los residuos.'],
    },
  };
}
