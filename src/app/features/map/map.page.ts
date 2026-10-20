import { Component, inject, signal, viewChild } from '@angular/core';
import { AlertController } from '@ionic/angular/alert-controller';
import { IonContent } from '@ionic/angular/ion-content';
import { IonFab } from '@ionic/angular/ion-fab';
import { IonFabButton } from '@ionic/angular/ion-fab-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { ToastController } from '@ionic/angular/toast-controller';
import { addIcons } from 'ionicons';
import { locateOutline } from 'ionicons/icons';
import { APP_CONFIG } from '../../core/app-config';
import { LngLat, LocationService } from './location.service';
import { TransitMapComponent } from './transit-map.component';

@Component({
  selector: 'app-map-page',
  imports: [IonContent, IonFab, IonFabButton, IonIcon, IonSpinner, TransitMapComponent],
  template: `
    <ion-content [fullscreen]="true" [scrollY]="false">
      <app-transit-map
        #map
        [styleUrl]="config.mapStyleUrl"
        [center]="config.defaultCenter"
        [zoom]="config.defaultZoom"
        [userLocation]="userLocation()"
      />
      <ion-fab slot="fixed" vertical="bottom" horizontal="end" class="recenter">
        <ion-fab-button
          color="light"
          aria-label="Show my location"
          [disabled]="locating()"
          (click)="recenter()"
        >
          @if (locating()) {
            <ion-spinner aria-hidden="true" />
          } @else {
            <ion-icon name="locate-outline" aria-hidden="true" />
          }
        </ion-fab-button>
      </ion-fab>
    </ion-content>
  `,
  styles: `
    /* Clear the MapLibre attribution, which wraps to two lines at 320px, so it stays visible. */
    .recenter {
      bottom: 64px;
    }
  `,
})
export class MapPage {
  protected readonly config = inject(APP_CONFIG);
  private readonly location = inject(LocationService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastController);
  private readonly map = viewChild<TransitMapComponent>('map');

  readonly userLocation = signal<LngLat | null>(null);
  readonly locating = signal(false);
  private explained = false;

  constructor() {
    addIcons({ locateOutline });
    // Use location silently only when already granted; otherwise wait for an explicit tap.
    void this.locateIfGranted();
  }

  async recenter(): Promise<void> {
    if (this.locating()) return;
    if (!this.explained && !(await this.location.isGranted())) {
      this.explained = true;
      if (!(await this.explainLocation())) return;
    }
    await this.showMyLocation();
  }

  private async locateIfGranted(): Promise<void> {
    if (await this.location.isGranted()) await this.showMyLocation();
  }

  private async showMyLocation(): Promise<void> {
    this.locating.set(true);
    try {
      const result = await this.location.locate();
      switch (result.kind) {
        case 'located':
          this.userLocation.set(result.position);
          this.map()?.focus(result.position);
          break;
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
