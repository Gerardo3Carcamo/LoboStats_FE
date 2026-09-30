import { fakeAsync, TestBed, tick } from '@angular/core/testing';

import { ProductTourService } from './product-tour';

describe('ProductTourService', () => {
  it('keeps the application interactive when no tour targets are rendered', fakeAsync(() => {
    const appRoot = document.createElement('app-root');
    const trigger = document.createElement('button');
    document.body.append(appRoot, trigger);
    trigger.focus();

    const service = TestBed.inject(ProductTourService);
    service.startWorksheetTour(trigger);
    tick(20);

    expect(appRoot.inert).toBeFalse();
    expect(document.querySelector('.driver-popover')).toBeNull();

    appRoot.remove();
    trigger.remove();
  }));
});
