import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../../core/app-config';
import { TransitRoutesService } from './transit-routes.service';

describe('TransitRoutesService', () => {
  let service: TransitRoutesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api' } },
      ],
    });
    service = TestBed.inject(TransitRoutesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the public list with trimmed q, page and pageSize', async () => {
    const result = firstValueFrom(service.list({ q: '  Colon ', page: 2, pageSize: 20 }));
    const req = http.expectOne((r) => r.url === 'https://api.example.test/api/transit-routes');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('Colon');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');
    const body = { routes: [], pagination: { page: 2, pageSize: 20, total: 0, totalPages: 0 } };
    req.flush(body);
    expect(await result).toEqual(body);
  });

  it('omits an empty q (the contract requires 1–160 characters)', () => {
    service.list({ q: '   ' }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/transit-routes'));
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ routes: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
  });

  it('unwraps the route detail envelope and encodes the id', async () => {
    const result = firstValueFrom(service.get('a/b'));
    const req = http.expectOne('https://api.example.test/api/transit-routes/a%2Fb');
    req.flush({ route: { id: 'a/b', routeCode: '01K' } });
    expect(await result).toEqual({ id: 'a/b', routeCode: '01K' });
  });
});
