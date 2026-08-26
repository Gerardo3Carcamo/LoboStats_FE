import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-verify',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './verify.component.html',
  styleUrl: './auth-form.scss',
})
export class VerifyComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly email = this.route.snapshot.queryParamMap.get('email')
    ?? sessionStorage.getItem('pendingVerificationEmail')
    ?? '';
  protected readonly submitting = signal(false);
  protected readonly resending = signal(false);
  protected readonly cooldown = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly form = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{6}$/)] }),
  });
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    this.destroyRef.onDestroy(() => clearInterval(this.timer));
  }

  protected submit(): void {
    if (!this.email) {
      this.error.set('No encontramos el correo por verificar. Regresa al registro.');
      return;
    }
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    this.auth.verify(this.email, this.form.controls.code.value).pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: () => {
        sessionStorage.removeItem('pendingVerificationEmail');
        void this.router.navigate(['/login'], { queryParams: { verified: 1 } });
      },
      error: (error: Error) => this.error.set(error.message),
    });
  }

  protected resend(): void {
    if (!this.email || this.resending() || this.cooldown()) return;
    this.error.set(null);
    this.message.set(null);
    this.resending.set(true);
    this.auth.resendCode(this.email).pipe(finalize(() => this.resending.set(false))).subscribe({
      next: () => {
        this.message.set('Enviamos un código nuevo a tu correo.');
        this.startCooldown();
      },
      error: (error: Error) => this.error.set(error.message),
    });
  }

  private startCooldown(): void {
    this.cooldown.set(60);
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.cooldown.update((seconds) => Math.max(0, seconds - 1));
      if (!this.cooldown()) clearInterval(this.timer);
    }, 1000);
  }
}
