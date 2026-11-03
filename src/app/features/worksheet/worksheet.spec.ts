import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { WorkspaceStore } from '../../core/services/workspace-store';
import { Worksheet } from './worksheet';
import { WORKSHEET_TOUR_TARGETS } from './worksheet-tour';

describe('Worksheet tour targets', () => {
  let fixture: ComponentFixture<Worksheet>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Worksheet],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Worksheet);
    fixture.autoDetectChanges();
  });

  it('renders every target required by the guided tour', () => {
    const root = fixture.nativeElement as HTMLElement;

    for (const target of Object.values(WORKSHEET_TOUR_TARGETS)) {
      expect(root.querySelector(`[data-tour="${target}"]`))
        .withContext(`Missing data-tour target: ${target}`)
        .not.toBeNull();
    }
  });

  it('keeps current data until the import preview is confirmed', async () => {
    const store = TestBed.inject(WorkspaceStore);
    store.replace(
      [{ key: 'c1', name: 'Anterior', data_type: 'number' }],
      [{ c1: 99 }],
      'Conjunto anterior',
    );
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#dataset-file') as HTMLInputElement;
    const file = new File(['Código,Puntaje\n001,85\n002,90'], 'nuevo.csv', {
      type: 'text/csv',
    });
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));

    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    fixture.detectChanges();

    expect(store.name()).toBe('Conjunto anterior');
    expect(store.filledRows()).toEqual([{ c1: 99 }]);

    const dialog = fixture.nativeElement.querySelector('.import-dialog') as HTMLDialogElement;
    expect(dialog.open).toBeTrue();

    const confirm = dialog.querySelector('.dialog-button.primary') as HTMLButtonElement;
    confirm.click();
    fixture.detectChanges();

    expect(store.name()).toBe('nuevo');
    expect(store.columns().map((column) => column.name)).toEqual(['Código', 'Puntaje']);
    expect(store.filledRows()).toEqual([
      { c1: '001', c2: 85 },
      { c1: '002', c2: 90 },
    ]);
  });
});
