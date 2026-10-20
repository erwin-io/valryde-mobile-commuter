import { TestBed } from '@angular/core/testing';
import { MAP_FACTORY, TransitMapComponent } from './transit-map.component';

class FakeMap {
  handlers: Record<string, () => void> = {};
  removed = false;
  setData = vi.fn();
  easeTo = vi.fn();
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
  getSource() {
    return { setData: this.setData };
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

  it('shows loading until the style loads, then adds the user-location layer', async () => {
    const fixture = await render();
    expect(fixture.componentInstance.state()).toBe('initializing');
    expect(fixture.nativeElement.textContent).toContain('Loading map');

    maps[0].emit('load');
    await fixture.whenStable();

    expect(fixture.componentInstance.state()).toBe('ready');
    expect(maps[0].addLayer).toHaveBeenCalledOnce();
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

    expect(maps[0].setData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        features: [expect.objectContaining({ geometry: { type: 'Point', coordinates: [121.05, 14.55] } })],
      }),
    );
  });

  it('removes the MapLibre instance on destroy', async () => {
    const fixture = await render();
    fixture.destroy();
    expect(maps[0].removed).toBe(true);
  });
});
