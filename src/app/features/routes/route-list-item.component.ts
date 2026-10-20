import { Component, computed, input, output } from '@angular/core';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { RouteBadgeComponent } from './route-badge.component';
import { TransitRoute } from './transit-routes.service';

@Component({
  selector: 'app-route-list-item',
  imports: [IonItem, IonLabel, RouteBadgeComponent],
  template: `
    <ion-item button detail (click)="selected.emit(route())">
      <app-route-badge slot="start" [code]="route().routeCode" [color]="route().routeColorHex" />
      <ion-label>
        <h2>{{ route().publicName }}</h2>
        @if (endpoints(); as e) {
          <p>{{ e }}</p>
        }
      </ion-label>
    </ion-item>
  `,
  styles: `
    h2 {
      font-weight: 600;
      white-space: normal;
    }
    p {
      white-space: normal;
    }
  `,
})
export class RouteListItemComponent {
  readonly route = input.required<TransitRoute>();
  readonly selected = output<TransitRoute>();

  protected readonly endpoints = computed(() => {
    const [first, ...rest] = this.route().directions;
    if (!first) return null;
    const summary = `${first.originName} – ${first.destinationName}`;
    return rest.length ? `${summary} · ${this.route().directions.length} directions` : summary;
  });
}
