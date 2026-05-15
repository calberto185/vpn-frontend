import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { PermissionsService } from '../services/permissions/permissions.service';

/**
 * RoutePermissionGuard — verifica que el rol del usuario tenga acceso
 * al segmento de ruta actual dentro del panel de administración.
 *
 * Uso en admin.routes.ts:
 *   { path: 'users', component: UsersComponent, canActivate: [RoutePermissionGuard] }
 *
 * Extrae el segmento de ruta a partir de la URL relativa al panel:
 *   /panel/users            → "users"
 *   /panel/settings/servers → "settings/servers"
 */
export const RoutePermissionGuard: CanActivateFn = async (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService   = inject(AuthService);
  const permissions   = inject(PermissionsService);
  const router        = inject(Router);

  const role = authService.role();

  // admin always passes, no lookup needed
  if (role === 'admin') return true;

  // Ensure permissions are loaded for this role
  if (role) await permissions.load(role);

  // Extract the route segment after /panel/
  // state.url may include query params — strip them
  const urlPath = state.url.split('?')[0];
  const afterPanel = urlPath.replace(/^\/panel\//, '');

  if (!permissions.canAccess(afterPanel)) {
    // Redirect to the first route the user actually has access to
    const allowed = permissions.allowedRoutes() ?? [];
    const first   = allowed.find((key: string) => !!key);
    router.navigateByUrl(first ? `/panel/${first}` : '/auth/login');
    return false;
  }

  return true;
};
