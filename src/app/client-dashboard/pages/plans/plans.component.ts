import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { filter, take } from 'rxjs';
import { ClientService }          from '../../services/client/client.service';
import { PlansService }           from '../../services/plans/plans.service';
import { PaymentsService }        from '../../services/payments/payments.service';
import { BankAccountService }     from '../../services/bankAccount/bankAccount.service';
import { TermsService }           from '../../services/terms/terms.service';
import { CountriesService }       from '../../../admin-dashboard/services/countries/countries.service';
import { ClientMessagesService }  from '../../services/messages/messages.service';
import { SocketService }          from '../../../shared/services/socket.service';
import UserEntity                 from '../../interfaces/user.interface';
import PlanClientDto              from '../../interfaces/planClient.interface';
import PlanEntity                 from '../../interfaces/plan.interface';
import bankAccountEntity          from '../../interfaces/bankAccount.interface';
import TermsEntity                from '../../interfaces/terms.interface';
import { CountryEntity }          from '../../interfaces/country.interface';
import { LocaleService }          from '../../../shared/services/locale/locale.service';

interface ServiceGroup {
  serviceId:   string;
  sortName:    string;
  longName:    string;
  description: string;
  picture:     string;
  plans:       PlanEntity[];
  /** All contracted plans for this service (could be more than one) */
  userPlans:   PlanClientDto[];
}

@Component({
  selector: 'app-plans',
  imports: [CommonModule, DatePipe, ReactiveFormsModule],
  templateUrl: './plans.component.html',
  styleUrl: './plans.component.css',
})
export class PlansComponent implements OnInit {

  protected localeService  = inject(LocaleService);
  private clientService    = inject(ClientService);
  private plansService     = inject(PlansService);
  private paymentsService  = inject(PaymentsService);
  private bankService      = inject(BankAccountService);
  private termsService     = inject(TermsService);
  private countriesService = inject(CountriesService);
  private msgService       = inject(ClientMessagesService);
  private socketSvc        = inject(SocketService);
  private fb               = inject(FormBuilder);

  // ── State ──────────────────────────────────────────────────────────────────
  profile        = signal<UserEntity>(new UserEntity());
  catalogPlans   = signal<PlanEntity[]>([]);
  bankAccounts   = signal<bankAccountEntity[]>([]);
  terms          = signal<TermsEntity[]>([]);
  selectedPlan   = signal<PlanClientDto | null>(null);
  selectedBank   = signal<bankAccountEntity | null>(null);
  toast          = signal<{ msg: string; ok: boolean } | null>(null);
  saving         = signal(false);
  actionLoading  = signal<string | null>(null);
  uploadProgress = signal(0);
  selectedFile: File | null = null;

  months     = signal(1);
  totalPrice = computed(() => {
    const plan = this.selectedPlan();
    return plan ? +(plan.price * this.months()).toFixed(2) : 0;
  });
  readonly MONTH_OPTIONS = [1, 2, 3, 6, 12];

  // ── Service action targets ─────────────────────────────────────────────────
  targetService = signal<PlanClientDto | null>(null);
  cancelReason  = signal('');

  // ── VPN by-country modal state ─────────────────────────────────────────────
  allCountries       = signal<CountryEntity[]>([]);
  countrySearch      = signal('');
  /** IDs of selected countries (Set so toggle is O(1)) */
  selectedCountryIds = signal<Set<string>>(new Set());
  allCountriesSelected = signal(false);
  /** The ServiceGroup that opened this modal (must be VPN) */
  vpnModalGroup = signal<ServiceGroup | null>(null);
  inquirySending = signal(false);

  // ── Computed ───────────────────────────────────────────────────────────────
  activeServices = computed(() => this.profile().services.filter(s => s.active));
  expiredServices = computed(() => this.profile().services.filter(s => !s.active));

  visibleBanks = computed(() => this.bankAccounts().filter(b => b.active && b.visible));
  activeTerms  = computed(() => this.terms().filter(t => t.active));

  needsPersonalData = computed(() => {
    const u = this.profile();
    return !u.country?.countryName || !u.telephone?.length;
  });

  serviceGroups = computed((): ServiceGroup[] => {
    const plans    = this.catalogPlans();
    const userSvcs = this.profile().services as PlanClientDto[];
    const groupMap = new Map<string, ServiceGroup>();

    for (const plan of plans) {
      const svcRef      = (plan as any).service;
      const svcId       = typeof svcRef === 'object' ? (svcRef?.id ?? '') : String(svcRef ?? '');
      const sortName    = typeof svcRef === 'object' ? (svcRef?.sortName ?? svcId) : svcId;
      const longName    = typeof svcRef === 'object' ? (svcRef?.longName ?? '') : '';
      const description = typeof svcRef === 'object' ? (svcRef?.Description ?? '') : '';
      const picture     = typeof svcRef === 'object' ? (svcRef?.picture ?? '') : '';
      if (!svcId) continue;
      if (!groupMap.has(svcId)) {
        const userPlans = userSvcs.filter(us => us.service_id === svcId);
        groupMap.set(svcId, { serviceId: svcId, sortName, longName, description, picture, plans: [], userPlans });
      }
      groupMap.get(svcId)!.plans.push(plan);
    }
    return Array.from(groupMap.values());
  });

  /** Service groups where the client already has at least one contract */
  contractedGroups = computed(() => this.serviceGroups().filter(g => g.userPlans.length > 0));
  /** Service groups the client has NOT yet contracted */
  availableGroups  = computed(() => this.serviceGroups().filter(g => g.userPlans.length === 0));

  // ── VPN modal computed ─────────────────────────────────────────────────────
  /** Countries filtered by search query (accent-insensitive) */
  filteredCountries = computed(() => {
    const normalize = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const q    = normalize(this.countrySearch());
    const list = this.allCountries();
    if (!q) return list;
    return list.filter(c =>
      normalize(c.countryName).includes(q) ||
      normalize(c.languageName).includes(q)
    );
  });

  /** If exactly 1 country is selected and allCountriesSelected=false, this is it */
  singleSelectedCountry = computed((): CountryEntity | null => {
    if (this.allCountriesSelected()) return null;
    const ids = this.selectedCountryIds();
    if (ids.size !== 1) return null;
    const [id] = ids;
    return this.allCountries().find(c => c.id === id) ?? null;
  });

  /** Plans in the VPN catalog specifically for the single selected country (global plans excluded — they don't count as "having service" for a country) */
  vpnPlansForSelectedCountry = computed((): PlanEntity[] => {
    const group   = this.vpnModalGroup();
    const country = this.singleSelectedCountry();
    if (!group || !country) return [];
    return group.plans.filter(p => {
      const c  = (p as any).country;
      const id = typeof c === 'object' ? (c?.id ?? '') : String(c ?? '');
      return id === country.id;
    });
  });

  /** True if the single selected country is already covered by the client's VPN contract */
  selectedCountryAlreadyInVpn = computed((): boolean => {
    const group   = this.vpnModalGroup();
    const country = this.singleSelectedCountry();
    if (!group || !country) return false;
    return group.userPlans.some(up => {
      // Match by plan country id
      const c = (up as any).country;
      const cobj = typeof c === 'object' ? c : null;
      if (cobj?.id === country.id) return true;
      // Match by server country name (fallback)
      return up.servers?.some((s: any) =>
        s.server_country?.toLowerCase() === country.countryName.toLowerCase()
      ) ?? false;
    });
  });

  /** True if the client already has any plan in the VPN modal group */
  clientHasVpnGroup = computed((): boolean =>
    (this.vpnModalGroup()?.userPlans?.length ?? 0) > 0
  );

  // ── Payment form ───────────────────────────────────────────────────────────
  paymentForm = this.fb.group({
    plan_id:       ['', Validators.required],
    bank_id:       ['', Validators.required],
    terms_id:      ['', Validators.required],
    note:          [''],
    pd_country:    [''],
    pd_tel_number: [''],
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadProfile();
    this.loadBankAccounts();
    this.loadCatalogPlans();
    this.loadTerms();
    this.loadCountries();
  }

  loadProfile() {
    this.clientService.getMe().subscribe({
      next: resp => {
        if (resp?.data) {
          const u = new UserEntity(); u.set(resp.data as any); this.profile.set(u);
        }
      },
    });
  }

  loadBankAccounts() {
    this.bankService.getBankAccount().subscribe(resp => this.bankAccounts.set(resp.data ?? []));
  }

  loadCatalogPlans() {
    this.plansService.getPlans().subscribe(resp => this.catalogPlans.set(resp.data ?? []));
  }

  loadTerms() {
    this.termsService.get().subscribe(resp => this.terms.set(resp.data ?? []));
  }

  loadCountries() {
    this.countriesService.getAllCountries().subscribe(resp => {
      this.allCountries.set(resp.data ?? []);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  daysLeft(plan: PlanClientDto): number {
    if (!plan.endedAt) return 999;
    return Math.max(0, Math.ceil((new Date(plan.endedAt as any).getTime() - Date.now()) / 86_400_000));
  }

  isExpired(plan: PlanClientDto): boolean {
    if (!plan.endedAt) return false;
    return new Date(plan.endedAt as any) < new Date();
  }

  serverCount(plan: PlanClientDto): number {
    return plan.servers?.filter((s: any) => s.access_permmit && s.visible).length ?? 0;
  }

  isCrypto(bank: bankAccountEntity): boolean {
    return bank.typeAccount.startsWith('crypto_') || ['binance_pay', 'bybit_pay'].includes(bank.typeAccount);
  }

  bankTypeIcon(bank: bankAccountEntity): string {
    if (this.isCrypto(bank)) return '₿';
    if (bank.typeAccount === 'cash') return '💵';
    if (bank.typeAccount === 'card') return '💳';
    if (['sbp', 'tbank', 'yoomoney'].includes(bank.typeAccount)) return '📱';
    return '🏦';
  }

  planEntityToDto(p: PlanEntity): PlanClientDto {
    const dto = new PlanClientDto();
    const svcRef = (p as any).service;
    dto.plan_id           = p.id;
    dto.service_id        = typeof svcRef === 'object' ? (svcRef?.id ?? '') : (svcRef ?? '');
    dto.service_sortName  = typeof svcRef === 'object' ? (svcRef?.sortName ?? '') : '';
    dto.service_longName  = typeof svcRef === 'object' ? (svcRef?.longName ?? '') : '';
    dto.plan_title_prefix = p.title_prefix;
    dto.plan_title_name   = p.title_name;
    dto.plan_title_suffix = p.title_suffix;
    dto.price             = p.price;
    dto.currencyName      = p.currencyName;
    dto.currencyCode      = p.currencyCode;
    dto.currencySymbol    = p.currencySymbol;
    dto.currencyFormat    = p.currencyFormat;
    dto.kind              = p.kind;
    dto.limitDevices      = p.limitDevices;
    dto.global            = p.global;
    dto.startedAt         = new Date();
    dto.endedAt           = null;
    return dto;
  }

  planActionLabel(group: ServiceGroup, plan: PlanEntity): string {
    if (group.userPlans.length === 0) return plan.button_name || 'Contratar';
    const isContracted = group.userPlans.some(up => up.plan_id === plan.id);
    if (isContracted) return ''; // handled inline as "Tu plan"
    if (group.plans.length <= 1) return '';
    const ref = group.userPlans.find(up => up.active) ?? group.userPlans[0];
    return plan.price > ref.price ? '↑ Migrar a plan superior' : '↓ Degradar a plan inferior';
  }

  planActionClass(group: ServiceGroup, plan: PlanEntity): string {
    if (group.userPlans.length === 0) return 'btn-primary';
    const ref = group.userPlans.find(up => up.active) ?? group.userPlans[0];
    return plan.price > ref.price ? 'btn-success' : 'btn-warning';
  }

  planTitle(plan: PlanEntity): string {
    const pre  = this.localeService.displayI18n(plan.title_prefix_i18n, plan.title_prefix);
    const name = this.localeService.displayI18n(plan.title_name_i18n,   plan.title_name);
    const suf  = this.localeService.displayI18n(plan.title_suffix_i18n, plan.title_suffix);
    return [pre, name, suf].filter(Boolean).join(' ');
  }

  /** Returns the first active contracted plan for a group, or first contracted plan */
  primaryUserPlan(group: ServiceGroup): PlanClientDto {
    return group.userPlans.find(up => up.active) ?? group.userPlans[0];
  }

  /** True if any contracted plan in the group matches the given plan catalog id */
  isContractedPlan(group: ServiceGroup, planId: string): boolean {
    return group.userPlans.some(up => up.plan_id === planId);
  }

  // ── Payment modal ──────────────────────────────────────────────────────────
  openPayment(plan: PlanClientDto) {
    this.selectedPlan.set(plan);
    this.selectedBank.set(null);
    this.months.set(1);
    this.selectedFile = null;
    this.uploadProgress.set(0);
    this.paymentForm.reset({
      plan_id:  plan.plan_id,
      bank_id:  '',
      terms_id: this.activeTerms()[0]?.id ?? '',
      note:     '',
    });
    (document.getElementById('pay_modal') as HTMLDialogElement | null)?.showModal();
  }

  openPaymentFromCatalog(plan: PlanEntity) {
    this.openPayment(this.planEntityToDto(plan));
  }

  setMonths(n: number) { this.months.set(n); }

  selectBank(bankId: string) {
    const bank = this.visibleBanks().find(b => b.id === bankId) ?? null;
    this.selectedBank.set(bank);
    this.paymentForm.patchValue({ bank_id: bankId });
  }

  onTermsCheck(checked: boolean) {
    const id = checked ? (this.activeTerms()[0]?.id ?? '') : '';
    this.paymentForm.patchValue({ terms_id: id });
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.length ? input.files[0] : null;
  }

  canSubmit(): boolean {
    return !this.paymentForm.invalid && !this.saving() && !!this.selectedFile;
  }

  onPaySubmit() {
    if (!this.canSubmit()) return;

    const plan = this.selectedPlan();
    const user = this.profile();
    const v    = this.paymentForm.value;

    if (!plan) { this.showToast('Selecciona un servicio', false); return; }
    if (!v.bank_id) { this.showToast('Selecciona un método de pago', false); return; }

    const personalData = {
      country:   user.country?.id || (v.pd_country ?? ''),
      telephone: {
        country: user.country?.id || (v.pd_country ?? ''),
        number:  user.telephone?.[0]?.phone || (v.pd_tel_number ?? ''),
      },
    };

    const payload: any = {
      plan:         plan.plan_id,
      bank:         v.bank_id,
      terms:        v.terms_id,
      global:       plan.global ?? false,
      payTo:        this.months(),
      total:        this.totalPrice(),
      PersonalData: personalData,
    };

    this.saving.set(true);
    this.paymentsService.doesPaymentsInitial(payload, this.selectedFile).subscribe({
      next: ({ progress, response }) => {
        this.uploadProgress.set(progress);
        if (response) {
          this.saving.set(false);
          this.showToast('Pago enviado. El administrador lo revisará pronto.', true);
          (document.getElementById('pay_modal') as HTMLDialogElement | null)?.close();
          this.paymentForm.reset();
          this.selectedFile = null;
          this.uploadProgress.set(0);
          this.loadProfile();
        }
      },
      error: (err: any) => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al enviar el pago', false);
      },
    });
  }

  // ── Service actions ────────────────────────────────────────────────────────
  openSuspend(plan: PlanClientDto) {
    this.targetService.set(plan);
    (document.getElementById('suspend_modal') as HTMLDialogElement | null)?.showModal();
  }

  openReactivate(plan: PlanClientDto) {
    this.targetService.set(plan);
    (document.getElementById('reactivate_modal') as HTMLDialogElement | null)?.showModal();
  }

  openCancel(plan: PlanClientDto) {
    this.targetService.set(plan);
    this.cancelReason.set('');
    (document.getElementById('cancel_modal') as HTMLDialogElement | null)?.showModal();
  }

  confirmSuspend() {
    const svc = this.targetService(); if (!svc) return;
    this.actionLoading.set(svc.service_id);
    this.clientService.suspendService(svc.service_id).subscribe({
      next: (resp: any) => {
        this.actionLoading.set(null);
        (document.getElementById('suspend_modal') as HTMLDialogElement | null)?.close();
        this.showToast(resp?.message ?? 'Servicio suspendido.', true);
        this.loadProfile();
      },
      error: err => { this.actionLoading.set(null); this.showToast(err?.error?.message ?? 'Error', false); },
    });
  }

  confirmReactivate() {
    const svc = this.targetService(); if (!svc) return;
    this.actionLoading.set(svc.service_id);
    this.clientService.reactivateService(svc.service_id).subscribe({
      next: (resp: any) => {
        this.actionLoading.set(null);
        (document.getElementById('reactivate_modal') as HTMLDialogElement | null)?.close();
        this.showToast(resp?.message ?? 'Servicio reactivado.', true);
        this.loadProfile();
      },
      error: err => { this.actionLoading.set(null); this.showToast(err?.error?.message ?? 'Error', false); },
    });
  }

  confirmCancel() {
    const svc = this.targetService(); if (!svc) return;
    this.actionLoading.set(svc.service_id);
    this.clientService.requestCancelService(svc.service_id, this.cancelReason()).subscribe({
      next: (resp: any) => {
        this.actionLoading.set(null);
        (document.getElementById('cancel_modal') as HTMLDialogElement | null)?.close();
        this.showToast(resp?.message ?? 'Solicitud enviada.', true);
      },
      error: err => { this.actionLoading.set(null); this.showToast(err?.error?.message ?? 'Error', false); },
    });
  }

  // ── VPN by-country modal ───────────────────────────────────────────────────
  groupHasGlobalUserPlan(group: ServiceGroup): boolean {
    return group.userPlans.some(up => up.global);
  }

  groupHasGlobalCatalogPlan(group: ServiceGroup): boolean {
    return group.plans.some(p => p.global);
  }

  isVpnGroup(group: ServiceGroup): boolean {
    return group.sortName.toUpperCase().includes('VPN') ||
           group.plans.some(p => (p as any).vpnMode != null);
  }

  openVpnCountryModal(group: ServiceGroup) {
    this.vpnModalGroup.set(group);
    this.selectedCountryIds.set(new Set());
    this.allCountriesSelected.set(false);
    this.countrySearch.set('');
    (document.getElementById('vpn_country_modal') as HTMLDialogElement | null)?.showModal();
  }

  closeVpnCountryModal() {
    (document.getElementById('vpn_country_modal') as HTMLDialogElement | null)?.close();
    this.selectedCountryIds.set(new Set());
    this.allCountriesSelected.set(false);
    this.countrySearch.set('');
  }

  toggleCountry(countryId: string) {
    if (this.allCountriesSelected()) return;
    const current = new Set(this.selectedCountryIds());
    if (current.has(countryId)) {
      current.delete(countryId);
    } else {
      current.add(countryId);
    }
    this.selectedCountryIds.set(current);
  }

  isCountrySelected(countryId: string): boolean {
    return this.selectedCountryIds().has(countryId);
  }

  toggleAllCountries() {
    const next = !this.allCountriesSelected();
    this.allCountriesSelected.set(next);
    if (next) {
      this.selectedCountryIds.set(new Set());
    }
  }

  contactSupportForPrice() {
    if (this.inquirySending()) return;
    this.inquirySending.set(true);

    const allSelected = this.allCountriesSelected();
    const selected    = this.allCountries().filter(c => this.isCountrySelected(c.id));

    const countryList = allSelected
      ? 'Todos los países disponibles'
      : selected.map(c => `${c.flag} ${c.countryName}`).join(', ') || 'No especificado';

    const subject = allSelected
      ? 'Consulta VPN — Todos los países'
      : selected.length === 1
        ? `Consulta VPN por País — ${selected[0].flag} ${selected[0].countryName}`
        : `Consulta VPN — ${selected.length} países seleccionados`;

    const body = [
      '📡 Consulta de servicio VPN por País',
      '',
      `Países de interés: ${countryList}`,
      '',
      'Por favor, indíqueme los planes disponibles y sus precios para los países mencionados.',
    ].join('\n');

    const correlationId = crypto.randomUUID();
    const payload = { correlationId, subject, body, reply_to_id: null, attachments: [] };

    const sent = this.socketSvc.sendRaw('messages:send', payload);

    if (!sent) {
      // WebSocket not connected — HTTP fallback
      this.msgService.send(subject, body, null, []).subscribe({
        next: () => {
          this.inquirySending.set(false);
          this.closeVpnCountryModal();
          this.showToast('Consulta enviada. Un asesor se pondrá en contacto contigo pronto.', true);
        },
        error: (err: any) => {
          this.inquirySending.set(false);
          this.showToast(err?.error?.message ?? 'Error al enviar la consulta', false);
        },
      });
      return;
    }

    // Wait for WebSocket ACK
    this.socketSvc.onSendAck().pipe(
      filter(ack => ack.correlationId === correlationId),
      take(1),
    ).subscribe(ack => {
      this.inquirySending.set(false);
      if (ack.ok) {
        this.closeVpnCountryModal();
        this.showToast('Consulta enviada. Un asesor se pondrá en contacto contigo pronto.', true);
      } else {
        this.showToast(ack.error ?? 'Error al enviar la consulta', false);
      }
    });
  }

  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 5000);
  }
}
