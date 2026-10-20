import { Injectable, signal } from '@angular/core';

/** Browser/WebView connectivity hint. It does not prove the VALRYDE API is reachable. */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  readonly online = signal(navigator.onLine);

  constructor() {
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }
}
