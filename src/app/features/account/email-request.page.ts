import { Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { IonBackButton } from '@ionic/angular/ion-back-button';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonList } from '@ionic/angular/ion-list';
import { IonNote } from '@ionic/angular/ion-note';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { authErrorMessage } from '../../core/auth/auth-errors';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { EMAIL_ERROR, emailValidators, trimmed } from './auth-form';

export type EmailRequestKind = 'forgot-password' | 'change-email';

const COPY: Record<EmailRequestKind, { title: string; intro: string; label: string; action: string; done: string }> = {
  'forgot-password': {
    title: 'Reset password',
    intro: 'Enter your account email and we’ll send you a link to choose a new password.',
    label: 'Email',
    action: 'Send reset link',
    // Generic on purpose: the API does not reveal whether an account exists.
    done: 'If an account uses that address, a password reset link is on its way.',
  },
  'change-email': {
    title: 'Change email',
    intro: 'We’ll send a confirmation link to the new address. Your email changes only after you open it.',
    label: 'New email',
    action: 'Send confirmation link',
    done: 'Check the new inbox and open the confirmation link to finish changing your email.',
  },
};

/** One email field that triggers an emailed challenge (password reset or email change). */
@Component({
  selector: 'app-email-request-page',
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonInput,
    IonButton,
    IonNote,
    StatePanelComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/account" /></ion-buttons>
        <ion-title>{{ copy().title }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      @if (sent()) {
        <app-state-panel icon="mail-outline" title="Check your email" [body]="copy().done" />
      } @else {
        <p class="intro">{{ copy().intro }}</p>
        <form [formGroup]="form" (ngSubmit)="submit()">
          <ion-list inset>
            <ion-item>
              <ion-input
                formControlName="email"
                type="email"
                [label]="copy().label"
                labelPlacement="stacked"
                autocomplete="email"
                inputmode="email"
                [errorText]="emailError"
              />
            </ion-item>
          </ion-list>
          @if (error(); as message) {
            <ion-note class="message" color="danger" role="alert">{{ message }}</ion-note>
          }
          <ion-button class="action" type="submit" expand="block" [disabled]="busy()">
            {{ copy().action }}
          </ion-button>
        </form>
      }
    </ion-content>
  `,
  styles: `
    .intro {
      margin: 16px 16px 0;
      color: var(--valryde-muted);
    }
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
export class EmailRequestPage {
  private readonly api = inject(AuthApiService);

  readonly kind = input.required<EmailRequestKind>();
  protected readonly copy = computed(() => COPY[this.kind()]);
  readonly email = new FormControl('', { nonNullable: true, validators: emailValidators });
  // [formGroup] makes Angular own the submit; a bare <form> would do a native GET and reload the app.
  protected readonly form = new FormGroup({ email: this.email });
  protected readonly emailError = EMAIL_ERROR;
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly sent = signal(false);

  async submit(): Promise<void> {
    if (this.email.invalid || this.busy()) {
      this.email.markAsTouched();
      return;
    }
    const email = trimmed(this.email.value);
    this.busy.set(true);
    this.error.set(null);
    try {
      await firstValueFrom(
        this.kind() === 'forgot-password' ? this.api.forgotPassword(email) : this.api.requestEmailChange(email),
      );
      this.sent.set(true);
    } catch (error) {
      this.error.set(authErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
