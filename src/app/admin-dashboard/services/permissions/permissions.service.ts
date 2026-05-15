import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RolesService } from '../roles/roles.service';
import { RouteAction, RoutePermission } from '../../interfaces/role.interface';

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private rolesService = inject(RolesService);

  /** null = no cargado, '*' = acceso total (admin) */
  private _routePermissions = signal<Record<string, RoutePermission> | null | '*'>(null);
  private _allowedRoutes    = signal<string[] | null>(null);
  private _loadedRole       = signal<string | null>(null);

  allowedRoutes = computed(() => this._allowedRoutes());

  // ── Load ───────────────────────────────────────────────────────────────────
  async load(roleName: string): Promise<void> {
    // Skip if already loaded for this role
    if (this._loadedRole() === roleName && this._routePermissions() !== null) return;

    if (roleName === 'admin') {
      this._routePermissions.set('*');
      this._allowedRoutes.set(['*']);
      this._loadedRole.set(roleName);
      return;
    }

    try {
      const resp = await firstValueFrom(this.rolesService.getByName(roleName));
      const role = resp?.data;

      if (role?.routePermissions) {
        this._routePermissions.set(role.routePermissions);
        this._allowedRoutes.set(role.allowedRoutes ?? []);
      } else if (role?.allowedRoutes) {
        // Fallback: rol sin routePermissions (datos legados)
        const legacy: Record<string, RoutePermission> = {};
        for (const r of role.allowedRoutes) {
          legacy[r] = { view: true, create: false, update: false, delete: false };
        }
        this._routePermissions.set(legacy);
        this._allowedRoutes.set(role.allowedRoutes);
      } else {
        this._routePermissions.set({});
        this._allowedRoutes.set([]);
      }
    } catch {
      this._routePermissions.set({});
      this._allowedRoutes.set([]);
    }

    this._loadedRole.set(roleName);
  }

  // ── canAccess — route-level (used by RoutePermissionGuard + sidebar) ────────
  /**
   * Returns true if the current role can access (view) the given route segment.
   * Supports prefix matching for nested routes (e.g. "settings/servers").
   */
  canAccess(routeSegment: string): boolean {
    const perms = this._routePermissions();
    if (perms === null) return false;
    if (perms === '*')  return true;

    // Exact match or prefix match
    return Object.entries(perms).some(([route, p]) =>
      p.view && (routeSegment === route || routeSegment.startsWith(route + '/'))
    );
  }

  // ── canDo — action-level (used by components to show/hide CRUD buttons) ────
  /**
   * Returns true if the current role can perform the given action on the route.
   *
   * Usage in a component:
   *   @if (permissions.canDo('users', 'delete')) { <button>Eliminar</button> }
   */
  canDo(routeSegment: string, action: RouteAction): boolean {
    const perms = this._routePermissions();
    if (perms === null) return false;
    if (perms === '*')  return true;

    const p = (perms as Record<string, RoutePermission>)[routeSegment];
    return p ? Boolean(p[action]) : false;
  }

  // ── Clear ──────────────────────────────────────────────────────────────────
  clear(): void {
    this._routePermissions.set(null);
    this._allowedRoutes.set(null);
    this._loadedRole.set(null);
  }
}
