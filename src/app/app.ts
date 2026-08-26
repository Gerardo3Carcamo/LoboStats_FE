import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs';
import { DataService } from './core/services/data.service';
import { TutorialService } from './core/services/tutorial.service';
import { AuthService } from './core/auth/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly data = inject(DataService);
  protected readonly tutorial = inject(TutorialService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly isAuthRoute = signal(this.isPublicAuthUrl(this.router.url));
  protected readonly navItems = [
    { label: 'Inicio', shortLabel: 'Inicio', icon: 'add_chart', path: '/', exact: true },
    { label: 'Datos', shortLabel: 'Datos', icon: 'table_view', path: '/datos', exact: false },
    { label: 'Estadística', shortLabel: 'Estad.', icon: 'science', path: '/estadistica', exact: false },
    { label: 'Gráficos', shortLabel: 'Gráf.', icon: 'ssid_chart', path: '/visualizaciones', exact: false },
    { label: 'ANOVA', shortLabel: 'ANOVA', icon: 'functions', path: '/anova', exact: false },
    { label: 'Distribuciones', shortLabel: 'Distrib.', icon: 'stacked_line_chart', path: '/distribuciones', exact: false },
  ];
  protected readonly pulsePath = computed(() => {
    const dataset = this.data.dataset();
    const amplitude = dataset ? Math.min(22, 8 + dataset.column_count) : 7;
    const beat = dataset ? Math.min(18, 5 + Math.log10(dataset.row_count + 1) * 4) : 6;
    return `M0 32 H120 L132 ${32 - amplitude / 2} L142 ${32 + amplitude / 2} L154 ${32 - beat} L166 ${32 + beat} L180 32 H305 L315 23 L326 41 L338 32 H520`;
  });

  constructor() {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.isAuthRoute.set(this.isPublicAuthUrl(event.urlAfterRedirects)));
  }

  protected logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => void this.router.navigateByUrl('/login'),
    });
  }

  private isPublicAuthUrl(url: string): boolean {
    return /^\/(login|registro|verificar)(?:[/?#]|$)/.test(url);
  }
}
