import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '../../core/app-config';
import { REQUIRES_AUTH } from '../../core/auth/auth-api.service';
import { PlaceDiscoveryService } from './place-discovery.service';

describe('G6 wire contract', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_CONFIG, useValue: { apiBaseUrl: 'https://api.example.test/api' } },
      ],
    }),
  );
  afterEach(() => TestBed.inject(HttpTestingController).verify());
  it('authenticates normalized place search and uses only the VALRYDE backend', () => {
    TestBed.inject(PlaceDiscoveryService).search('  Ayala  ').subscribe();
    const req = TestBed.inject(HttpTestingController).expectOne(
      (r) => r.url === 'https://api.example.test/api/places/search',
    );
    expect(req.request.context.get(REQUIRES_AUTH)).toBe(true);
    expect(req.request.params.get('q')).toBe('Ayala');
    expect(req.request.params.get('limit')).toBe('5');
    expect(req.request.params.keys().sort()).toEqual(['limit', 'q']);
    req.flush({ places: [], attribution: '© OpenStreetMap contributors' });
  });
  it('leaves discovery public, sends lat/lng in API order and the approved walking radius', () => {
    TestBed.inject(PlaceDiscoveryService)
      .discover({ lat: 10.3, lng: 123.8 }, { lat: 10.4, lng: 123.9 })
      .subscribe();
    const req = TestBed.inject(HttpTestingController).expectOne((r) =>
      r.url.endsWith('/transit-routes/discover'),
    );
    expect(req.request.context.get(REQUIRES_AUTH)).toBe(false);
    expect(req.request.params.get('lat')).toBe('10.3');
    expect(req.request.params.get('lng')).toBe('123.8');
    expect(req.request.params.get('destinationLat')).toBe('10.4');
    expect(req.request.params.get('destinationLng')).toBe('123.9');
    expect(req.request.params.get('maxWalkM')).toBe('500');
    req.flush({ candidates: [], directRouteFound: false });
  });
});
