import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PermissionsService } from '../../../services/permissions/permissions.service';
import { RouteCatalogService } from '../../../services/route-catalog/route-catalog.service';
import { RouteCatalogEntry } from '../../../interfaces/route-catalog.interface';
import { RouteAction } from '../../../interfaces/role.interface';

const ALL_ACTIONS: RouteAction[] = ['view', 'create', 'update', 'delete'];

const KNOWN_GROUPS = ['Principal', 'Gestión', 'Administración', 'Configuración', 'Contenido'];

@Component({
  selector: 'app-routes-settings',
  imports: [ReactiveFormsModule],
  templateUrl: './routes-settings.component.html',
})
export class RoutesSettingsComponent implements OnInit {
  private service     = inject(RouteCatalogService);
  private permissions = inject(PermissionsService);
  private fb          = inject(FormBuilder);

  canCreate = computed(() => this.permissions.canDo('settings/routes', 'create'));
  canUpdate = computed(() => this.permissions.canDo('settings/routes', 'update'));
  canDelete = computed(() => this.permissions.canDo('settings/routes', 'delete'));

  routes     = signal<RouteCatalogEntry[]>([]);
  loading    = signal(false);
  saving     = signal(false);
  deleting   = signal(false);
  editItem   = signal<RouteCatalogEntry | null>(null);
  toast      = signal<{ msg: string; ok: boolean } | null>(null);

  readonly allActions  = ALL_ACTIONS;
  readonly knownGroups = KNOWN_GROUPS;

  // ── Computed stats ────────────────────────────────────────────────────────
  totalRoutes  = computed(() => this.routes().length);
  systemRoutes = computed(() => this.routes().filter(r => r.isSystem).length);
  customRoutes = computed(() => this.routes().filter(r => !r.isSystem).length);
  groupCount   = computed(() => new Set(this.routes().map(r => r.group)).size);

  routeGroups = computed(() => {
    const map: Record<string, RouteCatalogEntry[]> = {};
    for (const r of this.routes()) {
      if (!map[r.group]) map[r.group] = [];
      map[r.group].push(r);
    }
    return Object.entries(map).map(([group, items]) => ({ group, items }));
  });

  // ── Forms ─────────────────────────────────────────────────────────────────
  addForm = this.fb.group({
    key:   ['', [Validators.required, Validators.pattern(/^[a-z0-9_/-]+$/)]],
    label: ['', Validators.required],
    group: ['Configuración', Validators.required],
    order: [0],
  });
  addActions = signal<RouteAction[]>(['view', 'create', 'update', 'delete']);

  editForm = this.fb.group({
    label: ['', Validators.required],
    group: ['', Validators.required],
    order: [0],
  });
  editActions = signal<RouteAction[]>(['view', 'create', 'update', 'delete']);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.service.getAll().subscribe({
      next:  r  => { this.routes.set(r?.data ?? []); this.loading.set(false); },
      error: () => { this.showToast('Error al cargar rutas.', false); this.loading.set(false); },
    });
  }

  // ── Action toggles ────────────────────────────────────────────────────────
  toggleAddAction(a: RouteAction): void {
    this.addActions.update(cur =>
      cur.includes(a) ? cur.filter(x => x !== a) : [...cur, a]
    );
  }

  toggleEditAction(a: RouteAction): void {
    this.editActions.update(cur =>
      cur.includes(a) ? cur.filter(x => x !== a) : [...cur, a]
    );
  }

  // ── Create ────────────────────────────────────────────────────────────────
  onSubmit(): void {
    if (this.addForm.invalid || this.saving()) return;
    this.saving.set(true);
    const v = this.addForm.getRawValue();
    this.service.create({
      key:     v.key!.trim().toLowerCase(),
      label:   v.label!.trim(),
      group:   v.group!.trim(),
      order:   Number(v.order) || 0,
      actions: [...this.addActions()],
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
        (document.getElementById('add_route') as HTMLDialogElement | null)?.close();
        this.addForm.reset({ group: 'Configuración', order: 0 });
        this.addActions.set(['view', 'create', 'update', 'delete']);
        this.showToast('Ruta creada correctamente.', true);
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al crear ruta.', false);
      },
    });
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  openEdit(route: RouteCatalogEntry): void {
    this.editItem.set(route);
    this.editForm.patchValue({ label: route.label, group: route.group, order: route.order });
    this.editActions.set([...route.actions]);
    (document.getElementById('edit_route') as HTMLDialogElement | null)?.showModal();
  }

  onEditSubmit(): void {
    if (this.editForm.invalid || this.saving()) return;
    const item = this.editItem();
    if (!item) return;
    this.saving.set(true);
    const v = this.editForm.getRawValue();
    this.service.update(item.id, {
      label:   v.label!.trim(),
      group:   v.group!.trim(),
      order:   Number(v.order) || 0,
      actions: [...this.editActions()],
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.load();
        (document.getElementById('edit_route') as HTMLDialogElement | null)?.close();
        this.showToast('Ruta actualizada.', true);
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al actualizar.', false);
      },
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  openDelete(route: RouteCatalogEntry): void {
    this.editItem.set(route);
    (document.getElementById('delete_route') as HTMLDialogElement | null)?.showModal();
  }

  confirmDelete(): void {
    const item = this.editItem();
    if (!item) return;
    this.deleting.set(true);
    this.service.delete(item.id).subscribe({
      next: () => {
        this.deleting.set(false);
        (document.getElementById('delete_route') as HTMLDialogElement | null)?.close();
        this.load();
        this.showToast('Ruta eliminada.', true);
      },
      error: err => {
        this.deleting.set(false);
        this.showToast(err?.error?.message ?? 'Error al eliminar.', false);
      },
    });
  }

  showToast(msg: string, ok: boolean): void {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
