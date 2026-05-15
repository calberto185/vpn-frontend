import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import AppsEntity from '../../interfaces/apps.interface';
import { AppsService } from '../../services/apps/apps.service';
import { PermissionsService } from '../../services/permissions/permissions.service';

const KIND_OPTIONS = [
  { value: 'app',      label: 'App' },
  { value: 'workflow', label: 'WorkFlow' },
  { value: 'bot',      label: 'Bot' },
  { value: 'webhook',  label: 'Webhook' },
];

@Component({
  selector: 'app-apps',
  imports: [ReactiveFormsModule],
  templateUrl: './apps.component.html',
  styleUrl: './apps.component.css',
})
export class AppsComponent implements OnInit {

  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions = inject(PermissionsService);
  canCreate = computed(() => this.permissions.canDo('settings/apps', 'create'));
  canUpdate = computed(() => this.permissions.canDo('settings/apps', 'update'));
  canDelete = computed(() => this.permissions.canDo('settings/apps', 'delete'));

  private appsService = inject(AppsService);
  private fb          = inject(FormBuilder);

  // ── State ─────────────────────────────────────────────────────────────────
  apps         = signal<AppsEntity[]>([]);
  toast        = signal<{ msg: string; ok: boolean } | null>(null);
  saving       = signal(false);
  deleting     = signal(false);
  editItem     = signal<AppsEntity | null>(null);
  deleteTarget = signal<AppsEntity | null>(null);

  readonly kindOptions = KIND_OPTIONS;

  // ── Computed stats ─────────────────────────────────────────────────────────
  totalApps    = computed(() => this.apps().length);
  activeApps   = computed(() => this.apps().filter(a => a.active).length);
  inactiveApps = computed(() => this.apps().filter(a => !a.active).length);

  // ── Forms ─────────────────────────────────────────────────────────────────
  createForm = this.fb.group({
    name:        ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.required, Validators.minLength(2)]],
    route:       ['', [Validators.required, Validators.minLength(2)]],
    kind:        ['app', Validators.required],
    active:      [true],
  });

  editForm = this.fb.group({
    name:        ['', [Validators.required, Validators.minLength(2)]],
    description: ['', [Validators.required, Validators.minLength(2)]],
    route:       ['', [Validators.required, Validators.minLength(2)]],
    kind:        ['app', Validators.required],
    active:      [false],
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadApps();
  }

  loadApps() {
    this.appsService.get().subscribe({
      next: resp => this.apps.set(resp.data ?? []),
      error: () => this.showToast('Error al cargar las apps', false),
    });
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  openCreateModal() {
    this.createForm.reset({ kind: 'app', active: true });
    (document.getElementById('modal_app_create') as HTMLDialogElement)?.showModal();
  }

  onSubmit() {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.appsService.create(this.createForm.value as any).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadApps();
        (document.getElementById('modal_app_create') as HTMLDialogElement)?.close();
        this.showToast('App creada exitosamente', true);
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al crear la app', false);
      },
    });
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  openEditModal(app: AppsEntity) {
    this.editItem.set(app);
    this.editForm.patchValue({
      name:        app.name,
      description: app.description,
      route:       app.route,
      kind:        app.kind,
      active:      app.active,
    });
    (document.getElementById('modal_app_edit') as HTMLDialogElement)?.showModal();
  }

  onEditSubmit() {
    if (this.editForm.invalid || !this.editItem()) return;
    this.saving.set(true);
    this.appsService.update({ id: this.editItem()!.id, ...this.editForm.value } as any).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadApps();
        (document.getElementById('modal_app_edit') as HTMLDialogElement)?.close();
        this.showToast('App actualizada', true);
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al actualizar', false);
      },
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  openDeleteModal(app: AppsEntity) {
    this.deleteTarget.set(app);
    (document.getElementById('modal_app_delete') as HTMLDialogElement)?.showModal();
  }

  confirmDelete() {
    const app = this.deleteTarget();
    if (!app) return;
    this.deleting.set(true);
    this.appsService.delete(app.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.apps.update(list => list.filter(a => a.id !== app.id));
        (document.getElementById('modal_app_delete') as HTMLDialogElement)?.close();
        this.showToast('App eliminada', true);
      },
      error: err => {
        this.deleting.set(false);
        this.showToast(err?.error?.message ?? 'Error al eliminar', false);
      },
    });
  }

  // ── Toggle active ──────────────────────────────────────────────────────────
  toggleActive(app: AppsEntity) {
    this.appsService.update({ id: app.id, active: !app.active } as any).subscribe({
      next: () => {
        this.loadApps();
        this.showToast(app.active ? 'App desactivada' : 'App activada', true);
      },
      error: () => this.showToast('Error al cambiar estado', false),
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  kindLabel(kind: string): string {
    return KIND_OPTIONS.find(k => k.value === kind)?.label ?? kind;
  }

  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
