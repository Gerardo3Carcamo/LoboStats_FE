import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { AuthService } from './auth.service';
import { authGuard, guestGuard } from './auth.guards';

describe('auth guards', () => {
  const router = { createUrlTree: vi.fn(() => ({ redirect: true }) as unknown as UrlTree) };
  const auth = { ensureSession: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
    ] });
  });

  it('redirects anonymous visitors to login preserving the destination', () => {
    auth.ensureSession.mockReturnValue(of(null));
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/anova' } as RouterStateSnapshot)) as Observable<unknown>;
    let guardResult: unknown;
    result.subscribe((value) => guardResult = value);
    expect(guardResult).toEqual({ redirect: true });
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/anova' } });
  });

  it('allows a valid session and keeps authenticated users out of guest pages', () => {
    auth.ensureSession.mockReturnValue(of({ full_name: 'Ada', email: 'ada@uadec.edu.mx' }));
    const privateResult = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/' } as RouterStateSnapshot)) as Observable<unknown>;
    const guestResult = TestBed.runInInjectionContext(() =>
      guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)) as Observable<unknown>;
    let allowed: unknown;
    let redirected: unknown;
    privateResult.subscribe((value) => allowed = value);
    guestResult.subscribe((value) => redirected = value);
    expect(allowed).toBe(true);
    expect(redirected).toEqual({ redirect: true });
  });
});
