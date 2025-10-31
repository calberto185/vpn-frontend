import { AfterViewInit, Component, inject, NgZone, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-resetearpassword-page',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './resetearpassword-page.component.html',
  styleUrl: './resetearpassword-page.component.css'
})
export class ResetearpasswordPageComponent implements AfterViewInit, OnInit {
  fb = inject(FormBuilder);
  hasError = signal(false);
  isPosting = signal(false);
  isSuccess = signal(false);
  ngZone = inject(NgZone);

  authService = inject(AuthService);

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    // code: ['', [ Validators.required]],
    // password: ['', [Validators.required]],
  })
  ngOnInit(): void {
    // Exponemos el callback global para reCAPTCHA
    (window as any).onSubmitRecaptcha = this.onSubmitRecaptcha.bind(this);
    // Exponemos también el callback del "onload" global
    (window as any).onRecaptchaLoad = this.onRecaptchaLoad.bind(this);
  }
     ngAfterViewInit(): void {
    // Asegura que la librería de Google ya cargó
    const interval = setInterval(() => {
      if ((window as any).google && (window as any).google.accounts) {
        clearInterval(interval);
      }
      if ((window as any).grecaptcha && (window as any).grecaptcha.render) {
        this.renderRecaptcha();
      }
    }, 100);
  }
  // RECAPCHA
  onSubmitRecaptcha(token: string) {

    //   if(this.loginForm.invalid) {
    //     this.hasError.set(true);
    //     setTimeout(() => {
    //       this.hasError.set(false);
    //     }, 3000);
    //     return;
    //   }
    //   const data = this.loginForm.value;
    //   const dataToSave = new AdminEntity();
    //   dataToSave.set(data);
    //   this.authService.register(dataToSave.get(), token).subscribe({
    //   next: () => {
    //     this.isSuccess.set(true);
    //   },
    //   error: () => {
    //     this.isSuccess.set(false);
    //     this.hasError.set(true);
    //   }
    // });


    if (this.loginForm.invalid) {
      this.hasError.set(true);
      setTimeout(() => {
        this.hasError.set(false);
      }, 3000);
      return;
    }
    const { email = '' } = this.loginForm.value;
    this.authService.resetPassword({ email, recaptcha: token }).subscribe({
      next: () => {
        this.isSuccess.set(true);
      },
      error: () => {
        this.isSuccess.set(false);
        this.hasError.set(true);
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
      grecaptcha.render('recaptcha-button-reset', {
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

}
