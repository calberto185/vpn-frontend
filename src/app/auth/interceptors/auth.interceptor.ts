import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpRequest,
  HttpStatusCode,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { LoadingService } from '../../shared/services/loading.service';
import { Router } from '@angular/router';

// ── Rutas exentas de token y de retry 401 ─────────────────────────────────────
const EXEMPT_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/recover-password',
  '/auth/signup',
];

// ── Estado singleton del proceso de refresh ───────────────────────────────────
// (module-level: un único proceso de refresh por instancia de la app)
let _isRefreshing = false;
const _refreshSubject$ = new BehaviorSubject<string | null>(null);

// ── Interceptor ───────────────────────────────────────────────────────────────
export function authInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) {
  const auth   = inject(AuthService);
  const ui     = inject(LoadingService);
  const router = inject(Router);

  const isExempt = EXEMPT_PATHS.some(p => req.url.includes(p));

  // Añadir token + credenciales
  let cloned = req.clone({ withCredentials: true });
  if (!isExempt) {
    const raw = auth.token();
    if (raw) {
      const bearer = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
      cloned = cloned.clone({ setHeaders: { Authorization: bearer } });
    }
  }

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      // Solo procesar 401 en rutas no exentas
      if (error.status === 401 && !isExempt) {
        return handle401(cloned, next, auth, ui, router);
      }
      return throwError(() => error);
    })
  );
}

// ── Lógica de retry con refresh ───────────────────────────────────────────────
function handle401(
  req:    HttpRequest<unknown>,
  next:   HttpHandlerFn,
  auth:   AuthService,
  ui:     LoadingService,
  router: Router
) {
  if (!_isRefreshing) {
    // Primer 401: iniciar proceso de refresh
    _isRefreshing = true;
    _refreshSubject$.next(null);

    return auth.refreshSilent().pipe(
      switchMap(newToken => {
        _isRefreshing = false;
        _refreshSubject$.next(newToken);

        // Reintentar la petición original con el nuevo token
        const retried = req.clone({
          setHeaders: {
            Authorization: newToken.startsWith('Bearer ')
              ? newToken
              : `Bearer ${newToken}`,
          },
          withCredentials: true,
        });
        return next(retried);
      }),
      catchError((refreshErr: HttpErrorResponse) => {
        _isRefreshing = false;
        _refreshSubject$.next(null);
        // Only treat as genuine session expiry for auth failures (400/401/403)
        // 429 (rate limit) or 5xx (server error) should NOT log the user out
        const isAuthFailure = refreshErr.status === 400
          || refreshErr.status === 401
          || refreshErr.status === 403;
        if (isAuthFailure) {
          auth.logout();
          ui.showSessionExpired(() => router.navigateByUrl('/'));
        }
        return throwError(() => refreshErr);
      })
    );
  }

  // Ya hay un refresh en curso: esperar resultado y reintentar
  return _refreshSubject$.pipe(
    filter(token => token !== null),
    take(1),
    switchMap(newToken => {
      const retried = req.clone({
        setHeaders: {
          Authorization: (newToken as string).startsWith('Bearer ')
            ? (newToken as string)
            : `Bearer ${newToken}`,
        },
        withCredentials: true,
      });
      return next(retried);
    })
  );
}
