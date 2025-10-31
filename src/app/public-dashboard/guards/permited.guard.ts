import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';

export const PermitedGuard: CanMatchFn = async  (
  route: Route,
  segments: UrlSegment[]
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isAuthenticated = await firstValueFrom(authService.checkStatus());
  if(isAuthenticated === true) {
    router.navigateByUrl("/panel");
    return false;
  }
  return true;
}
