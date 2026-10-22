import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { TRACKING_GATEWAY, GatewayState } from './tracking-gateway';
import { TrackingPanelComponent } from './tracking-panel.component';
import { VehicleTrackingStore } from './vehicle-tracking.store';

describe('TrackingPanelComponent', () => {
  it('shows unavailable rather than a fabricated count with the production default adapter', async () => {
    TestBed.configureTestingModule({ providers: [VehicleTrackingStore] });
    const fixture = TestBed.createComponent(TrackingPanelComponent);
    const store = TestBed.inject(VehicleTrackingStore);
    store.connect('d1', true, true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Live jeepneys are unavailable');
    expect(store.count()).toBeNull();
  });
  it('renders plate, status, direction, physical color and timestamp without private identity fields', async () => {
    const stream = new Subject<GatewayState>();
    TestBed.configureTestingModule({
      providers: [
        VehicleTrackingStore,
        { provide: TRACKING_GATEWAY, useValue: { watch: () => stream } },
      ],
    });
    const fixture = TestBed.createComponent(TrackingPanelComponent);
    const store = TestBed.inject(VehicleTrackingStore);
    store.connect('d1', true, true);
    stream.next({
      kind: 'snapshot',
      revision: 1,
      vehicles: [
        {
          id: 'v1',
          directionId: 'd1',
          position: [123, 10],
          plateNumber: 'TEST-001',
          routeLabel: '04C',
          directionLabel: 'Outbound',
          vehicleColor: '#123456',
          statusLabel: 'Available',
          observedAtMs: Date.now(),
          available: true,
        },
      ],
    });
    store.selectedId.set('v1');
    fixture.detectChanges();
    await fixture.whenStable();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('1 available jeepney');
    expect(text).toContain('TEST-001');
    expect(text).toContain('Outbound');
    expect(text).toContain('Available');
    expect(text).toContain('#123456');
    expect(text).toContain('Last update');
    stream.next({ kind: 'snapshot', revision: 2, vehicles: [] });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('article')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No available jeepneys');
  });
  it('renders offline state without stale counts', () => {
    TestBed.configureTestingModule({
      providers: [
        VehicleTrackingStore,
        { provide: TRACKING_GATEWAY, useValue: { watch: () => of({ kind: 'unavailable' }) } },
      ],
    });
    const fixture = TestBed.createComponent(TrackingPanelComponent);
    TestBed.inject(VehicleTrackingStore).connect('d1', true, false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Live jeepneys are hidden');
  });
});
