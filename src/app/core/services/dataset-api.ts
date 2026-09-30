import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Dataset, DatasetPayload } from '../../models/dataset';

@Injectable({ providedIn: 'root' })
export class DatasetApi {
  private readonly endpoint = '/api/v1/datasets';
  private readonly developmentHeaders = new HttpHeaders({
    'X-User-Email': 'alumno@uadec.edu.mx'
  });

  constructor(private readonly http: HttpClient) {}

  create(payload: DatasetPayload): Observable<Dataset> {
    return this.http.post<Dataset>(this.endpoint, payload, { headers: this.developmentHeaders });
  }
}
