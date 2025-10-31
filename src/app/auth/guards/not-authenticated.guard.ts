import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { firstValueFrom } from 'rxjs';

export const NotAuthenticatedGuard: CanMatchFn = async  (
  route: Route,
  segments: UrlSegment[]
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isAuthenticated = await firstValueFrom(authService.checkStatus());

  const isAdmin = authService.role?.()?.toLocaleLowerCase().includes("admin");
  if(isAuthenticated === true) {
    if(isAdmin) {
      router.navigateByUrl("/panel");
    } else {
      router.navigateByUrl("/client");
    }
    return false;
  }
  return true;
}
