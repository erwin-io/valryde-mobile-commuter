import { Component, input, output } from '@angular/core';
import { IonButton } from '@ionic/angular/ion-button';
import { IonIcon } from '@ionic/angular/ion-icon';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  busOutline,
  cloudOfflineOutline,
  constructOutline,
  searchOutline,
} from 'ionicons/icons';

/** Standard loading/empty/error/offline explanation with at most one recovery action. */
@Component({
  selector: 'app-state-panel',
  imports: [IonButton, IonIcon],
  template: `
    <section class="state-panel" role="status">
      <ion-icon [name]="icon()" aria-hidden="true" />
      <h2>{{ title() }}</h2>
      <p>{{ body() }}</p>
      @if (actionLabel()) {
        <ion-button (click)="action.emit()">{{ actionLabel() }}</ion-button>
      }
    </section>
  `,
  styles: `
    .state-panel {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      max-width: 360px;
      margin: 0 auto;
      padding: 32px 16px;
      text-align: center;
      color: var(--valryde-text);
    }
    ion-icon {
      font-size: 40px;
      color: var(--valryde-muted);
    }
    h2 {
      margin: 0;
      font-size: 18px;
      line-height: 24px;
      font-weight: 600;
    }
    p {
      margin: 0 0 8px;
      font-size: 16px;
      line-height: 24px;
      color: var(--valryde-muted);
    }
  `,
})
export class StatePanelComponent {
  readonly icon = input('alert-circle-outline');
  readonly title = input.required<string>();
  readonly body = input('');
  readonly actionLabel = input<string>();
  readonly action = output<void>();

  constructor() {
    addIcons({ alertCircleOutline, busOutline, cloudOfflineOutline, constructOutline, searchOutline });
  }
}
