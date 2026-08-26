import { AfterViewInit, Component, ElementRef, OnChanges, OnDestroy, SimpleChanges, ViewChild, inject, input } from '@angular/core';
import type { Config, Data, Layout } from 'plotly.js';
import { PlotlyService } from './plotly.service';

@Component({
  selector: 'app-plotly-chart',
  template: '<div #host class="plotly-host" role="img" [attr.aria-label]="ariaLabel()"></div>',
  styles: ':host,.plotly-host{display:block;width:100%;min-height:390px}',
})
export class PlotlyChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  readonly data = input.required<Data[]>();
  readonly layout = input<Partial<Layout>>({});
  readonly config = input<Partial<Config>>({ responsive: true, displaylogo: false });
  readonly ariaLabel = input('Gráfico estadístico interactivo');
  @ViewChild('host', { static: true }) private host?: ElementRef<HTMLDivElement>;
  private readonly loader = inject(PlotlyService);
  private plotly?: Awaited<ReturnType<PlotlyService['load']>>;
  private ready = false;
  private destroyed = false;

  ngAfterViewInit(): void {
    this.ready = true;
    void this.render();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.ready) void this.render();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.plotly && this.host) this.plotly.purge(this.host.nativeElement);
  }

  private async render(): Promise<void> {
    const plotly = this.plotly ?? await this.loader.load();
    if (this.destroyed || !this.host) return;
    this.plotly = plotly;
    await plotly.react(this.host.nativeElement, this.data(), {
      paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { family: 'Manrope, sans-serif', color: '#496070' },
      margin: { t: 28, r: 24, b: 52, l: 54 }, autosize: true, ...this.layout(),
    }, { responsive: true, displaylogo: false, ...this.config() });
  }
}
