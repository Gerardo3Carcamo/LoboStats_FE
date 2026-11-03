export interface DescriptiveAnalysisRequest {
  columns: string[];
  group_by: string | null;
  confidence_level: number;
  percentiles: number[];
  histogram_bins: number;
  frequency_limit: number;
}

export interface HistogramResult {
  counts: number[];
  edges: number[];
}

export interface BoxplotResult {
  lower_whisker: number;
  q1: number;
  median: number;
  q3: number;
  upper_whisker: number;
  outliers: number[];
}

export interface QqPlotResult {
  theoretical: number[];
  observed: number[];
}

export interface NumericSummary {
  mean: number;
  median: number;
  modes: number[];
  mode_frequency: number | null;
  variance: number | null;
  std_dev: number | null;
  std_error: number | null;
  coefficient_of_variation: number | null;
  minimum: number;
  maximum: number;
  range: number;
  q1: number;
  q3: number;
  iqr: number;
  sum: number;
  sum_squares: number;
  skewness: number | null;
  kurtosis_excess: number | null;
  percentiles: Record<string, number>;
  confidence_interval_mean: { level: number; lower: number; upper: number } | null;
  histogram: HistogramResult;
  boxplot: BoxplotResult;
  qq_plot: QqPlotResult;
}

export interface CategoricalSummary {
  unique_count: number;
  mode: string | null;
  mode_frequency: number | null;
  frequencies: { value: string; count: number; percentage: number }[];
  truncated: boolean;
}

export interface DescriptiveColumnResult {
  key: string;
  name: string;
  data_type: 'number' | 'text' | 'date';
  total_count: number;
  valid_count: number;
  missing_count: number;
  numeric: NumericSummary | null;
  categorical: CategoricalSummary | null;
  date: { minimum: string | null; maximum: string | null } | null;
}

export interface DescriptiveGroupResult {
  value: unknown;
  label: string;
  row_count: number;
  columns: DescriptiveColumnResult[];
}

export interface DescriptiveResult {
  dataset: {
    id: number;
    name: string;
    revision: number;
    content_sha256: string;
    row_count: number;
  };
  selection: DescriptiveAnalysisRequest;
  groups: DescriptiveGroupResult[];
  guidance: string[];
}

export interface AnalysisRun<T> {
  id: number;
  dataset_id: number;
  dataset_revision: number;
  dataset_sha256: string;
  analysis_type: string;
  status: string;
  engine_version: string;
  parameters: Record<string, unknown>;
  result: T;
  warnings: string[];
  created_at: string;
  is_stale: boolean;
}

export interface AnalysisRunSummary {
  id: number;
  dataset_id: number;
  dataset_revision: number;
  analysis_type: string;
  status: string;
  created_at: string;
  is_stale: boolean;
}
