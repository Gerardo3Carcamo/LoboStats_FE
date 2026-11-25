import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AnalysisApi } from '../../../core/services/analysis-api';
import { WorkspacePersistenceService } from '../../../core/services/workspace-persistence';
import { WorkspaceStore } from '../../../core/services/workspace-store';
import { AnalysisRun, HypothesisResult } from '../../../models/analysis';
import { Dataset } from '../../../models/dataset';
import { Hypothesis } from './hypothesis';
import { HYPOTHESIS_TOUR_TARGETS } from './hypothesis-tour';

describe('Hypothesis', () => {
  let fixture: ComponentFixture<Hypothesis>;
  let analysisApi: jasmine.SpyObj<AnalysisApi>;
  let persistence: jasmine.SpyObj<WorkspacePersistenceService>;

  const savedDataset: Dataset = {
    id: 9,
    owner_email: 'alumno@uadec.edu.mx',
    name: 'Contraste',
    columns: [
      { key: 'value', name: 'Valor', data_type: 'number' },
      { key: 'group', name: 'Grupo', data_type: 'text' },
    ],
    rows: [
      { value: 18, group: 'A' },
      { value: 20, group: 'A' },
      { value: 22, group: 'B' },
    ],
    row_count: 3,
    revision: 1,
    content_sha256: 'a'.repeat(64),
    created_at: '2026-11-25T12:00:00Z',
    updated_at: '2026-11-25T12:00:00Z',
  };

  beforeEach(async () => {
    analysisApi = jasmine.createSpyObj<AnalysisApi>('AnalysisApi', [
      'hypothesisCatalog',
      'hypothesis',
      'list',
      'get',
    ]);
    analysisApi.hypothesisCatalog.and.returnValue(of([]));
    analysisApi.hypothesis.and.returnValue(of(hypothesisRun()));
    analysisApi.list.and.returnValue(of([]));
    persistence = jasmine.createSpyObj<WorkspacePersistenceService>('WorkspacePersistenceService', [
      'saveCurrent',
    ]);
    persistence.saveCurrent.and.resolveTo(savedDataset);

    await TestBed.configureTestingModule({
      imports: [Hypothesis],
      providers: [
        provideRouter([]),
        { provide: AnalysisApi, useValue: analysisApi },
        { provide: WorkspacePersistenceService, useValue: persistence },
      ],
    }).compileComponents();

    const store = TestBed.inject(WorkspaceStore);
    store.replace(savedDataset.columns, savedDataset.rows, savedDataset.name);
    fixture = TestBed.createComponent(Hypothesis);
    fixture.autoDetectChanges();
  });

  it('saves the worksheet and runs a one-sample t test', async () => {
    const button = fixture.nativeElement.querySelector('.run-button') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(persistence.saveCurrent).toHaveBeenCalled();
    expect(analysisApi.hypothesis).toHaveBeenCalledWith(
      9,
      jasmine.objectContaining({
        test: 'one_sample_t',
        column: 'value',
        alternative: 'two_sided',
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('No se rechaza H₀');
    expect(fixture.nativeElement.textContent).toContain('0.42');
  });

  it('renders every target required by the guided tour', () => {
    const root = fixture.nativeElement as HTMLElement;
    for (const target of Object.values(HYPOTHESIS_TOUR_TARGETS)) {
      expect(root.querySelector(`[data-tour="${target}"]`))
        .withContext(`Missing data-tour target: ${target}`)
        .not.toBeNull();
    }
  });
});

function hypothesisRun(): AnalysisRun<HypothesisResult> {
  return {
    id: 22,
    dataset_id: 9,
    dataset_revision: 1,
    dataset_sha256: 'a'.repeat(64),
    analysis_type: 'hypothesis',
    status: 'completed',
    engine_version: 'hypothesis-1.0',
    parameters: {},
    warnings: [],
    created_at: '2026-11-25T12:00:00Z',
    is_stale: false,
    result: {
      dataset: {
        id: 9,
        name: 'Contraste',
        revision: 1,
        content_sha256: 'a'.repeat(64),
        row_count: 3,
      },
      test: { key: 'one_sample_t', label: 't de una muestra', category: 'Medias' },
      hypotheses: { null: 'H₀: μ = 0', alternative: 'H₁: μ ≠ 0' },
      alpha: 0.05,
      confidence_level: 0.95,
      alternative: 'two_sided',
      method: 't de una muestra',
      result: {
        statistic: 0.81,
        p_value: 0.42,
        degrees_of_freedom: 2,
        estimate: 20,
        null_value: 0,
        confidence_interval: { level: 0.95, lower: 15, upper: 25 },
        details: { n: 3, mean: 20, std_dev: 2 },
      },
      decision: 'fail_to_reject',
      interpretation: 'Con α = 0.05, no se rechaza la hipótesis nula.',
      guidance: ['Revise el tamaño del efecto.'],
    },
  };
}
