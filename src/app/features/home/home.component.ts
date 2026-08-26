import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { DataValue } from '../../core/models/dataset.model';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-home',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatInputModule, MatProgressSpinnerModule],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  protected readonly data = inject(DataService);
  private readonly router = inject(Router);

  protected readonly mode = signal<'file' | 'manual'>('file');
  protected readonly dragging = signal(false);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly submitting = signal(false);
  protected manualName = 'Muestra manual';
  protected columns = ['Variable A', 'Variable B'];
  protected rows: DataValue[][] = [['', ''], ['', '']];

  protected chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.setFile(input.files?.[0] ?? null);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.setFile(event.dataTransfer?.files[0] ?? null);
  }

  protected upload(): void {
    const file = this.selectedFile();
    if (!file) return;
    this.submitting.set(true);
    this.data.upload(file).pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: () => void this.router.navigate(['/datos']),
      error: () => undefined,
    });
  }

  protected createManual(): void {
    if (!this.manualName.trim() || this.columns.some((column) => !column.trim())) return;
    this.submitting.set(true);
    this.data.createManual({
      name: this.manualName.trim(),
      columns: this.columns.map((column) => column.trim()),
      rows: this.rows,
    }).pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: () => void this.router.navigate(['/datos']),
      error: () => undefined,
    });
  }

  protected addColumn(): void {
    this.columns = [...this.columns, `Variable ${this.columns.length + 1}`];
    this.rows = this.rows.map((row) => [...row, '']);
  }

  protected removeColumn(index: number): void {
    if (this.columns.length === 1) return;
    this.columns = this.columns.filter((_, position) => position !== index);
    this.rows = this.rows.map((row) => row.filter((_, position) => position !== index));
  }

  protected addRow(): void {
    this.rows = [...this.rows, this.columns.map(() => '')];
  }

  protected removeRow(index: number): void {
    if (this.rows.length === 1) return;
    this.rows = this.rows.filter((_, position) => position !== index);
  }

  protected updateCell(row: number, column: number, value: string): void {
    const parsed: DataValue = value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : value;
    this.rows = this.rows.map((current, index) => index === row
      ? current.map((cell, cellIndex) => cellIndex === column ? parsed : cell)
      : current);
  }

  private setFile(file: File | null): void {
    this.data.clearError();
    if (file && !file.name.toLowerCase().endsWith('.csv')) {
      this.selectedFile.set(null);
      return;
    }
    this.selectedFile.set(file);
  }
}
