import { FormControl, FormGroup } from '@angular/forms';
import { passwordsMatchValidator, strongPasswordValidator, uadecEmailValidator } from './auth.validators';

describe('auth validators', () => {
  it('only accepts the exact UAdeC domain ignoring case', () => {
    expect(uadecEmailValidator(new FormControl('alumna@UADEC.EDU.MX'))).toBeNull();
    expect(uadecEmailValidator(new FormControl('alumna@sub.uadec.edu.mx'))).toEqual({ uadecEmail: true });
    expect(uadecEmailValidator(new FormControl('alumna@uadec.edu.mx.example'))).toEqual({ uadecEmail: true });
  });

  it('requires 12 characters, upper and lower case, and a number', () => {
    expect(strongPasswordValidator(new FormControl('ClaveSegura12'))).toBeNull();
    expect(strongPasswordValidator(new FormControl('clavesegura12'))).toEqual({ strongPassword: true });
    expect(strongPasswordValidator(new FormControl('Clave1'))).toEqual({ strongPassword: true });
  });

  it('compares password confirmation', () => {
    const form = new FormGroup({
      password: new FormControl('ClaveSegura12'),
      passwordConfirmation: new FormControl('otra'),
    });
    expect(passwordsMatchValidator(form)).toEqual({ passwordsMismatch: true });
    form.controls.passwordConfirmation.setValue('ClaveSegura12');
    expect(passwordsMatchValidator(form)).toBeNull();
  });
});
