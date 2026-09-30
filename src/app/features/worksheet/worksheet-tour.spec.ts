import {
  WORKSHEET_TOUR_REVISION,
  WORKSHEET_TOUR_STEPS,
  WORKSHEET_TOUR_TARGETS,
} from './worksheet-tour';

describe('worksheet tour', () => {
  it('has a revision that changes with the tour', () => {
    expect(WORKSHEET_TOUR_REVISION).toMatch(/^\d{4}\.\d{2}\.\d+$/);
  });

  it('uses one unique step for every declared target', () => {
    const selectors = WORKSHEET_TOUR_STEPS.map((step) => step.element);
    const targets = Object.values(WORKSHEET_TOUR_TARGETS).map(
      (target) => `[data-tour="${target}"]`,
    );

    expect(selectors).toEqual(targets);
    expect(new Set(selectors).size).toBe(selectors.length);
  });

  it('provides concise Spanish content for every step', () => {
    for (const step of WORKSHEET_TOUR_STEPS) {
      expect(step.popover?.title).toBeTruthy();
      expect(step.popover?.description).toBeTruthy();
      expect(step.popover?.description).not.toContain('<');
    }
  });
});
