import { TestBed } from '@angular/core/testing';
import { MAP_FACTORY, RouteLine, TransitMapComponent } from './transit-map.component';

class FakeMap {
  handlers: Record<string, () => void> = {};
  removed = false;
  /** Last GeoJSON written to each source id. */
  data: Record<string, { features: unknown[] }> = {};
  easeTo = vi.fn();
  fitBounds = vi.fn();
  setPaintProperty = vi.fn();
  addSource = vi.fn();
  addLayer = vi.fn();
  resize = vi.fn();
  on(event: string, handler: () => void) {
    this.handlers[event] = handler;
    return this;
  }
  remove() {
    this.removed = true;
  }
  getSource(id: string) {
    return { setData: (d: { features: unknown[] }) => (this.data[id] = d) };
  }
  emit(event: string) {
    this.handlers[event]?.();
  }
}

describe('TransitMapComponent', () => {
  beforeAll(() => {
    // jsdom has no ResizeObserver.
    globalThis.ResizeObserver ??= class {
      observe() {}
      disconnect() {}
      unobserve() {}
    };
  });

  let maps: FakeMap[];

  async function render() {
    maps = [];
    TestBed.configureTestingModule({
      providers: [
        {
          provide: MAP_FACTORY,
          useValue: () => {
            const map = new FakeMap();
            maps.push(map);
            return map;
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(TransitMapComponent);
    fixture.componentRef.setInput('styleUrl', 'https://example.test/style.json');
    fixture.componentRef.setInput('center', [121, 14.6]);
    fixture.componentRef.setInput('zoom', 11);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    return fixture;
  }

  it('shows loading until the style loads, then adds route and user-location layers', async () => {
    const fixture = await render();
    expect(fixture.componentInstance.state()).toBe('initializing');
    expect(fixture.nativeElement.textContent).toContain('Loading map');

    maps[0].emit('load');
    await fixture.whenStable();

    expect(fixture.componentInstance.state()).toBe('ready');
    const layerIds = maps[0].addLayer.mock.calls.map(([layer]) => layer.id);
    // The user-location dot is added last so it draws above the route line.
    expect(layerIds).toEqual(['valryde-route-casing', 'valryde-route-line', 'valryde-user-location']);
    expect(fixture.nativeElement.textContent).not.toContain('Loading map');
  });

  it('explains an initial style failure and recreates the map on retry', async () => {
    const fixture = await render();
    maps[0].emit('error');
    await fixture.whenStable();

    expect(fixture.componentInstance.state()).toBe('style-error');
    expect(maps[0].removed).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('The map couldn’t load');

    fixture.componentInstance.retry();
    expect(maps).toHaveLength(2);
    expect(fixture.componentInstance.state()).toBe('initializing');
  });

  it('ignores recoverable errors after the map is ready', async () => {
    const fixture = await render();
    maps[0].emit('load');
    maps[0].emit('error');
    expect(fixture.componentInstance.state()).toBe('ready');
    expect(maps[0].removed).toBe(false);
  });

  it('renders the user location as a GeoJSON point once ready', async () => {
    const fixture = await render();
    maps[0].emit('load');
    fixture.componentRef.setInput('userLocation', [121.05, 14.55]);
    await fixture.whenStable();

    expect(maps[0].data['valryde-user-location'].features).toEqual([
      expect.objectContaining({ geometry: { type: 'Point', coordinates: [121.05, 14.55] } }),
    ]);
  });

  const line: RouteLine = {
    id: 'dir-1',
    coordinates: [
      [123.86, 10.26],
      [123.9, 10.3],
      [123.88, 10.31],
    ],
    color: '#43A047',
  };

  it('draws the official line in the route color and fits it once, above the sheet inset', async () => {
    const fixture = await render();
    fixture.componentRef.setInput('bottomInset', 400);
    fixture.componentRef.setInput('routeLine', line);
    maps[0].emit('load');
    await fixture.whenStable();

    expect(maps[0].data['valryde-route'].features).toEqual([
      expect.objectContaining({ geometry: { type: 'LineString', coordinates: line.coordinates } }),
    ]);
    expect(maps[0].setPaintProperty).toHaveBeenCalledWith('valryde-route-line', 'line-color', '#43A047');
    expect(maps[0].fitBounds).toHaveBeenCalledOnce();
    const [bounds, options] = maps[0].fitBounds.mock.calls[0];
    expect(bounds).toEqual([
      [123.86, 10.26],
      [123.9, 10.31],
    ]);
    expect(options.padding.bottom).toBe(432);

    // Same direction again (e.g. a re-emitted input) must not move the camera the user may have panned.
    fixture.componentRef.setInput('routeLine', { ...line });
    await fixture.whenStable();
    expect(maps[0].fitBounds).toHaveBeenCalledOnce();
  });

  it('clears the line when the selection is removed', async () => {
    const fixture = await render();
    fixture.componentRef.setInput('routeLine', line);
    maps[0].emit('load');
    await fixture.whenStable();
    fixture.componentRef.setInput('routeLine', null);
    await fixture.whenStable();
    expect(maps[0].data['valryde-route'].features).toEqual([]);
  });

  it('removes the MapLibre instance on destroy', async () => {
    const fixture = await render();
    fixture.destroy();
    expect(maps[0].removed).toBe(true);
  });
});
