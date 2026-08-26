import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface DistributionResponse {
  distribution: string;
  operation: string;
  parameters: Record<string, unknown>;
  results: unknown;
  interpretation: string;
}

@Injectable({ providedIn: 'root' })
export class DistributionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/distributions`;

  request(operation: string, payload: Record<string, unknown>): Observable<DistributionResponse> {
    return this.http.post<DistributionResponse>(`${this.baseUrl}/${operation}`, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        const body = error.error && typeof error.error === 'object' ? error.error as Record<string, unknown> : {};
        const nested = body['error'] && typeof body['error'] === 'object' ? body['error'] as Record<string, unknown> : {};
        const detail = body['message'] ?? body['detail'] ?? nested['message'];
        const message = detail ? String(detail) : error.status === 0
          ? 'No se pudo conectar con el motor de distribuciones.'
          : `La operación de distribución no pudo completarse (${error.status}).`;
        return throwError(() => new Error(message));
      }),
    );
  }
}
