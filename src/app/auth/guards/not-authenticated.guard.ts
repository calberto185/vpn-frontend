import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';

export const NotAuthenticatedGuard: CanMatchFn = async (
  route: Route,
  segments: UrlSegment[]
) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  const isAuthenticated = await firstValueFrom(authService.ensureAuthChecked());

  if (isAuthenticated === true) {
    const role = authService.role?.()?.toLowerCase() ?? null;
    // Panel = cualquier rol asignado por el admin (no 'client', no vacío)
    const isPanelUser = role !== null && role !== '' && role !== 'client';
    router.navigateByUrl(isPanelUser ? '/panel' : '/client');
    return false;
  }
  return true;
};
