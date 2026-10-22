import { MapLike } from '../map/transit-map.component';
import { PublicVehicle } from './tracking-gateway';
import { AnimationScheduler, VehicleMarkerRenderer } from './vehicle-marker-renderer';
const vehicle = (overrides: Partial<PublicVehicle> = {}): PublicVehicle => ({
  id: 'v1',
  directionId: 'd1',
  position: [123, 10],
  plateNumber: 'TEST-001',
  routeLabel: '04C',
  directionLabel: 'Outbound',
  vehicleColor: '#123456',
  statusLabel: 'Available',
  observedAtMs: 1,
  available: true,
  ...overrides,
});

describe('VehicleMarkerRenderer', () => {
  let renderer: VehicleMarkerRenderer;
  let time: number;
  let callbacks: FrameRequestCallback[];
  let buttons: HTMLElement[];
  let markers: { setLngLat: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> }[];
  const selected = vi.fn();
  let frames: AnimationScheduler;
  beforeEach(() => {
    time = 0;
    callbacks = [];
    buttons = [];
    markers = [];
    selected.mockReset();
    frames = {
      now: () => time,
      request: (cb) => {
        callbacks.push(cb);
        return callbacks.length;
      },
      cancel: vi.fn(),
    };
    renderer = new VehicleMarkerRenderer(
      {} as MapLike,
      (_map, button) => {
        buttons.push(button);
        const marker = { setLngLat: vi.fn(), remove: vi.fn() };
        markers.push(marker);
        return marker;
      },
      selected,
      frames,
    );
  });
  it('renders route labels as safe text, plate/direction accessible names and physical vehicle color', () => {
    renderer.render([vehicle({ routeLabel: '<img src=x onerror=alert(1)>' })], true);
    expect(buttons[0].textContent).toContain('<img');
    expect(buttons[0].querySelector('img')).toBeNull();
    expect(buttons[0].getAttribute('aria-label')).toContain('TEST-001');
    expect(buttons[0].getAttribute('aria-label')).toContain('Outbound');
    expect(buttons[0].style.borderBottomColor).toBe('rgb(18, 52, 86)');
    buttons[0].click();
    expect(selected).toHaveBeenCalledWith('v1');
  });
  it('interpolates only between received fixes and stops exactly at the endpoint', () => {
    renderer.render([vehicle()], true);
    renderer.render([vehicle({ position: [125, 12], observedAtMs: 2 })], true);
    time = 250;
    callbacks[0](250);
    expect(markers[0].setLngLat).toHaveBeenLastCalledWith([124, 11]);
    time = 500;
    callbacks[1](500);
    expect(markers[0].setLngLat).toHaveBeenLastCalledWith([125, 12]);
    expect(callbacks.length).toBe(2);
    time = 10000;
    expect(markers[0].setLngLat).toHaveBeenLastCalledWith([125, 12]);
  });
  it('jumps without animation for reduced motion and initial observations', () => {
    renderer.render([vehicle()], false);
    renderer.render([vehicle({ position: [125, 12], observedAtMs: 2 })], false);
    expect(callbacks).toEqual([]);
    expect(markers[0].setLngLat).toHaveBeenLastCalledWith([125, 12]);
  });
  it('cancels superseded animation and rejects a late callback from the previous fix', () => {
    renderer.render([vehicle()], true);
    renderer.render([vehicle({ position: [125, 12], observedAtMs: 2 })], true);
    const late = callbacks[0];
    renderer.render([vehicle({ position: [126, 13], observedAtMs: 3 })], true);
    const calls = markers[0].setLngLat.mock.calls.length;
    time = 500;
    late(500);
    expect(markers[0].setLngLat.mock.calls.length).toBe(calls);
    expect(frames.cancel).toHaveBeenCalled();
  });
  it('removes missing vehicles and cancels callbacks on hidden tab/map disposal', () => {
    renderer.render([vehicle()], true);
    renderer.render([vehicle({ position: [125, 12], observedAtMs: 2 })], true);
    renderer.clear();
    expect(markers[0].remove).toHaveBeenCalledOnce();
    expect(frames.cancel).toHaveBeenCalled();
    const calls = markers[0].setLngLat.mock.calls.length;
    callbacks[0](250);
    expect(markers[0].setLngLat.mock.calls.length).toBe(calls);
    renderer.render([vehicle()], false);
    renderer.render([], false);
    expect(markers[1].remove).toHaveBeenCalledOnce();
  });
});
