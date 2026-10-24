import { Component, inject } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { VehicleTrackingStore } from './vehicle-tracking.store';

@Component({
  selector: 'app-tracking-panel',
  imports: [IonButton],
  template: `
    @if (tracking.status() !== 'idle') {
      <section aria-label="Available jeepneys">
        @switch (tracking.status()) {
          @case ('loading') {
            <p role="status">Loading available jeepneys…</p>
          }
          @case ('offline') {
            <p role="status">You’re offline. Live jeepneys are hidden.</p>
          }
          @case ('unavailable') {
            <p role="status">Live jeepneys are unavailable.</p>
            <ion-button size="small" fill="clear" (click)="tracking.reconcile()">Retry</ion-button>
          }
          @case ('ready') {
            <p role="status">
              {{ tracking.count() }} available
              {{ tracking.count() === 1 ? 'jeepney' : 'jeepneys' }} for this direction
            </p>
            @if (tracking.count() === 0) {
              <p>No available jeepneys right now.</p>
            }
            <details>
              <summary>Jeepney list</summary>
              @for (vehicle of tracking.vehicles(); track vehicle.id) {
                <ion-button fill="clear" (click)="tracking.selectedId.set(vehicle.id)"
                  >{{ vehicle.routeLabel }} · {{ vehicle.plateNumber }}</ion-button
                >
              }
            </details>
          }
        }
        @if (tracking.selected(); as vehicle) {
          <article aria-label="Jeepney details">
            <strong>{{ vehicle.routeLabel }} · {{ vehicle.plateNumber }}</strong>
            <p>{{ vehicle.directionLabel }} · {{ vehicle.statusLabel }}</p>
            <p>
              <span class="color" [style.background]="vehicle.vehicleColor"></span> Vehicle color
              {{ vehicle.vehicleColor }}
            </p>
            <p>Last update {{ timeLabel(vehicle.observedAtMs) }}</p>
            <ion-button fill="clear" size="small" (click)="tracking.selectedId.set(null)"
              >Close jeepney details</ion-button
            >
          </article>
        }
      </section>
    }
  `,
  styles: `
    section {
      padding: 8px 12px;
      border-radius: 10px;
      background: var(--valryde-background, #fff);
      box-shadow: 0 1px 4px #0003;
      max-height: 180px;
      overflow: auto;
      font-size: 13px;
    }
    p {
      margin: 4px 0;
    }
    .color {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 1px solid #475467;
      vertical-align: middle;
    }
  `,
})
export class TrackingPanelComponent {
  readonly tracking = inject(VehicleTrackingStore);
  timeLabel(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
}
