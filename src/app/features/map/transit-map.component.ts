import {
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import type { FeatureCollection } from 'geojson';
import { GeoJSONSource, Map as MapLibreMap, MapOptions, setWorkerUrl } from 'maplibre-gl';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { LngLat } from './location.service';

export type MapState = 'initializing' | 'ready' | 'style-error';

export type MapLike = Pick<
  MapLibreMap,
  | 'on'
  | 'remove'
  | 'resize'
  | 'stop'
  | 'easeTo'
  | 'fitBounds'
  | 'addSource'
  | 'addLayer'
  | 'getSource'
  | 'setPaintProperty'
>;

/** A validated official route-direction line to draw (Admin-owned geometry and color). */
export interface RouteLine {
  id: string;
  coordinates: LngLat[];
  color: string;
}

export const MAP_FACTORY = new InjectionToken<(options: MapOptions) => MapLike>('MAP_FACTORY', {
  providedIn: 'root',
  factory: () => {
    // MapLibre resolves its worker relative to its own module URL, which bundling breaks;
    // angular.json copies the worker next to the app instead.
    setWorkerUrl(new URL('maplibre/maplibre-gl-worker.mjs', document.baseURI).href);
    return (options) => new MapLibreMap(options);
  },
});

const USER_LOCATION_SOURCE = 'valryde-user-location';
const ROUTE_SOURCE = 'valryde-route';
const ROUTE_CASING_LAYER = 'valryde-route-casing';
const ROUTE_LINE_LAYER = 'valryde-route-line';

/** Owns the MapLibre instance, its lifecycle, and declarative layer updates. No HTTP or business rules. */
@Component({
  selector: 'app-transit-map',
  imports: [IonSpinner, StatePanelComponent],
  template: `
    <div #container class="map-canvas" role="region" aria-label="Transit map"></div>
    @switch (state()) {
      @case ('initializing') {
        <div class="map-overlay" role="status">
          <ion-spinner aria-hidden="true" />
          <span>Loading map…</span>
        </div>
      }
      @case ('style-error') {
        <div class="map-overlay">
          <app-state-panel
            icon="cloud-offline-outline"
            title="The map couldn’t load"
            body="Check your connection and try again. The other tabs still work."
            actionLabel="Retry"
            (action)="retry()"
          />
        </div>
      }
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
    }
    .map-canvas {
      position: absolute;
      inset: 0;
    }
    .map-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      background: var(--valryde-background);
      color: var(--valryde-muted);
    }
  `,
})
export class TransitMapComponent {
  readonly styleUrl = input.required<string>();
  readonly center = input.required<LngLat>();
  readonly zoom = input.required<number>();
  readonly userLocation = input<LngLat | null>(null);
  readonly routeLine = input<RouteLine | null>(null);
  /** Pixels hidden by overlays at the bottom (e.g. a sheet), used when fitting a route. */
  readonly bottomInset = input(0);
  /** Whether the Ionic Map tab is visible. Hidden tabs stop camera work until re-entry. */
  readonly active = input(true);
  /** Optional 3D-style camera only; route geometry remains the same authoritative 2D line. */
  readonly perspective = input(false);
  /** Emits when the user pans the map by gesture (used to leave follow mode). */
  readonly userPanned = output<void>();

  readonly state = signal<MapState>('initializing');

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly createMap = inject(MAP_FACTORY);
  private map?: MapLike;
  private fittedRouteId?: string;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.init();
      const observer = new ResizeObserver(() => {
        if (!this.active()) return;
        this.map?.resize();
        // A route chosen while this tab was hidden is fitted once the map becomes visible.
        if (this.state() === 'ready') this.fitRouteIfNeeded();
      });
      observer.observe(this.container().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
    destroyRef.onDestroy(() => this.dispose());

    effect(() => {
      const position = this.userLocation();
      if (this.state() === 'ready') this.renderUserLocation(position);
    });

    effect(() => {
      const line = this.routeLine();
      if (this.state() === 'ready') this.renderRoute(line);
    });

    effect(() => {
      const active = this.active();
      if (this.state() !== 'ready' || !this.map) return;
      if (!active) {
        this.map.stop();
        return;
      }
      this.map.resize();
      this.fitRouteIfNeeded();
    });

    effect(() => {
      const perspective = this.perspective();
      const active = this.active();
      if (!active || this.state() !== 'ready' || !this.map) return;
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      this.map.easeTo({ pitch: perspective ? 45 : 0, bearing: 0, duration: reduceMotion ? 0 : 400 });
    });
  }

  retry(): void {
    this.dispose();
    this.init();
  }

  /** Moves the camera only; no animation when the user prefers reduced motion. */
  focus(position: LngLat, keepZoom = false): void {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.map?.easeTo({ center: position, ...(keepZoom ? {} : { zoom: 15 }), duration: reduceMotion ? 0 : 600 });
  }

  private init(): void {
    this.state.set('initializing');
    this.fittedRouteId = undefined;
    const map = this.createMap({
      container: this.container().nativeElement,
      style: this.styleUrl(),
      center: this.center(),
      zoom: this.zoom(),
      attributionControl: { compact: true },
    });
    this.map = map;

    map.on('load', () => {
      if (this.map !== map) return;
      // Route layers first so the user-location dot stays on top. Casing keeps the line legible on any route color.
      map.addSource(ROUTE_SOURCE, { type: 'geojson', data: emptyCollection() });
      map.addLayer({
        id: ROUTE_CASING_LAYER,
        type: 'line',
        source: ROUTE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#FFFFFF', 'line-width': 9 },
      });
      map.addLayer({
        id: ROUTE_LINE_LAYER,
        type: 'line',
        source: ROUTE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0B6E4F', 'line-width': 5 },
      });
      map.addSource(USER_LOCATION_SOURCE, { type: 'geojson', data: emptyCollection() });
      map.addLayer({
        id: USER_LOCATION_SOURCE,
        type: 'circle',
        source: USER_LOCATION_SOURCE,
        paint: {
          'circle-radius': 7,
          'circle-color': '#175CD3',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#FFFFFF',
        },
      });
      this.state.set('ready');
    });

    // Only gesture pans carry an originalEvent; programmatic easeTo/fitBounds do not.
    map.on('dragstart', (event: { originalEvent?: unknown }) => {
      if (this.map !== map) return;
      if (event.originalEvent) this.userPanned.emit();
    });

    // Tile/glyph errors after load are recoverable by MapLibre; only a failed initial style is fatal.
    map.on('error', () => {
      if (this.map !== map) return;
      if (this.state() === 'initializing') {
        this.state.set('style-error');
        this.dispose();
      }
    });
  }

  private renderUserLocation(position: LngLat | null): void {
    this.map?.getSource<GeoJSONSource>(USER_LOCATION_SOURCE)?.setData(
      position
        ? {
            type: 'FeatureCollection',
            features: [
              { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: position } },
            ],
          }
        : emptyCollection(),
    );
  }

  private renderRoute(line: RouteLine | null): void {
    const map = this.map;
    if (!map) return;
    map.getSource<GeoJSONSource>(ROUTE_SOURCE)?.setData(
      line
        ? {
            type: 'FeatureCollection',
            features: [
              { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: line.coordinates } },
            ],
          }
        : emptyCollection(),
    );
    if (!line) {
      this.fittedRouteId = undefined;
      return;
    }
    map.setPaintProperty(ROUTE_LINE_LAYER, 'line-color', line.color);
    this.fitRouteIfNeeded();
  }

  /** Fits once per direction so the user's own panning is not undone by unrelated updates. */
  private fitRouteIfNeeded(): void {
    const line = this.routeLine();
    if (!this.active() || !this.map || !line || this.fittedRouteId === line.id) return;
    const padding = { top: 88, left: 32, right: 32, bottom: this.bottomInset() + 32 };
    const { clientWidth, clientHeight } = this.container().nativeElement;
    // A hidden or mid-transition tab has no usable size; MapLibre would silently skip the fit.
    if (clientHeight <= padding.top + padding.bottom || clientWidth <= padding.left + padding.right) return;
    this.fittedRouteId = line.id;
    // The route can arrive before the ResizeObserver runs for a tab that just became visible; MapLibre
    // still has the hidden (0×0) canvas size then, and fitBounds would silently do nothing.
    this.map.resize();
    // Jump, don't animate: MapLibre's resize() (fired by Ionic tab transitions) stops camera animations,
    // and hidden or backgrounded WebViews pause animation frames, both of which left the fit abandoned.
    this.map.fitBounds(lineBounds(line.coordinates), { padding, maxZoom: 16, duration: 0 });
  }

  private dispose(): void {
    this.map?.remove();
    this.map = undefined;
  }
}

function lineBounds(coordinates: LngLat[]): [LngLat, LngLat] {
  const lngs = coordinates.map((c) => c[0]);
  const lats = coordinates.map((c) => c[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

function emptyCollection(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}
