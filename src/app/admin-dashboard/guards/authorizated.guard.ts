// import { inject } from '@angular/core';
// import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';
// import { firstValueFrom } from 'rxjs';
// import { AuthService } from '../../auth/services/auth.service';

// export const AuthorizatedGuard: CanMatchFn = async  (
//   route: Route,
//   segments: UrlSegment[]
// ) => {
//   const authService = inject(AuthService);
//   const router = inject(Router);

//   const isAuthorizated = authService.isAdmin();
//   if(isAuthorizated !== true) {
//     router.navigateByUrl("/panel/dashboard");
//     return false;
//   }
//   return true;
// }
// src/app/admin-dashboard/guards/standard.guard.ts
import { inject } from '@angular/core';
import { CanMatchFn, Route, Router, UrlSegment } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { firstValueFrom } from 'rxjs';

export const StandardGuard: CanMatchFn = async (
  route: Route,
  segments: UrlSegment[]
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Si no está autenticado, envíalo al login
  // (tu AuthenticatedGuard ya lo hace al nivel de ruta, esto es por seguridad)
  // Si prefieres, elimina este bloque y deja solo el check de rol.
  // const isLogged = await firstValueFrom(authService.checkStatus());
  // if (!isLogged) return router.createUrlTree(['/auth/login']);

  // Permitir solo a rol "standard"
    await firstValueFrom(authService.checkStatus());

  const isAdmin = authService.role()?.toLowerCase().includes("admin") ? true : false;
  // console.log("StandardGuard isAdmin: ", isAdmin)

  if (isAdmin == true) {
    // Si NO es standard (por ejemplo, es admin), lo llevamos a su panel
    router.navigateByUrl('/panel/dashboard');
    return false;
  }
  return true;
};
