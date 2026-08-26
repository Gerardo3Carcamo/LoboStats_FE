import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { passwordsMatchValidator, strongPasswordValidator, uadecEmailValidator } from '../../core/auth/auth.validators';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './auth-form.scss',
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, uadecEmailValidator] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, strongPasswordValidator] }),
    passwordConfirmation: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  }, { validators: passwordsMatchValidator });

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const email = value.email.trim().toLowerCase();
    this.error.set(null);
    this.submitting.set(true);
    this.auth.register({ full_name: value.fullName.trim(), email, password: value.password })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => {
          sessionStorage.setItem('pendingVerificationEmail', email);
          void this.router.navigate(['/verificar'], { queryParams: { email } });
        },
        error: (error: Error) => this.error.set(error.message),
      });
  }
}
