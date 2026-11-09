import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AnalysisApi } from '../../../core/services/analysis-api';
import { WorkspacePersistenceService } from '../../../core/services/workspace-persistence';
import { WorkspaceStore } from '../../../core/services/workspace-store';
import { AnalysisRun, DescriptiveResult } from '../../../models/analysis';
import { Dataset } from '../../../models/dataset';
import { DescriptiveStatistics } from './descriptive-statistics';
import { DESCRIPTIVE_TOUR_TARGETS } from './descriptive-statistics-tour';

describe('DescriptiveStatistics', () => {
  let fixture: ComponentFixture<DescriptiveStatistics>;
  let store: WorkspaceStore;
  let analysisApi: jasmine.SpyObj<AnalysisApi>;
  let persistence: jasmine.SpyObj<WorkspacePersistenceService>;

  const savedDataset: Dataset = {
    id: 7,
    owner_email: 'alumno@uadec.edu.mx',
    name: 'Ensayo',
    columns: [{ key: 'c1', name: 'Medición', data_type: 'number' }],
    rows: [{ c1: 1 }, { c1: 2 }],
    row_count: 2,
    revision: 1,
    content_sha256: 'a'.repeat(64),
    created_at: '2026-11-02T12:00:00Z',
    updated_at: '2026-11-02T12:00:00Z',
  };

  beforeEach(async () => {
    analysisApi = jasmine.createSpyObj<AnalysisApi>('AnalysisApi', ['descriptive', 'list', 'get']);
    persistence = jasmine.createSpyObj<WorkspacePersistenceService>('WorkspacePersistenceService', [
      'saveCurrent',
    ]);
    persistence.saveCurrent.and.resolveTo(savedDataset);
    analysisApi.descriptive.and.returnValue(of(descriptiveRun()));
    analysisApi.list.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [DescriptiveStatistics],
      providers: [
        provideRouter([]),
        { provide: AnalysisApi, useValue: analysisApi },
        { provide: WorkspacePersistenceService, useValue: persistence },
      ],
    }).compileComponents();

    store = TestBed.inject(WorkspaceStore);
    store.replace(savedDataset.columns, savedDataset.rows, savedDataset.name);
    fixture = TestBed.createComponent(DescriptiveStatistics);
    fixture.autoDetectChanges();
  });

  it('saves the current worksheet before requesting an analysis', async () => {
    const runButton = fixture.nativeElement.querySelector('.run-button') as HTMLButtonElement;
    runButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(persistence.saveCurrent).toHaveBeenCalled();
    expect(analysisApi.descriptive).toHaveBeenCalledWith(
      7,
      jasmine.objectContaining({ columns: ['c1'], histogram_bins: 10 }),
    );
    expect(fixture.nativeElement.textContent).toContain('Medición');
    expect(fixture.nativeElement.textContent).toContain('1.5');
    expect(store.filledRows()).toEqual([{ c1: 1 }, { c1: 2 }]);
  });

  it('renders every target required by the guided tour', () => {
    const root = fixture.nativeElement as HTMLElement;

    for (const target of Object.values(DESCRIPTIVE_TOUR_TARGETS)) {
      expect(root.querySelector(`[data-tour="${target}"]`))
        .withContext(`Missing data-tour target: ${target}`)
        .not.toBeNull();
    }
  });

  it('sends configurable percentiles as probabilities', async () => {
    const input = fixture.nativeElement.querySelector('#percentiles') as HTMLInputElement;
    input.value = '10, 50, 90';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.run-button') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(analysisApi.descriptive.calls.mostRecent().args[1].percentiles).toEqual([0.1, 0.5, 0.9]);
  });
});

function descriptiveRun(): AnalysisRun<DescriptiveResult> {
  return {
    id: 12,
    dataset_id: 7,
    dataset_revision: 1,
    dataset_sha256: 'a'.repeat(64),
    analysis_type: 'descriptive',
    status: 'completed',
    engine_version: 'descriptive-2.0',
    parameters: {},
    warnings: [],
    created_at: '2026-11-02T12:00:00Z',
    is_stale: false,
    result: {
      dataset: {
        id: 7,
        name: 'Ensayo',
        revision: 1,
        content_sha256: 'a'.repeat(64),
        row_count: 2,
      },
      selection: {
        columns: ['c1'],
        group_by: null,
        confidence_level: 0.95,
        percentiles: [0.25, 0.5, 0.75],
        histogram_bins: 10,
        frequency_limit: 25,
      },
      groups: [
        {
          value: null,
          label: 'Todos los datos',
          row_count: 2,
          columns: [
            {
              key: 'c1',
              name: 'Medición',
              data_type: 'number',
              total_count: 2,
              valid_count: 2,
              missing_count: 0,
              missing_percentage: 0,
              categorical: null,
              date: null,
              numeric: {
                mean: 1.5,
                median: 1.5,
                trimmed_mean: 1.5,
                mad: 0.5,
                geometric_mean: Math.sqrt(2),
                modes: [],
                mode_frequency: null,
                variance: 0.5,
                std_dev: Math.sqrt(0.5),
                std_error: 0.5,
                coefficient_of_variation: 47.14,
                minimum: 1,
                maximum: 2,
                range: 1,
                q1: 1,
                q3: 2,
                iqr: 1,
                sum: 3,
                sum_squares: 5,
                skewness: null,
                kurtosis_excess: null,
                percentiles: { p25: 1, p50: 1.5, p75: 2 },
                confidence_interval_mean: { level: 0.95, lower: -4.85, upper: 7.85 },
                confidence_interval_median: { level: 0.95, lower: 1, upper: 2 },
                confidence_interval_std_dev: { level: 0.95, lower: 0.32, upper: 22.5 },
                normality: null,
                histogram: { counts: [1, 0, 0, 1], edges: [1, 1.25, 1.5, 1.75, 2] },
                boxplot: {
                  lower_whisker: 1,
                  q1: 1,
                  median: 1.5,
                  q3: 2,
                  upper_whisker: 2,
                  outliers: [],
                  outlier_details: [],
                },
                qq_plot: { theoretical: [-0.5, 0.5], observed: [1, 2] },
                ecdf: { values: [1, 2], probabilities: [0.5, 1] },
              },
            },
          ],
        },
      ],
      missingness: {
        row_count: 2,
        complete_rows: 2,
        incomplete_rows: 0,
        incomplete_percentage: 0,
        columns: [{ key: 'c1', name: 'Medición', missing_count: 0, missing_percentage: 0 }],
      },
      guidance: ['La desviación estándar usa n - 1.'],
    },
  };
}
