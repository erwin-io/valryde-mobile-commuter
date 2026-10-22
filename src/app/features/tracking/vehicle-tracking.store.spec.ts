import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { TRACKING_GATEWAY, GatewayState, PublicVehicle } from './tracking-gateway';
import { VehicleTrackingStore } from './vehicle-tracking.store';

const vehicle = (overrides: Partial<PublicVehicle> = {}): PublicVehicle => ({
  id: 'v1',
  directionId: 'd1',
  position: [123.9, 10.3],
  plateNumber: 'TEST-001',
  routeLabel: '04C',
  directionLabel: 'Outbound',
  vehicleColor: '#BADA55',
  statusLabel: 'Available',
  observedAtMs: Date.now(),
  available: true,
  ...overrides,
});

describe('VehicleTrackingStore internal gateway boundary', () => {
  let store: VehicleTrackingStore;
  let streams: Subject<GatewayState>[];
  const watch = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T00:00:00Z'));
    streams = [];
    watch.mockReset().mockImplementation(() => {
      const stream = new Subject<GatewayState>();
      streams.push(stream);
      return stream;
    });
    TestBed.configureTestingModule({
      providers: [VehicleTrackingStore, { provide: TRACKING_GATEWAY, useValue: { watch } }],
    });
    store = TestBed.inject(VehicleTrackingStore);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });
  const emit = (vehicles: PublicVehicle[], revision = 0, stream = 0) =>
    streams[stream].next({ kind: 'snapshot', vehicles, revision });
  it('does not invent zero available vehicles before a snapshot or when the gateway is unavailable', () => {
    expect(store.count()).toBeNull();
    store.connect('d1', true, true);
    expect(store.status()).toBe('loading');
    expect(store.count()).toBeNull();
    streams[0].next({ kind: 'unavailable' });
    expect(store.status()).toBe('unavailable');
    expect(store.count()).toBeNull();
  });
  it('narrows the server-eligible set to selected direction and rejects malformed, future and expired fixes', () => {
    store.connect('d1', true, true);
    emit([
      vehicle(),
      vehicle({ id: 'off-route', available: false }),
      vehicle({ id: 'other', directionId: 'd2' }),
      vehicle({ id: 'old', observedAtMs: Date.now() - 30001 }),
      vehicle({ id: 'future', observedAtMs: Date.now() + 1 }),
      vehicle({ id: 'invalid', position: [NaN, 10] }),
    ]);
    expect(store.vehicles().map((v) => v.id)).toEqual(['v1']);
    expect(store.count()).toBe(1);
  });
  it('removes stale markers and details without waiting for another message', () => {
    store.connect('d1', true, true);
    emit([vehicle()]);
    store.selectedId.set('v1');
    expect(store.selected()).not.toBeNull();
    vi.advanceTimersByTime(30000);
    expect(store.count()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(store.count()).toBe(0);
    expect(store.selected()).toBeNull();
  });
  it('replaces full snapshot membership and rejects older revisions and observation timestamps', () => {
    store.connect('d1', true, true);
    const first = vehicle();
    emit([first], 10);
    emit([vehicle({ position: [124, 11], observedAtMs: Date.now() - 1 })], 11);
    expect(store.vehicles()[0].position).toEqual(first.position);
    emit([], 9);
    expect(store.count()).toBe(1);
    emit([], 12);
    expect(store.count()).toBe(0);
  });
  it('de-duplicates vehicles, validates physical color and strips private fields', () => {
    store.connect('d1', true, true);
    const incoming = {
      ...vehicle({ vehicleColor: 'url(private)' }),
      driverName: 'must stay private',
      operatorId: 'private',
      rawDevice: {},
    };
    emit([incoming, incoming]);
    expect(store.count()).toBe(1);
    expect(store.vehicles()[0].vehicleColor).toBe('#475467');
    expect(Object.keys(store.vehicles()[0])).not.toContain('driverName');
    incoming.position[0] = 0;
    expect(store.vehicles()[0].position[0]).toBe(123.9);
  });
  it('disconnects hidden/offline contexts and requires a new snapshot after network recovery or resume', () => {
    store.connect('d1', true, true);
    emit([vehicle()]);
    store.connect('d1', true, false);
    expect(streams[0].observed).toBe(false);
    expect(store.status()).toBe('offline');
    expect(store.count()).toBeNull();
    store.connect('d1', true, true);
    expect(watch).toHaveBeenCalledTimes(2);
    expect(store.count()).toBeNull();
    emit([vehicle()], 0, 1);
    expect(store.count()).toBe(1);
    store.connect('d1', false, true);
    expect(streams[1].observed).toBe(false);
    expect(store.vehicles()).toEqual([]);
    store.connect('d1', true, true);
    expect(watch).toHaveBeenCalledTimes(3);
    expect(store.status()).toBe('loading');
  });
  it('clears prior direction selection and subscriptions before switching routes', () => {
    store.connect('d1', true, true);
    emit([vehicle()]);
    store.selectedId.set('v1');
    store.connect('d2', true, true);
    expect(streams[0].observed).toBe(false);
    expect(store.selected()).toBeNull();
    expect(store.count()).toBeNull();
    emit([vehicle()], 1, 0);
    expect(store.count()).toBeNull();
    emit([vehicle({ id: 'v2', directionId: 'd2' })], 0, 1);
    expect(store.count()).toBe(1);
  });
  it('offers explicit fresh reconciliation and fails closed on stream error', () => {
    store.connect('d1', true, true);
    emit([vehicle()]);
    store.reconcile();
    expect(streams[0].observed).toBe(false);
    expect(store.count()).toBeNull();
    streams[1].error(new Error('raw private provider diagnostics'));
    expect(store.status()).toBe('unavailable');
    expect(store.vehicles()).toEqual([]);
  });
  it('does not resubscribe for unchanged context and disposes timers/subscriptions', () => {
    store.connect('d1', true, true);
    store.connect('d1', true, true);
    expect(watch).toHaveBeenCalledTimes(1);
    TestBed.resetTestingModule();
    expect(streams[0].observed).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
