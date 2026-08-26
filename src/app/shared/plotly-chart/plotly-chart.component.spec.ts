import { TestBed } from '@angular/core/testing';
import { PlotlyChartComponent } from './plotly-chart.component';
import { PlotlyService } from './plotly.service';

describe('PlotlyChartComponent', () => {
  it('renders through the lazy loader and purges its host on destroy', async () => {
    const plotly = { react: vi.fn(() => Promise.resolve()), purge: vi.fn() };
    await TestBed.configureTestingModule({ imports: [PlotlyChartComponent], providers: [{ provide: PlotlyService, useValue: { load: vi.fn(() => Promise.resolve(plotly)) } }] }).compileComponents();
    const fixture = TestBed.createComponent(PlotlyChartComponent);
    fixture.componentRef.setInput('data', [{ type: 'scatter', x: [1], y: [2] }]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(plotly.react).toHaveBeenCalledOnce();
    fixture.destroy();
    expect(plotly.purge).toHaveBeenCalledOnce();
  });
});
