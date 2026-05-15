import { AfterViewInit, Component, DoCheck, inject, NgZone, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import AdminEntity from '../../interfaces/auth-user.interface';
import { CountryEntity } from '../../interfaces/country.interface';
import { environment } from '../../../../environments/environment';
import AdminTelephoneDto from '../../interfaces/AdminTelephone.interface';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

@Component({
  selector: 'app-register-page',
  imports: [RouterLink, ReactiveFormsModule, TranslatePipe],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.css'
})
export class RegisterPageComponent implements AfterViewInit, OnInit, DoCheck {

  fb = inject(FormBuilder);
  hasError = signal('');
  isPosting = signal(false);
  isSuccess = signal(false);
  showPassword = signal(false);
  selectedCountry = signal(new CountryEntity());
  toggleDropdown = signal(false);
  ngZone = inject(NgZone);
  ListCountries = signal<CountryEntity[]>([]);

  authService = inject(AuthService);
  router = inject(Router);

  loginForm = this.fb.group({
    firstNames: ['', [Validators.required,]],
    lastNames: ['', [Validators.required,]],
    // dni: ['', [Validators.required, ]],
    telephone: ['', [Validators.required,]],
    country: ['', [Validators.required,]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  })
  ngOnInit(): void {
    // Exponemos el callback global para reCAPTCHA
    (window as any).onSubmitRecaptcha = this.onSubmitRecaptcha.bind(this);
    // Exponemos también el callback del "onload" global
    (window as any).onRecaptchaLoad = this.onRecaptchaLoad.bind(this);
    this.fillListCountries();
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
   ngDoCheck(): void {
    // if(!!this.toggleDropdown()) {

    // this.toggleDropdown.set(false)
    // }
  }
  fillListCountries() {
    this.authService.getAllCountries().subscribe((resp) => {
      this.ListCountries.set(resp.data ?? []);
    });
  }
  // RECAPCHA
  onSubmitRecaptcha(token: string) {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.hasError.set('Por favor completa todos los campos correctamente.');
      setTimeout(() => { this.hasError.set(''); }, 3000);
      (window as any).grecaptcha?.reset();
      return;
    }
    const data = this.loginForm.value;
    const dataToSave = new AdminEntity();
    dataToSave.set(data);
    const modelPhone = new AdminTelephoneDto();
    modelPhone.countryCode = this.selectedCountry().countryCode;
    modelPhone.countryName = this.selectedCountry().countryName;
    modelPhone.flag = this.selectedCountry().flag;
    modelPhone.phoneCode = this.selectedCountry().phoneCode;
    modelPhone.isActive = true;
    modelPhone.phone = data.telephone || "";
    dataToSave.telephone = modelPhone?.phone ? [modelPhone] : [];

    this.isPosting.set(true);
    this.authService.register(dataToSave.get(), token).subscribe({
      next: (resp) => {
        if (resp?.error || resp?.status >= 400) {
          this.isPosting.set(false);
          this.isSuccess.set(false);
          this.hasError.set(resp?.error?.message ?? 'Error al crear la cuenta. Inténtalo de nuevo.');
          setTimeout(() => { this.hasError.set(''); }, 4000);
          (window as any).grecaptcha?.reset();
          return;
        }
        this.isSuccess.set(true);
        this.authService.login({ email: dataToSave.email, password: dataToSave.password, recaptcha: token }).subscribe({
          next: (loginResp) => {
            this.isPosting.set(false);
            if (loginResp?.error?.message || loginResp?.status >= 400) {
              this.hasError.set(loginResp?.error?.message ?? 'Cuenta creada, pero ocurrió un error al iniciar sesión.');
              setTimeout(() => { this.hasError.set(''); }, 4000);
              (window as any).grecaptcha?.reset();
              return;
            }
            this.router.navigateByUrl('/client');
          },
          error: (err) => {
            this.isPosting.set(false);
            this.hasError.set(err?.error?.message ?? 'Cuenta creada, pero ocurrió un error al iniciar sesión.');
            setTimeout(() => { this.hasError.set(''); }, 4000);
            (window as any).grecaptcha?.reset();
          }
        });
      },
      error: (err) => {
        this.isPosting.set(false);
        this.isSuccess.set(false);
        this.hasError.set(err?.error?.message ?? 'Error al crear la cuenta. Inténtalo de nuevo.');
        setTimeout(() => { this.hasError.set(''); }, 4000);
        (window as any).grecaptcha?.reset();
      }
    });

    this.selectedCountry = signal(new CountryEntity());
  }

  onRecaptchaLoad() {
    this.renderRecaptcha();
  }

  renderRecaptcha() {
    const grecaptcha = (window as any).grecaptcha;
    if (!grecaptcha) return;
    grecaptcha.ready(() => {
      grecaptcha.render('recaptcha-button-create', {
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
      document.getElementById('googleButtonDiv_signup'),
      { theme: 'outline', size: 'large', text: 'signup_with' }
    );

    // Opcional: desactiva auto login
    (window as any).google.accounts.id.disableAutoSelect();
  }

  handleCredentialResponse(response: any) {
    this.isPosting.set(true);
    this.authService.registerGoogle({ jwt: response.credential }).subscribe({
      next: (resp) => {
        if (resp?.error?.message || resp?.status >= 400) {
          this.isPosting.set(false);
          this.hasError.set(resp?.error?.message ?? 'Error al registrarse con Google.');
          setTimeout(() => { this.hasError.set(''); }, 4000);
          return;
        }
        this.authService.loginGoogle({ jwt: response.credential }).subscribe({
          next: (loginResp) => {
            this.isPosting.set(false);
            if (loginResp?.error?.message || loginResp?.status >= 400) {
              this.hasError.set(loginResp?.error?.message ?? 'Error al iniciar sesión con Google.');
              setTimeout(() => { this.hasError.set(''); }, 4000);
              return;
            }
            this.router.navigateByUrl('/client');
          },
          error: (err) => {
            this.isPosting.set(false);
            this.hasError.set(err?.error?.message ?? 'Error al iniciar sesión con Google.');
            setTimeout(() => { this.hasError.set(''); }, 4000);
          }
        });
      },
      error: (err) => {
        this.isPosting.set(false);
        this.hasError.set(err?.error?.message ?? 'Error al registrarse con Google.');
        setTimeout(() => { this.hasError.set(''); }, 4000);
      }
    });
  }
  changeCountry(selected: CountryEntity | any) {
    this.selectedCountry.set(selected);
    this.toggleDropdown.set(false)
  }
}
