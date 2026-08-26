import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-data',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatPaginatorModule],
  templateUrl: './data.component.html',
})
export class DataComponent {
  protected readonly data = inject(DataService);
  private readonly router = inject(Router);
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(10);
  protected readonly totalMissing = (total: number, column: { missing: number }): number => total + column.missing;
  protected readonly pageRows = computed(() => {
    return this.data.dataset()?.preview ?? [];
  });

  protected paginate(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    const dataset = this.data.dataset();
    if (dataset) {
      this.data.get(dataset.id, event.pageIndex + 1, event.pageSize).subscribe({ error: () => undefined });
    }
  }

  protected remove(): void {
    const dataset = this.data.dataset();
    if (!dataset || !confirm(`¿Eliminar el dataset “${dataset.name}” de esta sesión?`)) return;
    this.data.deleteCurrent().subscribe({
      next: () => void this.router.navigate(['/']),
      error: () => undefined,
    });
  }
}
