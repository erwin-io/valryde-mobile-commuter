import { HttpErrorResponse } from '@angular/common/http';
import { Type, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { testUser } from '../../core/auth/auth.test-helpers';
import { SessionService, SessionStatus } from '../../core/auth/session.service';
import { AccountPage } from './account.page';
import { EmailLinkPage } from './email-link.page';
import { EmailRequestPage } from './email-request.page';
import { PasswordPage } from './password.page';
import { RegisterPage } from './register.page';
import { SignInPage } from './sign-in.page';

const apiError = (status: number, code: string) =>
  new HttpErrorResponse({ status, error: { error: { code, message: 'raw server text', requestId: 'req-1' } } });

/** Lets promise chains finish, then waits for change detection (Ionic timers make whenStable unreliable alone). */
async function settle(fixture: ComponentFixture<unknown>) {
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

describe('Account pages', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let session: {
    status: ReturnType<typeof signal<SessionStatus>>;
    endedByServer: ReturnType<typeof signal<boolean>>;
    user: ReturnType<typeof signal<typeof testUser | null>>;
    signIn: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    restore: ReturnType<typeof vi.fn>;
    setUser: ReturnType<typeof vi.fn>;
    clearLocal: ReturnType<typeof vi.fn>;
  };

  function render<T>(component: Type<T>, inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: api },
        { provide: SessionService, useValue: session },
      ],
    });
    const fixture = TestBed.createComponent(component);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.autoDetectChanges();
    return { fixture, page: fixture.componentInstance, text: () => fixture.nativeElement.textContent as string };
  }

  beforeEach(() => {
    api = {
      register: vi.fn(),
      resendVerification: vi.fn(() => of({ message: 'ok' })),
      verifyEmail: vi.fn(),
      confirmEmailChange: vi.fn(),
      resetPassword: vi.fn(),
      changePassword: vi.fn(),
      updateProfile: vi.fn(),
    };
    session = {
      status: signal<SessionStatus>('signed-out'),
      endedByServer: signal(false),
      user: signal<typeof testUser | null>(null),
      signIn: vi.fn(),
      signOut: vi.fn(async () => undefined),
      restore: vi.fn(),
      setUser: vi.fn(),
      clearLocal: vi.fn(async () => undefined),
    };
  });

  describe('SignInPage', () => {
    it('does not call the API while the form is invalid', async () => {
      const { page } = render(SignInPage);
      page.form.setValue({ email: 'not-an-email', password: '' });
      await page.submit();
      expect(session.signIn).not.toHaveBeenCalled();
    });

    it('signs in with a trimmed email and returns to the account tab', async () => {
      session.signIn.mockResolvedValue(undefined);
      const { page } = render(SignInPage);
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      page.form.setValue({ email: '  rider@example.test ', password: 'correct horse battery' });
      await page.submit();
      expect(session.signIn).toHaveBeenCalledWith('rider@example.test', 'correct horse battery');
      expect(navigate).toHaveBeenCalledWith(['/tabs/account'], { replaceUrl: true });
    });

    it('offers to resend verification for an unverified email, with generic confirmation', async () => {
      session.signIn.mockRejectedValue(apiError(403, 'EMAIL_NOT_VERIFIED'));
      const { fixture, page, text } = render(SignInPage);
      page.form.setValue({ email: 'rider@example.test', password: 'correct horse battery' });
      await page.submit();
      await settle(fixture);
      expect(text()).toContain('verify your email');
      expect(text()).toContain('Resend verification email');
      expect(text()).not.toContain('raw server text');

      await page.resend();
      await settle(fixture);
      expect(api['resendVerification']).toHaveBeenCalledWith('rider@example.test');
      expect(text()).toContain('a new email is on its way');
    });
  });

  describe('RegisterPage', () => {
    const valid = {
      displayName: ' Rider ',
      email: 'rider@example.test',
      password: 'correct horse battery',
      confirm: 'correct horse battery',
    };

    it('requires 12+ character passwords that match', async () => {
      const { page } = render(RegisterPage);
      page.form.setValue({ ...valid, password: 'short', confirm: 'short' });
      expect(page.form.controls.password.hasError('minlength')).toBe(true);
      page.form.setValue({ ...valid, confirm: 'different password!' });
      expect(page.form.hasError('mismatch')).toBe(true);
      await page.submit();
      expect(api['register']).not.toHaveBeenCalled();
    });

    it('registers a commuter and asks them to check their email', async () => {
      api['register'].mockReturnValue(of(testUser));
      const { fixture, page, text } = render(RegisterPage);
      page.form.setValue(valid);
      await page.submit();
      await settle(fixture);
      expect(api['register']).toHaveBeenCalledWith({
        displayName: 'Rider',
        email: 'rider@example.test',
        password: 'correct horse battery',
      });
      expect(text()).toContain('Check your email');
      expect(text()).toContain('rider@example.test');
    });

    it('shows safe copy for a conflict', async () => {
      api['register'].mockReturnValue(throwError(() => apiError(409, 'CONFLICT')));
      const { fixture, page, text } = render(RegisterPage);
      page.form.setValue(valid);
      await page.submit();
      await settle(fixture);
      expect(text()).toContain('sign in instead');
    });
  });

  describe('PasswordPage', () => {
    it('reset: explains a missing token instead of showing a form', async () => {
      const { fixture, text } = render(PasswordPage, { kind: 'reset' });
      await settle(fixture);
      expect(text()).toContain('Open the link from your email');
    });

    it('reset: posts the emailed token with the new password', async () => {
      api['resetPassword'].mockReturnValue(of(null));
      const { fixture, page, text } = render(PasswordPage, { kind: 'reset', token: 't'.repeat(32) });
      page.form.setValue({ current: '', password: 'a brand new password', confirm: 'a brand new password' });
      await page.submit();
      await settle(fixture);
      expect(api['resetPassword']).toHaveBeenCalledWith('t'.repeat(32), 'a brand new password');
      expect(text()).toContain('Password updated');
    });

    it('change: requires the current password, then ends the local session', async () => {
      api['changePassword'].mockReturnValue(of(null));
      const { page } = render(PasswordPage, { kind: 'change' });
      page.form.setValue({ current: '', password: 'a brand new password', confirm: 'a brand new password' });
      await page.submit();
      expect(api['changePassword']).not.toHaveBeenCalled();

      page.form.controls.current.setValue('the old password!');
      await page.submit();
      expect(api['changePassword']).toHaveBeenCalledWith('the old password!', 'a brand new password');
      expect(session.clearLocal).toHaveBeenCalled();
      expect(page.done()).toBe(true);
    });
  });

  describe('EmailLinkPage', () => {
    it('verifies the token from the link once', async () => {
      api['verifyEmail'].mockReturnValue(of(testUser));
      const { fixture, text } = render(EmailLinkPage, { kind: 'verify-email', token: 'v'.repeat(32) });
      await settle(fixture);
      expect(api['verifyEmail']).toHaveBeenCalledOnce();
      expect(text()).toContain('Email verified');
    });

    it('explains an expired or used link', async () => {
      api['verifyEmail'].mockReturnValue(throwError(() => apiError(400, 'INVALID_CHALLENGE')));
      const { fixture, text } = render(EmailLinkPage, { kind: 'verify-email', token: 'v'.repeat(32) });
      await settle(fixture);
      expect(text()).toContain('expired or has already been used');
    });

    it('ends the local session after confirming an email change (the API revokes all sessions)', async () => {
      session.status.set('signed-in');
      session.user.set(testUser);
      const changed = { ...testUser, email: 'new@example.test' };
      api['confirmEmailChange'].mockReturnValue(of(changed));
      const { fixture, text } = render(EmailLinkPage, { kind: 'confirm-email-change', token: 'c'.repeat(32) });
      await settle(fixture);
      expect(session.clearLocal).toHaveBeenCalled();
      expect(session.setUser).not.toHaveBeenCalled();
      expect(text()).toContain('new@example.test');
      expect(text()).toContain('Sign in again');
    });
  });

  describe('EmailRequestPage', () => {
    it('forgot password: submits through Angular and shows the generic confirmation', async () => {
      api['forgotPassword'] = vi.fn(() => of({ message: 'ok' }));
      const { fixture, page, text } = render(EmailRequestPage, { kind: 'forgot-password' });
      await settle(fixture);
      page.email.setValue('rider@example.test ');
      const submit = new Event('submit', { cancelable: true });
      (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(submit);
      expect(submit.defaultPrevented).toBe(true);
      await settle(fixture);
      expect(api['forgotPassword']).toHaveBeenCalledWith('rider@example.test');
      expect(text()).toContain('If an account uses that address');
    });

    it('change email: requests a confirmation link for the new address', async () => {
      api['requestEmailChange'] = vi.fn(() => of({ message: 'ok' }));
      const { fixture, page, text } = render(EmailRequestPage, { kind: 'change-email' });
      page.email.setValue('new@example.test');
      await page.submit();
      await settle(fixture);
      expect(api['requestEmailChange']).toHaveBeenCalledWith('new@example.test');
      expect(text()).toContain('Check the new inbox');
    });
  });

  describe('AccountPage', () => {
    it('offers sign-in and registration when signed out', async () => {
      const { fixture, text } = render(AccountPage);
      await settle(fixture);
      expect(text()).toContain('Sign in');
      expect(text()).toContain('Create an account');
    });

    it('shows the profile, saves a trimmed name, and signs out', async () => {
      session.status.set('signed-in');
      session.user.set(testUser);
      api['updateProfile'].mockReturnValue(of({ ...testUser, displayName: 'New Name' }));
      const { fixture, page, text } = render(AccountPage);
      await settle(fixture);
      expect(text()).toContain('rider@example.test');
      expect(text()).toContain('Verified');

      page.editName('Rider');
      page.name.setValue('  New Name ');
      await page.saveName();
      expect(api['updateProfile']).toHaveBeenCalledWith('New Name');
      expect(session.setUser).toHaveBeenCalledWith({ ...testUser, displayName: 'New Name' });

      await page.signOut();
      expect(session.signOut).toHaveBeenCalled();
    });

    it('handles the name form submit in Angular (no native GET that would reload the app)', async () => {
      session.status.set('signed-in');
      session.user.set(testUser);
      api['updateProfile'].mockReturnValue(of(testUser));
      const { fixture, page } = render(AccountPage);
      page.editName('Rider');
      await settle(fixture);
      const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
      const submit = new Event('submit', { cancelable: true });
      form.dispatchEvent(submit);
      expect(submit.defaultPrevented).toBe(true);
      expect(api['updateProfile']).toHaveBeenCalledWith('Rider');
    });

    it('lets the user retry when the session could not be restored', async () => {
      session.status.set('restore-failed');
      const { fixture, text } = render(AccountPage);
      await settle(fixture);
      expect(text()).toContain('Can’t restore your session');
    });
  });

  describe('C1 auth completion', () => {
    it('rejects a damaged verification link locally without calling the API, and offers a new email', async () => {
      const { fixture, text } = render(EmailLinkPage, { kind: 'verify-email', token: 'too-short' });
      await settle(fixture);
      expect(api['verifyEmail']).not.toHaveBeenCalled();
      expect(text()).toContain('incomplete or damaged');
      expect(text()).toContain('Send a new verification email');
    });

    it('offers a new verification email when the link has expired', async () => {
      api['verifyEmail'].mockReturnValue(throwError(() => apiError(400, 'INVALID_CHALLENGE')));
      const { fixture, text } = render(EmailLinkPage, { kind: 'verify-email', token: 'v'.repeat(32) });
      await settle(fixture);
      expect(text()).toContain('Send a new verification email');
    });

    it('does not offer verification resend on a failed email-change link', async () => {
      api['confirmEmailChange'].mockReturnValue(throwError(() => apiError(400, 'INVALID_CHALLENGE')));
      const { fixture, text } = render(EmailLinkPage, { kind: 'confirm-email-change', token: 'c'.repeat(32) });
      await settle(fixture);
      expect(text()).not.toContain('Send a new verification email');
    });

    it('treats an over-long reset token as a damaged link', async () => {
      const { fixture, text } = render(PasswordPage, { kind: 'reset', token: 'x'.repeat(513) });
      await settle(fixture);
      expect(text()).toContain('Open the link from your email');
    });

    it('resend-verification page sends the trimmed email and answers generically', async () => {
      const { fixture, page, text } = render(EmailRequestPage, { kind: 'resend-verification' });
      page.email.setValue(' rider@example.test ');
      await page.submit();
      await settle(fixture);
      expect(api['resendVerification']).toHaveBeenCalledWith('rider@example.test');
      expect(text()).toContain('If that address still needs verifying');
    });

    it('explains a disabled account at sign-in (403 FORBIDDEN on login)', async () => {
      session.signIn.mockRejectedValue(apiError(403, 'FORBIDDEN'));
      const { fixture, page, text } = render(SignInPage);
      page.form.setValue({ email: 'rider@example.test', password: 'correct horse battery' });
      await page.submit();
      await settle(fixture);
      expect(text()).toContain('This account is disabled');
      expect(text()).not.toContain('Resend verification email');
    });

    it('tells the user when the server ended their session', async () => {
      session.endedByServer.set(true);
      const { fixture, text } = render(AccountPage);
      await settle(fixture);
      expect(text()).toContain('Your session ended');
      expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    });

    it('error messages are exposed to assistive technology with role="alert"', async () => {
      session.signIn.mockRejectedValue(apiError(401, 'INVALID_CREDENTIALS'));
      const { fixture, page } = render(SignInPage);
      page.form.setValue({ email: 'rider@example.test', password: 'wrong password!!' });
      await page.submit();
      await settle(fixture);
      const alerts = [...fixture.nativeElement.querySelectorAll('[role="alert"]')] as HTMLElement[];
      expect(alerts.some((el) => el.textContent?.includes('Email or password is incorrect.'))).toBe(true);
    });
  });
});
