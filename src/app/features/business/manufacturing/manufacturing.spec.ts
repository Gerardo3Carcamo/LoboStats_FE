import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { AnalysisApi } from '../../../core/services/analysis-api';
import { WorkspacePersistenceService } from '../../../core/services/workspace-persistence';
import { WorkspaceStore } from '../../../core/services/workspace-store';
import { AnalysisRun, ManufacturingResult } from '../../../models/analysis';
import { Dataset } from '../../../models/dataset';
import { Manufacturing } from './manufacturing';
import { MANUFACTURING_TOUR_TARGETS } from './manufacturing-tour';

describe('Manufacturing', () => {
  let fixture: ComponentFixture<Manufacturing>;
  let analysisApi: jasmine.SpyObj<AnalysisApi>;
  let persistence: jasmine.SpyObj<WorkspacePersistenceService>;

  const savedDataset: Dataset = {
    id: 13,
    owner_email: 'alumno@uadec.edu.mx',
    name: 'Turnos planta norte',
    columns: [
      { key: 'planned', name: 'Tiempo programado', data_type: 'number' },
      { key: 'operating', name: 'Tiempo operativo', data_type: 'number' },
      { key: 'ideal', name: 'Ciclo ideal', data_type: 'number' },
      { key: 'total', name: 'Unidades totales', data_type: 'number' },
      { key: 'good', name: 'Unidades buenas', data_type: 'number' },
    ],
    rows: [{ planned: 480, operating: 400, ideal: 60, total: 360, good: 350 }],
    row_count: 1,
    revision: 1,
    content_sha256: 'd'.repeat(64),
    created_at: '2026-11-25T12:00:00Z',
    updated_at: '2026-11-25T12:00:00Z',
  };

  beforeEach(async () => {
    analysisApi = jasmine.createSpyObj<AnalysisApi>('AnalysisApi', [
      'manufacturing',
      'list',
      'get',
    ]);
    analysisApi.manufacturing.and.returnValue(of(manufacturingRun()));
    analysisApi.list.and.returnValue(of([]));
    persistence = jasmine.createSpyObj<WorkspacePersistenceService>('WorkspacePersistenceService', [
      'saveCurrent',
    ]);
    persistence.saveCurrent.and.resolveTo(savedDataset);

    await TestBed.configureTestingModule({
      imports: [Manufacturing],
      providers: [
        provideRouter([]),
        { provide: AnalysisApi, useValue: analysisApi },
        { provide: WorkspacePersistenceService, useValue: persistence },
      ],
    }).compileComponents();

    const store = TestBed.inject(WorkspaceStore);
    store.replace(savedDataset.columns, savedDataset.rows, savedDataset.name);
    fixture = TestBed.createComponent(Manufacturing);
    fixture.autoDetectChanges();
  });

  it('maps a shift summary and calculates plant metrics', async () => {
    const button = fixture.nativeElement.querySelector('.run-button') as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(persistence.saveCurrent).toHaveBeenCalled();
    expect(analysisApi.manufacturing).toHaveBeenCalledWith(
      13,
      jasmine.objectContaining({
        mode: 'summary',
        mapping: jasmine.objectContaining({
          planned_time: 'planned',
          operating_time: 'operating',
          total_count: 'total',
          good_count: 'good',
        }),
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('OEE');
    expect(fixture.nativeElement.textContent).toContain('72.9 %');
  });

  it('renders every target required by the guided tour', () => {
    const root = fixture.nativeElement as HTMLElement;
    for (const target of Object.values(MANUFACTURING_TOUR_TARGETS)) {
      expect(root.querySelector(`[data-tour="${target}"]`))
        .withContext(`Missing data-tour target: ${target}`)
        .not.toBeNull();
    }
  });
});

function manufacturingRun(): AnalysisRun<ManufacturingResult> {
  return {
    id: 41,
    dataset_id: 13,
    dataset_revision: 1,
    dataset_sha256: 'd'.repeat(64),
    analysis_type: 'manufacturing',
    status: 'completed',
    engine_version: 'manufacturing-1.0',
    parameters: {},
    warnings: [],
    created_at: '2026-11-25T12:00:00Z',
    is_stale: false,
    result: {
      dataset: {
        id: 13,
        name: 'Turnos planta norte',
        revision: 1,
        content_sha256: 'd'.repeat(64),
        row_count: 1,
      },
      scope: {
        mode: 'summary',
        analyzed_rows: 1,
        filters: {},
        time_unit: 'minutes',
        cycle_time_unit: 'seconds',
      },
      availability: { cycle: false, downtime: true, quality: true, oee: true },
      time_accounting: {
        planned_minutes: 480,
        planned_stop_minutes: 0,
        unplanned_stop_minutes: 80,
        unclassified_stop_minutes: 0,
        operating_minutes: 400,
        speed_loss_minutes: 40,
        quality_loss_minutes: 10,
        productive_equivalent_minutes: 350,
      },
      cycle: null,
      downtime: { total_minutes: 80, mtbf_minutes: null, mttr_minutes: null, pareto: [] },
      quality: { total_count: 360, yield: 350 / 360, first_pass_yield: 350 / 360 },
      oee: {
        availability: 400 / 480,
        performance: 360 / 400,
        quality: 350 / 360,
        oee: 350 / 480,
      },
      capability: null,
      guidance: ['Revise las pérdidas antes de decidir.'],
    },
  };
}
