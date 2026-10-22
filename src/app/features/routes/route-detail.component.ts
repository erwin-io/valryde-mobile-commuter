import { Component, computed, inject, input, output, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonNote } from '@ionic/angular/ion-note';
import { IonSegment } from '@ionic/angular/ion-segment';
import { IonSegmentButton } from '@ionic/angular/ion-segment-button';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { addIcons } from 'ionicons';
import { closeOutline, flagOutline, radioButtonOnOutline, star, starOutline } from 'ionicons/icons';
import { ApiFailure, failureCopy } from '../../core/api-failure';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { FavoritesService, MAX_FAVORITES } from '../favorites/favorites.service';
import { RouteBadgeComponent } from './route-badge.component';
import { savedAtLabel } from './route-cache.service';
import { RouteDirection, TransitRoute } from './transit-routes.service';

export type RouteDetailState =
  | { status: 'loading' }
  | { status: 'error'; failure: ApiFailure }
  /** `savedAt` is set when the route comes from the offline cache instead of the API. */
  | { status: 'ready'; route: TransitRoute; savedAt?: number };

/** Bottom-sheet content for one route: identity, explicit direction choice and endpoints. No HTTP. */
@Component({
  selector: 'app-route-detail',
  // Ionic sizes modal content through the ion-page layout (header + scrollable content).
  host: { class: 'ion-page' },
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonList,
    IonItem,
    IonNote,
    IonSkeletonText,
    RouteBadgeComponent,
    StatePanelComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        @if (route(); as r) {
          <app-route-badge slot="start" class="badge" [code]="r.routeCode" [color]="r.routeColorHex" />
          <ion-title>{{ r.publicName }}</ion-title>
        } @else {
          <ion-title>Route details</ion-title>
        }
        <ion-buttons slot="end">
          <!-- ion-button copies aria-* into its shadow button only once, so each state gets its own button. -->
          @if (route()) {
            @if (isFavorite()) {
              <ion-button aria-label="Remove from favorites" aria-pressed="true" (click)="toggleFavorite()">
                <ion-icon slot="icon-only" name="star" aria-hidden="true" />
              </ion-button>
            } @else {
              <ion-button aria-label="Save to favorites" aria-pressed="false" (click)="toggleFavorite()">
                <ion-icon slot="icon-only" name="star-outline" aria-hidden="true" />
              </ion-button>
            }
          }
          <ion-button aria-label="Close route details" (click)="closed.emit()">
            <ion-icon slot="icon-only" name="close-outline" aria-hidden="true" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      @switch (state().status) {
        @case ('loading') {
          <div class="loading" aria-busy="true" role="status" aria-label="Loading route">
            <ion-skeleton-text [animated]="true" class="skeleton-wide" />
            <ion-skeleton-text [animated]="true" class="skeleton-narrow" />
          </div>
        }
        @case ('error') {
          <app-state-panel
            icon="cloud-offline-outline"
            [title]="errorText().title"
            [body]="errorText().body"
            [actionLabel]="errorRetryable() ? 'Try again' : undefined"
            (action)="retry.emit()"
          />
        }
        @case ('ready') {
          @if (route(); as r) {
            @if (savedAt(); as at) {
              <ion-note class="note offline" role="status">
                You’re offline. Showing a copy saved {{ savedLabel(at) }}; it may be out of date.
              </ion-note>
            }
            @if (favoriteNotice(); as notice) {
              <ion-note class="note" role="status">{{ notice }}</ion-note>
            }
            @if (r.description) {
              <p class="description">{{ r.description }}</p>
            }
            @if (r.directions.length === 0) {
              <app-state-panel
                icon="bus-outline"
                title="No active direction"
                body="This route has no direction in service right now."
              />
            } @else {
              @if (r.directions.length > 1) {
                <ion-segment
                  class="directions"
                  aria-label="Route direction"
                  [value]="direction()?.id"
                  (ionChange)="directionChange.emit($any($event.detail.value))"
                >
                  @for (d of r.directions; track d.id) {
                    <ion-segment-button [value]="d.id">
                      <ion-label>{{ d.directionLabel }}</ion-label>
                    </ion-segment-button>
                  }
                </ion-segment>
              }
              @if (direction(); as d) {
                <ion-list lines="none" aria-label="Direction endpoints">
                  <ion-item>
                    <ion-icon slot="start" name="radio-button-on-outline" aria-hidden="true" />
                    <ion-label>
                      <p>From</p>
                      <h3>{{ d.originName }}</h3>
                    </ion-label>
                  </ion-item>
                  <ion-item>
                    <ion-icon slot="start" name="flag-outline" aria-hidden="true" />
                    <ion-label>
                      <p>To</p>
                      <h3>{{ d.destinationName }}</h3>
                    </ion-label>
                  </ion-item>
                </ion-list>
                @if (!lineDrawable()) {
                  <ion-note class="note" role="status">
                    The official line for this direction can’t be shown on the map.
                  </ion-note>
                }
              }
            }
            <ion-note class="note">
              Live jeepneys on this route will appear here once live tracking is released.
            </ion-note>
          }
        }
      }
    </ion-content>
  `,
  styles: `
    .badge {
      margin-inline-start: 16px;
    }
    .description {
      margin: 12px 16px 0;
      color: var(--valryde-muted);
    }
    .directions {
      margin: 12px 16px 4px;
      width: auto;
    }
    h3 {
      font-weight: 600;
      white-space: normal;
    }
    .offline {
      color: var(--valryde-warning);
    }
    .note {
      display: block;
      margin: 8px 16px 16px;
      font-size: 14px;
    }
    .loading {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
    }
    .skeleton-wide {
      width: 80%;
      height: 18px;
    }
    .skeleton-narrow {
      width: 50%;
      height: 18px;
    }
  `,
})
export class RouteDetailComponent {
  readonly state = input.required<RouteDetailState>();
  readonly direction = input<RouteDirection | null>(null);
  readonly lineDrawable = input(true);
  readonly directionChange = output<string>();
  readonly retry = output<void>();
  readonly closed = output<void>();

  protected readonly route = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.route : null;
  });
  protected readonly savedLabel = savedAtLabel;
  protected readonly savedAt = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? (s.savedAt ?? null) : null;
  });
  private readonly favorites = inject(FavoritesService);
  protected readonly favoriteNotice = signal<string | null>(null);
  protected readonly isFavorite = computed(() => {
    const route = this.route();
    return !!route && this.favorites.favorites().some((f) => f.routeId === route.id);
  });
  protected readonly errorText = computed(() => {
    const s = this.state();
    return failureCopy(s.status === 'error' ? s.failure : { kind: 'unavailable' });
  });
  protected readonly errorRetryable = computed(() => {
    const s = this.state();
    return s.status === 'error' && s.failure.kind !== 'not-found';
  });

  constructor() {
    addIcons({ closeOutline, flagOutline, radioButtonOnOutline, star, starOutline });
    void this.favorites.load();
  }

  /** Saves the route with the direction currently shown, or removes it. Device-local only. */
  async toggleFavorite(): Promise<void> {
    const route = this.route();
    if (!route) return;
    try {
      if (this.isFavorite()) {
        await this.favorites.remove(route.id);
        this.favoriteNotice.set('Removed from favorites.');
        return;
      }
      const result = await this.favorites.save(route.id, this.direction()?.id ?? null);
      this.favoriteNotice.set(
        result === 'full'
          ? `You can save up to ${MAX_FAVORITES} favorite routes. Remove one to add this route.`
          : 'Saved to favorites on this device.',
      );
    } catch {
      this.favoriteNotice.set('Couldn’t update favorites on this device. Please try again.');
    }
  }
}
