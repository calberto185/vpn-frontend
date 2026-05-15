/**
 * error.interceptor.ts
 *
 * Intercepta TODOS los errores HTTP y los mapea a la UI:
 *
 *  ┌──────────────┬──────────────────────────────────┬──────────────────────┐
 *  │ Código       │ Tipo                             │ UX                   │
 *  ├──────────────┼──────────────────────────────────┼──────────────────────┤
 *  │ 0 / network  │ network                          │ Pantalla completa    │
 *  │ 401          │ manejado por auth.interceptor    │ (ignorado aquí)      │
 *  │ 403          │ forbidden                        │ Pantalla completa    │
 *  │ 404          │ notfound                         │ Toast warning        │
 *  │ 400 / 409    │ —                                │ Toast warning        │
 *  │ 422          │ —                                │ Toast warning        │
 *  │ 429          │ —                                │ Toast warning        │
 *  │ 500+         │ server                           │ Pantalla completa    │
 *  └──────────────┴──────────────────────────────────┴──────────────────────┘
 *
 * El error siempre se re-lanza para que los componentes puedan opcionalmente
 * añadir su propio manejo adicional.
 */

import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { LoadingService } from '../services/loading.service';

// Rutas que gestionan sus propios errores — el interceptor NO muestra toast ni pantalla completa
const SILENT_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/refresh',
  '/auth/recover-password',
  '/auth/logout',
  // Infrastructure calls that self-recover via catchError in LocaleService
  '/api/languages',
  '/api/translations',
];

/**
 * API paths that belong to the client module.
 * A 403 on these paths means the user lacks a role/permission for that specific resource,
 * but it should NOT block the entire screen — the component will show empty state instead.
 * Admin panel paths (e.g. /admin/, /system/bankaccount) continue to show the full-screen error.
 */
const CLIENT_MODULE_API_PATHS = [
  '/client/',
  '/messages/client',
  '/payments/client',
  '/devices/client',
  '/system/client',
];

export function errorInterceptor(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) {
  const ui = inject(LoadingService);

  const isSilent        = SILENT_PATHS.some(p => req.url.includes(p));
  const isClientModule  = CLIENT_MODULE_API_PATHS.some(p => req.url.includes(p));

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {

      // Rutas de auth manejan sus propios errores con el LoadingService directamente
      if (isSilent) return throwError(() => error);

      // 401 ya manejado por authInterceptor
      if (error.status === 401) return throwError(() => error);

      if (error.status === 0 || error.statusText === 'Unknown Error') {
        // Sin conexión o timeout
        ui.showTypedError({
          type:        'network',
          title:       'Sin conexión',
          message:     'No se pudo conectar al servidor. Verifica tu conexión a internet e inténtalo de nuevo.',
          actionLabel: 'Reintentar',
          action:      () => { window.location.reload(); },
        });
        return throwError(() => error);
      }

      if (error.status === 403) {
        if (isClientModule) {
          // Client module: the 403 is a data-level restriction, not a page-level access denial.
          // Silently rethrow so the component renders with empty/partial data instead of a
          // full-screen error that blocks the entire UI.
          return throwError(() => error);
        }
        // Admin panel: show full-screen forbidden error
        ui.showTypedError({
          type:        'forbidden',
          title:       'Acceso denegado',
          message:     extractMessage(error, 'No tienes permisos para realizar esta acción.'),
          actionLabel: 'Volver',
          action:      () => { ui.clearError(); },
        });
        return throwError(() => error);
      }

      if (error.status === 404) {
        ui.warn(
          'No encontrado',
          extractMessage(error, 'El recurso solicitado no existe o fue eliminado.')
        );
        return throwError(() => error);
      }

      if (error.status === 400 || error.status === 409 || error.status === 422) {
        ui.warn(
          errorStatusLabel(error.status),
          extractMessage(error, 'Revisa los datos ingresados e intenta de nuevo.')
        );
        return throwError(() => error);
      }

      if (error.status === 429) {
        ui.warn(
          'Demasiadas solicitudes',
          'Has realizado muchas acciones seguidas. Espera un momento antes de continuar.'
        );
        return throwError(() => error);
      }

      if (error.status >= 500) {
        ui.showTypedError({
          type:        'server',
          title:       'Error en el servidor',
          message:     'Ocurrió un problema interno. Nuestro equipo ha sido notificado. Por favor, inténtalo más tarde.',
          actionLabel: 'Reintentar',
          action:      () => { window.location.reload(); },
        });
        return throwError(() => error);
      }

      // Cualquier otro error inesperado
      ui.showTypedError({
        type:        'error',
        title:       'Error inesperado',
        message:     extractMessage(error, 'Algo salió mal. Por favor, recarga la página.'),
        actionLabel: 'Recargar',
        action:      () => { window.location.reload(); },
      });
      return throwError(() => error);
    })
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractMessage(error: HttpErrorResponse, fallback: string): string {
  return (
    error?.error?.message ||
    error?.error?.error  ||
    error?.message       ||
    fallback
  );
}

function errorStatusLabel(status: number): string {
  switch (status) {
    case 400: return 'Datos incorrectos';
    case 409: return 'Conflicto de datos';
    case 422: return 'Error de validación';
    default:  return 'Aviso';
  }
}
