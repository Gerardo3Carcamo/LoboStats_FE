import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { driver } from 'driver.js';
import type { Driver, PopoverDOM } from 'driver.js';

import {
  WORKSHEET_TOUR_REVISION,
  WORKSHEET_TOUR_STEPS,
} from '../../features/worksheet/worksheet-tour';

@Injectable({ providedIn: 'root' })
export class ProductTourService {
  private readonly document = inject(DOCUMENT);
  private activeTour?: Driver;

  startWorksheetTour(trigger: HTMLElement): void {
    if (this.activeTour?.isActive()) return;
    this.activeTour = undefined;

    const appRoot = this.document.querySelector('app-root') as HTMLElement | null;
    const reduceMotion =
      this.document.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? false;

    let cleaned = false;
    let tour!: Driver;
    const cleanup = (): void => {
      if (cleaned) return;
      cleaned = true;
      if (appRoot) appRoot.inert = false;
      if (this.activeTour === tour) this.activeTour = undefined;
      this.document.defaultView?.requestAnimationFrame(() => trigger.focus());
    };

    tour = driver({
      steps: WORKSHEET_TOUR_STEPS,
      animate: !reduceMotion,
      duration: reduceMotion ? 0 : 220,
      allowClose: true,
      allowScroll: true,
      allowKeyboardControl: true,
      disableActiveInteraction: true,
      overlayClickBehavior: 'close',
      overlayColor: '#101712',
      overlayOpacity: 0.68,
      stagePadding: 8,
      stageRadius: 6,
      popoverClass: 'lobostats-tour',
      popoverOffset: 12,
      showButtons: ['previous', 'next', 'close'],
      showProgress: true,
      progressText: 'Paso {{current}} de {{total}}',
      prevBtnText: 'Anterior',
      nextBtnText: 'Siguiente',
      doneBtnText: 'Finalizar',
      skipMissingElement: true,
      onPopoverRender: (popover, options) => {
        if (appRoot) appRoot.inert = true;
        this.preparePopover(popover, options.index ?? 0);
      },
      onDestroyed: cleanup,
    });

    this.activeTour = tour;

    try {
      tour.drive();
      if (!tour.isActive()) cleanup();
    } catch (error) {
      cleanup();
      throw error;
    }
  }

  private preparePopover(popover: PopoverDOM, index: number): void {
    const titleId = `lobostats-tour-title-${index}`;
    const descriptionId = `lobostats-tour-description-${index}`;

    popover.wrapper.dataset['tourRevision'] = WORKSHEET_TOUR_REVISION;
    popover.wrapper.setAttribute('role', 'dialog');
    popover.wrapper.setAttribute('aria-modal', 'true');
    popover.wrapper.setAttribute('aria-labelledby', titleId);
    popover.wrapper.setAttribute('aria-describedby', descriptionId);
    popover.title.id = titleId;
    popover.description.id = descriptionId;
    popover.closeButton.setAttribute('aria-label', 'Cerrar recorrido guiado');
  }
}
