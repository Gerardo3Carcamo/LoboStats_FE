import {
  HYPOTHESIS_TOUR_REVISION,
  HYPOTHESIS_TOUR_STEPS,
  HYPOTHESIS_TOUR_TARGETS,
} from './hypothesis-tour';

describe('hypothesis tour', () => {
  it('has a revision that changes with the tour', () => {
    expect(HYPOTHESIS_TOUR_REVISION).toMatch(/^\d{4}\.\d{2}\.\d+$/);
  });

  it('uses one unique step for every declared target', () => {
    const selectors = HYPOTHESIS_TOUR_STEPS.map((step) => step.element);
    const targets = Object.values(HYPOTHESIS_TOUR_TARGETS).map(
      (target) => `[data-tour="${target}"]`,
    );

    expect(selectors).toEqual(targets);
    expect(new Set(selectors).size).toBe(selectors.length);
  });

  it('provides plain Spanish guidance', () => {
    for (const step of HYPOTHESIS_TOUR_STEPS) {
      const description = step.popover?.description ?? '';
      expect(description).toBeTruthy();
      expect(description).not.toContain('<');
    }
  });
});
