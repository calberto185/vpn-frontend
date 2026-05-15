import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SuppliersService } from '../../services/suppliers/suppliers.service';
import { ServicesService }  from '../../services/services/services.service';
import {
  SupplierEntity, SupplierCategory,
  SUPPLIER_CATEGORIES
} from '../../interfaces/supplier.interface';
import ServicesEntity from '../../interfaces/services.interface';
import { PermissionsService } from '../../services/permissions/permissions.service';

@Component({
  selector: 'app-suppliers',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './suppliers.component.html',
  styleUrl: './suppliers.component.css',
})
export class SuppliersComponent implements OnInit {

  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions = inject(PermissionsService);
  canCreate = computed(() => this.permissions.canDo('suppliers', 'create'));
  canUpdate = computed(() => this.permissions.canDo('suppliers', 'update'));
  canDelete = computed(() => this.permissions.canDo('suppliers', 'delete'));

  private svc         = inject(SuppliersService);
  private servicesSvc = inject(ServicesService);
  private fb          = inject(FormBuilder);

  suppliers     = signal<SupplierEntity[]>([]);
  servicesList  = signal<ServicesEntity[]>([]);
  categories    = SUPPLIER_CATEGORIES;
  paymentStats  = signal<Record<string, { count: number; total: number; paid: number; pending: number }>>({});

  toast        = signal<{ msg: string; ok: boolean } | null>(null);
  saving       = signal(false);
  deleting     = signal(false);
  editTarget   = signal<SupplierEntity | null>(null);
  deleteTarget = signal<SupplierEntity | null>(null);
  searchQuery  = signal('');
  filterCat    = signal<SupplierCategory | ''>('');
  filterActive = signal<boolean | null>(null);
  useServiceCatalog = signal(false);   // create modal toggle
  useServiceCatalogEdit = signal(false); // edit modal toggle

  // ── Stats ─────────────────────────────────────────────────────────────────
  total    = computed(() => this.suppliers().length);
  active   = computed(() => this.suppliers().filter(s => s.active).length);
  inactive = computed(() => this.suppliers().filter(s => !s.active).length);

  filtered = computed(() => {
    let list = this.suppliers();
    const q  = this.searchQuery().toLowerCase();
    if (q) list = list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.legalName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q));
    if (this.filterCat())    list = list.filter(s => s.category === this.filterCat());
    if (this.filterActive() !== null) list = list.filter(s => s.active === this.filterActive());
    return list;
  });

  // ── Forms ─────────────────────────────────────────────────────────────────
  createForm = this.fb.group({
    name:               ['', Validators.required],
    legalName:          [''],
    taxId:              [''],
    email:              [''],
    phone:              [''],
    address:            [''],
    category:           ['other'],
    serviceId:          [null as string | null],
    serviceName:        [''],
    serviceDescription: [''],
    contactName:        [''],
    website:            [''],
    notes:              [''],
  });

  editForm = this.fb.group({
    name:               ['', Validators.required],
    legalName:          [''],
    taxId:              [''],
    email:              [''],
    phone:              [''],
    address:            [''],
    category:           ['other'],
    serviceId:          [null as string | null],
    serviceName:        [''],
    serviceDescription: [''],
    contactName:        [''],
    website:            [''],
    notes:              [''],
    active:             [true],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadSuppliers();
    if (this.permissions.canDo('settings/services', 'view')) this.loadServices();
    if (this.permissions.canDo('supplier-payments', 'view')) this.loadPaymentStats();
  }

  loadSuppliers() {
    this.svc.list({ active: undefined }).subscribe({
      next: r => this.suppliers.set(r.data ?? []),
      error: () => this.showToast('Error al cargar proveedores', false),
    });
  }

  loadPaymentStats() {
    this.svc.paymentStatsBySupplier().subscribe({
      next: r => this.paymentStats.set(r.data ?? {}),
      error: () => {},
    });
  }

  loadServices() {
    this.servicesSvc.get().subscribe({
      next: r => this.servicesList.set(r.data ?? []),
      error: () => {},
    });
  }

  // ── Create ─────────────────────────────────────────────────────────────────
  onSelectServiceCreate(id: string) {
    const svc = this.servicesList().find(s => s.id === id);
    if (svc) {
      this.createForm.patchValue({
        serviceName: svc.sortName,
        serviceDescription: svc.Description,
      });
    }
  }

  openCreateModal() {
    this.createForm.reset({ category: 'other', serviceId: null });
    this.useServiceCatalog.set(false);
    (document.getElementById('modal_supplier_create') as HTMLDialogElement)?.showModal();
  }

  submitCreate() {
    if (this.createForm.invalid) { this.showToast('El nombre es requerido', false); return; }
    const v = this.createForm.value;
    if (!this.useServiceCatalog()) { v.serviceId = null; }
    this.saving.set(true);
    this.svc.create(v as any).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadSuppliers();
        (document.getElementById('modal_supplier_create') as HTMLDialogElement)?.close();
        this.showToast('Proveedor creado exitosamente', true);
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al crear proveedor', false);
      },
    });
  }

  // ── Edit ───────────────────────────────────────────────────────────────────
  onSelectServiceEdit(id: string) {
    const svc = this.servicesList().find(s => s.id === id);
    if (svc) {
      this.editForm.patchValue({
        serviceName: svc.sortName,
        serviceDescription: svc.Description,
      });
    }
  }

  openEditModal(sup: SupplierEntity) {
    this.editTarget.set(sup);
    const hasService = !!sup.serviceId;
    this.useServiceCatalogEdit.set(hasService);
    this.editForm.patchValue({
      name: sup.name,
      legalName: sup.legalName,
      taxId: sup.taxId,
      email: sup.email,
      phone: sup.phone,
      address: sup.address,
      category: sup.category,
      serviceId: sup.serviceId,
      serviceName: sup.serviceName,
      serviceDescription: sup.serviceDescription,
      contactName: sup.contactName,
      website: sup.website,
      notes: sup.notes,
      active: sup.active,
    });
    (document.getElementById('modal_supplier_edit') as HTMLDialogElement)?.showModal();
  }

  submitEdit() {
    if (this.editForm.invalid || !this.editTarget()) return;
    const v = this.editForm.value;
    if (!this.useServiceCatalogEdit()) { v.serviceId = null; }
    this.saving.set(true);
    this.svc.update(this.editTarget()!.id, v as any).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadSuppliers();
        (document.getElementById('modal_supplier_edit') as HTMLDialogElement)?.close();
        this.showToast('Proveedor actualizado', true);
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al actualizar', false);
      },
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  openDeleteModal(sup: SupplierEntity) {
    this.deleteTarget.set(sup);
    (document.getElementById('modal_supplier_delete') as HTMLDialogElement)?.showModal();
  }

  confirmDelete() {
    const sup = this.deleteTarget(); if (!sup) return;
    this.deleting.set(true);
    this.svc.remove(sup.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.loadSuppliers();
        (document.getElementById('modal_supplier_delete') as HTMLDialogElement)?.close();
        this.showToast('Proveedor desactivado', true);
      },
      error: err => {
        this.deleting.set(false);
        this.showToast(err?.error?.message ?? 'Error al eliminar', false);
      },
    });
  }

  // ── Toggle active ──────────────────────────────────────────────────────────
  toggleActive(sup: SupplierEntity) {
    this.svc.update(sup.id, { active: !sup.active }).subscribe({
      next: () => {
        this.loadSuppliers();
        this.showToast(sup.active ? 'Proveedor desactivado' : 'Proveedor activado', true);
      },
      error: () => this.showToast('Error al actualizar estado', false),
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  categoryLabel(cat: string) {
    return this.categories.find(c => c.value === cat)?.label ?? cat;
  }

  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
