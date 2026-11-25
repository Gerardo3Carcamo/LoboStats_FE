import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/worksheet/worksheet').then((module) => module.Worksheet),
  },
  {
    path: 'descriptive',
    loadComponent: () =>
      import('./features/analysis/descriptive/descriptive-statistics').then(
        (module) => module.DescriptiveStatistics,
      ),
  },
  {
    path: 'probability',
    loadComponent: () =>
      import('./features/analysis/probability/probability').then((module) => module.Probability),
  },
  {
    path: 'hypothesis',
    loadComponent: () =>
      import('./features/analysis/hypothesis/hypothesis').then((module) => module.Hypothesis),
  },
  {
    path: 'regression',
    loadComponent: () =>
      import('./features/analysis/regression/regression').then((module) => module.Regression),
  },
  {
    path: 'business/manufacturing',
    loadComponent: () =>
      import('./features/business/manufacturing/manufacturing').then(
        (module) => module.Manufacturing,
      ),
  },
  { path: '**', redirectTo: '' },
];
