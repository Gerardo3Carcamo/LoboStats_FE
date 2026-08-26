export interface StatisticalResponse {
  results: unknown;
  interpretation: string;
  alpha?: number;
}

export interface ResultEntry {
  label: string;
  value: unknown;
  depth: number;
}

export type AnalysisFieldType = 'variable' | 'variables' | 'number' | 'text' | 'choice';

export interface AnalysisField {
  key: string;
  label: string;
  type: AnalysisFieldType;
  required?: boolean;
  defaultValue?: unknown;
  hint?: string;
  options?: { value: unknown; label: string }[];
}

export interface AnalysisOperation {
  id: string;
  label: string;
  endpoint: string;
  description: string;
  fields: AnalysisField[];
}

export interface AnalysisCategory {
  id: string;
  label: string;
  operations: AnalysisOperation[];
}

export function adaptStatisticalResponse(value: unknown): StatisticalResponse {
  const response = isRecord(value) ? value : {};
  const alpha = toFiniteNumber(response['alpha']);
  return {
    results: response['results'] ?? response,
    interpretation: String(response['interpretation'] ?? response['conclusion'] ?? 'El servidor no proporcionó una interpretación.'),
    ...(alpha === undefined ? {} : { alpha }),
  };
}

export function findPValue(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findPValue(item);
      if (found !== null) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const key of ['p_value', 'pValue', 'p-value', 'p']) {
    const candidate = toFiniteNumber(value[key]);
    if (candidate !== undefined) return candidate;
  }
  for (const nested of Object.values(value)) {
    const found = findPValue(nested);
    if (found !== null) return found;
  }
  return null;
}

export function flattenResult(value: unknown, depth = 0): ResultEntry[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenNamed(String(index + 1), item, depth));
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, item]) => flattenNamed(key, item, depth));
  }
  return [{ label: 'valor', value, depth }];
}

function flattenNamed(label: string, value: unknown, depth: number): ResultEntry[] {
  if (Array.isArray(value) || isRecord(value)) {
    return [{ label, value: null, depth }, ...flattenResult(value, depth + 1)];
  }
  return [{ label, value, depth }];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | undefined {
  const number = Number(value);
  return value !== null && value !== undefined && Number.isFinite(number) ? number : undefined;
}
