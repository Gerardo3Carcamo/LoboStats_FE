import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, throwError } from 'rxjs';
import { ApiResult } from '../models/dataset.model';

@Injectable({ providedIn: 'root' })
export class AnalysisService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  run(path: string, payload: Record<string, unknown>): Observable<ApiResult> {
    this.loading.set(true);
    this.error.set(null);
    return this.http.post<ApiResult>(`${this.baseUrl}/${path}`, payload).pipe(
      catchError((error: HttpErrorResponse) => {
        const body = error.error && typeof error.error === 'object'
          ? error.error as Record<string, unknown>
          : {};
        const nested = body['error'] && typeof body['error'] === 'object'
          ? body['error'] as Record<string, unknown>
          : {};
        const detail = body['message'] ?? nested['message'];
        const message = detail ? String(detail) : error.status === 0
          ? 'No se pudo conectar con el motor estadístico.'
          : `El análisis no pudo completarse (${error.status}). Revisa las variables elegidas.`;
        this.error.set(message);
        return throwError(() => new Error(message));
      }),
      finalize(() => this.loading.set(false)),
    );
  }
}
