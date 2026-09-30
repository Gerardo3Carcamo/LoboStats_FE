import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/worksheet/worksheet').then((module) => module.Worksheet)
  },
  { path: '**', redirectTo: '' }
];
