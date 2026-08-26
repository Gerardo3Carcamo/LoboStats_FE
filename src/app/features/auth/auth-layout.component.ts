import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  imports: [RouterLink, RouterOutlet],
  template: `
    <main class="auth-layout">
      <section class="auth-context" aria-label="LoboStats">
        <a class="auth-brand" routerLink="/login"><span>L</span>LoboStats</a>
        <div class="context-copy">
          <p class="context-label">Laboratorio de datos</p>
          <h1>La evidencia empieza con una sesión segura.</h1>
          <p>Analiza muestras, contrasta hipótesis y conserva tu trabajo en un espacio universitario.</p>
        </div>
        <div class="distribution" aria-hidden="true">
          @for (bar of bars; track $index) { <i [style.height.%]="bar"></i> }
        </div>
        <small>Universidad Autónoma de Coahuila</small>
      </section>
      <section class="auth-form-panel">
        <router-outlet />
      </section>
    </main>
  `,
  styleUrl: './auth-layout.component.scss',
})
export class AuthLayoutComponent {
  protected readonly bars = [8, 12, 19, 31, 48, 68, 86, 100, 91, 72, 49, 29, 16, 9];
}
