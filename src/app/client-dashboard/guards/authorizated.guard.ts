import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../auth/services/auth.service';

export const AuthorizatedGuard: CanMatchFn = async  (
  route: Route,
  segments: UrlSegment[]
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // const isAuthorizated = authService.isAdmin();
    // Permitir solo a rol "standard"
  await firstValueFrom(authService.checkStatus());
  const isAdmin = authService.role()?.toLowerCase().includes("admin") ? true : false;
  console.log("Client AuthorizatedGuard authService.role(): ", authService.role())
  console.log("Client AuthorizatedGuard isAdmin: ", isAdmin)

  if(isAdmin !== true) {
    router.navigateByUrl("/client/dashboard");
    return false;
  }
  return true;
}
