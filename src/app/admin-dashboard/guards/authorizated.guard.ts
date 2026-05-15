import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { firstValueFrom } from 'rxjs';

/**
 * StandardGuard — protege la ruta /client
 * Solo acceden usuarios con rol 'client' (o sin rol asignado).
 * Cualquier usuario con rol de panel (admin, manager, support, etc.) es
 * redirigido a /panel/dashboard.
 */
export const StandardGuard: CanMatchFn = async (
  route: Route,
  segments: UrlSegment[]
) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  await firstValueFrom(authService.ensureAuthChecked());

  const role = authService.role()?.toLowerCase() ?? null;

  // Un rol de panel es cualquier rol que no sea 'client' y no sea null/vacío
  const isPanelUser = role !== null && role !== '' && role !== 'client';

  if (isPanelUser) {
    router.navigateByUrl('/panel/dashboard');
    return false;
  }
  return true;
};
