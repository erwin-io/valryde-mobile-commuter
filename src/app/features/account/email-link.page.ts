import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { firstValueFrom } from 'rxjs';
import { AuthApiService, AuthUser } from '../../core/auth/auth-api.service';
import { authErrorMessage } from '../../core/auth/auth-errors';
import { SessionService } from '../../core/auth/session.service';
import { StatePanelComponent } from '../../shared/state-panel.component';

export type EmailLinkKind = 'verify-email' | 'confirm-email-change';

/** Landing page for emailed one-time links: posts `?token=` once and reports the outcome. */
@Component({
  selector: 'app-email-link-page',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner, IonButton, RouterLink, StatePanelComponent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ kind() === 'verify-email' ? 'Verify email' : 'Confirm new email' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      @switch (state()) {
        @case ('working') {
          <div class="working" role="status">
            <ion-spinner aria-hidden="true" />
            <span>Checking your link…</span>
          </div>
        }
        @case ('done') {
          <app-state-panel
            icon="checkmark-circle-outline"
            [title]="kind() === 'verify-email' ? 'Email verified' : 'Email updated'"
            [body]="
              kind() === 'verify-email'
                ? 'Your account is ready. Sign in to continue.'
                : 'Your account now uses ' + (user()?.email ?? 'the new address') + '. Sign in again with your new email.'
            "
          />
          <ion-button class="action" expand="block" [routerLink]="continueLink()">Continue</ion-button>
        }
        @case ('failed') {
          <app-state-panel icon="alert-circle-outline" title="This link didn’t work" [body]="error() ?? ''" />
          <ion-button class="action" expand="block" routerLink="/tabs/account">Go to account</ion-button>
        }
      }
    </ion-content>
  `,
  styles: `
    .working {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 48px 16px;
      color: var(--valryde-muted);
    }
    .action {
      margin: 8px 16px;
    }
  `,
})
export class EmailLinkPage implements OnInit {
  private readonly api = inject(AuthApiService);
  private readonly session = inject(SessionService);

  readonly kind = input.required<EmailLinkKind>();
  /** Bound from `?token=`. */
  readonly token = input<string>();

  readonly state = signal<'working' | 'done' | 'failed'>('working');
  readonly user = signal<AuthUser | null>(null);
  readonly error = signal<string | null>(null);
  protected readonly continueLink = computed(() =>
    this.session.status() === 'signed-in' ? '/tabs/account' : '/tabs/account/sign-in',
  );

  async ngOnInit(): Promise<void> {
    const token = this.token();
    if (!token) {
      this.error.set('The link is incomplete. Open it again from your email.');
      this.state.set('failed');
      return;
    }
    try {
      const user = await firstValueFrom(
        this.kind() === 'verify-email' ? this.api.verifyEmail(token) : this.api.confirmEmailChange(token),
      );
      this.user.set(user);
      // The API revokes every session when an email change is confirmed (credentials_version bump).
      if (this.kind() === 'confirm-email-change') await this.session.clearLocal();
      else if (this.session.user()?.id === user.id) this.session.setUser(user);
      this.state.set('done');
    } catch (error) {
      this.error.set(authErrorMessage(error));
      this.state.set('failed');
    }
  }
}
