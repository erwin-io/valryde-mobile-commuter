import { Component, inject } from '@angular/core';
import { ConnectivityService } from '../core/connectivity.service';

@Component({
  selector: 'app-offline-banner',
  template: `
    @if (!connectivity.online()) {
      <div class="offline-banner" role="status">
        You’re offline. Live vehicles and place search are unavailable.
      </div>
    }
  `,
  styles: `
    .offline-banner {
      position: absolute;
      z-index: 1000;
      top: 0;
      left: 0;
      right: 0;
      padding: calc(var(--ion-safe-area-top, 0px) + 8px) 16px 8px;
      background: var(--valryde-warning);
      color: #fff;
      font-size: 14px;
      line-height: 20px;
      text-align: center;
    }
  `,
})
export class OfflineBannerComponent {
  protected readonly connectivity = inject(ConnectivityService);
}
