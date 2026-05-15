import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import PlanEntity from '../../interfaces/plan.interface';
import { PlansService } from '../../services/plans/plans.service';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CountriesService } from '../../services/countries/countries.service';
import { CountryEntity } from '../../interfaces/country.interface';
import ServicesEntity from '../../interfaces/services.interface';
import { ServicesService } from '../../services/services/services.service';
import { PermissionsService } from '../../services/permissions/permissions.service';
import { LocaleService } from '../../../shared/services/locale/locale.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-plans',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './plans.component.html',
  styleUrl: './plans.component.css',
})
export class PlansComponent implements OnInit, OnDestroy {

  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions      = inject(PermissionsService);
  protected localeService  = inject(LocaleService);
  canCreate = computed(() => this.permissions.canDo('settings/plans', 'create'));
  canUpdate = computed(() => this.permissions.canDo('settings/plans', 'update'));
  canDelete = computed(() => this.permissions.canDo('settings/plans', 'delete'));

  private plansService    = inject(PlansService);
  private countryService  = inject(CountriesService);
  private servicesService = inject(ServicesService);
  private fb              = inject(FormBuilder);

  ListCountries = signal<CountryEntity[]>([]);
  ListServices  = signal<ServicesEntity[]>([]);
  ListPlans     = signal<PlanEntity[]>([]);
  hasError      = signal('');
  editItem      = signal<PlanEntity | null>(null);
  viewItem      = signal<PlanEntity | null>(null);
  saving        = signal(false);
  deleting      = signal(false);
  loading       = signal(false);

  // ── i18n ──────────────────────────────────────────────────────────────────
  /** Active system languages (driven by localeService signal) */
  activeLangs = computed(() => this.localeService.systemLanguages());

  /**
   * Per-language text values for Add form.
   * Shape: { fieldName: { langCode: value } }
   * Includes 'features' key — stored as comma-separated string, converted to array on save.
   */
  i18nAdd  = signal<Record<string, Record<string, string>>>({});
  i18nEdit = signal<Record<string, Record<string, string>>>({});

  /** Validation: at least one lang must have title_name filled */
  addTitleValid  = computed(() =>
    this.activeLangs().some(l => (this.i18nAdd()['title_name']?.[l.code] ?? '').trim() !== '')
  );
  editTitleValid = computed(() =>
    this.activeLangs().some(l => (this.i18nEdit()['title_name']?.[l.code] ?? '').trim() !== '')
  );

  setI18nAdd(field: string, lang: string, value: string): void {
    this.i18nAdd.update(v => ({ ...v, [field]: { ...(v[field] ?? {}), [lang]: value } }));
  }

  setI18nEdit(field: string, lang: string, value: string): void {
    this.i18nEdit.update(v => ({ ...v, [field]: { ...(v[field] ?? {}), [lang]: value } }));
  }

  // ── Search / Filter ───────────────────────────────────────────────────────
  searchQuery  = signal('');
  filterActive = signal('');   // '' | 'active' | 'inactive'
  filterService = signal('');  // '' | serviceId

  filteredPlans = computed(() => {
    const q   = this.searchQuery().toLowerCase().trim();
    const fa  = this.filterActive();
    const fs  = this.filterService();
    return this.ListPlans().filter(p => {
      const title = this.localeService.displayI18n((p as any).title_name_i18n, (p as any).title_name ?? '').toLowerCase();
      const matchQ = !q || title.includes(q) || (p.id ?? '').toLowerCase().includes(q);
      const matchActive =
        !fa ||
        (fa === 'active'   &&  p.active) ||
        (fa === 'inactive' && !p.active);
      const matchService = !fs || p.service?.id === fs;
      return matchQ && matchActive && matchService;
    });
  });

  // ── Stats ─────────────────────────────────────────────────────────────────
  totalPlans    = computed(() => this.ListPlans().length);
  activePlans   = computed(() => this.ListPlans().filter(p => p.active).length);
  inactivePlans = computed(() => this.ListPlans().filter(p => !p.active).length);
  visiblePlans  = computed(() => this.ListPlans().filter(p => p.visible).length);

  private subs = new Subscription();

  // ── VPN mode helpers ──────────────────────────────────────────────────────
  isVpnService(serviceId: string): boolean {
    const s = this.ListServices().find(s => s.id === serviceId);
    return !!s && !!(s.sortName?.toLowerCase().includes('vpn') || (s.sortName_i18n && Object.values(s.sortName_i18n).some(v => v?.toLowerCase().includes('vpn'))));
  }

  isVpnAdd   = signal(false);
  isVpnEdit  = signal(false);
  vpnModeAdd  = signal<string | null>(null);
  vpnModeEdit = signal<string | null>(null);

  readonly VPN_PERIOD_OPTIONS = [
    { value: 'dia',       label: 'Día' },
    { value: 'semana',    label: 'Semana' },
    { value: 'mes',       label: 'Mes' },
    { value: 'trimestre', label: 'Trimestre' },
  ];

  readonly KIND_OPTIONS = [
    { value: 'hora',      label: 'Hora' },
    { value: 'dia',       label: 'Día' },
    { value: 'semana',    label: 'Semana' },
    { value: 'quincena',  label: 'Quincena' },
    { value: 'mes',       label: 'Mes' },
    { value: 'trimestre', label: 'Trimestre' },
    { value: 'semestre',  label: 'Semestre' },
    { value: 'anual',     label: 'Anual' },
  ];

  // ── Forms (operational fields only — text/i18n fields managed via i18n signals) ──
  planForm = this.fb.group({
    price:           [0, [Validators.required, Validators.min(0)]],
    kind:            ['mes', Validators.required],
    country:         ['', Validators.required],
    service:         ['', Validators.required],
    limitDevices:    [1, [Validators.required, Validators.min(1)]],
    active:          [false],
    visible:         [false],
    global:          [false],
    main:            [false],
    vpnMode:         [null as string | null],
    dataLimitGB:     [0],
    dataLimitPeriod: ['mes'],
    userNameService: [''],
    passwordService: [''],
    codeService:     [''],
  });

  editForm = this.fb.group({
    id:              [''],
    price:           [0, [Validators.required, Validators.min(0)]],
    kind:            ['mes', Validators.required],
    country:         ['', Validators.required],
    service:         ['', Validators.required],
    limitDevices:    [1, [Validators.required, Validators.min(1)]],
    active:          [false],
    visible:         [false],
    global:          [false],
    main:            [false],
    vpnMode:         [null as string | null],
    dataLimitGB:     [0],
    dataLimitPeriod: ['mes'],
    userNameService: [''],
    passwordService: [''],
    codeService:     [''],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.fillListPlans();
    if (this.permissions.canDo('settings/services', 'view')) this.fillListServices();
    this.fillListCountries();

    this.subs.add(
      this.planForm.get('service')!.valueChanges.subscribe(v =>
        this.isVpnAdd.set(this.isVpnService(v ?? ''))
      )
    );
    this.subs.add(
      this.editForm.get('service')!.valueChanges.subscribe(v =>
        this.isVpnEdit.set(this.isVpnService(v ?? ''))
      )
    );
    this.subs.add(
      this.planForm.get('vpnMode')!.valueChanges.subscribe(v =>
        this.vpnModeAdd.set(v ?? null)
      )
    );
    this.subs.add(
      this.editForm.get('vpnMode')!.valueChanges.subscribe(v =>
        this.vpnModeEdit.set(v ?? null)
      )
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  fillListCountries() {
    this.countryService.getAllCountries().subscribe(resp => this.ListCountries.set(resp.data ?? []));
  }

  fillListServices() {
    this.servicesService.get().subscribe(resp => this.ListServices.set(resp.data ?? []));
  }

  fillListPlans() {
    this.loading.set(true);
    this.plansService.getPlans().subscribe({
      next:  resp => { this.ListPlans.set(resp.data ?? []); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private parseFeatures(raw: string): string[] {
    return (raw ?? '').split(',').map(f => f.trim()).filter(Boolean);
  }

  /** Resolve display name for a plan in the current UI language (for table/modals) */
  planDisplayName(p: PlanEntity): string {
    const name = this.localeService.displayI18n(p.title_name_i18n, p.title_name);
    const pre  = this.localeService.displayI18n(p.title_prefix_i18n, p.title_prefix);
    const suf  = this.localeService.displayI18n(p.title_suffix_i18n, p.title_suffix);
    return [pre, name, suf].filter(Boolean).join(' ');
  }

  private buildPlanEntity(
    formValue: any,
    i18nData: Record<string, Record<string, string>>,
    existingPlan?: PlanEntity | null
  ): PlanEntity | null {
    const exist_Service = this.ListServices().find(s => s.id === formValue.service);
    const exist_Country = this.ListCountries().find(c => c.id === formValue.country);
    if (!exist_Service || !exist_Country) {
      this.hasError.set('Selecciona un servicio y país válidos');
      setTimeout(() => this.hasError.set(''), 3000);
      return null;
    }
    const service = new ServicesEntity(); service.set(exist_Service);
    const country = new CountryEntity(); country.set(exist_Country);
    const dataToSave = new PlanEntity();
    if (existingPlan) dataToSave.set({ ...existingPlan, ...formValue });
    else dataToSave.set(formValue);

    // i18n text fields
    dataToSave.title_prefix_i18n = i18nData['title_prefix'] ?? {};
    dataToSave.title_name_i18n   = i18nData['title_name']   ?? {};
    dataToSave.title_suffix_i18n = i18nData['title_suffix'] ?? {};
    dataToSave.description_i18n  = i18nData['description']  ?? {};
    dataToSave.button_name_i18n  = i18nData['button_name']  ?? {};

    // features: comma string per lang → string[] per lang
    const featRaw = i18nData['features'] ?? {};
    dataToSave.features_i18n = Object.fromEntries(
      Object.entries(featRaw).map(([lang, raw]) => [lang, this.parseFeatures(raw)])
    ) as Record<string, string[]>;

    dataToSave.service        = service;
    dataToSave.country        = country;
    dataToSave.currencyCode   = service.country?.countryCode   ?? '';
    dataToSave.currencyFormat = service.country?.currencyFormat ?? '';
    dataToSave.currencyName   = service.country?.currencyName   ?? '';
    dataToSave.currencySymbol = service.country?.currencySymbol ?? '';
    dataToSave.language       = service.country?.languageCode   ?? '';

    const isVpn = this.isVpnService(formValue.service ?? '');
    dataToSave.vpnMode        = isVpn ? (formValue.vpnMode ?? null) : null;
    dataToSave.dataLimitGB    = isVpn && formValue.vpnMode === 'by_data' ? (Number(formValue.dataLimitGB) || 0) : 0;
    dataToSave.dataLimitPeriod = isVpn && formValue.vpnMode === 'by_data' ? (formValue.dataLimitPeriod ?? '') : '';
    dataToSave.userNameService = formValue.userNameService ?? '';
    dataToSave.passwordService = formValue.passwordService ?? '';
    dataToSave.codeService     = formValue.codeService ?? '';
    return dataToSave;
  }

  // ── Create ────────────────────────────────────────────────────────────────
  onSubmit() {
    if (this.planForm.invalid || !this.addTitleValid()) {
      this.hasError.set('Formulario inválido. Completa al menos el nombre en un idioma.');
      setTimeout(() => this.hasError.set(''), 3000);
      return;
    }
    const plan = this.buildPlanEntity(this.planForm.value, this.i18nAdd());
    if (!plan) return;
    try {
      this.plansService.register(plan.get()).subscribe({
        next: () => {
          this.fillListPlans();
          (document.getElementById('add_plan') as HTMLDialogElement | null)?.close();
          this.planForm.reset({ kind: 'mes', active: false, visible: false, global: false, main: false, price: 0, limitDevices: 1, vpnMode: null, dataLimitGB: 0, dataLimitPeriod: 'mes', userNameService: '', passwordService: '', codeService: '' });
          this.i18nAdd.set({});
        },
        error: err => {
          this.hasError.set(err?.error?.message ?? 'Error al crear el plan');
          setTimeout(() => this.hasError.set(''), 4000);
        },
      });
    } catch (e: any) {
      this.hasError.set(e.message); setTimeout(() => this.hasError.set(''), 3000);
    }
  }

  // ── View ──────────────────────────────────────────────────────────────────
  openViewModal(plan: PlanEntity) {
    this.viewItem.set(plan);
    (document.getElementById('view_plan') as HTMLDialogElement | null)?.showModal();
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  openEditModal(plan: PlanEntity) {
    this.editItem.set(plan);
    const langs = this.localeService.systemLanguages();

    // Populate i18n signals — fall back legacy plain string to all langs
    const fields = ['title_prefix', 'title_name', 'title_suffix', 'description', 'button_name'] as const;
    const toSignal: Record<string, Record<string, string>> = {};
    for (const f of fields) {
      const i18nKey = (f + '_i18n') as keyof PlanEntity;
      const existing = (plan[i18nKey] ?? {}) as Record<string, string>;
      const hasI18n = Object.values(existing).some(v => !!v);
      if (hasI18n) {
        toSignal[f] = { ...existing };
      } else {
        // Legacy: spread the plain string to every active lang
        const legacy = (plan[f as keyof PlanEntity] as string) ?? '';
        toSignal[f] = Object.fromEntries(langs.map(l => [l.code, legacy]));
      }
    }

    // features_i18n → comma string per lang
    const featI18n: Record<string, string> = {};
    for (const l of langs) {
      const arr = plan.features_i18n?.[l.code] ?? [];
      featI18n[l.code] = arr.length ? arr.join(', ') : (plan.features?.join(', ') ?? '');
    }
    toSignal['features'] = featI18n;
    this.i18nEdit.set(toSignal);

    this.editForm.patchValue({
      id:              plan.id,
      price:           plan.price,
      kind:            plan.kind,
      country:         plan.country?.id ?? '',
      service:         plan.service?.id ?? '',
      limitDevices:    plan.limitDevices,
      active:          plan.active,
      visible:         plan.visible,
      global:          plan.global,
      main:            plan.main,
      vpnMode:         plan.vpnMode ?? null,
      dataLimitGB:     plan.dataLimitGB ?? 0,
      dataLimitPeriod: plan.dataLimitPeriod ?? 'mes',
      userNameService: plan.userNameService ?? '',
      passwordService: plan.passwordService ?? '',
      codeService:     plan.codeService ?? '',
    });
    this.isVpnEdit.set(this.isVpnService(plan.service?.id ?? ''));
    this.vpnModeEdit.set(plan.vpnMode ?? null);
    (document.getElementById('edit_plan') as HTMLDialogElement | null)?.showModal();
  }

  onEditSubmit() {
    if (this.editForm.invalid || !this.editTitleValid()) return;
    const plan = this.buildPlanEntity(this.editForm.value, this.i18nEdit(), this.editItem());
    if (!plan) return;
    try {
      this.saving.set(true);
      this.plansService.update(plan).subscribe({
        next: () => {
          this.saving.set(false);
          this.fillListPlans();
          (document.getElementById('edit_plan') as HTMLDialogElement | null)?.close();
        },
        error: err => {
          this.saving.set(false);
          this.hasError.set(err?.error?.message ?? 'Error al actualizar el plan');
          setTimeout(() => this.hasError.set(''), 3000);
        },
      });
    } catch (e: any) {
      this.saving.set(false); this.hasError.set(e.message); setTimeout(() => this.hasError.set(''), 3000);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  openDeleteModal(plan: PlanEntity) {
    this.editItem.set(plan);
    (document.getElementById('delete_plan') as HTMLDialogElement | null)?.showModal();
  }

  confirmDelete() {
    const plan = this.editItem(); if (!plan) return;
    this.deleting.set(true);
    this.plansService.delete(plan.id).subscribe({
      next: () => {
        this.deleting.set(false);
        (document.getElementById('delete_plan') as HTMLDialogElement | null)?.close();
        this.fillListPlans();
      },
      error: err => {
        this.deleting.set(false);
        this.hasError.set(err?.error?.message ?? 'Error al eliminar el plan');
        setTimeout(() => this.hasError.set(''), 3000);
      },
    });
  }
}
