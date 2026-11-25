export interface DescriptiveAnalysisRequest {
  columns: string[];
  group_by: string | null;
  confidence_level: number;
  percentiles: number[];
  histogram_bins: number;
  frequency_limit: number;
}

export type HypothesisTestKey =
  | 'one_sample_z'
  | 'one_sample_t'
  | 'two_sample_t'
  | 'paired_t'
  | 'one_proportion'
  | 'two_proportions'
  | 'one_sample_poisson_rate'
  | 'two_sample_poisson_rate'
  | 'one_variance'
  | 'two_variances'
  | 'correlation'
  | 'normality'
  | 'chi_square_independence'
  | 'poisson_goodness_of_fit'
  | 'one_sample_sign'
  | 'one_sample_wilcoxon'
  | 'mann_whitney'
  | 'kruskal_wallis'
  | 'mood_median'
  | 'friedman'
  | 'runs';

export type HypothesisAlternative = 'two_sided' | 'less' | 'greater';
export type HypothesisDesign =
  | 'one_numeric'
  | 'one_categorical'
  | 'paired_numeric'
  | 'paired_categorical'
  | 'grouped_numeric'
  | 'grouped_categorical'
  | 'blocked_numeric';

export interface HypothesisTestSpec {
  key: HypothesisTestKey;
  label: string;
  category: string;
  design: HypothesisDesign;
  description: string;
}

export interface HypothesisAnalysisRequest {
  test: HypothesisTestKey;
  column: string;
  second_column?: string;
  group_by?: string;
  block_by?: string;
  groups?: unknown[];
  hypothesized_value?: number;
  known_std_dev?: number;
  alternative?: HypothesisAlternative;
  confidence_level?: number;
  equal_variances?: boolean;
  method?: string;
  success_value?: unknown;
  observation_length?: number;
  second_observation_length?: number;
  sequence_cutoff?: number;
}

export interface HypothesisResult {
  dataset: {
    id: number;
    name: string;
    revision: number;
    content_sha256: string;
    row_count: number;
  };
  test: { key: HypothesisTestKey; label: string; category: string };
  hypotheses: { null: string; alternative: string };
  alpha: number;
  confidence_level: number;
  alternative: HypothesisAlternative;
  method: string;
  result: {
    statistic: number | null;
    p_value: number | null;
    degrees_of_freedom: number | number[] | null;
    estimate: number | null;
    null_value: number | null;
    confidence_interval: { level: number; lower: number | null; upper: number | null } | null;
    details: Record<string, unknown>;
  };
  decision: 'reject' | 'fail_to_reject' | null;
  interpretation: string;
  guidance: string[];
}

export type RegressionModelKey =
  | 'linear'
  | 'fitted_line'
  | 'stepwise'
  | 'best_subsets'
  | 'pls'
  | 'binary_logistic'
  | 'ordinal_logistic'
  | 'nominal_logistic';

export interface RegressionModelSpec {
  key: RegressionModelKey;
  label: string;
  category: string;
  description: string;
}

export interface RegressionAnalysisRequest {
  model: RegressionModelKey;
  response: string;
  predictors: string[];
  categorical_predictors?: string[];
  interactions?: string[][];
  degree?: number;
  include_intercept?: boolean;
  confidence_level?: number;
  selection_method?: 'forward' | 'backward' | 'stepwise';
  alpha_to_enter?: number;
  alpha_to_remove?: number;
  best_models_per_size?: number;
  components?: number;
  scale?: boolean;
  event_value?: unknown;
  reference_category?: unknown;
  category_order?: unknown[];
}

export interface RegressionCoefficient {
  term: string;
  category?: string;
  reference?: string;
  coefficient: number;
  standard_error?: number;
  statistic?: number | null;
  p_value?: number | null;
  lower?: number;
  upper?: number;
  vif?: number | null;
  odds_ratio?: number;
  relative_risk_ratio?: number;
}

export interface RegressionResult {
  dataset: {
    id: number;
    name: string;
    revision: number;
    content_sha256: string;
    row_count: number;
  };
  model: {
    key: RegressionModelKey;
    label: string;
    category: string;
    response: string;
    predictors: string[];
  };
  equation: string;
  fit: Record<string, unknown>;
  coefficients: RegressionCoefficient[];
  anova: Record<string, unknown>[] | null;
  diagnostics: Record<string, unknown>;
  predictions: Record<string, unknown>[];
  plots: Record<string, unknown>;
  selection?: Record<string, unknown>;
  guidance: string[];
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
