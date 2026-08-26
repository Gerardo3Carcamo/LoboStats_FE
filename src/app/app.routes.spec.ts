import { routes } from './app.routes';

describe('application routes', () => {
  it('exposes statistics, charts, ANOVA and distributions while preserving old links', () => {
    const privateRoutes = routes.find((route) => route.canActivateChild)?.children ?? [];
    expect(privateRoutes.some((route) => route.path === 'estadistica' && route.loadComponent)).toBe(true);
    expect(privateRoutes.some((route) => route.path === 'visualizaciones' && route.loadComponent)).toBe(true);
    expect(privateRoutes.some((route) => route.path === 'anova' && route.loadComponent)).toBe(true);
    expect(privateRoutes.some((route) => route.path === 'distribuciones' && route.loadComponent)).toBe(true);
    expect(privateRoutes.find((route) => route.path === 'pruebas')?.redirectTo).toBe('estadistica');
    expect(privateRoutes.find((route) => route.path === 'descriptiva')?.redirectTo).toBe('estadistica');
  });

  it('keeps only auth screens public and guards all application routes', () => {
    const publicRoutes = routes.filter((route) => ['login', 'registro', 'verificar'].includes(route.path ?? ''));
    expect(publicRoutes.map((route) => route.path)).toEqual(['login', 'registro', 'verificar']);
    expect(publicRoutes.every((route) => route.canActivate?.length === 1 && route.children?.[0]?.path === '')).toBe(true);
    expect(routes.find((route) => route.canActivateChild)?.canActivateChild).toHaveLength(1);
  });
});
