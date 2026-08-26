import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, tap, throwError } from 'rxjs';
import { Dataset, ManualDataset } from '../models/dataset.model';

@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';
  private readonly datasetState = signal<Dataset | null>(null);

  readonly dataset = this.datasetState.asReadonly();
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly hasDataset = computed(() => this.dataset() !== null);

  health(): Observable<unknown> {
    return this.http.get(`${this.baseUrl}/health`);
  }

  upload(file: File): Observable<Dataset> {
    const body = new FormData();
    body.append('file', file);
    return this.request(this.http.post<unknown>(`${this.baseUrl}/data/upload`, body));
  }

  createManual(payload: ManualDataset): Observable<Dataset> {
    return this.request(this.http.post<unknown>(`${this.baseUrl}/data/manual`, payload));
  }

  get(id: string, page = 1, pageSize = 10): Observable<Dataset> {
    return this.request(this.http.get<unknown>(`${this.baseUrl}/data/${id}`, {
      params: { page, page_size: pageSize },
    }));
  }

  deleteCurrent(): Observable<void> {
    const current = this.dataset();
    if (!current) return throwError(() => new Error('No hay un dataset activo.'));

    this.loading.set(true);
    this.error.set(null);
    return this.http.delete<void>(`${this.baseUrl}/data/${current.id}`).pipe(
      tap(() => this.datasetState.set(null)),
      catchError((error: HttpErrorResponse) => this.handleError(error)),
      finalize(() => this.loading.set(false)),
    );
  }

  clearError(): void {
    this.error.set(null);
  }

  private request(source: Observable<unknown>): Observable<Dataset> {
    this.loading.set(true);
    this.error.set(null);
    return source.pipe(
      map((response) => this.normalizeDataset(response)),
      tap((dataset) => this.datasetState.set(dataset)),
      catchError((error: HttpErrorResponse) => this.handleError(error)),
      finalize(() => this.loading.set(false)),
    );
  }

  private normalizeDataset(response: unknown): Dataset {
    const root = this.asRecord(response);
    const nested = this.asRecord(root['dataset']);
    const source = Object.keys(nested).length ? nested : root;
    const previewSource = source['data'] ?? root['data'] ?? source['preview'] ?? root['preview'];
    const columns = Array.isArray(source['columns']) ? source['columns'] : [];

    return {
      id: String(source['id'] ?? source['dataset_id'] ?? ''),
      name: String(source['name'] ?? 'Dataset sin nombre'),
      row_count: Number(source['row_count'] ?? source['rowCount'] ?? 0),
      column_count: Number(source['column_count'] ?? source['columnCount'] ?? columns.length),
      columns: columns.map((column) => {
        if (typeof column === 'string') {
          return { name: column, type: 'desconocido', missing: 0, unique: 0 };
        }
        const item = this.asRecord(column);
        return {
          name: String(item['name'] ?? ''),
          type: String(item['type'] ?? 'desconocido'),
          missing: Number(item['missing'] ?? 0),
          unique: Number(item['unique'] ?? 0),
        };
      }),
      preview: Array.isArray(previewSource)
        ? previewSource.map((row) => this.asRecord(row) as Dataset['preview'][number])
        : [],
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    const errorBody = this.asRecord(error.error);
    const nestedError = this.asRecord(errorBody['error']);
    const apiMessage = error.error && typeof error.error === 'object'
      ? String(errorBody['message'] ?? nestedError['message'] ?? '')
      : '';
    const message = apiMessage || (error.status === 0
      ? 'No se pudo conectar con el servidor. Verifica que el backend esté activo.'
      : `La solicitud falló (${error.status}). Intenta de nuevo.`);
    this.error.set(message);
    return throwError(() => new Error(message));
  }
}
