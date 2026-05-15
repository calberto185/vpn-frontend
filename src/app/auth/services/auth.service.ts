import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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
import { PermissionsService } from '../../admin-dashboard/services/permissions/permissions.service';
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class AuthService {
  private _authStatus = signal<AuthStatus>('checking');
  private _user = signal<User|null>(null);
  private _Admin = signal<boolean>(false);
  private _Role = signal<string | null>(null);
  private _token = signal<string | null>(localStorage.getItem('access_token'));
  private loadingService  = inject(LoadingService);
  private permissionsService = inject(PermissionsService);

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
    return this.http.post<any>(baseUrl + '/auth/login', { ...params }).pipe(
      tap((resp) => this.handlerAuthSuccess(resp)),
      map(() => true),
      catchError((error) => this.handlerAuthError(error)),
      tap(() => this.loadingService.hide())
    );
  }

  loginGoogle(params: any): Observable<any> {
    this.loadingService.show();
    const { jwt = '' } = params;
    return this.http.post<any>(baseUrl + '/auth/login/google', { jwt }).pipe(
      tap((resp) => this.handlerAuthSuccess(resp)),
      map(() => true),
      catchError((error) => this.handlerAuthError(error)),
      tap(() => this.loadingService.hide())
    );
  }

  register(data: AdminEntity, recaptcha: string) {
    this.loadingService.show();
    return this.http.post<any>(`${baseUrl}/auth/signup`, { ...data, recaptcha }).pipe(
      tap(() => this.loadingService.hide()),
      catchError((error) => {
        this.loadingService.hide();
        return of(error);
      })
    );
  }

  registerGoogle(data: any) {
    this.loadingService.show();
    const { jwt = '' } = data;
    return this.http.post<any>(`${baseUrl}/auth/signup/google`, { jwt }).pipe(
      tap(() => this.loadingService.hide()),
      catchError((error) => {
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
        this.loadingService.hide();
        return of(error);
      })
    );
  }
  async logout() {
    this._user.set(null);
    this._Admin.set(false);
    this._Role.set(null);
    this._authStatus.set('not-authenticated');
    this._token.set(null);
    localStorage.removeItem('access_token');
    this.permissionsService.clear();
    this.http.post<any>(baseUrl + '/auth/logout', {}).subscribe();
  }
  checkStatus(): Observable<any> {
    const token = localStorage.getItem('access_token');
    if (!token) {
      this._authStatus.set('not-authenticated');
      return of(false);
    }

    this.loadingService.show();

    return this.http.post(`${baseUrl}/auth/refresh`, {}, { withCredentials: true }).pipe(
      tap((resp: any) => this.handlerAuthSuccess(resp)),
      map(() => true),
      catchError((error: HttpErrorResponse) => {
        this.loadingService.hide();
        const isAuthFailure = error.status === 400 || error.status === 401 || error.status === 403;
        if (isAuthFailure) {
          this._authStatus.set('not-authenticated');
          this._user.set(null);
          this._token.set(null);
          localStorage.removeItem('access_token');
          this.permissionsService.clear();
          this.loadingService.showSessionExpired(() => {
            this.loadingService.clearError();
            window.location.href = '/';
          });
        }
        return of(false);
      }),
      tap(() => this.loadingService.hide())
    );
  }

  /**
   * Used by route guards.
   * Calls checkStatus() only on the first load (when authStatus is still 'checking').
   * On subsequent navigations it returns the cached in-memory state immediately,
   * avoiding a POST /auth/refresh on every route change.
   */
  ensureAuthChecked(): Observable<boolean> {
    if (this._authStatus() !== 'checking') {
      return of(this._authStatus() === 'authenticated');
    }
    return this.checkStatus();
  }

  /**
   * Intenta renovar el access_token usando el refresh_token HttpOnly.
   * Llamado por el interceptor ante errores 401 — sin spinners ni overlays.
   */
  refreshSilent(): Observable<string> {
    return this.http.post<any>(`${baseUrl}/auth/refresh`, {}, { withCredentials: true }).pipe(
      tap(resp => {
        const token = resp?.data?.access_token;
        if (token) {
          this._token.set(token);
          this._user.set(resp?.data?.user);
          this._authStatus.set('authenticated');
          this._Admin.set(resp.data?.user?.role?.toLowerCase() === 'admin');
          this._Role.set(resp.data?.user?.role?.toLowerCase() ?? null);
          localStorage.setItem('access_token', token);
        }
      }),
      map(resp => resp?.data?.access_token as string)
    );
  }

  private handlerAuthSuccess(resp: ResponseEntity<any>) {
    this._user.set(resp?.data?.user);
    this._authStatus.set('authenticated');
    this._token.set(resp?.data?.access_token);
    this._Admin.set(resp.data?.user?.role.toLowerCase()  === "admin" ? true :  false)
    const role = resp.data?.user?.role?.toLowerCase() ?? null;
    this._Role.set(role);
    localStorage.setItem('access_token', resp.data.access_token);
    this.loadingService.clearError();
    // Pre-load permissions for non-admin panel roles
    if (role && role !== 'client') {
      this.permissionsService.load(role);
    }
    return resp;
  }

  private handlerAuthError(error: any) {
    this._authStatus.set('not-authenticated');
    this._user.set(null);
    this._token.set(null);
    localStorage.removeItem('access_token');
    this.loadingService.hide();
    return of(error);
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
