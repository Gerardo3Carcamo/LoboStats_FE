import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { AnalysisService } from '../../core/services/analysis.service';
import { DataService } from '../../core/services/data.service';
import { VisualizationsComponent } from './visualizations.component';

describe('VisualizationsComponent payloads', () => {
  it('maps UI field names to the chart API contract', async () => {
    const data = { dataset: signal({ id: 'dataset-1', name: 'Muestra', row_count: 2, column_count: 3, columns: [], preview: [] }) };
    const analysis = { loading: signal(false), error: signal(null), run: vi.fn(() => of({ results: {} })) };
    await TestBed.configureTestingModule({ imports: [VisualizationsComponent], providers: [provideNoopAnimations(), { provide: DataService, useValue: data }, { provide: AnalysisService, useValue: analysis }] }).compileComponents();
    const component = TestBed.createComponent(VisualizationsComponent).componentInstance as unknown as {
      values: Record<string, string | string[]>; selectKind(kind: string): void; createPayload(): Record<string, unknown>;
    };

    component.selectKind('bubble');
    component.values = { x_column: 'x', y_column: 'y', size_column: 'peso' };
    expect(component.createPayload()).toEqual({ dataset_id: 'dataset-1', x: 'x', y: 'y', size: 'peso' });

    component.selectKind('interval');
    component.values = { x_column: 'grupo', y_column: 'valor' };
    expect(component.createPayload()).toEqual({ dataset_id: 'dataset-1', group: 'grupo', value: 'valor' });
  });

  it('adapts backend Q-Q points into Plotly traces', async () => {
    const data = { dataset: signal({ id: 'dataset-1', name: 'Muestra', row_count: 2, column_count: 1, columns: [], preview: [] }) };
    const analysis = { loading: signal(false), error: signal(null), run: vi.fn(() => of({ results: {} })) };
    await TestBed.configureTestingModule({ imports: [VisualizationsComponent], providers: [provideNoopAnimations(), { provide: DataService, useValue: data }, { provide: AnalysisService, useValue: analysis }] }).compileComponents();
    const component = TestBed.createComponent(VisualizationsComponent).componentInstance as unknown as {
      values: Record<string, string | string[]>; selectKind(kind: string): void; buildPlotly(result: Record<string, unknown>): void; plotData(): { x?: unknown[]; y?: unknown[] }[] | null;
    };
    component.selectKind('qq'); component.values = { column: 'peso' };
    component.buildPlotly({ results: { points: [{ theoretical: -1, observed: 10 }, { theoretical: 1, observed: 20 }], line: { slope: 5, intercept: 15 } } });
    expect(component.plotData()?.[0]?.x).toEqual([-1, 1]);
    expect(component.plotData()?.[0]?.y).toEqual([10, 20]);
    expect(component.plotData()).toHaveLength(2);
  });
});
