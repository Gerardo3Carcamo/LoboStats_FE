import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AnalysisApi } from '../../../core/services/analysis-api';
import { WorkspacePersistenceService } from '../../../core/services/workspace-persistence';
import { WorkspaceStore } from '../../../core/services/workspace-store';
import { AnalysisRun, ProbabilityResult } from '../../../models/analysis';
import { Dataset } from '../../../models/dataset';
import { Probability } from './probability';
import { PROBABILITY_TOUR_TARGETS } from './probability-tour';

describe('Probability', () => {
  let fixture: ComponentFixture<Probability>;
  let analysisApi: jasmine.SpyObj<AnalysisApi>;
  let persistence: jasmine.SpyObj<WorkspacePersistenceService>;

  const savedDataset: Dataset = {
    id: 9,
    owner_email: 'alumno@uadec.edu.mx',
    name: 'Espacio de cálculo',
    columns: [{ key: 'c1', name: 'Valor', data_type: 'number' }],
    rows: [],
    row_count: 0,
    revision: 1,
    content_sha256: 'b'.repeat(64),
    created_at: '2026-11-08T12:00:00Z',
    updated_at: '2026-11-08T12:00:00Z',
  };

  beforeEach(async () => {
    analysisApi = jasmine.createSpyObj<AnalysisApi>('AnalysisApi', [
      'probability',
      'probabilityCatalog',
      'list',
      'get',
    ]);
    persistence = jasmine.createSpyObj<WorkspacePersistenceService>('WorkspacePersistenceService', [
      'saveCurrent',
    ]);
    persistence.saveCurrent.and.resolveTo(savedDataset);
    analysisApi.probability.and.returnValue(of(probabilityRun()));
    analysisApi.probabilityCatalog.and.returnValue(
      of([
        {
          key: 'binomial',
          label: 'Binomial',
          kind: 'discrete',
          category: 'Frecuentes',
          description: 'Éxitos en ensayos',
          parameters: [
            {
              key: 'trials',
              label: 'Ensayos',
              default: 10,
              minimum: 1,
              maximum: 10000,
              step: 1,
              integer: true,
              required: true,
            },
            {
              key: 'success_probability',
              label: 'Probabilidad',
              default: 0.3,
              minimum: 0,
              maximum: 1,
              step: 0.01,
              integer: false,
              required: true,
            },
          ],
        },
        {
          key: 'normal',
          label: 'Normal',
          kind: 'continuous',
          category: 'Frecuentes',
          description: 'Mediciones continuas',
          parameters: [
            {
              key: 'mean',
              label: 'Media',
              default: 100,
              minimum: null,
              maximum: null,
              step: 0.1,
              integer: false,
              required: true,
            },
            {
              key: 'std_dev',
              label: 'Desviación',
              default: 15,
              minimum: 0.000001,
              maximum: 1000000,
              step: 0.1,
              integer: false,
              required: true,
            },
          ],
        },
        {
          key: 'custom_discrete',
          label: 'Discreta personalizada',
          kind: 'discrete',
          category: 'Discretas',
          description: 'Valores y probabilidades de la hoja',
          parameters: [
            {
              key: 'custom_values',
              label: 'Columna de valores',
              default: null,
              minimum: null,
              maximum: null,
              step: null,
              integer: false,
              required: true,
              kind: 'column',
            },
            {
              key: 'custom_probabilities',
              label: 'Columna de probabilidades',
              default: null,
              minimum: null,
              maximum: null,
              step: null,
              integer: false,
              required: true,
              kind: 'column',
            },
          ],
        },
      ]),
    );
    analysisApi.list.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [Probability],
      providers: [
        provideRouter([]),
        { provide: AnalysisApi, useValue: analysisApi },
        { provide: WorkspacePersistenceService, useValue: persistence },
      ],
    }).compileComponents();

    const store = TestBed.inject(WorkspaceStore);
    store.replace(savedDataset.columns, savedDataset.rows, savedDataset.name);
    fixture = TestBed.createComponent(Probability);
    fixture.autoDetectChanges();
  });

  it('saves the workspace and calculates the configured binomial event', async () => {
    const button = fixture.nativeElement.querySelector('.calculate-button') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(persistence.saveCurrent).toHaveBeenCalled();
    expect(analysisApi.probability).toHaveBeenCalledWith(
      9,
      jasmine.objectContaining({
        distribution: 'binomial',
        mode: 'event',
        operation: 'exact',
        trials: 10,
        success_probability: 0.3,
        lower: 3,
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('26.68');
  });

  it('uses interval events when normal is selected', () => {
    const distribution = fixture.nativeElement.querySelector(
      '.distribution-picker select',
    ) as HTMLSelectElement;
    distribution.value = 'normal';
    distribution.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const operation = fixture.nativeElement.querySelector(
      '.event-section select',
    ) as HTMLSelectElement;
    expect(operation.value).toBe('between');
    expect(Array.from(operation.options).some((option) => option.value === 'exact')).toBeFalse();
  });

  it('renders worksheet column selectors for a custom discrete distribution', () => {
    const distribution = fixture.nativeElement.querySelector(
      '.distribution-picker select',
    ) as HTMLSelectElement;
    distribution.value = 'custom_discrete';
    distribution.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const selectors = fixture.nativeElement.querySelectorAll(
      '.parameter-section select',
    ) as NodeListOf<HTMLSelectElement>;
    expect(selectors.length).toBe(2);
    expect(selectors[0].textContent).toContain('Valor');
  });

  it('separates inverse probability input from the resulting quantile', async () => {
    analysisApi.probability.and.returnValue(of(inverseRun()));
    const modes = fixture.nativeElement.querySelectorAll(
      '.mode-picker button',
    ) as NodeListOf<HTMLButtonElement>;
    modes[2].click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.calculate-button') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    const answer = fixture.nativeElement.querySelector('.probability-answer') as HTMLElement;
    expect(answer.dataset['mode']).toBe('inverse');
    expect(answer.textContent).toContain('Probabilidad de entrada');
    expect(answer.textContent).toContain('95');
    expect(answer.textContent).toContain('Cuantil resultante');
    expect(answer.textContent).toContain('124.672804');
  });

  it('renders every target required by the guided tour', () => {
    const root = fixture.nativeElement as HTMLElement;
    for (const target of Object.values(PROBABILITY_TOUR_TARGETS)) {
      expect(root.querySelector(`[data-tour="${target}"]`))
        .withContext(`Missing data-tour target: ${target}`)
        .not.toBeNull();
    }
  });
});

function probabilityRun(): AnalysisRun<ProbabilityResult> {
  return {
    id: 21,
    dataset_id: 9,
    dataset_revision: 1,
    dataset_sha256: 'b'.repeat(64),
    analysis_type: 'probability',
    status: 'completed',
    engine_version: 'probability-1.0',
    parameters: {},
    warnings: [],
    created_at: '2026-11-08T12:00:00Z',
    is_stale: false,
    result: {
      mode: 'event',
      calculation_label: 'Probabilidad del evento',
      result_value: 0.266827932,
      calculations: [{ index: 0, input: 3, result: 0.266827932, status: 'valid', error: null }],
      input: null,
      distribution: {
        key: 'binomial',
        label: 'Binomial',
        kind: 'discrete',
        parameters: { trials: 10, success_probability: 0.3 },
        mean: 3,
        variance: 2.1,
        std_dev: Math.sqrt(2.1),
      },
      event: { operation: 'exact', label: 'Exactamente 3', lower: 3, upper: null },
      probability: 0.266827932,
      percentage: 26.6827932,
      complement_probability: 0.733172068,
      model_formula: 'X ~ Binomial(n=10, p=0.3)',
      calculation_formula: 'P(X = 3)',
      event_formula: 'P(X = 3)',
      interpretation: 'La probabilidad de observar exactamente 3 es 26.68 %.',
      points: [
        { x: 0, value: 0.0282475, selected: false },
        { x: 1, value: 0.1210608, selected: false },
        { x: 2, value: 0.2334744, selected: false },
        { x: 3, value: 0.2668279, selected: true },
        { x: 4, value: 0.2001209, selected: false },
      ],
      guidance: ['Usa binomial para ensayos independientes.'],
    },
  };
}

function inverseRun(): AnalysisRun<ProbabilityResult> {
  const run = probabilityRun();
  return {
    ...run,
    id: 22,
    parameters: {
      distribution: 'normal',
      mode: 'inverse',
      mean: 100,
      std_dev: 12.59,
      input: { kind: 'constant', values: [0.95] },
    },
    result: {
      ...run.result,
      mode: 'inverse',
      calculation_label: 'Probabilidad acumulada inversa',
      result_value: 124.672804,
      calculations: [{ index: 0, input: 0.95, result: 124.672804, status: 'valid', error: null }],
      input: { kind: 'constant', values: [0.95] },
      distribution: {
        key: 'normal',
        label: 'Normal',
        kind: 'continuous',
        parameters: { mean: 100, std_dev: 12.59 },
        mean: 100,
        variance: 158.5081,
        std_dev: 12.59,
      },
      calculation_formula: 'F⁻¹(0.95)',
      interpretation: 'La probabilidad acumulada 0.95 corresponde al cuantil 124.673.',
      probability: undefined,
      percentage: undefined,
      complement_probability: undefined,
      event_formula: undefined,
      event: undefined,
    },
  };
}
