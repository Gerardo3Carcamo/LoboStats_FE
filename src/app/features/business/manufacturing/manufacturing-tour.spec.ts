import {
  MANUFACTURING_TOUR_REVISION,
  MANUFACTURING_TOUR_STEPS,
  MANUFACTURING_TOUR_TARGETS,
} from './manufacturing-tour';

describe('manufacturing tour', () => {
  it('has a revision that changes with the tour', () => {
    expect(MANUFACTURING_TOUR_REVISION).toMatch(/^\d{4}\.\d{2}\.\d+$/);
  });

  it('uses one unique step for every declared target', () => {
    const selectors = MANUFACTURING_TOUR_STEPS.map((step) => step.element);
    const targets = Object.values(MANUFACTURING_TOUR_TARGETS).map(
      (target) => `[data-tour="${target}"]`,
    );

    expect(selectors).toEqual(targets);
    expect(new Set(selectors).size).toBe(selectors.length);
  });

  it('uses manufacturing language without markup', () => {
    for (const step of MANUFACTURING_TOUR_STEPS) {
      const description = step.popover?.description ?? '';
      expect(description).toBeTruthy();
      expect(description).not.toContain('<');
    }
  });
});
