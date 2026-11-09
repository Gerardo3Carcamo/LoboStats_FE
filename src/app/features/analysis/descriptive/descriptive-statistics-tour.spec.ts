import {
  DESCRIPTIVE_TOUR_REVISION,
  DESCRIPTIVE_TOUR_STEPS,
  DESCRIPTIVE_TOUR_TARGETS,
} from './descriptive-statistics-tour';

describe('descriptive statistics tour', () => {
  it('has a revision that changes with the tour', () => {
    expect(DESCRIPTIVE_TOUR_REVISION).toMatch(/^\d{4}\.\d{2}\.\d+$/);
  });

  it('uses one unique step for every declared target', () => {
    const selectors = DESCRIPTIVE_TOUR_STEPS.map((step) => step.element);
    const targets = Object.values(DESCRIPTIVE_TOUR_TARGETS).map(
      (target) => `[data-tour="${target}"]`,
    );

    expect(selectors).toEqual(targets);
    expect(new Set(selectors).size).toBe(selectors.length);
  });

  it('provides concise Spanish content and practical examples', () => {
    const descriptions = DESCRIPTIVE_TOUR_STEPS.map((step) => step.popover?.description ?? '');

    for (const step of DESCRIPTIVE_TOUR_STEPS) {
      expect(step.popover?.title).toBeTruthy();
      expect(step.popover?.description).toBeTruthy();
      expect(step.popover?.description).not.toContain('<');
    }
    expect(descriptions.filter((description) => description.includes('Ejemplo:')).length).toBe(4);
  });
});
