import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonNote } from '@ionic/angular/ion-note';
import { IonSkeletonText } from '@ionic/angular/ion-skeleton-text';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { addIcons } from 'ionicons';
import { trashOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { RouteBadgeComponent } from '../routes/route-badge.component';
import { TransitRoute, TransitRoutesService } from '../routes/transit-routes.service';
import { FavoriteRoute, FavoritesService } from './favorites.service';

type Resolved =
  | { status: 'loading' }
  | { status: 'ready'; route: TransitRoute }
  /** 404/400: deleted, deactivated (no longer public) or malformed id. */
  | { status: 'missing' }
  | { status: 'error' };

@Component({
  selector: 'app-favorites-page',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
    IonNote,
    IonSkeletonText,
    RouteBadgeComponent,
    StatePanelComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Favorites</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      @if (!favorites.loaded()) {
        <div class="loading" role="status" aria-label="Loading favorites">
          <ion-skeleton-text [animated]="true" class="skeleton" />
        </div>
      } @else if (favorites.favorites().length === 0) {
        <app-state-panel
          icon="star-outline"
          title="No favorite routes yet"
          body="Open a route and tap the star to save it here for quick access."
        />
      } @else {
        <ion-list>
          @for (favorite of favorites.favorites(); track favorite.routeId) {
            @let item = resolved()[favorite.routeId] ?? { status: 'loading' };
            <ion-item [button]="item.status === 'ready'" [detail]="false" (click)="open(favorite, item)">
              @switch (item.status) {
                @case ('loading') {
                  <ion-label aria-busy="true">
                    <ion-skeleton-text [animated]="true" class="skeleton-title" />
                    <ion-skeleton-text [animated]="true" class="skeleton-line" />
                  </ion-label>
                }
                @case ('ready') {
                  @if (item.route; as route) {
                    <app-route-badge slot="start" [code]="route.routeCode" [color]="route.routeColorHex" />
                    <ion-label>
                      <h2>{{ route.publicName }}</h2>
                      <p>{{ endpoints(route, favorite.directionId) }}</p>
                    </ion-label>
                  }
                }
                @case ('missing') {
                  <ion-label>
                    <h2>Route no longer available</h2>
                    <p>It may have been withdrawn or changed. You can remove it.</p>
                  </ion-label>
                }
                @case ('error') {
                  <ion-label>
                    <h2>Couldn’t load this route</h2>
                    <p>Check your connection.</p>
                  </ion-label>
                  <ion-button slot="end" fill="clear" (click)="retry(favorite.routeId, $event)">Retry</ion-button>
                }
              }
              <ion-button
                slot="end"
                fill="clear"
                color="medium"
                aria-label="Remove from favorites"
                (click)="remove(favorite.routeId, $event)"
              >
                <ion-icon slot="icon-only" name="trash-outline" aria-hidden="true" />
              </ion-button>
            </ion-item>
          }
        </ion-list>
      }
      @if (favorites.loaded()) {
        <ion-note class="device-note">Favorites are saved on this device only. They aren’t synced to your account or other devices.</ion-note>
      }
      @if (storageError()) {
        <ion-note class="device-note storage-error" role="alert">
          Couldn’t update favorites on this device. Please try again.
        </ion-note>
      }
    </ion-content>
  `,
  styles: `
    h2 {
      font-weight: 600;
      white-space: normal;
    }
    p {
      white-space: normal;
    }
    .loading {
      padding: 16px;
    }
    .skeleton,
    .skeleton-title {
      width: 60%;
      height: 16px;
    }
    .skeleton-line {
      width: 80%;
      height: 14px;
    }
    .device-note {
      display: block;
      margin: 16px;
      font-size: 14px;
    }
    .storage-error {
      color: var(--valryde-danger);
    }
  `,
})
export class FavoritesPage {
  protected readonly favorites = inject(FavoritesService);
  private readonly routes = inject(TransitRoutesService);
  private readonly router = inject(Router);

  private readonly states = signal<Partial<Record<string, Resolved>>>({});
  protected readonly resolved = computed(() => this.states());
  protected readonly storageError = signal(false);

  constructor() {
    addIcons({ trashOutline });
    void this.refresh();
  }

  /** Ionic lifecycle: favorites may have changed on the map while this tab was hidden. */
  ionViewWillEnter(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    await this.favorites.load();
    await Promise.all(
      this.favorites
        .favorites()
        // Ready routes stay as they are; in-flight ones are not requested twice (constructor + first ionViewWillEnter).
        .filter((f) => !['ready', 'loading'].includes(this.states()[f.routeId]?.status ?? ''))
        .map((f) => this.resolve(f.routeId)),
    );
  }

  retry(routeId: string, event: Event): void {
    event.stopPropagation();
    void this.resolve(routeId);
  }

  async remove(routeId: string, event: Event): Promise<void> {
    event.stopPropagation();
    this.storageError.set(false);
    try {
      await this.favorites.remove(routeId);
    } catch {
      this.storageError.set(true);
    }
  }

  open(favorite: FavoriteRoute, item: Resolved): void {
    if (item.status !== 'ready') return;
    const queryParams: Record<string, string> = { route: favorite.routeId };
    // Only reopen a direction the route still has; otherwise the map picks the first active one.
    if (favorite.directionId && item.route.directions.some((d) => d.id === favorite.directionId)) {
      queryParams['direction'] = favorite.directionId;
    }
    void this.router.navigate(['/tabs/map'], { queryParams });
  }

  protected endpoints(route: TransitRoute, directionId: string | null): string {
    const direction = route.directions.find((d) => d.id === directionId) ?? route.directions[0];
    return direction ? `${direction.originName} → ${direction.destinationName}` : 'No active direction right now';
  }

  private async resolve(routeId: string): Promise<void> {
    this.setState(routeId, { status: 'loading' });
    try {
      this.setState(routeId, { status: 'ready', route: await firstValueFrom(this.routes.get(routeId)) });
    } catch (error) {
      const missing = error instanceof HttpErrorResponse && [400, 404].includes(error.status);
      this.setState(routeId, missing ? { status: 'missing' } : { status: 'error' });
    }
  }

  private setState(routeId: string, state: Resolved): void {
    this.states.update((all) => ({ ...all, [routeId]: state }));
  }
}
