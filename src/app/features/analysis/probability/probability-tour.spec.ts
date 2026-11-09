import {
  PROBABILITY_TOUR_REVISION,
  PROBABILITY_TOUR_STEPS,
  PROBABILITY_TOUR_TARGETS,
} from './probability-tour';

describe('probability tour', () => {
  it('has a revision that changes with the tour', () => {
    expect(PROBABILITY_TOUR_REVISION).toMatch(/^\d{4}\.\d{2}\.\d+$/);
  });

  it('uses one unique step for every declared target', () => {
    const selectors = PROBABILITY_TOUR_STEPS.map((step) => step.element);
    const targets = Object.values(PROBABILITY_TOUR_TARGETS).map(
      (target) => `[data-tour="${target}"]`,
    );

    expect(selectors).toEqual(targets);
    expect(new Set(selectors).size).toBe(selectors.length);
  });

  it('provides plain Spanish explanations with examples', () => {
    const descriptions = PROBABILITY_TOUR_STEPS.map((step) => step.popover?.description ?? '');
    expect(descriptions.some((description) => description.includes('Ejemplo'))).toBeTrue();
    for (const description of descriptions) {
      expect(description).toBeTruthy();
      expect(description).not.toContain('<');
    }
  });
});
