import { Injectable } from '@angular/core';
import type * as Plotly from 'plotly.js';

@Injectable({ providedIn: 'root' })
export class PlotlyService {
  private module?: Promise<typeof Plotly>;

  load(): Promise<typeof Plotly> {
    this.module ??= import('plotly.js-dist-min').then((loaded) => {
      const candidate = loaded as unknown as { default?: typeof Plotly };
      return candidate.default ?? loaded as unknown as typeof Plotly;
    });
    return this.module;
  }
}
