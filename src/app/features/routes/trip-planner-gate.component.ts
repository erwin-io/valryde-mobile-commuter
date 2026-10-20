import { Component } from '@angular/core';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonList } from '@ionic/angular/ion-list';
import { StatePanelComponent } from '../../shared/state-panel.component';

/**
 * Origin/destination entry for checklist 37. Gated: place search and direct-route discovery
 * are backend gap G6 (no approved places or discovery API), so the fields stay disabled.
 */
@Component({
  selector: 'app-trip-planner-gate',
  imports: [IonList, IonItem, IonInput, StatePanelComponent],
  template: `
    <ion-list inset>
      <ion-item>
        <ion-input label="From" labelPlacement="stacked" value="Your location" [disabled]="true" />
      </ion-item>
      <ion-item>
        <ion-input
          label="To"
          labelPlacement="stacked"
          placeholder="Search a destination"
          [disabled]="true"
        />
      </ion-item>
    </ion-list>
    <app-state-panel
      icon="construct-outline"
      title="Trip planning isn’t available yet"
      body="Finding places and direct jeepney routes between two points needs a VALRYDE service that hasn’t been released. You can still search and browse routes."
    />
  `,
})
export class TripPlannerGateComponent {}
