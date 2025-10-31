import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { User } from '../interfaces/auth-reponse.interface';
import AdminEntity from '../interfaces/auth-user.interface';
import { rxResource } from '@angular/core/rxjs-interop';
import { ResponseEntity } from '../../shared/interfaces/reponse.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../environments/environment'
import { CountryEntity } from '../interfaces/country.interface';
import { LoadingService } from '../../shared/services/loading.service';
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class AuthService {
  private _authStatus = signal<AuthStatus>('checking');
  private _user = signal<User|null>(null);
  private _Admin = signal<boolean>(false);
  private _Role = signal<string | null>(null);
  private _token = signal<string | null>(localStorage.getItem('access_token'));
  private loadingService = inject(LoadingService);

  private http = inject(HttpClient);

  checkStatusResource = rxResource({
    loader: () => {
      return this.checkStatus() }
  })

  authStatus = computed<AuthStatus>(() => {
    if(this._authStatus() == 'checking') return 'checking';
    if(this._user()) return 'authenticated';
    return 'not-authenticated';
  })

  user = computed(() => this._user())
  token = computed(() => this._token())
  isAdmin = computed(() => this._Admin());
  role = computed(() => this._Role());

  login(params: any): Observable<any> {
    this.loadingService.show();
    const {email = '', password = ''} = params;
    return this.http.post<any>(baseUrl+'/auth/login', {
      ...params
    }).pipe(
      tap((resp) => this.handlerAuthSuccess(resp)),
      map(() => true),
      catchError((error) => {
        this.loadingService.showError('Error al iniciar sesión', error?.error?.message || 'Ocurrió un error inesperado.', (err: any) => { });
        return this.handlerAuthError(error)
      }),
      tap(() => this.loadingService.hide())
    )
  }
  loginGoogle(params: any): Observable<any> {
    this.loadingService.show();
    const {jwt = ''} = params;
    return this.http.post<any>(baseUrl+'/auth/login/google', {
      jwt
    }).pipe(
      tap((resp) => this.handlerAuthSuccess(resp)),
      map(() => true),
      catchError((error) => {
        this.loadingService.showError('Error con Google', error?.error?.message || 'No se pudo iniciar sesión con Google.', (err: any) => {});
        return this.handlerAuthError(error);
      }),
      tap(() => this.loadingService.hide())
    )
  }

  register(data: AdminEntity, recaptcha: string) {
    this.loadingService.show();
    return this.http.post<any>(`${baseUrl}/auth/signup`, { ...data, recaptcha }).pipe(
      tap(() => this.loadingService.hide()),
      catchError((error) => {
        this.loadingService.showError('Error de registro', error?.error?.message || 'No se pudo crear la cuenta.', (err: any) => {});
        this.loadingService.hide();
        return of(error);
      })
    );
  }
  registerGoogle(data: any) {
    this.loadingService.show();
    const {jwt = ''} = data;
    return this.http.post<any>(`${baseUrl}/auth/signup/google`, { jwt }).pipe(
      tap(() => this.loadingService.hide()),
      catchError((error) => {
        this.loadingService.showError('Error de registro', error?.error?.message || 'No se pudo crear la cuenta.', (err: any) => {});
        this.loadingService.hide();
        return of(error);
      })
    );
  }

  resetPassword(params: any) {
    this.loadingService.show();
    return this.http.post<any>(`${baseUrl}/auth/recover-password`, params).pipe(
      tap(() => this.loadingService.hide()),
      catchError((error) => {
        this.loadingService.showError('Error al recuperar contraseña', error?.error?.message || 'No se pudo enviar el correo.', (err: any) => {});
        this.loadingService.hide();
        return of(error);
      })
    );
  }
  async logout() {
    this._user.set(null);
    this._Admin.set(false)
    this._Role.set(null)
    this._authStatus.set('not-authenticated');
    this._token.set(null);
    localStorage.removeItem('access_token');
    this.loadingService.clearError();
    await this.http.post<any>(baseUrl+'/auth/logout', {}).subscribe((resp) => {});
  }
  checkStatus(): Observable<any> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      // this.loadingService.showError('Sesión expirada', 'Inicia sesión nuevamente.', (err: any) => {
      //   console.log("final 1 1")
      //   this.logout();
      //   this.loadingService.hide()
      // });
      return of(false);
    }

    this.loadingService.show();

    return this.http.post(`${baseUrl}/auth/refresh`, {}, { withCredentials: true }).pipe(
      tap((resp: any) => this.handlerAuthSuccess(resp)),
      map(() => true),
      catchError((error) => {
        this.loadingService.showError('Error de autenticación', error?.error?.message || 'Token inválido o expirado.', (err: any) => {
          this.logout();
          this.loadingService.hide()
        });
        return this.handlerAuthError(error);
      }),
      tap(() => {
          this.loadingService.hide()
      })
    );
  }

  private handlerAuthSuccess(resp: ResponseEntity<any>) {
    this._user.set(resp?.data?.user);
    this._authStatus.set('authenticated');
    this._token.set(resp?.data?.access_token);
    this._Admin.set(resp.data?.user?.role.toLowerCase()  === "admin" ? true :  false)
    this._Role.set(resp.data?.user?.role.toLowerCase())
    localStorage.setItem('access_token', resp.data.access_token);
    this.loadingService.clearError();
    return resp;
  }

  private handlerAuthError(error: any) {
    this.logout();
    this.loadingService.hide();
    return of(error)
  }
  getAllCountries(): Observable<ResponseEntity<CountryEntity[]>> {
   this.loadingService.show();

    return this.http.get<ResponseEntity<CountryEntity[]>>(`${baseUrl}/countries`).pipe(
      tap(() => this.loadingService.hide()),
      catchError((error) => {
        this.loadingService.showError('Error al cargar países', 'No se pudieron obtener los datos.', (err: any) => {});
        this.loadingService.hide();
        return of(error);
      })
    );
  }
}
