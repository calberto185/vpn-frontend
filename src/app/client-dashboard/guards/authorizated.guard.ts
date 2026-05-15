import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';

/**
 * AuthorizatedGuard — protege la ruta /panel
 * Solo acceden usuarios con rol asignado por el admin (cualquier rol ≠ 'client').
 * Usuarios con rol 'client' (o sin rol) son redirigidos al módulo cliente.
 */
export const AuthorizatedGuard: CanMatchFn = async (
  route: Route,
  segments: UrlSegment[]
) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  await firstValueFrom(authService.ensureAuthChecked());

  const role = authService.role()?.toLowerCase() ?? null;

  // Un rol de panel es cualquier rol que no sea 'client' y no sea null/vacío
  const isPanelUser = role !== null && role !== '' && role !== 'client';

  if (!isPanelUser) {
    router.navigateByUrl('/client/dashboard');
    return false;
  }
  return true;
};
