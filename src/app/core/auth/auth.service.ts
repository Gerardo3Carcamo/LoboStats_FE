import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { LoginCredentials, RegisterPayload, User } from '../models/auth.model';
import { API_BASE_URL } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/auth`;
  private readonly userState = signal<User | null>(null);
  private sessionRequest?: Observable<User | null>;
  private refreshRequest?: Observable<void>;
  private sessionChecked = false;

  readonly user = this.userState.asReadonly();
  readonly loading = signal(true);

  csrfToken(refresh = false): string | null {
    return sessionStorage.getItem(refresh ? 'csrfRefreshToken' : 'csrfAccessToken');
  }

  bootstrap(): Observable<User | null> {
    return this.ensureSession();
  }

  ensureSession(): Observable<User | null> {
    if (this.userState()) return of(this.userState());
    if (this.sessionChecked) return of(null);
    if (this.sessionRequest) return this.sessionRequest;

    this.loading.set(true);
    this.sessionRequest = this.fetchUser().pipe(
      catchError(() => this.refresh().pipe(switchMap(() => this.fetchUser()), catchError(() => of(null)))),
      finalize(() => {
        this.sessionChecked = true;
        this.loading.set(false);
        this.sessionRequest = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.sessionRequest;
  }

  login(credentials: LoginCredentials): Observable<User> {
    this.loading.set(true);
    return this.http.post<unknown>(`${this.baseUrl}/login`, credentials).pipe(
      tap((response) => this.storeCsrf(response)),
      switchMap(() => this.fetchUser()),
      tap(() => this.sessionChecked = true),
      catchError((error: HttpErrorResponse) => this.rethrow(error)),
      finalize(() => this.loading.set(false)),
    );
  }

  register(payload: RegisterPayload): Observable<void> {
    return this.http.post<unknown>(`${this.baseUrl}/register`, payload).pipe(
      map(() => undefined),
      catchError((error: HttpErrorResponse) => this.rethrow(error)),
    );
  }

  verify(email: string, code: string): Observable<void> {
    return this.http.post<unknown>(`${this.baseUrl}/verify`, { email, code }).pipe(
      map(() => undefined),
      catchError((error: HttpErrorResponse) => this.rethrow(error)),
    );
  }

  resendCode(email: string): Observable<void> {
    return this.http.post<unknown>(`${this.baseUrl}/resend-code`, { email }).pipe(
      map(() => undefined),
      catchError((error: HttpErrorResponse) => this.rethrow(error)),
    );
  }

  refresh(): Observable<void> {
    if (this.refreshRequest) return this.refreshRequest;

    this.refreshRequest = this.http.get<unknown>(`${this.baseUrl}/refresh-csrf`).pipe(
      tap((response) => this.storeCsrf(response)),
      switchMap(() => this.http.post<unknown>(`${this.baseUrl}/refresh`, {})),
      tap((response) => this.storeCsrf(response)),
      map(() => undefined),
      finalize(() => this.refreshRequest = undefined),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshRequest;
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, {}).pipe(
      finalize(() => {
        this.userState.set(null);
        this.sessionChecked = true;
        this.clearCsrf();
      }),
    );
  }

  clearSession(): void {
    this.userState.set(null);
    this.sessionChecked = false;
    this.clearCsrf();
  }

  private fetchUser(): Observable<User> {
    return this.http.get<unknown>(`${this.baseUrl}/me`).pipe(
      tap((response) => this.storeCsrf(response)),
      map((response) => this.normalizeUser(response)),
      tap((user) => this.userState.set(user)),
    );
  }

  private storeCsrf(response: unknown): void {
    const source = this.asRecord(response);
    if (source['csrf_access_token']) sessionStorage.setItem('csrfAccessToken', String(source['csrf_access_token']));
    if (source['csrf_refresh_token']) sessionStorage.setItem('csrfRefreshToken', String(source['csrf_refresh_token']));
  }

  private clearCsrf(): void {
    sessionStorage.removeItem('csrfAccessToken');
    sessionStorage.removeItem('csrfRefreshToken');
  }

  private normalizeUser(response: unknown): User {
    const root = this.asRecord(response);
    const nested = this.asRecord(root['user']);
    const source = Object.keys(nested).length ? nested : root;
    return {
      id: typeof source['id'] === 'string' || typeof source['id'] === 'number' ? source['id'] : undefined,
      full_name: String(source['full_name'] ?? source['fullName'] ?? source['name'] ?? ''),
      email: String(source['email'] ?? ''),
    };
  }

  private rethrow(error: HttpErrorResponse): Observable<never> {
    const body = this.asRecord(error.error);
    const nested = this.asRecord(body['error']);
    const apiMessage = String(body['message'] ?? nested['message'] ?? '');
    const message = apiMessage || (error.status === 0
      ? 'No se pudo conectar con el servidor.'
      : 'No se pudo completar la solicitud. Revisa los datos e intenta de nuevo.');
    return throwError(() => new Error(message));
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
  }
}
