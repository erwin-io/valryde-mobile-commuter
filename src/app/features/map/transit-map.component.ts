import {
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  afterNextRender,
  effect,
  inject,
  input,
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
  'on' | 'remove' | 'resize' | 'easeTo' | 'addSource' | 'addLayer' | 'getSource'
>;

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

  readonly state = signal<MapState>('initializing');

  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly createMap = inject(MAP_FACTORY);
  private map?: MapLike;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.init();
      const observer = new ResizeObserver(() => this.map?.resize());
      observer.observe(this.container().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
    destroyRef.onDestroy(() => this.dispose());

    effect(() => {
      const position = this.userLocation();
      if (this.state() === 'ready') this.renderUserLocation(position);
    });
  }

  retry(): void {
    this.dispose();
    this.init();
  }

  /** Moves the camera only; no animation when the user prefers reduced motion. */
  focus(position: LngLat): void {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.map?.easeTo({ center: position, zoom: 15, duration: reduceMotion ? 0 : 600 });
  }

  private init(): void {
    this.state.set('initializing');
    const map = this.createMap({
      container: this.container().nativeElement,
      style: this.styleUrl(),
      center: this.center(),
      zoom: this.zoom(),
      attributionControl: { compact: true },
    });
    this.map = map;

    map.on('load', () => {
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

    // Tile/glyph errors after load are recoverable by MapLibre; only a failed initial style is fatal.
    map.on('error', () => {
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

  private dispose(): void {
    this.map?.remove();
    this.map = undefined;
  }
}

function emptyCollection(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}
