import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/worksheet/worksheet').then((module) => module.Worksheet),
  },
  {
    path: 'descriptive',
    loadComponent: () =>
      import('./features/analysis/descriptive/descriptive-statistics').then(
        (module) => module.DescriptiveStatistics,
      ),
  },
  { path: '**', redirectTo: '' }
];
