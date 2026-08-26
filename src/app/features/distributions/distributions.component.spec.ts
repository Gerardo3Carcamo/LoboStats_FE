import type { DistributionResponse } from '../../core/services/distribution.service';
import { DISTRIBUTIONS, adaptCurveResult, adaptIdentifyResult, buildCalculatorPayload, probabilityPlotTraces } from './distributions.component';

describe('distributions adapters', () => {
  const normal = DISTRIBUTIONS.find((item) => item.id === 'normal')!;
  const params = { mean: 2, std: 3 };

  it('builds dynamic calculator payloads for every operation', () => {
    expect(buildCalculatorPayload(normal, 'pdf', { x: 1 }, params)).toEqual({ distribution: 'normal', params, x: 1 });
    expect(buildCalculatorPayload(normal, 'cdf', { x: 2 }, params)).toEqual({ distribution: 'normal', params, x: 2 });
    expect(buildCalculatorPayload(normal, 'sf', { x: 3 }, params)).toEqual({ distribution: 'normal', params, x: 3 });
    expect(buildCalculatorPayload(normal, 'ppf', { q: 0.9 }, params)).toEqual({ distribution: 'normal', params, q: 0.9 });
    expect(buildCalculatorPayload(normal, 'interval', { confidence: 0.95 }, params)).toEqual({ distribution: 'normal', params, confidence: 0.95 });
    expect(buildCalculatorPayload(normal, 'random', { size: 20, seed: '' }, params)).toEqual({ distribution: 'normal', params, size: 20, seed: 0 });
    expect(buildCalculatorPayload(normal, 'random', { size: 20, seed: 7 }, params)).toEqual({ distribution: 'normal', params, size: 20, seed: 7 });
  });

  it('keeps distribution-specific parameter names', () => {
    const hypergeom = DISTRIBUTIONS.find((item) => item.id === 'hypergeom')!;
    expect(buildCalculatorPayload(hypergeom, 'pdf', { x: 2 }, { M: 40, n: 12, N: 8, loc: 0 })).toEqual({
      distribution: 'hypergeom', params: { M: 40, n: 12, N: 8, loc: 0 }, x: 2,
    });
  });

  it('adapts curve rows returned by the backend', () => {
    expect(adaptCurveResult(response({ values: [
      { x: -1, density: 0.2, cdf: 0.1 }, { x: 0, density: 0.4, cdf: 0.5 },
    ] }))).toEqual({ x: [-1, 0], y: [0.2, 0.4] });
  });

  it('adapts ranking, best candidate and non-fatal failures', () => {
    const view = adaptIdentifyResult(response({
      ranking: [{ distribution: 'normal', ad_statistic: 0.21, p_value: 0.72, aic: 101, bic: 108 }],
      best_distribution: { name: 'normal' },
      failures: { gamma: 'La optimización no convergió' },
    }));
    expect(view.ranking[0]).toEqual({ distribution: 'normal', ad: 0.21, pValue: 0.72, aic: 101, bic: 108 });
    expect(view.bestDistribution).toBe('normal');
    expect(view.failures).toEqual([{ distribution: 'gamma', reason: 'La optimización no convergió' }]);
  });

  it('adapts the backend identify contract with nested Anderson-Darling values', () => {
    const view = adaptIdentifyResult(response({
      candidates: [{ distribution: 'lognormal', anderson_darling: { statistic: 0.18, p_value: 0.63 }, aic: 88, bic: 93 }],
      best_distribution: 'lognormal', failures: [],
    }));
    expect(view.ranking[0]).toEqual({ distribution: 'lognormal', ad: 0.18, pValue: 0.63, aic: 88, bic: 93 });
    expect(view.bestDistribution).toBe('lognormal');
  });

  it('creates SVG probability traces with confidence fill and fitted reference', () => {
    const traces = probabilityPlotTraces(response({
      points: [{ theoretical: -1, observed: -0.8 }, { theoretical: 1, observed: 1.1 }],
      confidence_band: { x: [-1, 1], lower: [-1.2, 0.7], upper: [-0.5, 1.4] },
      reference_line: { slope: 1, intercept: 0 },
      fitted_parameters: { loc: 0, scale: 1 },
    }));
    expect(traces).toHaveLength(4);
    expect(traces.every((trace) => trace.type !== 'scattergl')).toBe(true);
    expect(traces[1]).toMatchObject({ type: 'scatter', fill: 'tonexty' });
    expect(traces[3]).toMatchObject({ type: 'scatter', mode: 'lines' });
  });
});

function response(results: unknown): DistributionResponse {
  return { distribution: 'normal', operation: 'test', parameters: {}, results, interpretation: '' };
}
