import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonInput } from '@ionic/angular/ion-input';
import { IonInputPasswordToggle } from '@ionic/angular/ion-input-password-toggle';
import { IonItem } from '@ionic/angular/ion-item';
import { IonList } from '@ionic/angular/ion-list';
import { IonNote } from '@ionic/angular/ion-note';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { apiErrorCode, authErrorMessage } from '../../core/auth/auth-errors';
import { SessionService } from '../../core/auth/session.service';
import { EMAIL_ERROR, emailValidators, trimmed } from './auth-form';

@Component({
  selector: 'app-sign-in-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonInput,
    IonInputPasswordToggle,
    IonButton,
    IonNote,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/account" /></ion-buttons>
        <ion-title>Sign in</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <ion-list inset>
          <ion-item>
            <ion-input
              formControlName="email"
              type="email"
              label="Email"
              labelPlacement="stacked"
              autocomplete="email"
              inputmode="email"
              [errorText]="emailError"
            />
          </ion-item>
          <ion-item>
            <ion-input
              formControlName="password"
              type="password"
              label="Password"
              labelPlacement="stacked"
              autocomplete="current-password"
              errorText="Enter your password."
            >
              <ion-input-password-toggle slot="end" />
            </ion-input>
          </ion-item>
        </ion-list>
        @if (error(); as message) {
          <ion-note class="message" color="danger" role="alert">{{ message }}</ion-note>
        }
        @if (unverified()) {
          <ion-button class="action" fill="outline" expand="block" (click)="resend()" [disabled]="busy()">
            Resend verification email
          </ion-button>
        }
        @if (notice(); as text) {
          <ion-note class="message" role="status">{{ text }}</ion-note>
        }
        <ion-button class="action" type="submit" expand="block" [disabled]="busy()">Sign in</ion-button>
      </form>
      <ion-button class="action" fill="clear" expand="block" routerLink="/tabs/account/forgot-password">
        Forgot password?
      </ion-button>
      <ion-button class="action" fill="clear" expand="block" routerLink="/tabs/account/register">
        Create an account
      </ion-button>
    </ion-content>
  `,
  styles: `
    .message {
      display: block;
      margin: 0 16px 12px;
      font-size: 14px;
    }
    .action {
      margin: 8px 16px;
    }
  `,
})
export class SignInPage {
  private readonly session = inject(SessionService);
  private readonly api = inject(AuthApiService);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: emailValidators }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  protected readonly emailError = EMAIL_ERROR;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly unverified = signal(false);

  async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await this.session.signIn(trimmed(email), password);
      this.form.reset();
      await this.router.navigate(['/tabs/account'], { replaceUrl: true });
    } catch (error) {
      const code = apiErrorCode(error);
      this.unverified.set(code === 'EMAIL_NOT_VERIFIED');
      // On login, Agent A returns 403 FORBIDDEN only when the account is not ACTIVE.
      this.error.set(code === 'FORBIDDEN' ? 'This account is disabled and can’t sign in.' : authErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  async resend(): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.resendVerification(trimmed(this.form.controls.email.value)));
      // The API answers generically (enumeration-resistant); so do we.
      this.notice.set('If the address needs verifying, a new email is on its way.');
    } catch (error) {
      this.error.set(authErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
