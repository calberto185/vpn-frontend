import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RolesService } from '../../services/roles/roles.service';
import { RouteCatalogService } from '../../services/route-catalog/route-catalog.service';
import {
  RouteCatalogEntry,
  getRouteActions,
  groupRoutesByGroup,
} from '../../interfaces/route-catalog.interface';
import {
  emptyPermission,
  fullPermission,
  RoleBadgeColor,
  RoleEntity,
  RouteAction,
  RoutePermission,
} from '../../interfaces/role.interface';

type ModalMode = 'create' | 'edit';

const ACTION_LABELS: Record<RouteAction, string> = {
  view:   'Ver',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
};

const ALL_ACTIONS: RouteAction[] = ['view', 'create', 'update', 'delete'];

@Component({
  selector: 'app-roles',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './roles.component.html',
  styleUrl: './roles.component.css',
})
export class RolesComponent implements OnInit {
  private rolesService        = inject(RolesService);
  private routeCatalogService = inject(RouteCatalogService);
  private fb                  = inject(FormBuilder);

  // ── State ──────────────────────────────────────────────────────────────────
  roles        = signal<RoleEntity[]>([]);
  loading      = signal(false);
  saving       = signal(false);
  syncing      = signal(false);
  toast        = signal<{ msg: string; ok: boolean } | null>(null);

  modalMode    = signal<ModalMode>('create');
  showModal    = signal(false);
  editingRole  = signal<RoleEntity | null>(null);
  deleteTarget = signal<RoleEntity | null>(null);
  expandedRoleId = signal<string | null>(null);

  // ── Dynamic route catalog ──────────────────────────────────────────────────
  allRoutes = signal<RouteCatalogEntry[]>([]);

  routeGroups = computed(() => groupRoutesByGroup(this.allRoutes()));

  // ── Permissions matrix state ───────────────────────────────────────────────
  routePerms = signal<Record<string, RoutePermission>>({});

  readonly allActions   = ALL_ACTIONS;
  readonly actionLabels = ACTION_LABELS;

  readonly badgeColors: RoleBadgeColor[] = [
    'primary', 'secondary', 'success', 'warning', 'error', 'info', 'ghost',
  ];

  form: FormGroup = this.fb.group({
    label:       ['', [Validators.required, Validators.minLength(2)]],
    name:        ['', [Validators.required, Validators.pattern(/^[a-z0-9_]+$/)]],
    description: [''],
    color:       ['primary', Validators.required],
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadCatalog();
    this.loadRoles();
  }

  loadCatalog(): void {
    this.routeCatalogService.getAll().subscribe({
      next:  r  => this.allRoutes.set(r?.data ?? []),
      error: () => this.showToast('Error al cargar catálogo de rutas.', false),
    });
  }

  loadRoles(): void {
    this.loading.set(true);
    this.rolesService.getAll().subscribe({
      next:  r  => { this.roles.set(r?.data ?? []); this.loading.set(false); },
      error: err => { this.showToast(err?.error?.message ?? 'Error al cargar roles.', false); this.loading.set(false); },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  routeActionsFor(key: string): RouteAction[] {
    return getRouteActions(key, this.allRoutes());
  }

  badgeClass(color: RoleBadgeColor): string {
    return `badge badge-${color}`;
  }

  visibleCount(role: RoleEntity): number {
    return Object.values(role.routePermissions ?? {}).filter(p => p.view).length;
  }

  actionCount(role: RoleEntity): number {
    return Object.values(role.routePermissions ?? {})
      .reduce((s, p) => s + [p.view, p.create, p.update, p.delete].filter(Boolean).length, 0);
  }

  toggleExpand(id: string): void {
    this.expandedRoleId.update(cur => cur === id ? null : id);
  }

  // ── Permissions matrix helpers ─────────────────────────────────────────────
  perm(routeKey: string): RoutePermission {
    return this.routePerms()[routeKey] ?? emptyPermission();
  }

  isActionEnabled(routeKey: string, action: RouteAction): boolean {
    return this.routeActionsFor(routeKey).includes(action);
  }

  toggleAction(routeKey: string, action: RouteAction): void {
    this.routePerms.update(map => {
      const current = map[routeKey] ?? emptyPermission();
      const updated = { ...current, [action]: !current[action] };
      if (action === 'view' && !updated.view) {
        updated.create = false;
        updated.update = false;
        updated.delete = false;
      }
      if (action !== 'view' && updated[action]) {
        updated.view = true;
      }
      return { ...map, [routeKey]: updated };
    });
  }

  grantRoute(routeKey: string): void {
    const available = this.routeActionsFor(routeKey);
    this.routePerms.update(map => {
      const p = emptyPermission();
      for (const a of available) p[a] = true;
      return { ...map, [routeKey]: p };
    });
  }

  revokeRoute(routeKey: string): void {
    this.routePerms.update(map => ({ ...map, [routeKey]: emptyPermission() }));
  }

  isRouteGranted(routeKey: string): boolean {
    const p         = this.perm(routeKey);
    const available = this.routeActionsFor(routeKey);
    return available.every(a => p[a]);
  }

  isRoutePartial(routeKey: string): boolean {
    const p         = this.perm(routeKey);
    const available = this.routeActionsFor(routeKey);
    const granted   = available.filter(a => p[a]).length;
    return granted > 0 && granted < available.length;
  }

  grantGroup(routes: RouteCatalogEntry[]): void {
    this.routePerms.update(map => {
      const next = { ...map };
      for (const r of routes) {
        const available = this.routeActionsFor(r.key);
        const p = emptyPermission();
        for (const a of available) p[a] = true;
        next[r.key] = p;
      }
      return next;
    });
  }

  revokeGroup(routes: RouteCatalogEntry[]): void {
    this.routePerms.update(map => {
      const next = { ...map };
      for (const r of routes) next[r.key] = emptyPermission();
      return next;
    });
  }

  isGroupFullyGranted(routes: RouteCatalogEntry[]): boolean {
    return routes.every(r => this.isRouteGranted(r.key));
  }

  isGroupPartial(routes: RouteCatalogEntry[]): boolean {
    const granted = routes.filter(r => this.perm(r.key).view);
    return granted.length > 0 && granted.length < routes.length;
  }

  grantAll(): void {
    const next: Record<string, RoutePermission> = {};
    for (const r of this.allRoutes()) {
      const available = this.routeActionsFor(r.key);
      const p = emptyPermission();
      for (const a of available) p[a] = true;
      next[r.key] = p;
    }
    this.routePerms.set(next);
  }

  revokeAll(): void {
    const next: Record<string, RoutePermission> = {};
    for (const r of this.allRoutes()) next[r.key] = emptyPermission();
    this.routePerms.set(next);
  }

  // ── Modal open/close ───────────────────────────────────────────────────────
  openCreate(): void {
    this.modalMode.set('create');
    this.editingRole.set(null);
    this.form.reset({ label: '', name: '', description: '', color: 'primary' });
    this.form.get('name')?.enable();
    this.revokeAll();
    this.showModal.set(true);
  }

  openEdit(role: RoleEntity): void {
    this.modalMode.set('edit');
    this.editingRole.set(role);
    this.form.patchValue({
      label:       role.label,
      name:        role.name,
      description: role.description,
      color:       role.color,
    });
    this.form.get('name')?.disable();

    const perms: Record<string, RoutePermission> = {};
    for (const r of this.allRoutes()) {
      perms[r.key] = role.routePermissions?.[r.key] ?? emptyPermission();
    }
    this.routePerms.set(perms);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingRole.set(null);
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const v = this.form.getRawValue();
    const payload: Partial<RoleEntity> = {
      name:             v.name?.trim().toLowerCase().replace(/\s+/g, '_'),
      label:            v.label?.trim(),
      description:      v.description?.trim(),
      color:            v.color,
      routePermissions: this.routePerms(),
    };

    const obs = this.modalMode() === 'create'
      ? this.rolesService.create(payload)
      : this.rolesService.update(this.editingRole()!.id, payload);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.showToast(
          this.modalMode() === 'create' ? 'Rol creado correctamente.' : 'Rol actualizado correctamente.',
          true
        );
        this.loadRoles();
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al guardar el rol.', false);
      },
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  confirmDelete(role: RoleEntity): void {
    this.deleteTarget.set(role);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  doDelete(): void {
    const role = this.deleteTarget();
    if (!role) return;
    this.rolesService.delete(role.id).subscribe({
      next:  () => { this.deleteTarget.set(null); this.showToast('Rol eliminado.', true); this.loadRoles(); },
      error: err => { this.deleteTarget.set(null); this.showToast(err?.error?.message ?? 'Error al eliminar.', false); },
    });
  }

  // ── Sync routes ────────────────────────────────────────────────────────────
  syncRoutes(): void {
    if (this.syncing()) return;
    this.syncing.set(true);
    this.rolesService.syncRoutes().subscribe({
      next: (r) => {
        this.syncing.set(false);
        this.showToast(r?.message ?? 'Rutas sincronizadas.', true);
        this.loadCatalog();
        this.loadRoles();
      },
      error: (err) => {
        this.syncing.set(false);
        this.showToast(err?.error?.message ?? 'Error al sincronizar rutas.', false);
      },
    });
  }

  // ── Toast ──────────────────────────────────────────────────────────────────
  showToast(msg: string, ok: boolean): void {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
