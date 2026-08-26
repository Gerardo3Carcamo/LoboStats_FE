import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { AnalysisService } from '../../core/services/analysis.service';
import { DataService } from '../../core/services/data.service';
import { AnovaComponent } from './anova.component';

describe('AnovaComponent payloads', () => {
  it('uses the repeated-measures API field names', async () => {
    const data = { dataset: signal({ id: 'dataset-2', name: 'Muestra', row_count: 4, column_count: 3, columns: [], preview: [] }) };
    const analysis = { loading: signal(false), error: signal(null), run: vi.fn(() => of({ results: {} })) };
    await TestBed.configureTestingModule({ imports: [AnovaComponent], providers: [provideNoopAnimations(), { provide: DataService, useValue: data }, { provide: AnalysisService, useValue: analysis }] }).compileComponents();
    const component = TestBed.createComponent(AnovaComponent).componentInstance as unknown as {
      values: Record<string, unknown>; select(id: string): void; createPayload(): Record<string, unknown>;
    };
    component.select('repeated-measures');
    component.values = { value: 'respuesta', subject: 'persona', within: 'tiempo' };
    expect(component.createPayload()).toMatchObject({ dataset_id: 'dataset-2', value: 'respuesta', subject: 'persona', within: 'tiempo' });
  });
});
