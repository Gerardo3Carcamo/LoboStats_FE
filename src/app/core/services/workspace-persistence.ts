import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Dataset } from '../../models/dataset';
import { DatasetApi } from './dataset-api';
import { WorkspaceStore } from './workspace-store';

@Injectable({ providedIn: 'root' })
export class WorkspacePersistenceService {
  private readonly datasetApi = inject(DatasetApi);
  private readonly store = inject(WorkspaceStore);

  async saveCurrent(): Promise<Dataset> {
    const datasetId = this.store.datasetId();
    const request = datasetId
      ? this.datasetApi.update(datasetId, this.store.payload())
      : this.datasetApi.create(this.store.payload());
    const saved = await firstValueFrom(request);
    this.store.markSaved(saved);
    return saved;
  }
}
