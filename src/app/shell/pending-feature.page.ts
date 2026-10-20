import { Component, input } from '@angular/core';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { StatePanelComponent } from '../shared/state-panel.component';

/** Honest placeholder for approved tabs whose slice has not been implemented yet. */
@Component({
  selector: 'app-pending-feature',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, StatePanelComponent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ title() }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <app-state-panel icon="construct-outline" [title]="title() + ' is not available yet'" [body]="body()" />
    </ion-content>
  `,
})
export class PendingFeaturePage {
  readonly title = input.required<string>();
  readonly body = input.required<string>();
}
