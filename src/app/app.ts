import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ProductTourService } from './core/services/product-tour';

interface NavigationGroup {
  label: string;
  items: { label: string; badge: string; available: boolean }[];
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly productTour = inject(ProductTourService);
  protected readonly navigation: NavigationGroup[] = [
    {
      label: 'Preparar',
      items: [{ label: 'Hoja de trabajo', badge: '01', available: true }],
    },
    {
      label: 'Analizar',
      items: [
        { label: 'Descriptiva', badge: '02', available: false },
        { label: 'Probabilidad', badge: '03', available: false },
        { label: 'Hipótesis', badge: '04', available: false },
        { label: 'Regresión', badge: '05', available: false },
      ],
    },
    {
      label: 'Especializar',
      items: [
        { label: 'Calidad', badge: '06', available: false },
        { label: 'Series de tiempo', badge: '07', available: false },
        { label: 'Multivariado', badge: '08', available: false },
      ],
    },
  ];

  protected startTour(event: Event): void {
    this.productTour.startWorksheetTour(event.currentTarget as HTMLElement);
  }
}
