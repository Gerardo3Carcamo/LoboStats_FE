import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { ProductTourService } from './core/services/product-tour';
import { BrandMark } from './shared/brand-mark/brand-mark';
import { NavigationIcon, NavigationIconName } from './shared/navigation-icon/navigation-icon';

const SIDEBAR_PINNED_KEY = 'lobostats.sidebar.pinned';
type SidebarMode = 'compact' | 'temporary' | 'pinned';

interface NavigationItem {
  label: string;
  shortLabel: string;
  icon: NavigationIconName;
  available: boolean;
  path?: string;
}

interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

@Component({
  selector: 'app-root',
  imports: [BrandMark, CdkTrapFocus, NavigationIcon, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly productTour = inject(ProductTourService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mobileMenuClose = viewChild<ElementRef<HTMLButtonElement>>('mobileMenuClose');
  private mobileMenuTrigger: HTMLElement | null = null;

  protected readonly sidebarMode = signal<SidebarMode>(initialSidebarMode());
  protected readonly sidebarExpanded = computed(() => this.sidebarMode() !== 'compact');
  protected readonly mobileMenuOpen = signal(false);
  protected readonly navigation: NavigationGroup[] = [
    {
      label: 'Preparar',
      items: [
        {
          label: 'Hoja de trabajo',
          shortLabel: 'Hoja',
          icon: 'worksheet',
          available: true,
          path: '/',
        },
      ],
    },
    {
      label: 'Analizar',
      items: [
        {
          label: 'Estadística descriptiva',
          shortLabel: 'Descriptiva',
          icon: 'descriptive',
          available: true,
          path: '/descriptive',
        },
        {
          label: 'Probabilidad',
          shortLabel: 'Probabilidad',
          icon: 'probability',
          available: true,
          path: '/probability',
        },
        {
          label: 'Hipótesis',
          shortLabel: 'Hipótesis',
          icon: 'hypothesis',
          available: true,
          path: '/hypothesis',
        },
        {
          label: 'Regresión',
          shortLabel: 'Regresión',
          icon: 'regression',
          available: true,
          path: '/regression',
        },
      ],
    },
    {
      label: 'Especializar',
      items: [
        { label: 'Calidad', shortLabel: 'Calidad', icon: 'quality', available: false },
        {
          label: 'Series de tiempo',
          shortLabel: 'Series',
          icon: 'time-series',
          available: false,
        },
        {
          label: 'Multivariado',
          shortLabel: 'Multivariado',
          icon: 'multivariate',
          available: false,
        },
      ],
    },
  ];
  protected readonly availableNavigation = this.navigation.flatMap((group) =>
    group.items.filter((item) => item.available),
  );
  protected readonly primaryMobileNavigation = this.availableNavigation.slice(0, 3);

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.sidebarMode() === 'temporary') this.sidebarMode.set('compact');
        this.mobileMenuOpen.set(false);
      });
  }

  protected toggleSidebar(): void {
    if (this.sidebarMode() === 'compact') {
      this.sidebarMode.set('temporary');
      return;
    }
    if (this.sidebarMode() === 'pinned') this.persistPinnedPreference(false);
    this.sidebarMode.set('compact');
  }

  protected closeTemporarySidebar(): void {
    if (this.sidebarMode() === 'temporary') this.sidebarMode.set('compact');
  }

  protected togglePinnedSidebar(): void {
    const pin = this.sidebarMode() !== 'pinned';
    this.sidebarMode.set(pin ? 'pinned' : 'compact');
    this.persistPinnedPreference(pin);
  }

  protected openMobileMenu(event: Event): void {
    this.mobileMenuTrigger = event.currentTarget as HTMLElement;
    this.mobileMenuOpen.set(true);
    requestAnimationFrame(() => this.mobileMenuClose()?.nativeElement.focus());
  }

  protected closeMobileMenu(restoreFocus = true): void {
    this.mobileMenuOpen.set(false);
    if (restoreFocus) requestAnimationFrame(() => this.mobileMenuTrigger?.focus());
  }

  @HostListener('document:keydown.escape')
  protected closeMenusWithEscape(): void {
    if (this.mobileMenuOpen()) {
      this.closeMobileMenu();
      return;
    }
    this.closeTemporarySidebar();
  }

  @HostListener('window:resize')
  protected adaptNavigationToViewport(): void {
    if (window.innerWidth <= 900 && this.sidebarMode() === 'pinned') {
      this.sidebarMode.set('compact');
    }
    if (window.innerWidth > 600 && this.mobileMenuOpen()) this.closeMobileMenu(false);
  }

  protected startTour(event: Event): void {
    const trigger = event.currentTarget as HTMLElement;
    if (this.router.url.startsWith('/descriptive')) {
      this.productTour.startDescriptiveTour(trigger);
      return;
    }
    if (this.router.url.startsWith('/probability')) {
      this.productTour.startProbabilityTour(trigger);
      return;
    }
    if (this.router.url.startsWith('/hypothesis')) {
      this.productTour.startHypothesisTour(trigger);
      return;
    }
    if (this.router.url.startsWith('/regression')) {
      this.productTour.startRegressionTour(trigger);
      return;
    }
    if (this.router.url === '/') {
      this.productTour.startWorksheetTour(trigger);
      return;
    }
    void this.router
      .navigate(['/'])
      .then(() => requestAnimationFrame(() => this.productTour.startWorksheetTour(trigger)));
  }

  private persistPinnedPreference(pinned: boolean): void {
    try {
      localStorage.setItem(SIDEBAR_PINNED_KEY, String(pinned));
    } catch {
      // The navigation remains usable when browser storage is unavailable.
    }
  }
}

function initialSidebarMode(): SidebarMode {
  try {
    return window.matchMedia('(min-width: 901px)').matches &&
      localStorage.getItem(SIDEBAR_PINNED_KEY) === 'true'
      ? 'pinned'
      : 'compact';
  } catch {
    return 'compact';
  }
}
