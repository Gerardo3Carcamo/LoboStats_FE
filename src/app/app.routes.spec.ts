import { routes } from './app.routes';

describe('application routes', () => {
  it('exposes statistics, charts, ANOVA and distributions while preserving old links', () => {
    expect(routes.some((route) => route.path === 'estadistica' && route.loadComponent)).toBe(true);
    expect(routes.some((route) => route.path === 'visualizaciones' && route.loadComponent)).toBe(true);
    expect(routes.some((route) => route.path === 'anova' && route.loadComponent)).toBe(true);
    expect(routes.some((route) => route.path === 'distribuciones' && route.loadComponent)).toBe(true);
    expect(routes.find((route) => route.path === 'pruebas')?.redirectTo).toBe('estadistica');
    expect(routes.find((route) => route.path === 'descriptiva')?.redirectTo).toBe('estadistica');
  });
});
