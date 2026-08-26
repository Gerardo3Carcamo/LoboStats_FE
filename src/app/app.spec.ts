import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideRouter([]), provideNoopAnimations()],
    }).compileComponents();
  });

  it('creates the application shell', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the brand and all primary navigation destinations', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.brand')?.textContent).toContain('LoboStats');
    expect(element.querySelectorAll('.sidebar nav a')).toHaveLength(6);
    expect(element.querySelector('.mobile-nav')?.textContent).toContain('Distrib.');
    expect(element.querySelector('.workspace-status')?.textContent).toContain('Sin una muestra activa');
    expect(element.querySelector('[data-tour="start"]')?.textContent).toContain('Ver tutorial');
  });
});
