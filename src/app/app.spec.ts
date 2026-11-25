import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';

describe('App navigation', () => {
  let fixture: ComponentFixture<App>;

  beforeEach(async () => {
    localStorage.removeItem('lobostats.sidebar.pinned');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    fixture.detectChanges();
  });

  it('uses statistical icons instead of numbered module badges', () => {
    const root = fixture.nativeElement as HTMLElement;
    const desktopItems = root.querySelectorAll('.sidebar .nav-item');

    expect(desktopItems.length).toBe(9);
    expect(root.querySelectorAll('.sidebar app-navigation-icon').length).toBe(9);
    expect(root.querySelector('.brand app-brand-mark svg')).not.toBeNull();
    expect(root.querySelector('.sidebar')?.textContent).not.toContain('01');
  });

  it('opens temporarily and closes from the backdrop', () => {
    const root = fixture.nativeElement as HTMLElement;
    const toggle = root.querySelector('.sidebar-toggle') as HTMLButtonElement;

    toggle.click();
    fixture.detectChanges();

    expect(root.querySelector('.app-frame')?.getAttribute('data-sidebar')).toBe('temporary');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    (root.querySelector('.sidebar-backdrop') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.app-frame')?.getAttribute('data-sidebar')).toBe('compact');
  });

  it('closes a temporary menu with Escape', () => {
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('.sidebar-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(root.querySelector('.app-frame')?.getAttribute('data-sidebar')).toBe('compact');
  });

  it('persists the pinned preference and allows unpinning', () => {
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('.sidebar-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();

    (root.querySelector('.pin-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.app-frame')?.getAttribute('data-sidebar')).toBe('pinned');
    expect(localStorage.getItem('lobostats.sidebar.pinned')).toBe('true');

    (root.querySelector('.pin-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.app-frame')?.getAttribute('data-sidebar')).toBe('compact');
    expect(localStorage.getItem('lobostats.sidebar.pinned')).toBe('false');
  });

  it('exposes every module in the on-demand mobile sheet', () => {
    const root = fixture.nativeElement as HTMLElement;
    (root.querySelector('.mobile-nav button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const sheet = root.querySelector('.mobile-module-sheet');
    expect(sheet).not.toBeNull();
    expect(sheet?.querySelectorAll('app-navigation-icon').length).toBe(9);
    expect(sheet?.textContent).toContain('Series de tiempo');

    (sheet?.querySelector('header button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.mobile-module-sheet')).toBeNull();
  });
});
