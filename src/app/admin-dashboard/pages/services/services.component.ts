import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ServicesService } from '../../services/services/services.service';
import ServicesEntity from '../../interfaces/services.interface';
import { CountryEntity } from '../../interfaces/country.interface';
import { CountriesService } from '../../services/countries/countries.service';
import { PermissionsService } from '../../services/permissions/permissions.service';
import { LocaleService } from '../../../shared/services/locale/locale.service';

@Component({
  selector: 'app-services',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './services.component.html',
  styleUrl: './services.component.css'
})
export class ServicesComponent implements OnInit {

  ListServices  = signal<ServicesEntity[]>([]);
  ListCountries = signal<CountryEntity[]>([]);

  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions      = inject(PermissionsService);
  protected localeService  = inject(LocaleService);
  canCreate = computed(() => this.permissions.canDo('settings/services', 'create'));
  canUpdate = computed(() => this.permissions.canDo('settings/services', 'update'));
  canDelete = computed(() => this.permissions.canDo('settings/services', 'delete'));

  private servicesService = inject(ServicesService);
  private countryService  = inject(CountriesService);
  private fb              = inject(FormBuilder);

  toast    = signal<{ msg: string; ok: boolean } | null>(null);
  hasError = signal('');
  editItem = signal<ServicesEntity | null>(null);
  viewItem = signal<ServicesEntity | null>(null);
  saving   = signal(false);
  deleting = signal(false);
  loading  = signal(false);

  // ── Search / Filter ───────────────────────────────────────────────────────
  searchQuery   = signal('');
  filterActive  = signal('');  // '' | 'active' | 'inactive'

  filteredServices = computed(() => {
    const q  = this.searchQuery().toLowerCase().trim();
    const fa = this.filterActive();
    return this.ListServices().filter(s => {
      const displayName = this.svcDisplayName(s).toLowerCase();
      const matchQ = !q || displayName.includes(q) || (s.id ?? '').toLowerCase().includes(q);
      const matchActive =
        !fa ||
        (fa === 'active'   &&  s.state) ||
        (fa === 'inactive' && !s.state);
      return matchQ && matchActive;
    });
  });

  // ── Computed stats ────────────────────────────────────────────────────────
  totalServices    = computed(() => this.ListServices().length);
  activeServices   = computed(() => this.ListServices().filter(s => s.state).length);
  inactiveServices = computed(() => this.ListServices().filter(s => !s.state).length);
  visibleServices  = computed(() => this.ListServices().filter(s => s.visible).length);

  // ── i18n ──────────────────────────────────────────────────────────────────
  activeLangs = computed(() => this.localeService.systemLanguages());

  i18nAdd  = signal<Record<string, Record<string, string>>>({});
  i18nEdit = signal<Record<string, Record<string, string>>>({});

  addSortNameValid  = computed(() =>
    this.activeLangs().some(l => (this.i18nAdd()['sortName']?.[l.code] ?? '').trim() !== '')
  );
  editSortNameValid = computed(() =>
    this.activeLangs().some(l => (this.i18nEdit()['sortName']?.[l.code] ?? '').trim() !== '')
  );

  setI18nAdd(field: string, lang: string, value: string): void {
    this.i18nAdd.update(v => ({ ...v, [field]: { ...(v[field] ?? {}), [lang]: value } }));
  }

  setI18nEdit(field: string, lang: string, value: string): void {
    this.i18nEdit.update(v => ({ ...v, [field]: { ...(v[field] ?? {}), [lang]: value } }));
  }

  /** Display name for table/modals using current locale */
  svcDisplayName(s: ServicesEntity): string {
    return this.localeService.displayI18n(s.sortName_i18n, s.sortName);
  }

  // ── Forms (operational fields only) ──────────────────────────────────────
  serviceForm = this.fb.group({
    picture: [''],
    country: ['', Validators.required],
    state:   [false],
    visible: [false],
  });

  editForm = this.fb.group({
    id:      [''],
    picture: [''],
    country: ['', Validators.required],
    state:   [false],
    visible: [false],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.fillListCountries();
    this.fillListServices();
  }

  fillListServices() {
    this.loading.set(true);
    this.servicesService.get().subscribe({
      next:  resp => { this.ListServices.set(resp.data ?? []); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  fillListCountries() {
    this.countryService.getAllCountries().subscribe(resp => this.ListCountries.set(resp.data ?? []));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private buildEntity(
    data: any,
    i18nData: Record<string, Record<string, string>>,
    existing?: ServicesEntity | null
  ): ServicesEntity | null {
    const exist_Country = this.ListCountries().find(c => c.id === data.country);
    if (!exist_Country) { this.showToast('Selecciona un país válido', false); return null; }
    const country = new CountryEntity(); country.set(exist_Country);
    const entity = new ServicesEntity();
    if (existing) entity.set({ ...existing, ...data });
    else entity.set(data);
    entity.country          = country;
    entity.sortName_i18n    = i18nData['sortName']     ?? {};
    entity.longName_i18n    = i18nData['longName']     ?? {};
    entity.Description_i18n = i18nData['Description']  ?? {};
    return entity;
  }

  // ── Create ────────────────────────────────────────────────────────────────
  onSubmit() {
    if (this.serviceForm.invalid || !this.addSortNameValid()) {
      this.showToast('Completa al menos el nombre corto en un idioma.', false);
      return;
    }
    const entity = this.buildEntity(this.serviceForm.value, this.i18nAdd());
    if (!entity) return;
    this.saving.set(true);
    this.servicesService.register(entity.get()).subscribe({
      next: () => {
        this.saving.set(false);
        this.fillListServices();
        (document.getElementById('add_service') as HTMLDialogElement | null)?.close();
        this.serviceForm.reset({ state: false, visible: false });
        this.i18nAdd.set({});
        this.showToast('Servicio creado exitosamente.', true);
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al crear el servicio', false);
      },
    });
  }

  // ── View ──────────────────────────────────────────────────────────────────
  openViewModal(svc: ServicesEntity) {
    this.viewItem.set(svc);
    (document.getElementById('view_service') as HTMLDialogElement | null)?.showModal();
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  openEditModal(svc: ServicesEntity) {
    this.editItem.set(svc);
    const langs = this.localeService.systemLanguages();
    const fields = ['sortName', 'longName', 'Description'] as const;
    const toSignal: Record<string, Record<string, string>> = {};
    for (const f of fields) {
      const i18nKey = (f + '_i18n') as keyof ServicesEntity;
      const existing = (svc[i18nKey] ?? {}) as Record<string, string>;
      const hasI18n = Object.values(existing).some(v => !!v);
      if (hasI18n) {
        toSignal[f] = { ...existing };
      } else {
        const legacy = (svc[f as keyof ServicesEntity] as string) ?? '';
        toSignal[f] = Object.fromEntries(langs.map(l => [l.code, legacy]));
      }
    }
    this.i18nEdit.set(toSignal);

    this.editForm.patchValue({
      id:      svc.id,
      picture: svc.picture,
      country: svc.country?.id ?? '',
      state:   svc.state,
      visible: svc.visible,
    });
    (document.getElementById('edit_service') as HTMLDialogElement | null)?.showModal();
  }

  onEditSubmit() {
    if (this.editForm.invalid || !this.editSortNameValid()) return;
    const entity = this.buildEntity(this.editForm.value, this.i18nEdit(), this.editItem());
    if (!entity) return;
    this.saving.set(true);
    this.servicesService.update(entity).subscribe({
      next: () => {
        this.saving.set(false);
        this.fillListServices();
        (document.getElementById('edit_service') as HTMLDialogElement | null)?.close();
        this.showToast('Servicio actualizado.', true);
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al actualizar', false);
      },
    });
  }

  // ── Toggle state ──────────────────────────────────────────────────────────
  toggleState(svc: ServicesEntity) {
    const updated = { ...svc, state: !svc.state } as ServicesEntity;
    this.servicesService.update(updated).subscribe({
      next: () => {
        this.fillListServices();
        this.showToast(updated.state ? 'Servicio activado.' : 'Servicio desactivado.', true);
      },
      error: err => this.showToast(err?.error?.message ?? 'Error', false),
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  openDeleteModal(svc: ServicesEntity) {
    this.editItem.set(svc);
    (document.getElementById('delete_service') as HTMLDialogElement | null)?.showModal();
  }

  confirmDelete() {
    const svc = this.editItem(); if (!svc) return;
    this.deleting.set(true);
    this.servicesService.delete(svc.id).subscribe({
      next: () => {
        this.deleting.set(false);
        (document.getElementById('delete_service') as HTMLDialogElement | null)?.close();
        this.fillListServices();
        this.showToast('Servicio eliminado.', true);
      },
      error: err => {
        this.deleting.set(false);
        this.showToast(err?.error?.message ?? 'Error al eliminar', false);
      },
    });
  }

  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
