export interface DescriptiveAnalysisRequest {
  columns: string[];
  group_by: string | null;
  confidence_level: number;
  percentiles: number[];
  histogram_bins: number;
  frequency_limit: number;
}

export type ProbabilityDistribution =
  | 'binomial'
  | 'poisson'
  | 'normal'
  | 'geometric'
  | 'negative_binomial'
  | 'hypergeometric'
  | 'exponential'
  | 'student_t'
  | 'chi_square'
  | 'f'
  | 'uniform'
  | 'integer_uniform'
  | 'custom_discrete'
  | 'beta'
  | 'cauchy'
  | 'gamma'
  | 'laplace'
  | 'logistic'
  | 'loglogistic'
  | 'lognormal'
  | 'triangular'
  | 'weibull'
  | 'extreme_min'
  | 'extreme_max';
export type ProbabilityOperation = 'exact' | 'at_most' | 'at_least' | 'between';
export type ProbabilityMode = 'pdf' | 'cdf' | 'inverse' | 'event';

export interface ProbabilityInput {
  kind: 'constant' | 'column';
  values: (number | null)[];
  column_key?: string;
}

export interface ProbabilityParameterSpec {
  key: string;
  label: string;
  default: number | null;
  minimum: number | null;
  maximum: number | null;
  step: number | null;
  integer: boolean;
  required: boolean;
  kind?: 'number' | 'column';
}

export interface ProbabilityDistributionSpec {
  key: ProbabilityDistribution;
  label: string;
  kind: 'discrete' | 'continuous';
  category: string;
  description: string;
  parameters: ProbabilityParameterSpec[];
}

export interface ProbabilityAnalysisRequest {
  distribution: ProbabilityDistribution;
  mode: ProbabilityMode;
  operation?: ProbabilityOperation;
  input?: ProbabilityInput;
  trials?: number;
  success_probability?: number;
  rate?: number;
  mean?: number;
  std_dev?: number;
  required_successes?: number;
  population_size?: number;
  population_successes?: number;
  draws?: number;
  scale?: number;
  threshold?: number;
  degrees_freedom?: number;
  numerator_df?: number;
  denominator_df?: number;
  noncentrality?: number;
  support_min?: number;
  support_max?: number;
  integer_min?: number;
  integer_max?: number;
  custom_values?: number[];
  custom_probabilities?: number[];
  shape_alpha?: number;
  shape_beta?: number;
  location?: number;
  shape?: number;
  mode_value?: number;
  lower?: number;
  upper?: number;
}

export interface ProbabilityPoint {
  x: number;
  value: number;
  selected: boolean;
}

export interface ProbabilityResult {
  mode: ProbabilityMode;
  calculation_label: string;
  result_value: number;
  calculations: {
    index: number;
    input: number | null;
    result: number | null;
    status: 'valid' | 'invalid';
    error: string | null;
  }[];
  input: ProbabilityInput | null;
  distribution: {
    key: ProbabilityDistribution;
    label: string;
    kind: 'discrete' | 'continuous';
    parameters: Record<string, number | number[]>;
    mean: number | null;
    variance: number | null;
    std_dev: number | null;
  };
  event?: {
    operation: ProbabilityOperation;
    label: string;
    lower: number;
    upper: number | null;
  };
  probability?: number;
  percentage?: number;
  complement_probability?: number;
  model_formula: string;
  calculation_formula: string;
  event_formula?: string;
  interpretation: string;
  points: ProbabilityPoint[];
  guidance: string[];
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
  outlier_details?: { row: number; value: number }[];
}

export interface QqPlotResult {
  theoretical: number[];
  observed: number[];
}

export interface EcdfResult {
  values: number[];
  probabilities: number[];
}

export interface ConfidenceInterval {
  level: number;
  lower: number;
  upper: number;
  method?: string;
}

export interface NormalityResult {
  test: 'Anderson-Darling';
  statistic: number;
  adjusted_statistic: number;
  p_value: number;
  alpha: number;
  reject_normality: boolean;
  interpretation: string;
}

export interface NumericSummary {
  mean: number;
  median: number;
  trimmed_mean?: number;
  mad?: number;
  geometric_mean?: number | null;
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
  confidence_interval_mean: ConfidenceInterval | null;
  confidence_interval_median?: ConfidenceInterval | null;
  confidence_interval_std_dev?: ConfidenceInterval | null;
  normality?: NormalityResult | null;
  histogram: HistogramResult;
  boxplot: BoxplotResult;
  qq_plot: QqPlotResult;
  ecdf?: EcdfResult;
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
  missing_percentage?: number;
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
  missingness?: {
    row_count: number;
    complete_rows: number;
    incomplete_rows: number;
    incomplete_percentage: number;
    columns: {
      key: string;
      name: string;
      missing_count: number;
      missing_percentage: number;
    }[];
  };
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
  engine_version: string;
  distribution: string | null;
  mode: ProbabilityMode | null;
  formula: string | null;
  result_preview: number | null;
  input_kind: 'constant' | 'column' | null;
  presentation: AnalysisRunPresentation;
}

export interface AnalysisRunPresentation {
  module: string;
  title: string;
  detail: string;
  result: string;
  filter_key: string;
  filter_label: string;
  tags: string[];
}
