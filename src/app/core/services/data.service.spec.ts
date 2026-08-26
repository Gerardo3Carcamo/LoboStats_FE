import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DataService } from './data.service';

describe('DataService', () => {
  let service: DataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(DataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uploads a CSV using the multipart file key and stores a nested dataset', () => {
    const file = new File(['x,y\n1,2'], 'sample.csv', { type: 'text/csv' });
    let receivedName = '';

    service.upload(file).subscribe((dataset) => receivedName = dataset.name);
    const request = http.expectOne('/api/data/upload');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get('file')).toBe(file);
    request.flush({ dataset: { id: 'd-1', name: 'Muestra', row_count: 1, column_count: 2, columns: [], preview: [] } });

    expect(receivedName).toBe('Muestra');
    expect(service.dataset()?.id).toBe('d-1');
    expect(service.loading()).toBe(false);
  });

  it('accepts dataset fields at the response root', () => {
    service.get('root-1').subscribe();
    const request = http.expectOne((candidate) => candidate.url === '/api/data/root-1');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('page_size')).toBe('10');
    request.flush({
      id: 'root-1', name: 'Raíz', rowCount: 3, columnCount: 1,
      columns: [{ name: 'edad', type: 'number', missing: 0, unique: 3 }],
      preview: [{ edad: 20 }],
    });

    expect(service.dataset()?.row_count).toBe(3);
    expect(service.dataset()?.columns[0]?.name).toBe('edad');
  });

  it('exposes a useful connection error', () => {
    service.get('missing').subscribe({ error: () => undefined });
    http.expectOne((candidate) => candidate.url === '/api/data/missing').error(new ProgressEvent('network'));
    expect(service.error()).toContain('No se pudo conectar');
  });

  it('normalizes the backend MVP response', () => {
    service.get('backend-1', 2, 25).subscribe();
    const request = http.expectOne((candidate) => candidate.url === '/api/data/backend-1');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('page_size')).toBe('25');
    request.flush({
      dataset_id: 'backend-1', name: 'Iris', row_count: 150, column_count: 2,
      columns: [{ name: 'sepal_length', type: 'numérico', missing: 0, unique: 35 }],
      preview: [{ sepal_length: 4.9 }],
      data: [{ sepal_length: 5.1 }],
    });

    expect(service.dataset()?.id).toBe('backend-1');
    expect(service.dataset()?.preview).toEqual([{ sepal_length: 5.1 }]);
  });
});
