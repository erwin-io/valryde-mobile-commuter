import { Routes } from '@angular/router';
import { signedInGuard } from './core/auth/signed-in.guard';

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
        loadComponent: () => import('./features/routes/routes.page').then((m) => m.RoutesPage),
      },
      {
        path: 'favorites',
        loadComponent: () => import('./features/favorites/favorites.page').then((m) => m.FavoritesPage),
      },
      {
        path: 'account',
        children: [
          { path: '', loadComponent: () => import('./features/account/account.page').then((m) => m.AccountPage) },
          { path: 'sign-in', loadComponent: () => import('./features/account/sign-in.page').then((m) => m.SignInPage) },
          { path: 'register', loadComponent: () => import('./features/account/register.page').then((m) => m.RegisterPage) },
          {
            path: 'forgot-password',
            loadComponent: () => import('./features/account/email-request.page').then((m) => m.EmailRequestPage),
            data: { kind: 'forgot-password' },
          },
          {
            path: 'resend-verification',
            loadComponent: () => import('./features/account/email-request.page').then((m) => m.EmailRequestPage),
            data: { kind: 'resend-verification' },
          },
          {
            path: 'change-email',
            canMatch: [signedInGuard],
            loadComponent: () => import('./features/account/email-request.page').then((m) => m.EmailRequestPage),
            data: { kind: 'change-email' },
          },
          {
            path: 'change-password',
            canMatch: [signedInGuard],
            loadComponent: () => import('./features/account/password.page').then((m) => m.PasswordPage),
            data: { kind: 'change' },
          },
        ],
      },
      { path: '', redirectTo: 'map', pathMatch: 'full' },
    ],
  },
  // Landing pages for Agent A's emailed links (APP_*_URL defaults); `?token=` binds to the page input.
  {
    path: 'auth/verify-email',
    loadComponent: () => import('./features/account/email-link.page').then((m) => m.EmailLinkPage),
    data: { kind: 'verify-email' },
  },
  {
    path: 'auth/reset-password',
    loadComponent: () => import('./features/account/password.page').then((m) => m.PasswordPage),
    data: { kind: 'reset' },
  },
  {
    path: 'account/confirm-email-change',
    loadComponent: () => import('./features/account/email-link.page').then((m) => m.EmailLinkPage),
    data: { kind: 'confirm-email-change' },
  },
  { path: '', redirectTo: 'tabs/map', pathMatch: 'full' },
  { path: '**', redirectTo: 'tabs/map' },
];
