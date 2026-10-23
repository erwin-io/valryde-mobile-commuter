import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { failureCopy, toApiFailure } from '../../core/api-failure';
import { SessionService } from '../../core/auth/session.service';
import { ConnectivityService } from '../../core/connectivity.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { LocationService } from '../map/location.service';
import {
  DirectRoute,
  Place,
  PlaceDiscoveryService,
  Point,
  withinPhilippines,
} from './place-discovery.service';

type Status = 'idle' | 'loading' | 'ready' | 'error';
type Endpoint = 'origin' | 'destination';
type SelectedPlace = Point & { name: string };

@Component({
  selector: 'app-trip-planner',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonButton,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    StatePanelComponent,
  ],
  template: `
    <section aria-label="Find a direct jeepney route">
      <h2>Where are you going?</h2>
      <p>
        Choose two places to find a direct ride. Routes pass within 500 m of each place; walking
        paths and transfers aren’t included.
      </p>
      @if (!online()) {
        <app-state-panel
          title="Trip search needs a connection"
          body="Reconnect, then search again. You can still browse saved routes."
        />
      } @else if (session.status() !== 'signed-in') {
        <app-state-panel
          title="Sign in to search places"
          body="You can browse routes without signing in."
        />
        <ion-button routerLink="/tabs/account/sign-in">Sign in</ion-button>
      } @else {
        <ion-list>
          <ion-item
            ><ion-label
              ><p>From</p>
              <h3>{{ origin()?.name || 'Choose your starting point' }}</h3></ion-label
            >
            <ion-button slot="end" fill="clear" (click)="edit('origin')">Change start</ion-button>
          </ion-item>
          <ion-item
            ><ion-label
              ><p>To</p>
              <h3>{{ destination()?.name || 'Choose a destination' }}</h3></ion-label
            >
            <ion-button slot="end" fill="clear" (click)="edit('destination')"
              >Change destination</ion-button
            >
          </ion-item>
        </ion-list>
        <p class="privacy">
          Using your location shares it with VALRYDE for this search. It isn’t saved on this device.
        </p>
        <ion-button fill="outline" [disabled]="locating()" (click)="locate()">{{
          locating() ? 'Finding your location…' : 'Use my current location'
        }}</ion-button>
        @if (locationMessage()) {
          <p role="status">{{ locationMessage() }}</p>
        }
        <form [formGroup]="form" (ngSubmit)="search()">
          <ion-input
            [label]="target() === 'origin' ? 'Search starting point' : 'Search destination'"
            labelPlacement="stacked"
            [formControl]="query"
            [maxlength]="120"
            placeholder="Place name in the Philippines"
          />
          <ion-button type="submit" [disabled]="!validQuery() || searchStatus() === 'loading'"
            >Search places</ion-button
          >
        </form>
        @if (searchStatus() === 'loading') {
          <p role="status" aria-busy="true">Searching places…</p>
        }
        @if (searchStatus() === 'error') {
          <app-state-panel
            [title]="searchError()"
            body="Try again, or use Find a route to search route codes and names."
            actionLabel="Try again"
            (action)="search()"
          />
        }
        @if (searchStatus() === 'ready') {
          @if (places().length === 0) {
            <p role="status">No places found. Try a nearby landmark or a more specific name.</p>
          }
          <ion-list aria-label="Place results">
            @for (place of places(); track place.id) {
              <ion-item button (click)="choose(place)"
                ><ion-label class="ion-text-wrap"
                  ><h3>{{ place.name }}</h3>
                  <p>{{ place.label }}</p></ion-label
                ></ion-item
              >
            }
          </ion-list>
        }
        @if (attribution()) {
          <p class="attribution">{{ attribution() }}</p>
        }
        <ion-button
          expand="block"
          [disabled]="!origin() || !destination() || routeStatus() === 'loading' || locating()"
          (click)="discover()"
          >Find direct routes</ion-button
        >
        @if (routeStatus() === 'loading') {
          <p role="status" aria-busy="true">Finding direct routes…</p>
        }
        @if (routeStatus() === 'error') {
          <app-state-panel [title]="routeError()" actionLabel="Try again" (action)="discover()" />
        }
        @if (routeStatus() === 'ready') {
          @if (candidates().length === 0) {
            <app-state-panel
              title="No direct route found"
              body="Try another starting point or destination, or browse routes. Transfers aren’t planned."
            />
          } @else {
            <ion-list aria-label="Direct route results">
              @for (candidate of candidates(); track candidate.direction.id) {
                <ion-item button (click)="open(candidate)"
                  ><ion-label class="ion-text-wrap">
                    <h3>{{ candidate.route.routeCode }} · {{ candidate.route.publicName }}</h3>
                    <p>
                      {{ candidate.direction.directionLabel }}:
                      {{ candidate.direction.originName }} →
                      {{ candidate.direction.destinationName }}
                    </p>
                    <p>
                      Route proximity: {{ candidate.originDistanceM }} m from start ·
                      {{ candidate.destinationDistanceM }} m from destination
                    </p>
                  </ion-label></ion-item
                >
              }
            </ion-list>
          }
        }
      }
    </section>
  `,
  styles: `
    section {
      padding: 16px;
    }
    h2 {
      font-size: 22px;
      margin: 4px 0 12px;
    }
    p {
      line-height: 1.5;
      color: var(--valryde-muted);
    }
    .privacy,
    .attribution {
      font-size: 13px;
    }
    ion-input {
      margin-top: 16px;
    }
    ion-list {
      padding: 0;
    }
  `,
})
export class TripPlannerComponent {
  protected readonly session = inject(SessionService);
  readonly online = inject(ConnectivityService).online;
  private readonly service = inject(PlaceDiscoveryService);
  private readonly location = inject(LocationService);
  private readonly router = inject(Router);
  readonly query = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(120)],
  });
  readonly form = new FormGroup({ query: this.query });
  readonly target = signal<Endpoint>('destination');
  readonly origin = signal<SelectedPlace | null>(null);
  readonly destination = signal<SelectedPlace | null>(null);
  readonly places = signal<Place[]>([]);
  readonly attribution = signal('');
  readonly candidates = signal<DirectRoute[]>([]);
  readonly searchStatus = signal<Status>('idle');
  readonly routeStatus = signal<Status>('idle');
  readonly searchError = signal('');
  readonly routeError = signal('');
  readonly locationMessage = signal('');
  readonly locating = signal(false);
  private searchRequest?: Subscription;
  private routeRequest?: Subscription;
  private locationGeneration = 0;

  constructor() {
    const destroy = inject(DestroyRef);
    this.query.valueChanges.pipe(takeUntilDestroyed(destroy)).subscribe(() => this.clearSearch());
    effect(() => {
      const signedIn = this.session.status() === 'signed-in';
      const online = this.online();
      if (!signedIn || !online) this.clear();
    });
    destroy.onDestroy(() => this.clear());
  }

  validQuery(): boolean {
    return this.query.valid && this.query.value.trim().length >= 2;
  }

  edit(target: Endpoint): void {
    if (target === 'origin') {
      // A manual start edit supersedes any foreground fix still being requested.
      this.locationGeneration++;
      this.locating.set(false);
      this.locationMessage.set('');
    }
    this.target.set(target);
    this.query.setValue('');
    this.clearRoutes();
  }

  search(): void {
    this.clearSearch();
    if (!this.online() || this.session.status() !== 'signed-in' || !this.validQuery()) return;
    this.searchStatus.set('loading');
    this.searchRequest = this.service.search(this.query.value).subscribe({
      next: (result) => {
        this.places.set(result.places.filter(withinPhilippines));
        this.attribution.set(result.attribution);
        this.searchStatus.set('ready');
      },
      error: (error: unknown) => {
        this.searchError.set(
          error instanceof HttpErrorResponse && error.status === 503
            ? 'Place search is temporarily unavailable'
            : this.errorText(error),
        );
        this.searchStatus.set('error');
      },
    });
  }

  choose(place: Place): void {
    if (!withinPhilippines(place)) return;
    if (this.target() === 'origin') {
      this.locationGeneration++;
      this.locating.set(false);
      this.origin.set({ name: place.name, lat: place.lat, lng: place.lng });
      this.locationMessage.set('');
    } else this.destination.set({ name: place.name, lat: place.lat, lng: place.lng });
    this.clearSearch();
    this.clearRoutes();
  }

  async locate(): Promise<void> {
    if (!this.online() || this.session.status() !== 'signed-in') return;
    const generation = ++this.locationGeneration;
    this.locating.set(true);
    this.clearRoutes();
    this.locationMessage.set('');
    const result = await this.location.locate();
    if (generation !== this.locationGeneration) return;
    this.locating.set(false);
    if (result.kind === 'located') {
      const point = { lng: result.position[0], lat: result.position[1] };
      if (withinPhilippines(point)) this.origin.set({ ...point, name: 'Your current location' });
      else
        this.locationMessage.set(
          this.origin()
            ? 'Your location is outside the Philippines. Keep your selected start or choose another.'
            : 'Choose a starting point in the Philippines.',
        );
    } else
      this.locationMessage.set(
        result.kind === 'denied'
          ? this.origin()
            ? 'Location permission is off. Keep your selected start or choose another.'
            : 'Location permission is off. Search for a starting point instead.'
          : this.origin()
            ? 'Couldn’t find your location. Keep your selected start or choose another.'
            : 'Couldn’t find your location. Try again or search for a starting point.',
      );
  }

  discover(): void {
    this.clearRoutes();
    const origin = this.origin();
    const destination = this.destination();
    if (
      !this.online() ||
      this.session.status() !== 'signed-in' ||
      !origin ||
      !destination ||
      this.locating()
    )
      return;
    this.routeStatus.set('loading');
    this.routeRequest = this.service.discover(origin, destination).subscribe({
      next: (result) => {
        this.candidates.set(result.directRouteFound ? result.candidates : []);
        this.routeStatus.set('ready');
      },
      error: (error: unknown) => {
        this.routeError.set(this.errorText(error));
        this.routeStatus.set('error');
      },
    });
  }

  open(candidate: DirectRoute): void {
    void this.router.navigate(['/tabs/map'], {
      queryParams: { route: candidate.route.id, direction: candidate.direction.id },
    });
  }

  private errorText(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 401)
      return 'Sign in again to search places';
    const copy = failureCopy(toApiFailure(error));
    return `${copy.title}. ${copy.body}`;
  }
  private clearSearch(): void {
    this.searchRequest?.unsubscribe();
    this.places.set([]);
    this.searchStatus.set('idle');
  }
  private clearRoutes(): void {
    this.routeRequest?.unsubscribe();
    this.candidates.set([]);
    this.routeStatus.set('idle');
  }
  private clear(): void {
    this.clearSearch();
    this.clearRoutes();
    this.locationGeneration++;
    this.attribution.set('');
    this.locating.set(false);
    this.origin.set(null);
    this.destination.set(null);
    this.query.setValue('');
    this.locationMessage.set('');
  }
}
