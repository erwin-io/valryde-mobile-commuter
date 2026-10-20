import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { RouteReuseStrategy, provideRouter, withComponentInputBinding } from '@angular/router';
import { IonicRouteStrategy } from '@ionic/angular/ionic-route-strategy';
import { provideIonicAngular } from '@ionic/angular/provide';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { APP_CONFIG } from './core/app-config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Ionic declares zone.js as a peer; keep zone-based change detection until Ionic documents zoneless support.
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideIonicAngular(),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideRouter(routes, withComponentInputBinding()),
    { provide: APP_CONFIG, useValue: environment },
  ],
};
