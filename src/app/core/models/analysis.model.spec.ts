import { adaptStatisticalResponse, findPValue, flattenResult } from './analysis.model';

describe('analysis adapters', () => {
  it('normalizes the statistical response contract', () => {
    const response = adaptStatisticalResponse({ results: { statistic: 4.2 }, interpretation: 'Hay evidencia.', alpha: 0.01 });
    expect(response).toEqual({ results: { statistic: 4.2 }, interpretation: 'Hay evidencia.', alpha: 0.01 });
  });

  it('finds nested p-values and flattens nested tables', () => {
    const results = { assumptions: { normality: { p_value: 0.034 } }, table: [{ effect: 'A', f: 5.1 }] };
    expect(findPValue(results)).toBe(0.034);
    expect(flattenResult(results).some((entry) => entry.label === 'effect' && entry.value === 'A')).toBe(true);
  });
});
