import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AnalysisRun,
  AnalysisRunSummary,
  DescriptiveAnalysisRequest,
  DescriptiveResult,
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

  list(datasetId: number): Observable<AnalysisRunSummary[]> {
    return this.http.get<AnalysisRunSummary[]>(`/api/v1/datasets/${datasetId}/analyses`, {
      headers: this.developmentHeaders,
    });
  }

  get<T>(analysisId: number): Observable<AnalysisRun<T>> {
    return this.http.get<AnalysisRun<T>>(`/api/v1/analyses/${analysisId}`, {
      headers: this.developmentHeaders,
    });
  }
}
