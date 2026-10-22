import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonLabel } from '@ionic/angular/ion-label';
import { IonList } from '@ionic/angular/ion-list';
import { IonListHeader } from '@ionic/angular/ion-list-header';
import { IonNote } from '@ionic/angular/ion-note';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { IonTitle } from '@ionic/angular/ion-title';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { authErrorMessage } from '../../core/auth/auth-errors';
import { SessionService } from '../../core/auth/session.service';
import { StatePanelComponent } from '../../shared/state-panel.component';
import { displayNameValidators, trimmed } from './auth-form';

@Component({
  selector: 'app-account-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonListHeader,
    IonItem,
    IonLabel,
    IonInput,
    IonNote,
    IonButton,
    IonSpinner,
    StatePanelComponent,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Account</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      @switch (session.status()) {
        @case ('restoring') {
          <div class="restoring" role="status">
            <ion-spinner aria-hidden="true" />
            <span>Restoring your session…</span>
          </div>
        }
        @case ('restore-failed') {
          <app-state-panel
            icon="cloud-offline-outline"
            title="Can’t restore your session"
            body="Check your connection or unlock your device, then try again. You can still use the map and routes."
            actionLabel="Try again"
            (action)="session.restore()"
          />
        }
        @case ('signed-out') {
          @if (session.endedByServer()) {
            <ion-note class="message" role="alert">
              Your session ended, for example after a password or email change on another device. Please sign in again.
            </ion-note>
          }
          <app-state-panel
            icon="person-circle-outline"
            title="Your VALRYDE account"
            body="Routes and the map work without an account. Sign in to keep your profile on this device."
          />
          <ion-button class="action" expand="block" routerLink="/tabs/account/sign-in">Sign in</ion-button>
          <ion-button class="action" expand="block" fill="outline" routerLink="/tabs/account/register">
            Create an account
          </ion-button>
        }
        @case ('signed-in') {
          @if (session.user(); as user) {
            <ion-list inset>
              <ion-list-header><ion-label>Profile</ion-label></ion-list-header>
              @if (editingName()) {
                <form [formGroup]="nameForm" (ngSubmit)="saveName()">
                  <ion-item>
                    <ion-input
                      formControlName="name"
                      label="Name"
                      labelPlacement="stacked"
                      autocomplete="name"
                      [maxlength]="120"
                      errorText="Enter a name of up to 120 characters."
                    />
                  </ion-item>
                  <div class="inline-actions">
                    <ion-button fill="clear" (click)="editingName.set(false)">Cancel</ion-button>
                    <ion-button type="submit" [disabled]="busy()">Save</ion-button>
                  </div>
                </form>
              } @else {
                <ion-item button detail (click)="editName(user.displayName)">
                  <ion-label>
                    <p>Name</p>
                    <h2>{{ user.displayName }}</h2>
                  </ion-label>
                </ion-item>
              }
              <ion-item button detail routerLink="/tabs/account/change-email">
                <ion-label>
                  <p>Email</p>
                  <h2>{{ user.email }}</h2>
                </ion-label>
                <ion-note slot="end">{{ user.emailVerified ? 'Verified' : 'Not verified' }}</ion-note>
              </ion-item>
              <ion-item button detail routerLink="/tabs/account/change-password">
                <ion-label>Change password</ion-label>
              </ion-item>
            </ion-list>
            @if (message(); as text) {
              <ion-note class="message" role="status">{{ text }}</ion-note>
            }
            <ion-button class="action" expand="block" fill="outline" color="danger" (click)="signOut()">
              Sign out
            </ion-button>
            <p class="fine-print">Signing out removes your session from this device only.</p>
          }
        }
      }
    </ion-content>
  `,
  styles: `
    .restoring {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 48px 16px;
      color: var(--valryde-muted);
    }
    h2 {
      font-weight: 600;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    .inline-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 4px 8px 8px;
    }
    .message {
      display: block;
      margin: 0 16px 12px;
      font-size: 14px;
    }
    .action {
      margin: 8px 16px;
    }
    .fine-print {
      margin: 4px 16px;
      font-size: 14px;
      color: var(--valryde-muted);
    }
  `,
})
export class AccountPage {
  protected readonly session = inject(SessionService);
  private readonly api = inject(AuthApiService);

  readonly name = new FormControl('', { nonNullable: true, validators: displayNameValidators });
  // [formGroup] makes Angular own the submit; a bare <form> would do a native GET and reload the app.
  protected readonly nameForm = new FormGroup({ name: this.name });
  readonly editingName = signal(false);
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);

  editName(current: string): void {
    this.name.setValue(current);
    this.message.set(null);
    this.editingName.set(true);
  }

  async saveName(): Promise<void> {
    const value = trimmed(this.name.value);
    if (!value || this.name.invalid || this.busy()) {
      this.name.markAsTouched();
      return;
    }
    this.busy.set(true);
    try {
      this.session.setUser(await firstValueFrom(this.api.updateProfile(value)));
      this.editingName.set(false);
      this.message.set('Name updated.');
    } catch (error) {
      this.message.set(authErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  async signOut(): Promise<void> {
    this.message.set(null);
    await this.session.signOut();
  }
}
