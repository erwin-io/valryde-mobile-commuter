import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
import { authErrorMessage } from '../../core/auth/auth-errors';
import { StatePanelComponent } from '../../shared/state-panel.component';
import {
  EMAIL_ERROR,
  PASSWORD_ERROR,
  displayNameValidators,
  emailValidators,
  matching,
  passwordValidators,
  trimmed,
} from './auth-form';

@Component({
  selector: 'app-register-page',
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
    StatePanelComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/account" /></ion-buttons>
        <ion-title>Create account</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      @if (sentTo(); as email) {
        <app-state-panel
          icon="mail-outline"
          title="Check your email"
          [body]="'We sent a verification link to ' + email + '. Open it to finish creating your account.'"
        />
        @if (notice(); as text) {
          <ion-note class="message" role="status">{{ text }}</ion-note>
        }
        <ion-button class="action" fill="outline" expand="block" [disabled]="busy()" (click)="resend(email)">
          Resend email
        </ion-button>
        <ion-button class="action" expand="block" routerLink="/tabs/account/sign-in">Go to sign in</ion-button>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()">
          <ion-list inset>
            <ion-item>
              <ion-input
                formControlName="displayName"
                label="Name"
                labelPlacement="stacked"
                autocomplete="name"
                [maxlength]="120"
                errorText="Enter a name of up to 120 characters."
              />
            </ion-item>
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
                autocomplete="new-password"
                helperText="At least 12 characters."
                [errorText]="passwordError"
              >
                <ion-input-password-toggle slot="end" />
              </ion-input>
            </ion-item>
            <ion-item>
              <ion-input
                formControlName="confirm"
                type="password"
                label="Confirm password"
                labelPlacement="stacked"
                autocomplete="new-password"
              >
                <ion-input-password-toggle slot="end" />
              </ion-input>
            </ion-item>
          </ion-list>
          @if (form.hasError('mismatch') && form.controls.confirm.touched) {
            <ion-note class="message" color="danger" role="alert">Passwords don’t match.</ion-note>
          }
          @if (error(); as message) {
            <ion-note class="message" color="danger" role="alert">{{ message }}</ion-note>
          }
          <ion-button class="action" type="submit" expand="block" [disabled]="busy()">Create account</ion-button>
        </form>
        <p class="fine-print">Your name and email are private and never shown to drivers or operators.</p>
      }
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
    .fine-print {
      margin: 12px 16px;
      font-size: 14px;
      color: var(--valryde-muted);
    }
  `,
})
export class RegisterPage {
  private readonly api = inject(AuthApiService);

  readonly form = new FormGroup(
    {
      displayName: new FormControl('', { nonNullable: true, validators: displayNameValidators }),
      email: new FormControl('', { nonNullable: true, validators: emailValidators }),
      password: new FormControl('', { nonNullable: true, validators: passwordValidators }),
      confirm: new FormControl('', { nonNullable: true }),
    },
    { validators: matching('password', 'confirm') },
  );
  protected readonly emailError = EMAIL_ERROR;
  protected readonly passwordError = PASSWORD_ERROR;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly sentTo = signal<string | null>(null);

  async submit(): Promise<void> {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const { displayName, email, password } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    try {
      const user = await firstValueFrom(
        this.api.register({ displayName: trimmed(displayName), email: trimmed(email), password }),
      );
      this.form.reset();
      this.sentTo.set(user.email);
    } catch (error) {
      this.error.set(authErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  async resend(email: string): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.resendVerification(email));
      this.notice.set('If the address still needs verifying, a new email is on its way.');
    } catch (error) {
      this.notice.set(authErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
