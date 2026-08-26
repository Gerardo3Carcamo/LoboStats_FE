import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const uadecEmailValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  return /^[^\s@]+@uadec\.edu\.mx$/i.test(value) ? null : { uadecEmail: true };
};

export const strongPasswordValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  return value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)
    ? null
    : { strongPassword: true };
};

export const passwordsMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmation = control.get('passwordConfirmation')?.value;
  return password === confirmation ? null : { passwordsMismatch: true };
};
