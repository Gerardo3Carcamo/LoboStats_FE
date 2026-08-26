import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DataService } from '../services/data.service';
import { authInterceptor } from './auth.interceptor';
import { API_BASE_URL } from '../config/api.config';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let data: DataService;

  beforeEach(() => {
    sessionStorage.setItem('csrfAccessToken', 'access-csrf');
    sessionStorage.setItem('csrfRefreshToken', 'refresh-csrf');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    data = TestBed.inject(DataService);
  });

  afterEach(() => {
    sessionStorage.clear();
    http.verify();
  });

  it('sends credentials and access CSRF on mutable requests', () => {
    data.createManual({ name: 'Muestra', columns: ['x'], rows: [[1]] }).subscribe();
    const request = http.expectOne(`${API_BASE_URL}/data/manual`);
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-CSRF-TOKEN')).toBe('access-csrf');
    request.flush({ id: '1', name: 'Muestra', columns: [], preview: [] });
  });

  it('refreshes once with refresh CSRF and retries a 401 request', () => {
    data.get('one').subscribe();
    const initial = http.expectOne((request) => request.url === `${API_BASE_URL}/data/one`);
    expect(initial.request.withCredentials).toBe(true);
    initial.flush({}, { status: 401, statusText: 'Unauthorized' });

    http.expectOne(`${API_BASE_URL}/auth/refresh-csrf`).flush({ csrf_refresh_token: 'renewed-refresh-csrf' });
    const refresh = http.expectOne(`${API_BASE_URL}/auth/refresh`);
    expect(refresh.request.headers.get('X-CSRF-TOKEN')).toBe('renewed-refresh-csrf');
    refresh.flush({ csrf_access_token: 'renewed-access-csrf' });
    http.expectOne((request) => request.url === `${API_BASE_URL}/data/one`).flush({ id: 'one', name: 'A', columns: [], preview: [] });
    expect(data.dataset()?.id).toBe('one');
  });

  it('shares one refresh between concurrent 401 responses', () => {
    client.get('/api/alpha').subscribe();
    client.get('/api/beta').subscribe();
    http.expectOne('/api/alpha').flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/beta').flush({}, { status: 401, statusText: 'Unauthorized' });

    const csrfRequests = http.match(`${API_BASE_URL}/auth/refresh-csrf`);
    expect(csrfRequests).toHaveLength(1);
    csrfRequests[0].flush({ csrf_refresh_token: 'renewed-refresh-csrf' });
    const refreshes = http.match(`${API_BASE_URL}/auth/refresh`);
    expect(refreshes).toHaveLength(1);
    refreshes[0].flush({ csrf_access_token: 'renewed-access-csrf' });
    http.expectOne('/api/alpha').flush({ ok: true });
    http.expectOne('/api/beta').flush({ ok: true });
  });
});
