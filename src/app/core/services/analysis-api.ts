import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AnalysisRun,
  AnalysisRunSummary,
  DescriptiveAnalysisRequest,
  DescriptiveResult,
  HypothesisAnalysisRequest,
  HypothesisResult,
  HypothesisTestSpec,
  ManufacturingAnalysisRequest,
  ManufacturingResult,
  ProbabilityAnalysisRequest,
  ProbabilityDistributionSpec,
  ProbabilityResult,
  RegressionAnalysisRequest,
  RegressionModelSpec,
  RegressionResult,
} from '../../models/analysis';

@Injectable({ providedIn: 'root' })
export class AnalysisApi {
  private readonly developmentHeaders = new HttpHeaders({
    'X-User-Email': 'alumno@uadec.edu.mx',
  });

  constructor(private readonly http: HttpClient) {}

  descriptive(
    datasetId: number,
    payload: DescriptiveAnalysisRequest,
  ): Observable<AnalysisRun<DescriptiveResult>> {
    return this.http.post<AnalysisRun<DescriptiveResult>>(
      `/api/v1/datasets/${datasetId}/analyses/descriptive`,
      payload,
      { headers: this.developmentHeaders },
    );
  }

  hypothesisCatalog(): Observable<HypothesisTestSpec[]> {
    return this.http.get<HypothesisTestSpec[]>('/api/v1/hypothesis/tests', {
      headers: this.developmentHeaders,
    });
  }

  hypothesis(
    datasetId: number,
    payload: HypothesisAnalysisRequest,
  ): Observable<AnalysisRun<HypothesisResult>> {
    return this.http.post<AnalysisRun<HypothesisResult>>(
      `/api/v1/datasets/${datasetId}/analyses/hypothesis`,
      payload,
      { headers: this.developmentHeaders },
    );
  }

  regressionCatalog(): Observable<RegressionModelSpec[]> {
    return this.http.get<RegressionModelSpec[]>('/api/v1/regression/models', {
      headers: this.developmentHeaders,
    });
  }

  regression(
    datasetId: number,
    payload: RegressionAnalysisRequest,
  ): Observable<AnalysisRun<RegressionResult>> {
    return this.http.post<AnalysisRun<RegressionResult>>(
      `/api/v1/datasets/${datasetId}/analyses/regression`,
      payload,
      { headers: this.developmentHeaders },
    );
  }

  manufacturingMetrics(): Observable<Record<string, unknown>[]> {
    return this.http.get<Record<string, unknown>[]>('/api/v1/business/manufacturing/metrics', {
      headers: this.developmentHeaders,
    });
  }

  manufacturing(
    datasetId: number,
    payload: ManufacturingAnalysisRequest,
  ): Observable<AnalysisRun<ManufacturingResult>> {
    return this.http.post<AnalysisRun<ManufacturingResult>>(
      `/api/v1/datasets/${datasetId}/analyses/manufacturing`,
      payload,
      { headers: this.developmentHeaders },
    );
  }

  probability(
    datasetId: number,
    payload: ProbabilityAnalysisRequest,
  ): Observable<AnalysisRun<ProbabilityResult>> {
    return this.http.post<AnalysisRun<ProbabilityResult>>(
      `/api/v1/datasets/${datasetId}/analyses/probability`,
      payload,
      { headers: this.developmentHeaders },
    );
  }

  probabilityCatalog(): Observable<ProbabilityDistributionSpec[]> {
    return this.http.get<ProbabilityDistributionSpec[]>('/api/v1/probability/distributions', {
      headers: this.developmentHeaders,
    });
  }

  list(
    datasetId: number,
    options: { analysisType?: string; limit?: number; beforeId?: number } = {},
  ): Observable<AnalysisRunSummary[]> {
    let params = new HttpParams();
    if (options.analysisType) params = params.set('analysis_type', options.analysisType);
    if (options.limit) params = params.set('limit', options.limit);
    if (options.beforeId) params = params.set('before_id', options.beforeId);
    return this.http.get<AnalysisRunSummary[]>(`/api/v1/datasets/${datasetId}/analyses`, {
      headers: this.developmentHeaders,
      params,
    });
  }

  get<T>(analysisId: number): Observable<AnalysisRun<T>> {
    return this.http.get<AnalysisRun<T>>(`/api/v1/analyses/${analysisId}`, {
      headers: this.developmentHeaders,
    });
  }
}
