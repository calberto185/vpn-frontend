import { AfterViewInit, Component, inject, NgZone, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../../environments/environment';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
declare var grecaptcha: any;

@Component({
  selector: 'app-login-page',
  imports: [RouterLink, ReactiveFormsModule, TranslatePipe],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css'
})
export class LoginPageComponent implements AfterViewInit, OnInit {
  fb = inject(FormBuilder);
  hasError = signal("");
  isPosting = signal(false);
  showPassword = signal(false);
  router = inject(Router);
  ngZone = inject(NgZone);

  authService = inject(AuthService);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email ]],
    password: ['', [Validators.required, Validators.minLength(8) ]],
  })


  ngOnInit() {
    // Exponemos el callback global para reCAPTCHA
    (window as any).onSubmitRecaptcha = this.onSubmitRecaptcha.bind(this);
    // Exponemos también el callback del "onload" global
    (window as any).onRecaptchaLoad = this.onRecaptchaLoad.bind(this);
  }

  ngAfterViewInit(): void {
    // Asegura que la librería de Google ya cargó
    const interval = setInterval(() => {
      if ((window as any).google && (window as any).google.accounts) {
        this.renderGoogleButton();
        clearInterval(interval);
      }
      if ((window as any).grecaptcha && (window as any).grecaptcha.render) {
        this.renderRecaptcha();
      }
    }, 100);
  }
// RECAPCHA
  onSubmitRecaptcha(token: string) {
    if(this.loginForm.invalid) {
      this.hasError.set("Formulario inválido, revisa los campos.");
      setTimeout(() => { this.hasError.set(""); }, 3000);
      (window as any).grecaptcha?.reset();
      return;
    }
    const { email = '', password = '', } = this.loginForm.value;
    this.isPosting.set(true);
    this.authService.login({email, password, recaptcha: token}).subscribe({
      next: (resp) => {
        this.isPosting.set(false);
        if(resp?.error?.message || resp?.status >= 400) {
          this.hasError.set(resp?.error?.message ?? 'Credenciales incorrectas.');
          setTimeout(() => { this.hasError.set(""); }, 4000);
          (window as any).grecaptcha?.reset();
          return;
        }
        this.redirectAfterLogin();
      },
      error: (err) => {
        this.isPosting.set(false);
        this.hasError.set(err?.error?.message ?? 'Credenciales incorrectas.');
        setTimeout(() => { this.hasError.set(""); }, 4000);
        (window as any).grecaptcha?.reset();
      }
    });
  }

  onRecaptchaLoad() {
    this.renderRecaptcha();
  }

  renderRecaptcha() {
    const grecaptcha = (window as any).grecaptcha;
    if (!grecaptcha) return;
    grecaptcha.ready(() => {
      grecaptcha.render('recaptcha-button', {
        sitekey: environment.google_recapcha,
        size: 'invisible',
        callback: (token: string) => this.ngZone.run(() => this.onSubmitRecaptcha(token)),
      });
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    const grecaptcha = (window as any).grecaptcha;
    if (grecaptcha) {
      grecaptcha.execute();
    }
  }

  // AUTHENTICACION CON GOOGLE
  renderGoogleButton() {
    (window as any).google.accounts.id.initialize({
      client_id: environment.google_client_id,
      callback: this.handleCredentialResponse.bind(this)
    });

    (window as any).google.accounts.id.renderButton(
      document.getElementById('googleButtonDiv_login'),
      { theme: 'outline', size: 'large', text: 'signin_with' }
    );

    // Opcional: desactiva auto login
    (window as any).google.accounts.id.disableAutoSelect();
  }

  /** Redirige al módulo correcto según el rol del usuario */
  private redirectAfterLogin() {
    const role = this.authService.role()?.toLowerCase() ?? null;
    const isPanelUser = role !== null && role !== '' && role !== 'client';
    this.router.navigateByUrl(isPanelUser ? '/panel' : '/client');
  }

  handleCredentialResponse(response: any) {
    this.isPosting.set(true);
    this.authService.loginGoogle({jwt: response.credential}).subscribe({
      next: (resp) => {
        this.isPosting.set(false);
        if(resp?.error?.message || resp?.status >= 400) {
          this.hasError.set(resp?.error?.message ?? 'Error al iniciar sesión con Google.');
          setTimeout(() => { this.hasError.set(""); }, 4000);
          return;
        }
        this.redirectAfterLogin();
      },
      error: (err) => {
        this.isPosting.set(false);
        this.hasError.set(err?.error?.message ?? 'Error al iniciar sesión con Google.');
        setTimeout(() => { this.hasError.set(""); }, 4000);
      }
    });
  }

}
