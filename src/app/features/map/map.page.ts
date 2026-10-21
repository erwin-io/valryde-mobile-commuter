import { Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonFab } from '@ionic/angular/ion-fab';
import { IonFabButton } from '@ionic/angular/ion-fab-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonModal } from '@ionic/angular/ion-modal';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { ToastController } from '@ionic/angular/toast-controller';
import { addIcons } from 'ionicons';
import { locateOutline, navigate, searchOutline } from 'ionicons/icons';
import { APP_CONFIG } from '../../core/app-config';
import { RouteDetailComponent } from '../routes/route-detail.component';
import { RouteSelectionService } from '../routes/route-selection.service';
import { LngLat, LocationService } from './location.service';
import { TransitMapComponent } from './transit-map.component';

@Component({
  selector: 'app-map-page',
  imports: [
    IonContent,
    IonButton,
    IonFab,
    IonFabButton,
    IonIcon,
    IonModal,
    IonSpinner,
    TransitMapComponent,
    RouteDetailComponent,
  ],
  providers: [RouteSelectionService],
  template: `
    <ion-content [fullscreen]="true" [scrollY]="false">
      <app-transit-map
        #map
        [styleUrl]="config.mapStyleUrl"
        [center]="config.defaultCenter"
        [zoom]="config.defaultZoom"
        [userLocation]="userLocation()"
        [routeLine]="selection.line()"
        [bottomInset]="sheetInset"
        (userPanned)="stopFollowing()"
      />
      <div class="map-search">
        <ion-button expand="block" color="light" (click)="openSearch()">
          <ion-icon slot="start" name="search-outline" aria-hidden="true" />
          Search jeepney routes
        </ion-button>
      </div>
      <ion-fab slot="fixed" vertical="bottom" horizontal="end" class="recenter">
        <ion-fab-button
          [color]="following() ? 'primary' : 'light'"
          [attr.aria-label]="following() ? 'Stop following my location' : 'Show and follow my location'"
          [attr.aria-pressed]="following()"
          [disabled]="locating()"
          (click)="recenter()"
        >
          @if (locating()) {
            <ion-spinner aria-hidden="true" />
          } @else {
            <ion-icon [name]="following() ? 'navigate' : 'locate-outline'" aria-hidden="true" />
          }
        </ion-fab-button>
      </ion-fab>

      <ion-modal
        [isOpen]="selection.state() !== null"
        [breakpoints]="[0, 0.3, 0.5, 0.9]"
        [initialBreakpoint]="0.5"
        [backdropBreakpoint]="0.9"
        (didDismiss)="closeRoute()"
      >
        <ng-template>
          @if (selection.state(); as state) {
            <app-route-detail
              [state]="state"
              [direction]="selection.direction()"
              [lineDrawable]="selection.line() !== null"
              (directionChange)="chooseDirection($event)"
              (retry)="selection.retry()"
              (closed)="closeRoute()"
            />
          }
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: `
    /* Clear the MapLibre attribution, which wraps to two lines at 320px, so it stays visible. */
    .recenter {
      bottom: 64px;
    }
    .map-search {
      position: absolute;
      z-index: 2;
      top: calc(var(--ion-safe-area-top, 0px) + 12px);
      left: 16px;
      right: 16px;
    }
    .map-search ion-button {
      --border-radius: 12px;
      margin: 0;
      text-transform: none;
      font-weight: 500;
    }
  `,
})
export class MapPage {
  protected readonly config = inject(APP_CONFIG);
  private readonly location = inject(LocationService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly map = viewChild<TransitMapComponent>('map');
  private readonly router = inject(Router);
  protected readonly selection = inject(RouteSelectionService);
  /** Map area hidden by the route sheet at its initial 0.5 breakpoint. */
  protected readonly sheetInset = Math.round(window.innerHeight * 0.5);

  readonly userLocation = signal<LngLat | null>(null);
  readonly locating = signal(false);
  /** Follow mode: the camera tracks foreground position updates until the user pans or taps again. */
  readonly following = signal(false);
  private explained = false;
  private stopWatch?: () => void;

  constructor() {
    addIcons({ locateOutline, navigate, searchOutline });
    inject(DestroyRef).onDestroy(() => this.stopFollowing());
    // ?route=<id>&direction=<id> keeps the selection deep-linkable and back-navigable.
    inject(ActivatedRoute)
      .queryParamMap.pipe(takeUntilDestroyed())
      .subscribe((params) => {
        // Fitting a selected route and following the user would fight over the camera.
        if (params.get('route')) this.stopFollowing();
        this.selection.select(params.get('route'), params.get('direction'));
      });
    // Use location silently only when already granted; otherwise wait for an explicit tap.
    void this.locateIfGranted();
  }

  openSearch(): void {
    void this.router.navigate(['/tabs/routes']);
  }

  chooseDirection(directionId: string): void {
    void this.router.navigate([], {
      queryParams: { direction: directionId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  closeRoute(): void {
    if (this.selection.state() === null) return;
    void this.router.navigate([], { queryParams: { route: null, direction: null }, replaceUrl: true });
  }

  /** Ionic lifecycle: stop GPS updates while the Map tab is not visible. */
  ionViewDidLeave(): void {
    this.stopFollowing();
  }

  stopFollowing(): void {
    this.following.set(false);
    this.stopWatch?.();
    this.stopWatch = undefined;
  }

  async recenter(): Promise<void> {
    if (this.locating()) return;
    if (this.following()) {
      this.stopFollowing();
      return;
    }
    if (!this.explained && !(await this.location.isGranted())) {
      this.explained = true;
      if (!(await this.explainLocation())) return;
    }
    if (await this.showMyLocation()) await this.startFollowing();
  }

  private async locateIfGranted(): Promise<void> {
    if (await this.location.isGranted()) await this.showMyLocation();
  }

  private async startFollowing(): Promise<void> {
    this.following.set(true);
    const stop = await this.location.watch(
      (position) => {
        this.userLocation.set(position);
        if (this.following()) this.map()?.focus(position, true);
      },
      (result) => {
        this.stopFollowing();
        void this.toast(
          result.kind === 'denied'
            ? 'Location access was turned off, so VALRYDE stopped following you. The map still works.'
            : 'We lost your location, so VALRYDE stopped following you.',
        );
      },
    );
    // Following may have ended (pan, tab change, error) while the watch was starting.
    if (this.following()) this.stopWatch = stop;
    else stop();
  }

  /** Locates once and centers the map. Returns true when a position was found. */
  private async showMyLocation(): Promise<boolean> {
    this.locating.set(true);
    try {
      const result = await this.location.locate();
      switch (result.kind) {
        case 'located':
          this.userLocation.set(result.position);
          this.map()?.focus(result.position);
          return true;
        case 'denied':
          await this.toast(
            'Location is off for VALRYDE. You can still browse the map, or turn location on in your device settings.',
          );
          break;
        case 'unavailable':
          await this.toast('We couldn’t find your location. Please try again.');
          break;
      }
    } finally {
      this.locating.set(false);
    }
    return false;
  }

  private async explainLocation(): Promise<boolean> {
    const alert = await this.alerts.create({
      header: 'Show where you are?',
      message:
        'VALRYDE uses your location only on this device to center the map near you. It is not sent to our servers.',
      buttons: [
        { text: 'Not now', role: 'cancel' },
        { text: 'Allow', role: 'confirm' },
      ],
    });
    await alert.present();
    return (await alert.onDidDismiss()).role === 'confirm';
  }

  private async toast(message: string): Promise<void> {
    const toast = await this.toasts.create({ message, duration: 4000, position: 'top' });
    await toast.present();
  }
}
