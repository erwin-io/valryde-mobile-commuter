import { Component } from '@angular/core';
import { IonApp } from '@ionic/angular/ion-app';
import { IonRouterOutlet } from '@ionic/angular/ion-router-outlet';
import { OfflineBannerComponent } from './shared/offline-banner.component';

@Component({
  selector: 'app-root',
  imports: [IonApp, IonRouterOutlet, OfflineBannerComponent],
  template: `
    <ion-app>
      <app-offline-banner />
      <ion-router-outlet />
    </ion-app>
  `,
})
export class App {}
