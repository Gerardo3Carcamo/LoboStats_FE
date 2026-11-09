import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AnalysisApi } from '../../core/services/analysis-api';
import { AnalysisRunSummary } from '../../models/analysis';
import { AnalysisHistoryDialog } from './analysis-history-dialog';

describe('AnalysisHistoryDialog', () => {
  let fixture: ComponentFixture<AnalysisHistoryDialog>;
  let analysisApi: jasmine.SpyObj<AnalysisApi>;

  beforeEach(async () => {
    analysisApi = jasmine.createSpyObj<AnalysisApi>('AnalysisApi', ['list']);
    analysisApi.list.and.returnValue(of(historyItems()));
    await TestBed.configureTestingModule({
      imports: [AnalysisHistoryDialog],
      providers: [{ provide: AnalysisApi, useValue: analysisApi }],
    }).compileComponents();
    fixture = TestBed.createComponent(AnalysisHistoryDialog);
    fixture.componentRef.setInput('datasetId', 1);
    fixture.componentRef.setInput('analysisType', 'probability');
    fixture.detectChanges();
  });

  it('loads a filtered and paginated analysis type', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    fixture.componentInstance.open(trigger);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(analysisApi.list).toHaveBeenCalledWith(1, {
      analysisType: 'probability',
      limit: 26,
      beforeId: undefined,
    });
    expect(fixture.nativeElement.textContent).toContain('Normal · CDF');
    trigger.remove();
  });

  it('searches presentation fields and emits the selected run', async () => {
    const selected = jasmine.createSpy('selected');
    fixture.componentInstance.selected.subscribe(selected);
    const trigger = document.createElement('button');
    document.body.append(trigger);
    fixture.componentInstance.open(trigger);
    await fixture.whenStable();
    fixture.detectChanges();

    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    search.value = 'Normal';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Binomial · Evento');

    (fixture.nativeElement.querySelector('.history-group button') as HTMLButtonElement).click();
    expect(selected).toHaveBeenCalledWith(jasmine.objectContaining({ id: 12 }));
    trigger.remove();
  });
});

function historyItems(): AnalysisRunSummary[] {
  return [
    summary(12, {
      module: 'Probabilidad',
      title: 'Normal · CDF',
      detail: 'F(115)',
      result: '84.13 %',
      filter_key: 'cdf',
      filter_label: 'CDF',
      tags: ['probability-3.0'],
    }),
    summary(11, {
      module: 'Probabilidad',
      title: 'Binomial · Evento',
      detail: 'P(X ≥ 6)',
      result: '33.48 %',
      filter_key: 'event',
      filter_label: 'Evento',
      tags: ['Por columna', 'probability-3.0'],
    }),
  ];
}

function summary(id: number, presentation: AnalysisRunSummary['presentation']): AnalysisRunSummary {
  return {
    id,
    dataset_id: 1,
    dataset_revision: 1,
    analysis_type: 'probability',
    status: 'completed',
    created_at: new Date(Date.now() - (12 - id) * 86_400_000).toISOString(),
    is_stale: false,
    engine_version: 'probability-3.0',
    distribution: null,
    mode: null,
    formula: null,
    result_preview: null,
    input_kind: null,
    presentation,
  };
}
