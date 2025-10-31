// auth.interceptor.ts (funcional)
import { HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

const EXEMPT_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/recover-password'
];

export function authInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn) {
  const auth = inject(AuthService);

  // Siempre enviamos cookies (para refresh_token HttpOnly)
  let cloned = req.clone({ withCredentials: true });

  // Evitar Authorization en rutas exentas
  const isExempt = EXEMPT_PATHS.some(p => cloned.url.includes(p));

  if (!isExempt) {
    const raw = auth.token(); // tu método actual
    if (raw) {
      const bearer = raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
      cloned = cloned.clone({
        setHeaders: { Authorization: bearer }
      });
    }
  }

  return next(cloned);
}
