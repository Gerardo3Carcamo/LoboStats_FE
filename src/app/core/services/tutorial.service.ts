import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { driver, DriveStep } from 'driver.js';

@Injectable({ providedIn: 'root' })
export class TutorialService {
  private readonly router = inject(Router);

  async start(): Promise<void> {
    await this.router.navigateByUrl('/');

    requestAnimationFrame(() => {
      const isMobile = window.matchMedia('(max-width: 780px)').matches;
      const navigationSelector = isMobile
        ? '.mobile-nav'
        : '.sidebar-nav';
      const steps: DriveStep[] = [
        {
          element: isMobile ? '.mobile-brand' : '[data-tour="brand"]',
          popover: {
            title: 'Bienvenido a LoboStats',
            description: 'Analiza una muestra desde la carga hasta una conclusión estadística.',
            side: isMobile ? 'bottom' : 'right',
            align: 'start',
          },
        },
        {
          element: navigationSelector,
          popover: {
            title: 'Tu flujo de trabajo',
            description: 'Avanza por Datos, Estadística, Gráficos, ANOVA y Distribuciones. Allí puedes calcular probabilidades e identificar modelos para una variable.',
            side: isMobile ? 'top' : 'right',
            align: 'center',
          },
        },
        {
          element: '[data-tour="dataset-status"]',
          popover: {
            title: 'Estado de la muestra',
            description: 'Aquí verás si hay datos listos y cuántas filas y variables contienen.',
            side: 'bottom',
            align: 'end',
          },
        },
        {
          element: '[data-tour="entry-mode"]',
          popover: {
            title: 'Elige cómo empezar',
            description: 'Carga un CSV o escribe una tabla pequeña directamente en la aplicación.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '[data-tour="data-entry"]',
          popover: {
            title: 'Carga tu primera muestra',
            description: 'Selecciona el archivo, procésalo y LoboStats te llevará a revisar su calidad antes de analizar.',
            side: 'top',
            align: 'center',
          },
        },
      ];

      driver({
        steps,
        showProgress: true,
        smoothScroll: true,
        allowClose: true,
        stagePadding: 8,
        stageRadius: 12,
        popoverClass: 'lobostats-tour',
        nextBtnText: 'Siguiente',
        prevBtnText: 'Anterior',
        doneBtnText: 'Empezar',
        progressText: '{{current}} de {{total}}',
        onDestroyed: () => document.querySelector<HTMLElement>('[data-tour="start"]')?.focus(),
      }).drive();
    });
  }
}
