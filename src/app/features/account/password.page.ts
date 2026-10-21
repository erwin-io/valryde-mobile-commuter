import { Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { SessionService } from '../../core/auth/session.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { PASSWORD_ERROR, matching, passwordValidators } from './auth-form';

export type PasswordPageKind = 'reset' | 'change';

/**
 * `reset`: opened from the emailed link (`/auth/reset-password?token=`).
 * `change`: signed in; the API then revokes every session, so the user signs in again.
 */
@Component({
  selector: 'app-password-page',
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
        <ion-title>{{ kind() === 'reset' ? 'Choose a new password' : 'Change password' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      @if (done()) {
        <app-state-panel
          icon="checkmark-circle-outline"
          title="Password updated"
          [body]="
            kind() === 'reset'
              ? 'Sign in with your new password.'
              : 'For your security, every device has been signed out. Sign in again with your new password.'
          "
        />
        <ion-button class="action" expand="block" routerLink="/tabs/account/sign-in">Sign in</ion-button>
      } @else if (missingToken()) {
        <app-state-panel
          icon="mail-outline"
          title="Open the link from your email"
          body="Password resets start from the link we email you. Request a new one if it has expired."
        />
        <ion-button class="action" expand="block" routerLink="/tabs/account/forgot-password">
          Request a reset link
        </ion-button>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()">
          <ion-list inset>
            @if (kind() === 'change') {
              <ion-item>
                <ion-input
                  formControlName="current"
                  type="password"
                  label="Current password"
                  labelPlacement="stacked"
                  autocomplete="current-password"
                  errorText="Enter your current password."
                >
                  <ion-input-password-toggle slot="end" />
                </ion-input>
              </ion-item>
            }
            <ion-item>
              <ion-input
                formControlName="password"
                type="password"
                label="New password"
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
                label="Confirm new password"
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
          <ion-button class="action" type="submit" expand="block" [disabled]="busy()">Save password</ion-button>
        </form>
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
  `,
})
export class PasswordPage {
  private readonly api = inject(AuthApiService);
  private readonly session = inject(SessionService);

  readonly kind = input.required<PasswordPageKind>();
  /** Bound from `?token=` on the emailed reset link. */
  readonly token = input<string>();

  readonly form = new FormGroup(
    {
      current: new FormControl('', { nonNullable: true }),
      password: new FormControl('', { nonNullable: true, validators: passwordValidators }),
      confirm: new FormControl('', { nonNullable: true }),
    },
    { validators: matching('password', 'confirm') },
  );
  protected readonly passwordError = PASSWORD_ERROR;
  protected readonly missingToken = computed(() => this.kind() === 'reset' && !this.token());
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly done = signal(false);

  async submit(): Promise<void> {
    const current = this.form.controls.current;
    current.setValidators(this.kind() === 'change' ? [Validators.required] : []);
    current.updateValueAndValidity({ emitEvent: false });
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const { password } = this.form.getRawValue();
    this.busy.set(true);
    this.error.set(null);
    try {
      if (this.kind() === 'reset') {
        await firstValueFrom(this.api.resetPassword(this.token() ?? '', password));
      } else {
        await firstValueFrom(this.api.changePassword(current.value, password));
        await this.session.clearLocal();
      }
      this.form.reset();
      this.done.set(true);
    } catch (error) {
      this.error.set(authErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
