import {
  REGRESSION_TOUR_REVISION,
  REGRESSION_TOUR_STEPS,
  REGRESSION_TOUR_TARGETS,
} from './regression-tour';

describe('regression tour', () => {
  it('has a revision that changes with the tour', () => {
    expect(REGRESSION_TOUR_REVISION).toMatch(/^\d{4}\.\d{2}\.\d+$/);
  });

  it('uses one unique step for every declared target', () => {
    const selectors = REGRESSION_TOUR_STEPS.map((step) => step.element);
    const targets = Object.values(REGRESSION_TOUR_TARGETS).map(
      (target) => `[data-tour="${target}"]`,
    );

    expect(selectors).toEqual(targets);
    expect(new Set(selectors).size).toBe(selectors.length);
  });

  it('explains the modeling workflow in plain Spanish', () => {
    for (const step of REGRESSION_TOUR_STEPS) {
      const description = step.popover?.description ?? '';
      expect(description).toBeTruthy();
      expect(description).not.toContain('<');
    }
  });
});
