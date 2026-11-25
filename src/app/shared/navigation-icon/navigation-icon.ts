import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type NavigationIconName =
  | 'worksheet'
  | 'descriptive'
  | 'probability'
  | 'hypothesis'
  | 'regression'
  | 'manufacturing'
  | 'quality'
  | 'time-series'
  | 'multivariate';

@Component({
  selector: 'app-navigation-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 24 24" focusable="false">
      @switch (name()) {
        @case ('worksheet') {
          <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
          <path d="M3.5 9h17M9 4v16M15 4v16" />
        }
        @case ('descriptive') {
          <path d="M3.5 20.5h17M4.5 20V13h3v7M10.5 20V7h3v13M16.5 20V10h3v10" />
          <path class="accent" d="M3.5 5.5h17" />
        }
        @case ('probability') {
          <path d="M2.5 19h19" />
          <path d="M3 19c4.3 0 4.7-13 9-13s4.7 13 9 13" />
          <path class="accent" d="M12 6v13" />
        }
        @case ('hypothesis') {
          <circle cx="6" cy="8" r="2.5" />
          <circle cx="18" cy="16" r="2.5" />
          <path d="M9.5 8h9M14.5 5l4 3-4 3M14.5 16h-9M9.5 13l-4 3 4 3" />
        }
        @case ('regression') {
          <path d="M3.5 3.5v17h17" />
          <circle cx="7" cy="15" r="1.25" />
          <circle cx="11" cy="13" r="1.25" />
          <circle cx="14.5" cy="9" r="1.25" />
          <circle cx="18" cy="7" r="1.25" />
          <path class="accent" d="M5.5 17.5 19 5.5" />
        }
        @case ('manufacturing') {
          <path d="M3.5 20.5V9.5l5 3v-3l5 3V6h3v6.5h4v8Z" />
          <path d="M6.5 20v-3h3v3M13 16h1M17 16h1" />
          <path class="accent" d="M14.5 6V3.5h2V6" />
        }
        @case ('quality') {
          <path d="M3.5 4v16h17M4 8h16M4 16h16" />
          <path class="accent" d="m5 13 3-2 3 3 3-5 5 3" />
        }
        @case ('time-series') {
          <path d="M3.5 4v16h17" />
          <path class="accent" d="m5 16 3-5 3 2 3-6 5 4" />
          <path d="M8 4v2M14 4v2M20 4v2" />
        }
        @case ('multivariate') {
          <circle cx="7" cy="8" r="1.5" />
          <circle cx="10" cy="5.5" r="1.25" />
          <circle cx="10.5" cy="10" r="1.25" />
          <circle cx="16" cy="14" r="1.5" />
          <circle cx="19" cy="11.5" r="1.25" />
          <circle cx="18.5" cy="17" r="1.25" />
          <path class="accent" d="M3.5 20.5 20.5 3.5" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      height: 22px;
      width: 22px;
    }

    svg {
      fill: none;
      height: 100%;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 1.55;
      width: 100%;
    }

    .accent {
      stroke-width: 2;
    }
  `,
})
export class NavigationIcon {
  readonly name = input.required<NavigationIconName>();
}
