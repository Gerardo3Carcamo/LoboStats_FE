import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      { path: '', loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent) },
    ],
  },
  {
    path: 'registro',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      { path: '', loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent) },
    ],
  },
  {
    path: 'verificar',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      { path: '', loadComponent: () => import('./features/auth/verify.component').then((m) => m.VerifyComponent) },
    ],
  },
  {
    path: '',
    canActivateChild: [authGuard],
    children: [
      { path: '', loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent) },
      { path: 'datos', loadComponent: () => import('./features/data/data.component').then((m) => m.DataComponent) },
      { path: 'estadistica', loadComponent: () => import('./features/statistics/statistics.component').then((m) => m.StatisticsComponent) },
      { path: 'visualizaciones', loadComponent: () => import('./features/visualizations/visualizations.component').then((m) => m.VisualizationsComponent) },
      { path: 'anova', loadComponent: () => import('./features/anova/anova.component').then((m) => m.AnovaComponent) },
      { path: 'distribuciones', loadComponent: () => import('./features/distributions/distributions.component').then((m) => m.DistributionsComponent) },
      { path: 'descriptiva', redirectTo: 'estadistica', pathMatch: 'full' },
      { path: 'pruebas', redirectTo: 'estadistica', pathMatch: 'full' },
      { path: '**', redirectTo: '' },
    ],
  },
];
