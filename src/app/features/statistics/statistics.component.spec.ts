import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { AnalysisService } from '../../core/services/analysis.service';
import { DataService } from '../../core/services/data.service';
import { StatisticsComponent } from './statistics.component';

describe('StatisticsComponent payloads', () => {
  it('builds an independent /api payload for the selected operation', async () => {
    const data = { dataset: signal({ id: 'sample-7', name: 'Muestra', row_count: 2, column_count: 1, columns: [], preview: [] }) };
    const analysis = { loading: signal(false), error: signal(null), run: vi.fn(() => of({ results: {} })) };
    await TestBed.configureTestingModule({ imports: [StatisticsComponent], providers: [provideNoopAnimations(), { provide: DataService, useValue: data }, { provide: AnalysisService, useValue: analysis }] }).compileComponents();
    const component = TestBed.createComponent(StatisticsComponent).componentInstance as unknown as { values: Record<string, unknown>; createPayload(): Record<string, unknown> };
    component.values = { column: 'peso', confidence: 0.95 };
    expect(component.createPayload()).toEqual({ dataset_id: 'sample-7', column: 'peso', confidence: 0.95 });
  });

  it('adapts independent t and two-proportion fields to the API contract', async () => {
    const data = { dataset: signal({ id: 'sample-8', name: 'Muestra', row_count: 2, column_count: 1, columns: [], preview: [] }) };
    const analysis = { loading: signal(false), error: signal(null), run: vi.fn(() => of({ results: {} })) };
    await TestBed.configureTestingModule({ imports: [StatisticsComponent], providers: [provideNoopAnimations(), { provide: DataService, useValue: data }, { provide: AnalysisService, useValue: analysis }] }).compileComponents();
    const component = TestBed.createComponent(StatisticsComponent).componentInstance as unknown as {
      values: Record<string, unknown>; selectCategory(id: string): void; selectOperation(id: string): void; createPayload(): Record<string, unknown>;
    };

    component.selectCategory('parametric'); component.selectOperation('t-independent');
    component.values = { type: 'independent', value_column: 'peso', group_column: 'turno', group1: 'A', group2: 'B' };
    expect(component.createPayload()['groups']).toEqual(['A', 'B']);
    expect(component.createPayload()['group1']).toBeUndefined();

    component.selectCategory('proportion'); component.selectOperation('two-sample');
    component.values = { successes1: 6, nobs1: 10, successes2: 4, nobs2: 10 };
    expect(component.createPayload()['successes']).toEqual([6, 4]);
    expect(component.createPayload()['nobs']).toEqual([10, 10]);
  });
});
