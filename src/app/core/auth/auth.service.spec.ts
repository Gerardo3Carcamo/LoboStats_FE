import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { API_BASE_URL } from '../config/api.config';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('restores a session with me, refresh and a second me request', () => {
    let email = '';
    service.ensureSession().subscribe((user) => email = user?.email ?? '');
    http.expectOne(`${API_BASE_URL}/auth/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${API_BASE_URL}/auth/refresh-csrf`).flush({ csrf_refresh_token: 'refresh-csrf' });
    http.expectOne(`${API_BASE_URL}/auth/refresh`).flush({ csrf_access_token: 'new-access-csrf' });
    http.expectOne(`${API_BASE_URL}/auth/me`).flush({ user: { id: 7, full_name: 'Ada', email: 'ada@uadec.edu.mx' }, csrf_access_token: 'new-access-csrf' });

    expect(email).toBe('ada@uadec.edu.mx');
    expect(service.user()?.full_name).toBe('Ada');
    expect(service.loading()).toBe(false);
  });

  it('logs in with the contract payload and fetches the user from the cookie session', () => {
    service.login({ email: 'ada@uadec.edu.mx', password: 'ClaveSegura12' }).subscribe();
    const login = http.expectOne(`${API_BASE_URL}/auth/login`);
    expect(login.request.body).toEqual({ email: 'ada@uadec.edu.mx', password: 'ClaveSegura12' });
    login.flush({ csrf_access_token: 'access-csrf', csrf_refresh_token: 'refresh-csrf' });
    http.expectOne(`${API_BASE_URL}/auth/me`).flush({ full_name: 'Ada', email: 'ada@uadec.edu.mx', csrf_access_token: 'access-csrf' });
    expect(service.user()?.email).toBe('ada@uadec.edu.mx');
    expect(service.csrfToken()).toBe('access-csrf');
    expect(service.csrfToken(true)).toBe('refresh-csrf');
  });

  it('uses the register, verify and resend contracts', () => {
    service.register({ full_name: 'Ada', email: 'ada@uadec.edu.mx', password: 'ClaveSegura12' }).subscribe();
    const register = http.expectOne(`${API_BASE_URL}/auth/register`);
    expect(register.request.body).toEqual({ full_name: 'Ada', email: 'ada@uadec.edu.mx', password: 'ClaveSegura12' });
    register.flush({});

    service.verify('ada@uadec.edu.mx', '123456').subscribe();
    const verify = http.expectOne(`${API_BASE_URL}/auth/verify`);
    expect(verify.request.body).toEqual({ email: 'ada@uadec.edu.mx', code: '123456' });
    verify.flush({});

    service.resendCode('ada@uadec.edu.mx').subscribe();
    const resend = http.expectOne(`${API_BASE_URL}/auth/resend-code`);
    expect(resend.request.body).toEqual({ email: 'ada@uadec.edu.mx' });
    resend.flush({});
  });

  it('revalidates the server session after a transient clear', () => {
    service.clearSession();
    service.ensureSession().subscribe();
    http.expectOne(`${API_BASE_URL}/auth/me`).flush({ user: { id: 8, full_name: 'Ada', email: 'ada@uadec.edu.mx' }, csrf_access_token: 'restored-csrf' });
    expect(service.user()?.id).toBe(8);
    expect(service.csrfToken()).toBe('restored-csrf');
  });
});
