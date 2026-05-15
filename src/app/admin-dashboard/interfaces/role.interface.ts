// ── Action types ──────────────────────────────────────────────────────────────
export type RouteAction = 'view' | 'create' | 'update' | 'delete';

export interface RoutePermission {
  view:   boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

// ── Role entity ───────────────────────────────────────────────────────────────
export interface RoleEntity {
  id: string;
  name: string;           // "admin" | "manager" | "support" | custom
  label: string;          // display name
  description: string;
  color: RoleBadgeColor;
  /** Source of truth: map of routeKey → per-action booleans */
  routePermissions: Record<string, RoutePermission>;
  /** Derived: routes where view === true — used by RoutePermissionGuard */
  allowedRoutes: string[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RoleBadgeColor =
  | 'primary' | 'secondary' | 'success'
  | 'warning' | 'error' | 'info' | 'ghost';

/** Returns an empty RoutePermission (all false) */
export function emptyPermission(): RoutePermission {
  return { view: false, create: false, update: false, delete: false };
}

/** Returns a full RoutePermission (all true) */
export function fullPermission(): RoutePermission {
  return { view: true, create: true, update: true, delete: true };
}
