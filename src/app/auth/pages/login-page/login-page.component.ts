import { AfterViewInit, Component, inject, NgZone, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../../environments/environment';
declare var grecaptcha: any;

@Component({
  selector: 'app-login-page',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.css'
})
export class LoginPageComponent implements AfterViewInit, OnInit {
  fb = inject(FormBuilder);
  hasError = signal("");
  isPosting = signal(false);
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
      this.hasError.set("Formulario invalido");
      setTimeout(() => {
        this.hasError.set("");
      }, 3000);
      return;
    }
    const { email = '', password = '', } = this.loginForm.value;
    this.authService.login({email, password, recaptcha: token}).subscribe((resp) => {
        if(resp?.error?.message) {
          this.hasError.set(resp?.error?.message)
          setTimeout(() => {
          this.hasError.set("")
          }, 4000);
          return;
        }
        // this.router.navigateByUrl('/');
        this.router.navigateByUrl('/client');
        // this.router.navigateByUrl('/panel/dashboard');
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
    const grecaptcha = (window as any).grecaptcha;
    if (grecaptcha) {
      grecaptcha.execute(); // Ejecuta el reCAPTCHA invisible
    } else {
      console.error('❌ grecaptcha no está inicializado');
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

  handleCredentialResponse(response: any) {
     this.authService.loginGoogle({jwt: response.credential}).subscribe((resp) => {
        if(resp?.error?.message) {
          this.hasError.set(resp?.error?.message)
          setTimeout(() => {
          this.hasError.set("")
          }, 4000);
          return;
        }
        this.router.navigateByUrl('/client');
    });
  }

}
