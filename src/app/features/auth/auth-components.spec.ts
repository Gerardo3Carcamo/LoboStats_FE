import { provideHttpClient } from '@angular/common/http';
import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { RegisterComponent } from './register.component';

describe('auth screens', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideRouter([])],
  }));

  function render<T>(component: Type<T>): ComponentFixture<T> {
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    return fixture;
  }

  it('renders an accessible login form', () => {
    const element = render(LoginComponent).nativeElement as HTMLElement;
    expect(element.querySelector('h2')?.textContent).toContain('Continúa tu análisis');
    expect(element.querySelector('input[autocomplete="username"]')).toBeTruthy();
    expect(element.querySelector('input[autocomplete="current-password"]')).toBeTruthy();
    expect(element.querySelector('button[type="submit"]')?.textContent).toContain('Iniciar sesión');
  });

  it('renders registration requirements and confirmation', () => {
    const element = render(RegisterComponent).nativeElement as HTMLElement;
    expect(element.textContent).toContain('@uadec.edu.mx');
    expect(element.textContent).toContain('12 caracteres');
    expect(element.querySelectorAll('input[autocomplete="new-password"]')).toHaveLength(2);
  });
});
