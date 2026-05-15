import { RouteAction } from './role.interface';

/** A single entry in the dynamic route catalog (stored in DB) */
export interface RouteCatalogEntry {
  id:        string;
  key:       string;           // e.g. "settings/plans", "users"
  label:     string;           // display name
  group:     string;           // "Configuración" | "Gestión" | etc.
  actions:   RouteAction[];    // actions available for this route
  isSystem:  boolean;          // system routes cannot be deleted
  order:     number;
  createdAt: string;
  updatedAt: string;
}

/** Returns the actions available for a given route key from the catalog */
export function getRouteActions(routeKey: string, catalog: RouteCatalogEntry[]): RouteAction[] {
  return catalog.find(r => r.key === routeKey)?.actions ?? ['view', 'create', 'update', 'delete'];
}

/** Groups catalog entries by their group field */
export function groupRoutesByGroup(catalog: RouteCatalogEntry[]): { group: string; routes: RouteCatalogEntry[] }[] {
  const map: Record<string, RouteCatalogEntry[]> = {};
  for (const r of catalog) {
    if (!map[r.group]) map[r.group] = [];
    map[r.group].push(r);
  }
  return Object.entries(map).map(([group, routes]) => ({ group, routes }));
}
