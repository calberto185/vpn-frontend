import { AfterViewInit, Component, DoCheck, inject, NgZone, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import AdminEntity from '../../interfaces/auth-user.interface';
import { CountryEntity } from '../../interfaces/country.interface';
import { environment } from '../../../../environments/environment';
import AdminTelephoneDto from '../../interfaces/AdminTelephone.interface';

@Component({
  selector: 'app-register-page',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.css'
})
export class RegisterPageComponent implements AfterViewInit, OnInit, DoCheck {

  fb = inject(FormBuilder);
  hasError = signal(false);
  isPosting = signal(false);
  isSuccess = signal(false);
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
      console.log("resp countries: ", resp)
      this.ListCountries.set(resp.data ?? [])
    })
  }
  // RECAPCHA
  onSubmitRecaptcha(token: string) {

    if (this.loginForm.invalid) {
      this.hasError.set(true);
      setTimeout(() => {
        this.hasError.set(false);
      }, 3000);
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
    dataToSave.telephone = modelPhone?.phone ? [modelPhone] : []
    this.authService.register(dataToSave.get(), token).subscribe({
      next: () => {
        this.isSuccess.set(true);
        this.authService.login({ email: dataToSave.email, password: dataToSave.password, recaptcha: token }).subscribe((resp) => {
          if (resp?.error?.message) {
            this.hasError.set(resp?.error?.message)
            setTimeout(() => {
              this.hasError.set(false)
            }, 4000);
            return;
          }
          // this.router.navigateByUrl('/');
          this.router.navigateByUrl('/client');
          // this.router.navigateByUrl('/panel/dashboard');
        });
      },
      error: () => {
        this.isSuccess.set(false);
        this.hasError.set(true);
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
      document.getElementById('googleButtonDiv_signup'),
      { theme: 'outline', size: 'large', text: 'signup_with' }
    );

    // Opcional: desactiva auto login
    (window as any).google.accounts.id.disableAutoSelect();
  }

  handleCredentialResponse(response: any) {
    this.authService.registerGoogle({ jwt: response.credential, }).subscribe((resp) => {
      if (resp?.error?.message) {
        this.hasError.set(resp?.error?.message)
        setTimeout(() => {
          this.hasError.set(false)
        }, 4000);
        return;
      }
      this.authService.loginGoogle({ jwt: response.credential }).subscribe((resp) => {
        if (resp?.error?.message) {
          this.hasError.set(resp?.error?.message)
          setTimeout(() => {
            this.hasError.set(false)
          }, 4000);
          return;
        }
        this.router.navigateByUrl('/client');
      });
    });
  }
  changeCountry(selected: CountryEntity | any) {
    this.selectedCountry.set(selected);
    this.toggleDropdown.set(false)
  }
}
