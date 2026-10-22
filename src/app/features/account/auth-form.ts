import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

// Client-side checks mirror the Agent A request schemas; the server remains the authority.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Checks the trimmed value: phone keyboards and autofill often add a trailing space. */
function emailShape(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  return !value || (value.length <= 254 && EMAIL_PATTERN.test(value)) ? null : { email: true };
}

export const emailValidators = [Validators.required, emailShape];
export const passwordValidators = [Validators.required, Validators.minLength(12), Validators.maxLength(128)];
export const displayNameValidators = [Validators.required, Validators.maxLength(120)];

export const EMAIL_ERROR = 'Enter a valid email address.';
export const PASSWORD_ERROR = 'Use 12 to 128 characters.';

/** Group validator: `confirm` must equal `field`. */
export function matching(field: string, confirm: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null =>
    group.get(field)?.value === group.get(confirm)?.value ? null : { mismatch: true };
}

/** Emailed challenge tokens are 20–512 characters (Agent A contract); anything else is a damaged link. */
export function isPlausibleToken(token: string | undefined | null): token is string {
  return typeof token === 'string' && token.length >= 20 && token.length <= 512;
}

/** Trimmed string values; passwords are left untouched. */
export function trimmed(value: string): string {
  return value.trim();
}
