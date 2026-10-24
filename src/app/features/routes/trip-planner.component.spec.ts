import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { SessionService, SessionStatus } from '../../core/auth/session.service';
import { ConnectivityService } from '../../core/connectivity.service';
import { LocationResult, LocationService } from '../map/location.service';
import {
  DiscoveryResults,
  Place,
  PlaceDiscoveryService,
  PlaceResults,
} from './place-discovery.service';
import { TripPlannerComponent } from './trip-planner.component';

const start: Place = {
  id: 'osm:N:1',
  name: 'Carbon',
  label: 'Carbon, Cebu',
  lat: 10.29,
  lng: 123.9,
};
const end: Place = { id: 'osm:N:2', name: 'Ayala', label: 'Ayala, Cebu', lat: 10.32, lng: 123.91 };
const candidate = {
  route: { id: 'r1', routeCode: '04C', publicName: 'Carbon – Lahug', routeColorHex: '#123456' },
  direction: {
    id: 'd1',
    directionLabel: 'Outbound',
    originName: 'Carbon',
    destinationName: 'Lahug',
  },
  originDistanceM: 120,
  destinationDistanceM: 340,
};

describe('TripPlannerComponent', () => {
  let fixture: ComponentFixture<TripPlannerComponent>;
  let component: TripPlannerComponent;
  let places: Subject<PlaceResults>;
  let routes: Subject<DiscoveryResults>;
  const status = signal<SessionStatus>('signed-in');
  const online = signal(true);
  const search = vi.fn();
  const discover = vi.fn();
  const locate = vi.fn();
  const text = () => fixture.nativeElement.textContent as string;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
  };
  beforeEach(async () => {
    places = new Subject();
    routes = new Subject();
    search.mockReset().mockReturnValue(places);
    discover.mockReset().mockReturnValue(routes);
    locate.mockReset();
    status.set('signed-in');
    online.set(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: { status } },
        { provide: ConnectivityService, useValue: { online } },
        { provide: PlaceDiscoveryService, useValue: { search, discover } },
        { provide: LocationService, useValue: { locate } },
      ],
    });
    fixture = TestBed.createComponent(TripPlannerComponent);
    component = fixture.componentInstance;
    await settle();
  });
  function selectBoth() {
    component.edit('origin');
    component.choose(start);
    component.edit('destination');
    component.choose(end);
  }
  it('submits through the Angular form without native navigation or reloading the session', async () => {
    component.query.setValue('Carbon');
    await settle();
    const event = new Event('submit', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector('form').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(search).toHaveBeenCalledWith('Carbon');
  });
  it('gates anonymous place search and never requests location at launch', async () => {
    status.set('signed-out');
    await settle();
    component.query.setValue('Ayala');
    component.search();
    expect(search).not.toHaveBeenCalled();
    expect(locate).not.toHaveBeenCalled();
    expect(text()).toContain('Sign in to search places');
  });
  it('rejects short/oversized queries without spending provider capacity', () => {
    for (const q of [' ', 'a', 'a'.repeat(121)]) {
      component.query.setValue(q);
      component.search();
    }
    expect(search).not.toHaveBeenCalled();
  });
  it('shows normalized names, labels, attribution and a distinct empty state', async () => {
    component.query.setValue('Ayala');
    component.search();
    expect(component.searchStatus()).toBe('loading');
    places.next({ places: [end], attribution: '© OpenStreetMap contributors' });
    await settle();
    expect(text()).toContain('Ayala, Cebu');
    expect(text()).toContain('© OpenStreetMap contributors');
    places.next({ places: [], attribution: '© OpenStreetMap contributors' });
    await settle();
    expect(text()).toContain('No places found');
    component.choose(end);
    await settle();
    expect(text()).toContain('© OpenStreetMap contributors');
  });
  it('cancels stale search immediately when query or endpoint changes', () => {
    component.query.setValue('Ayala');
    component.search();
    expect(places.observed).toBe(true);
    component.query.setValue('Carbon');
    expect(places.observed).toBe(false);
    places.next({ places: [end], attribution: 'stale' });
    expect(component.places()).toEqual([]);
    component.search();
    component.edit('origin');
    expect(places.observed).toBe(false);
  });
  it('provides a recoverable provider-down state without exposing raw errors', async () => {
    component.query.setValue('Ayala');
    component.search();
    places.error(
      new HttpErrorResponse({ status: 503, error: { message: 'private-provider-url' } }),
    );
    await settle();
    expect(text()).toContain('Place search is temporarily unavailable');
    expect(text()).toContain('Find a route');
    expect(text()).not.toContain('private-provider-url');
    search.mockReturnValue(new Subject());
    component.search();
    expect(search).toHaveBeenCalledTimes(2);
  });
  it('handles rate limiting with wait guidance', async () => {
    component.query.setValue('Ayala');
    component.search();
    places.error(new HttpErrorResponse({ status: 429 }));
    await settle();
    expect(text()).toContain('Too many requests');
  });
  it('preserves server direction, distance and IDs when opening the existing map', async () => {
    selectBoth();
    component.discover();
    expect(discover).toHaveBeenCalledWith(
      { name: start.name, lat: start.lat, lng: start.lng },
      { name: end.name, lat: end.lat, lng: end.lng },
    );
    routes.next({ candidates: [candidate], directRouteFound: true });
    await settle();
    expect(text()).toContain('04C');
    expect(text()).toContain('Outbound');
    expect(text()).toContain('120 m');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.open(candidate);
    expect(navigate).toHaveBeenCalledWith(['/tabs/map'], {
      queryParams: { route: 'r1', direction: 'd1' },
    });
  });
  it('renders no-direct-route without inventing a transfer', async () => {
    selectBoth();
    component.discover();
    routes.next({ candidates: [], directRouteFound: false });
    await settle();
    expect(text()).toContain('No direct route found');
    expect(text()).toContain('Transfers aren’t planned');
  });
  it('cancels old discovery when a selected place changes', () => {
    selectBoth();
    component.discover();
    expect(routes.observed).toBe(true);
    component.choose({ ...end, name: 'Other place' });
    expect(routes.observed).toBe(false);
    routes.next({ candidates: [candidate], directRouteFound: true });
    expect(component.candidates()).toEqual([]);
  });
  it('clears searches, coordinates and results on network loss and sign-out', async () => {
    selectBoth();
    component.discover();
    online.set(false);
    await settle();
    expect(routes.observed).toBe(false);
    expect(component.origin()).toBeNull();
    expect(component.destination()).toBeNull();
    expect(text()).toContain('Trip search needs a connection');
    online.set(true);
    await settle();
    selectBoth();
    status.set('signed-out');
    await settle();
    expect(component.origin()).toBeNull();
    expect(component.candidates()).toEqual([]);
  });
  it('accepts explicit geolocation and sends no coordinate until discovery is requested', async () => {
    locate.mockResolvedValue({ kind: 'located', position: [123.9, 10.3] });
    await component.locate();
    expect(component.origin()).toEqual({ name: 'Your current location', lat: 10.3, lng: 123.9 });
    expect(discover).not.toHaveBeenCalled();
  });
  it('offers manual origin after permission denial or an outside-PH location', async () => {
    locate.mockResolvedValue({ kind: 'denied' });
    await component.locate();
    expect(component.locationMessage()).toContain('Search for a starting point');
    locate.mockResolvedValue({ kind: 'located', position: [0, 51] });
    await component.locate();
    expect(component.origin()).toBeNull();
    expect(component.locationMessage()).toContain('Philippines');
  });
  it('preserves a selected start when a requested fix is denied or outside the Philippines', async () => {
    selectBoth();
    locate.mockResolvedValueOnce({ kind: 'denied' });
    await component.locate();
    expect(component.origin()?.name).toBe(start.name);
    expect(component.locationMessage()).toContain('Keep your selected start');
    locate.mockResolvedValueOnce({ kind: 'located', position: [0, 51] });
    await component.locate();
    expect(component.origin()?.name).toBe(start.name);
    expect(component.destination()?.name).toBe(end.name);
  });
  it('ignores a pending location after the rider starts editing the origin', async () => {
    selectBoth();
    let resolve!: (r: LocationResult) => void;
    locate.mockImplementation(
      () =>
        new Promise<LocationResult>((r) => {
          resolve = r;
        }),
    );
    const pending = component.locate();
    component.edit('origin');
    resolve({ kind: 'located', position: [123.8, 10.4] });
    await pending;
    expect(component.origin()?.name).toBe(start.name);
    expect(component.locating()).toBe(false);
  });
  it('ignores a late location after a manual origin is selected or component is destroyed', async () => {
    let resolve!: (r: LocationResult) => void;
    locate.mockImplementation(
      () =>
        new Promise<LocationResult>((r) => {
          resolve = r;
        }),
    );
    const pending = component.locate();
    component.edit('origin');
    component.choose(start);
    resolve({ kind: 'located', position: [123.8, 10.4] });
    await pending;
    expect(component.origin()?.name).toBe('Carbon');
    const late = component.locate();
    fixture.destroy();
    resolve({ kind: 'located', position: [123.8, 10.4] });
    await late;
    expect(component.origin()).toBeNull();
  });
  it('cancels active HTTP subscriptions on destroy', () => {
    component.query.setValue('Ayala');
    component.search();
    selectBoth();
    component.discover();
    fixture.destroy();
    expect(places.observed).toBe(false);
    expect(routes.observed).toBe(false);
  });
});
