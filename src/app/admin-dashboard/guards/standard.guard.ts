// src/app/client-dashboard/guards/standard.guard.ts
import { inject } from '@angular/core';
import { CanMatchFn, Router, UrlSegment, Route } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { firstValueFrom } from 'rxjs';

export const StandardGuard: CanMatchFn = async  (
  route: Route,
  segments: UrlSegment[]
) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  // 1) Si no está autenticado → al logi
  //
    const isAuthenticated = await firstValueFrom(authService.checkStatus());
  if (!authService) {
    return router.createUrlTree(['/auth/login']);
  }

  // 2) Si es admin → mándalo a su panel
  if (authService.isAdmin()) {
    return router.createUrlTree(['/panel/dashboard']);
  }

  // 3) Si no es admin → lo tratamos como standard → permitir
  return true;
};
