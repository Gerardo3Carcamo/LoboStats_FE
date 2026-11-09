import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 32 32" focusable="false">
      <path class="wolf" d="M3.5 4.5 11 9l5-2.5L21 9l7.5-4.5-3 17.5L16 28.5 6.5 22Z" />
      <path class="ear" d="m6.5 8 4.2 3M25.5 8l-4.2 3" />
      <circle class="datum" cx="11.5" cy="15" r="1.25" />
      <circle class="datum" cx="20.5" cy="15" r="1.25" />
      <path class="median" d="M16 10.5v13M12.5 21h7" />
      <path class="nose" d="m13.5 23.5 2.5 2 2.5-2" />
    </svg>
  `,
  styles: `
    :host {
      color: var(--gold);
      display: inline-flex;
      flex: 0 0 auto;
      height: 42px;
      width: 42px;
    }

    svg {
      fill: none;
      height: 100%;
      overflow: visible;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      width: 100%;
    }

    .wolf {
      stroke-width: 1.65;
    }

    .ear,
    .median {
      opacity: 0.78;
      stroke-width: 1.25;
    }

    .datum {
      fill: currentColor;
      stroke: none;
    }

    .nose {
      stroke-width: 1.65;
    }
  `,
})
export class BrandMark {}
