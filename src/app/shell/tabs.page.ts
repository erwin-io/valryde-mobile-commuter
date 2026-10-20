import { Component } from '@angular/core';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonTabBar } from '@ionic/angular/ion-tab-bar';
import { IonTabButton } from '@ionic/angular/ion-tab-button';
import { IonTabs } from '@ionic/angular/ion-tabs';
import { addIcons } from 'ionicons';
import { busOutline, mapOutline, personCircleOutline, starOutline } from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="map">
          <ion-icon name="map-outline" aria-hidden="true" />
          <ion-label>Map</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="routes">
          <ion-icon name="bus-outline" aria-hidden="true" />
          <ion-label>Routes</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="favorites">
          <ion-icon name="star-outline" aria-hidden="true" />
          <ion-label>Favorites</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="account">
          <ion-icon name="person-circle-outline" aria-hidden="true" />
          <ion-label>Account</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {
  constructor() {
    addIcons({ mapOutline, busOutline, starOutline, personCircleOutline });
  }
}
