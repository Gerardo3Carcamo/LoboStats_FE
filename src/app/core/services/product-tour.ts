import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { driver } from 'driver.js';
import type { DriveStep, Driver, PopoverDOM } from 'driver.js';

import {
  DESCRIPTIVE_TOUR_REVISION,
  DESCRIPTIVE_TOUR_STEPS,
} from '../../features/analysis/descriptive/descriptive-statistics-tour';
import {
  PROBABILITY_TOUR_REVISION,
  PROBABILITY_TOUR_STEPS,
} from '../../features/analysis/probability/probability-tour';
import {
  HYPOTHESIS_TOUR_REVISION,
  HYPOTHESIS_TOUR_STEPS,
} from '../../features/analysis/hypothesis/hypothesis-tour';
import {
  REGRESSION_TOUR_REVISION,
  REGRESSION_TOUR_STEPS,
} from '../../features/analysis/regression/regression-tour';

import {
  WORKSHEET_TOUR_REVISION,
  WORKSHEET_TOUR_STEPS,
} from '../../features/worksheet/worksheet-tour';

@Injectable({ providedIn: 'root' })
export class ProductTourService {
  private readonly document = inject(DOCUMENT);
  private activeTour?: Driver;

  startWorksheetTour(trigger: HTMLElement): void {
    this.startTour(trigger, WORKSHEET_TOUR_STEPS, WORKSHEET_TOUR_REVISION);
  }

  startDescriptiveTour(trigger: HTMLElement): void {
    this.startTour(trigger, DESCRIPTIVE_TOUR_STEPS, DESCRIPTIVE_TOUR_REVISION);
  }

  startProbabilityTour(trigger: HTMLElement): void {
    this.startTour(trigger, PROBABILITY_TOUR_STEPS, PROBABILITY_TOUR_REVISION);
  }

  startHypothesisTour(trigger: HTMLElement): void {
    this.startTour(trigger, HYPOTHESIS_TOUR_STEPS, HYPOTHESIS_TOUR_REVISION);
  }

  startRegressionTour(trigger: HTMLElement): void {
    this.startTour(trigger, REGRESSION_TOUR_STEPS, REGRESSION_TOUR_REVISION);
  }

  private startTour(trigger: HTMLElement, steps: DriveStep[], revision: string): void {
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
      steps,
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
        this.preparePopover(popover, options.index ?? 0, revision);
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

  private preparePopover(popover: PopoverDOM, index: number, revision: string): void {
    const titleId = `lobostats-tour-title-${index}`;
    const descriptionId = `lobostats-tour-description-${index}`;

    popover.wrapper.dataset['tourRevision'] = revision;
    popover.wrapper.setAttribute('role', 'dialog');
    popover.wrapper.setAttribute('aria-modal', 'true');
    popover.wrapper.setAttribute('aria-labelledby', titleId);
    popover.wrapper.setAttribute('aria-describedby', descriptionId);
    popover.title.id = titleId;
    popover.description.id = descriptionId;
    popover.closeButton.setAttribute('aria-label', 'Cerrar recorrido guiado');
  }
}
