import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'tabs',
    loadComponent: () => import('./shell/tabs.page').then((m) => m.TabsPage),
    children: [
      {
        path: 'map',
        loadComponent: () => import('./features/map/map.page').then((m) => m.MapPage),
      },
      {
        path: 'routes',
        loadComponent: () => import('./shell/pending-feature.page').then((m) => m.PendingFeaturePage),
        data: { title: 'Routes', body: 'Route search and the route list arrive in the next slice.' },
      },
      {
        path: 'favorites',
        loadComponent: () => import('./shell/pending-feature.page').then((m) => m.PendingFeaturePage),
        data: {
          title: 'Favorites',
          body: 'Saved routes will appear here once favorite storage is approved.',
        },
      },
      {
        path: 'account',
        loadComponent: () => import('./shell/pending-feature.page').then((m) => m.PendingFeaturePage),
        data: { title: 'Account', body: 'Sign-in and your profile arrive in a later slice.' },
      },
      { path: '', redirectTo: 'map', pathMatch: 'full' },
    ],
  },
  { path: '', redirectTo: 'tabs/map', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs/map' },
];
