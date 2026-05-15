import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { addSignedFooter } from '../../../shared/utils/pdf-signature.util';
import { environment } from '../../../../environments/environment';
import UserEntity from '../../interfaces/user.interface';
import { UsersService } from '../../services/users/users.service';
import { PlansService } from '../../services/plans/plans.service';
import PlanEntity from '../../interfaces/plan.interface';
import { BankAccountService } from '../../services/bankAccount/bankAccount.service';
import bankAccountEntity from '../../interfaces/bankAccount.interface';
import { PaymentsService } from '../../services/payments/payments.service';
import paymentEntity from '../../interfaces/payment.interface';
import { SocketService } from '../../../shared/services/socket.service';
import { PermissionsService } from '../../services/permissions/permissions.service';
import { AdminMessagesService } from '../../services/messages/messages.service';

@Component({
  selector: 'app-payments',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.css',
})
export class PaymentsComponent implements OnInit, OnDestroy {

  // ── State ─────────────────────────────────────────────────────────────────
  ListUsers        = signal<UserEntity[]>([]);
  ListBankAccount  = signal<bankAccountEntity[]>([]);
  ListPlans        = signal<PlanEntity[]>([]);
  ListPayments     = signal<paymentEntity[]>([]);

  // ── Filters ───────────────────────────────────────────────────────────────
  searchQuery   = signal('');
  filterState   = signal('');
  filterMethod  = signal('');
  filterService = signal('');
  filterPeriod  = signal<'all' | 'today' | 'week' | 'month' | 'year'>('all');
  dateFrom      = signal('');
  dateTo        = signal('');

  filteredPayments = computed(() => {
    const q       = this.searchQuery().toLowerCase().trim();
    const state   = this.filterState();
    const method  = this.filterMethod();
    const service = this.filterService().toLowerCase().trim();
    const period  = this.filterPeriod();
    const from    = this.dateFrom();
    const to      = this.dateTo();

    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const periodStart = (() => {
      if (period === 'today') return today;
      if (period === 'week')  { const d = new Date(today); d.setDate(d.getDate() - d.getDay()); return d; }
      if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
      if (period === 'year')  return new Date(now.getFullYear(), 0, 1);
      return null;
    })();

    const customFrom = from ? new Date(from + 'T00:00:00') : null;
    const customTo   = to   ? new Date(to   + 'T23:59:59') : null;

    return this.ListPayments().filter(p => {
      const matchQ = !q || (
        (p.user_name  ?? '').toLowerCase().includes(q) ||
        (p.user_email ?? '').toLowerCase().includes(q) ||
        (p.id         ?? '').toLowerCase().includes(q) ||
        (p.method     ?? '').toLowerCase().includes(q)
      );
      const matchState   = !state   || p.state === state;
      const matchMethod  = !method  || (p.method ?? '').toLowerCase().includes(method.toLowerCase());
      const matchService = !service || (
        (p.plan?.service_sortName ?? '').toLowerCase().includes(service) ||
        (p.plan?.plan_title_name  ?? '').toLowerCase().includes(service)
      );

      const createdAt = p.createdAt ? new Date(p.createdAt) : null;
      const matchPeriod = !periodStart || !createdAt || createdAt >= periodStart;
      const matchFrom   = !customFrom  || !createdAt || createdAt >= customFrom;
      const matchTo     = !customTo    || !createdAt || createdAt <= customTo;

      return matchQ && matchState && matchMethod && matchService && matchPeriod && matchFrom && matchTo;
    });
  });

  // ── Pagination ────────────────────────────────────────────────────────────
  pageSize    = signal<number>(50);
  currentPage = signal(1);

  totalPages = computed(() => {
    const size = this.pageSize();
    if (!size) return 1;
    return Math.max(1, Math.ceil(this.filteredPayments().length / size));
  });

  paginatedPayments = computed(() => {
    const size = this.pageSize();
    if (!size) return this.filteredPayments();
    const page  = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * size;
    return this.filteredPayments().slice(start, start + size);
  });

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const cur   = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [];
    pages.push(1);
    if (cur > 3) pages.push('...');
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
    if (cur < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  });

  goToPage(p: number | '...') {
    if (p === '...') return;
    this.currentPage.set(Math.max(1, Math.min(p, this.totalPages())));
  }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  clearFilters() {
    this.searchQuery.set('');
    this.filterState.set('');
    this.filterMethod.set('');
    this.filterService.set('');
    this.filterPeriod.set('all');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.currentPage.set(1);
  }

  hasActiveFilters = computed(() =>
    !!(this.searchQuery() || this.filterState() || this.filterMethod() ||
       this.filterService() || this.filterPeriod() !== 'all' || this.dateFrom() || this.dateTo())
  );

  // ── Stats ─────────────────────────────────────────────────────────────────
  paymentsAceptados  = computed(() => this.ListPayments().filter(p => p.state === 'Aceptado').length);
  paymentsPendientes = computed(() => this.ListPayments().filter(p => p.state === 'Pendiente' || p.state === 'Varificando').length);
  paymentsDevueltos  = computed(() => this.ListPayments().filter(p => p.state === 'Devuelto').length);

  SelectClient     = signal<UserEntity>(new UserEntity());
  selectedPayment  = signal<paymentEntity | null>(null);
  selectedFile: File | null = null;
  uploadProgress   = signal(0);
  toast            = signal<{ msg: string; ok: boolean } | null>(null);
  rejectReason     = '';

  // ── Manual payment helpers ────────────────────────────────────────────────

  /** Text typed in the client search combobox */
  clientSearch          = signal('');
  /** Whether the client dropdown list is visible */
  showClientDropdown    = signal(false);

  /** Live-filtered client list (max 50 shown) */
  filteredClients = computed(() => {
    const q = this.clientSearch().toLowerCase().trim();
    const list = q
      ? this.ListUsers().filter(u =>
          `${u.firstNames} ${u.lastNames}`.toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q) ||
          (u.dni   ?? '').toLowerCase().includes(q)
        )
      : this.ListUsers();
    return list.slice(0, 50);
  });

  /** Data-URL preview of the selected proof image */
  proofPreview = signal<string | null>(null);

  /** Plan selected inside the modal (for the preview card) */
  selectedPlan = computed(() => {
    const planId = this.userForm.get('plan_id')?.value;
    return this.SelectClient().services?.find(s => s.plan_id === planId) ?? null;
  });

  // ── Period signals (reactive — computed() can't read FormControl values) ──
  periodFromSig = signal('');
  periodToSig   = signal('');

  // ── Currencies ────────────────────────────────────────────────────────────
  readonly CURRENCIES: { code: string; symbol: string; name: string }[] = [
    // ── Américas ──
    { code: 'USD', symbol: '$',    name: 'Dólar estadounidense' },
    { code: 'CAD', symbol: 'CA$',  name: 'Dólar canadiense' },
    { code: 'MXN', symbol: '$',    name: 'Peso mexicano' },
    { code: 'GTQ', symbol: 'Q',    name: 'Quetzal guatemalteco' },
    { code: 'BZD', symbol: 'BZ$',  name: 'Dólar de Belice' },
    { code: 'HNL', symbol: 'L',    name: 'Lempira hondureño' },
    { code: 'NIO', symbol: 'C$',   name: 'Córdoba nicaragüense' },
    { code: 'CRC', symbol: '₡',    name: 'Colón costarricense' },
    { code: 'PAB', symbol: 'B/.',  name: 'Balboa panameño' },
    { code: 'CUP', symbol: '$',    name: 'Peso cubano' },
    { code: 'DOP', symbol: 'RD$',  name: 'Peso dominicano' },
    { code: 'HTG', symbol: 'G',    name: 'Gourde haitiano' },
    { code: 'JMD', symbol: 'J$',   name: 'Dólar jamaicano' },
    { code: 'TTD', symbol: 'TT$',  name: 'Dólar de Trinidad y Tobago' },
    { code: 'BBD', symbol: '$',    name: 'Dólar de Barbados' },
    { code: 'VES', symbol: 'Bs.S', name: 'Bolívar venezolano' },
    { code: 'COP', symbol: '$',    name: 'Peso colombiano' },
    { code: 'PEN', symbol: 'S/',   name: 'Sol peruano' },
    { code: 'ECU', symbol: '$',    name: 'Dólar ecuatoriano (USD)' },
    { code: 'BOB', symbol: 'Bs.',  name: 'Boliviano' },
    { code: 'BRL', symbol: 'R$',   name: 'Real brasileño' },
    { code: 'ARS', symbol: '$',    name: 'Peso argentino' },
    { code: 'CLP', symbol: '$',    name: 'Peso chileno' },
    { code: 'UYU', symbol: '$U',   name: 'Peso uruguayo' },
    { code: 'PYG', symbol: '₲',    name: 'Guaraní paraguayo' },
    // ── Europa ──
    { code: 'EUR', symbol: '€',    name: 'Euro' },
    { code: 'GBP', symbol: '£',    name: 'Libra esterlina' },
    { code: 'CHF', symbol: 'CHF',  name: 'Franco suizo' },
    { code: 'NOK', symbol: 'kr',   name: 'Corona noruega' },
    { code: 'SEK', symbol: 'kr',   name: 'Corona sueca' },
    { code: 'DKK', symbol: 'kr',   name: 'Corona danesa' },
    { code: 'ISK', symbol: 'kr',   name: 'Corona islandesa' },
    { code: 'CZK', symbol: 'Kč',   name: 'Corona checa' },
    { code: 'HUF', symbol: 'Ft',   name: 'Forinto húngaro' },
    { code: 'PLN', symbol: 'zł',   name: 'Esloti polaco' },
    { code: 'RON', symbol: 'lei',  name: 'Leu rumano' },
    { code: 'BGN', symbol: 'лв',   name: 'Lev búlgaro' },
    { code: 'HRK', symbol: 'kn',   name: 'Kuna croata' },
    { code: 'RSD', symbol: 'din',  name: 'Dinar serbio' },
    { code: 'RUB', symbol: '₽',    name: 'Rublo ruso' },
    { code: 'UAH', symbol: '₴',    name: 'Grivna ucraniana' },
    { code: 'GEL', symbol: '₾',    name: 'Lari georgiano' },
    { code: 'AMD', symbol: '֏',    name: 'Dram armenio' },
    { code: 'AZN', symbol: '₼',    name: 'Manat azerbaiyano' },
    // ── Asia / Pacífico ──
    { code: 'JPY', symbol: '¥',    name: 'Yen japonés' },
    { code: 'CNY', symbol: '¥',    name: 'Yuan chino' },
    { code: 'HKD', symbol: 'HK$',  name: 'Dólar de Hong Kong' },
    { code: 'TWD', symbol: 'NT$',  name: 'Dólar taiwanés' },
    { code: 'KRW', symbol: '₩',    name: 'Won surcoreano' },
    { code: 'SGD', symbol: 'S$',   name: 'Dólar de Singapur' },
    { code: 'MYR', symbol: 'RM',   name: 'Ringgit malayo' },
    { code: 'THB', symbol: '฿',    name: 'Baht tailandés' },
    { code: 'VND', symbol: '₫',    name: 'Dong vietnamita' },
    { code: 'IDR', symbol: 'Rp',   name: 'Rupia indonesia' },
    { code: 'PHP', symbol: '₱',    name: 'Peso filipino' },
    { code: 'INR', symbol: '₹',    name: 'Rupia india' },
    { code: 'PKR', symbol: '₨',    name: 'Rupia pakistaní' },
    { code: 'BDT', symbol: '৳',    name: 'Taka bangladesí' },
    { code: 'LKR', symbol: '₨',    name: 'Rupia de Sri Lanka' },
    { code: 'NPR', symbol: '₨',    name: 'Rupia nepalesa' },
    { code: 'AUD', symbol: 'A$',   name: 'Dólar australiano' },
    { code: 'NZD', symbol: 'NZ$',  name: 'Dólar neozelandés' },
    { code: 'FJD', symbol: 'FJ$',  name: 'Dólar fiyiano' },
    // ── Oriente Medio ──
    { code: 'AED', symbol: 'د.إ',  name: 'Dírham de EAU' },
    { code: 'SAR', symbol: '﷼',    name: 'Riyal saudí' },
    { code: 'QAR', symbol: '﷼',    name: 'Riyal catarí' },
    { code: 'KWD', symbol: 'د.ك',  name: 'Dinar kuwaití' },
    { code: 'BHD', symbol: '.د.ب', name: 'Dinar bareiní' },
    { code: 'OMR', symbol: '﷼',    name: 'Riyal omaní' },
    { code: 'JOD', symbol: 'JD',   name: 'Dinar jordano' },
    { code: 'ILS', symbol: '₪',    name: 'Nuevo séquel israelí' },
    { code: 'TRY', symbol: '₺',    name: 'Lira turca' },
    { code: 'IRR', symbol: '﷼',    name: 'Rial iraní' },
    { code: 'IQD', symbol: 'ع.د',  name: 'Dinar iraquí' },
    // ── África ──
    { code: 'ZAR', symbol: 'R',    name: 'Rand sudafricano' },
    { code: 'NGN', symbol: '₦',    name: 'Naira nigeriana' },
    { code: 'GHS', symbol: 'GH₵',  name: 'Cedi ghanés' },
    { code: 'KES', symbol: 'KSh',  name: 'Chelín keniano' },
    { code: 'EGP', symbol: '£',    name: 'Libra egipcia' },
    { code: 'MAD', symbol: 'MAD',  name: 'Dírham marroquí' },
    { code: 'TND', symbol: 'DT',   name: 'Dinar tunecino' },
    { code: 'DZD', symbol: 'دج',   name: 'Dinar argelino' },
    { code: 'ETB', symbol: 'Br',   name: 'Birr etíope' },
    { code: 'TZS', symbol: 'TSh',  name: 'Chelín tanzano' },
    { code: 'UGX', symbol: 'USh',  name: 'Chelín ugandés' },
    { code: 'XOF', symbol: 'CFA',  name: 'Franco CFA (UEMOA)' },
    { code: 'XAF', symbol: 'FCFA', name: 'Franco CFA (CEMAC)' },
    // ── Criptomonedas ──
    { code: 'USDT', symbol: '₮',   name: 'Tether (USDT)' },
    { code: 'BTC',  symbol: '₿',   name: 'Bitcoin' },
    { code: 'ETH',  symbol: 'Ξ',   name: 'Ethereum' },
    { code: 'USDC', symbol: '$',   name: 'USD Coin' },
    { code: 'BNB',  symbol: 'BNB', name: 'BNB' },
    { code: 'LTC',  symbol: 'Ł',   name: 'Litecoin' },
  ];

  // ── Services ──────────────────────────────────────────────────────────────
  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions = inject(PermissionsService);
  canCreate = computed(() => this.permissions.canDo('payments', 'create'));
  canUpdate = computed(() => this.permissions.canDo('payments', 'update'));
  canDelete = computed(() => this.permissions.canDo('payments', 'delete'));

  private userService        = inject(UsersService);
  private bankAccountService = inject(BankAccountService);
  private plansService       = inject(PlansService);
  private paymentsService    = inject(PaymentsService);
  private socketSvc          = inject(SocketService);
  private msgService         = inject(AdminMessagesService);
  private http               = inject(HttpClient);
  private fb                 = inject(FormBuilder);
  private subs               = new Subscription();

  // ── Voucher blob URL (loaded via HttpClient so auth interceptor fires) ────
  voucherBlobUrl  = signal<string | null>(null);
  voucherLoading  = signal(false);
  private _currentBlobUrl: string | null = null;

  hasError = signal('');

  userForm = this.fb.group({
    user_id:     ['', Validators.required],
    plan_id:     ['', Validators.required],
    file:        [''],
    state:       ['Aceptado', Validators.required],
    currency:    ['USD', Validators.required],
    amount:      ['', Validators.required],
    method:      ['', Validators.required],
    methodPay:   ['', Validators.required],
    period_from: ['', Validators.required],
    period_to:   ['', Validators.required],
    note:        [''],
  });

  // ── Period helpers ────────────────────────────────────────────────────────

  /** Auto-fills period_from from the selected plan's startedAt */
  fillPeriodFromPlan() {
    const plan = this.selectedPlan();
    if (!plan) return;
    const base = plan.endedAt
      ? this._dayAfter(new Date(plan.endedAt))
      : plan.startedAt
        ? new Date(plan.startedAt)
        : new Date();
    const fromStr = this._toInputDate(base);
    this.userForm.patchValue({ period_from: fromStr });
    this.periodFromSig.set(fromStr);
    this.autoPeriodTo();
  }

  /** Calculates period_to based on period_from + plan kind */
  autoPeriodTo() {
    const from = this.periodFromSig() || this.userForm.get('period_from')?.value;
    const plan = this.selectedPlan();
    if (!from || !plan?.kind) return;
    const toStr = this._toInputDate(this._addOnePeriod(new Date(from), plan.kind));
    this.userForm.patchValue({ period_to: toStr });
    this.periodToSig.set(toStr);
  }

  onPeriodFromChange(value: string) {
    this.userForm.patchValue({ period_from: value });
    this.periodFromSig.set(value);
    this.autoPeriodTo();
  }

  onPeriodToChange(value: string) {
    this.userForm.patchValue({ period_to: value });
    this.periodToSig.set(value);
  }

  periodPreview = computed(() => {
    const from = this.periodFromSig();
    const to   = this.periodToSig();
    if (!from) return null;
    const fmt = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
    return { from: fmt(from), to: to ? fmt(to) : '—', daysApart: to ? this._daysBetween(from, to) : null };
  });

  private _toInputDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private _dayAfter(d: Date): Date {
    const n = new Date(d); n.setDate(n.getDate() + 1); return n;
  }

  private _daysBetween(from: string, to: string): number {
    return Math.round(
      (new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime())
      / (1000 * 60 * 60 * 24)
    ) + 1;
  }

  /** Returns the LAST day of the period (inclusive). E.g. mes: 2026-05-01 → 2026-05-31 */
  private _addOnePeriod(from: Date, kind: string): Date {
    const d = new Date(from);
    switch ((kind ?? '').toLowerCase()) {
      case 'minuto':    d.setMinutes(d.getMinutes() + 1); break;
      case 'hora':      d.setHours(d.getHours() + 1);     break;
      case 'dia':       /* same day — no change */          break;
      case 'semana':    d.setDate(d.getDate() + 6);        break;
      case 'mes':       d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() - 1); break;
      case 'trimestre': d.setMonth(d.getMonth() + 3); d.setDate(d.getDate() - 1); break;
      case 'semestre':  d.setMonth(d.getMonth() + 6); d.setDate(d.getDate() - 1); break;
      case 'año':       d.setFullYear(d.getFullYear() + 1); d.setDate(d.getDate() - 1); break;
      default:          d.setMonth(d.getMonth() + 1); d.setDate(d.getDate() - 1); break;
    }
    return d;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.fillListPayments();
    if (this.permissions.canDo('users', 'view'))                  this.fillListUsers();
    if (this.permissions.canDo('settings/bank-account', 'view'))  this.fillBankAccount();
    if (this.permissions.canDo('settings/plans', 'view'))         this.fillListPlans();
    this.listenSockets();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private listenSockets(): void {
    // Actualizar pago en la lista sin recargar toda la colección
    this.subs.add(
      this.socketSvc.onPaymentUpdated().subscribe(evt => {
        this.ListPayments.update(list => {
          const p = list.find(x => x.id === evt.payment_id);
          if (p) p.state = evt.state as any;
          return [...list];
        });
      })
    );
  }

  fillListPayments() {
    this.paymentsService.getPayments().subscribe(resp => this.ListPayments.set(resp.data ?? []));
  }
  fillListUsers() {
    this.userService.getUsers().subscribe(resp => this.ListUsers.set(resp.data ?? []));
  }
  fillBankAccount() {
    this.bankAccountService.getBankAccount().subscribe(resp => this.ListBankAccount.set(resp?.data ?? []));
  }
  fillListPlans() {
    this.plansService.getPlans().subscribe(resp => this.ListPlans.set(resp.data ?? []));
  }

  // ── Create payment (manual / on behalf of client) ────────────────────────
  onSubmit() {
    if (this.userForm.invalid) {
      this.hasError.set('Completa los campos obligatorios');
      setTimeout(() => this.hasError.set(''), 3000);
      return;
    }
    const { plan_id, state, amount, method, methodPay, currency, period_from, period_to, note } = this.userForm.value;
    const user    = this.SelectClient();
    const plan    = user.services.find(p => p.plan_id === plan_id);
    const account = this.ListBankAccount().find(p => p.id === methodPay);
    if (!method || !state || !user.id || !plan?.plan_id || !account?.id) return;

    const adminNote = note?.trim()
      ? `[Pago gestionado por administrador] ${note.trim()}`
      : '[Pago gestionado por administrador]';

    // Build period as a human-readable range string
    const fmtDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('es', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    const periodStr = period_from
      ? `${fmtDate(period_from!)} → ${period_to ? fmtDate(period_to!) : '—'}`
      : '';

    const dataToSave = new paymentEntity();
    dataToSave.createdAt             = new Date();
    dataToSave.kind                  = plan.kind;
    dataToSave.method                = method!;
    dataToSave.methodPay.id          = account.id;
    dataToSave.methodPay.cardAccount = account.cardAccount;
    dataToSave.methodPay.name        = account.name;
    dataToSave.methodPay.number      = account.number;
    dataToSave.methodPay.typeAccount = account.typeAccount;
    dataToSave.note                  = adminNote;
    dataToSave.period                = periodStr;
    dataToSave.plan                  = plan;
    dataToSave.amount                = Number(amount);
    dataToSave.currencyCode          = currency || plan.currencyCode || 'USD';
    dataToSave.state                 = state!;
    dataToSave.user_email            = user.email;
    dataToSave.user_id               = user.id;
    dataToSave.user_name             = `${user.firstNames} ${user.lastNames}`;

    // Use a blank placeholder file when the admin has no proof image
    const proof = this.selectedFile ?? new File([], 'sin-comprobante.txt', { type: 'text/plain' });

    this.paymentsService.doesPayments(dataToSave.get(), proof).subscribe({
      next: ({ progress, response }) => {
        this.uploadProgress.set(progress);
        if (response) {
          this.showToast('Pago registrado correctamente', true);
          this.fillListPayments();
          this._resetAddForm();
        }
      },
      error: err => this.showToast(err?.error?.message ?? 'Error al registrar pago', false),
    });
  }

  _resetAddForm() {
    this.cerrarDialogo();
    this.userForm.reset({ state: 'Aceptado', currency: 'USD' });
    this.selectedFile  = null;
    this.proofPreview.set(null);
    this.clientSearch.set('');
    this.showClientDropdown.set(false);
    this.SelectClient.set(new UserEntity());
    this.periodFromSig.set('');
    this.periodToSig.set('');
    this.uploadProgress.set(0);
  }

  // ── Client combobox ───────────────────────────────────────────────────────

  selectClient(user: UserEntity) {
    this.SelectClient.set(user);
    this.userForm.patchValue({ user_id: user.id, plan_id: '' });
    this.clientSearch.set('');
    this.showClientDropdown.set(false);
    // Reset period when client changes
    this.periodFromSig.set('');
    this.periodToSig.set('');
    this.userForm.patchValue({ period_from: '', period_to: '', amount: '' });
  }

  clearClientSelection() {
    this.SelectClient.set(new UserEntity());
    this.clientSearch.set('');
    this.userForm.patchValue({ user_id: '', plan_id: '', amount: '', period_from: '', period_to: '' });
    this.periodFromSig.set('');
    this.periodToSig.set('');
  }

  openClientDropdown() {
    this.showClientDropdown.set(true);
  }

  closeClientDropdown() {
    // Delay to allow mousedown on list items to fire first
    setTimeout(() => this.showClientDropdown.set(false), 160);
  }

  // ── Plan change ───────────────────────────────────────────────────────────
  /** Called when plan select changes — auto-fill amount, currency and period */
  onPlanChange() {
    const plan = this.selectedPlan();
    if (!plan) return;
    this.userForm.patchValue({
      amount:   String(plan.price ?? ''),
      currency: plan.currencyCode || 'USD',
    });
    this.fillPeriodFromPlan();
  }

  // ── Confirm / Reject ──────────────────────────────────────────────────────
  openConfirm(pago: paymentEntity) {
    this.selectedPayment.set(pago);
    (document.getElementById('confirm_payment') as HTMLDialogElement | null)?.showModal();
  }

  doConfirm() {
    const pago = this.selectedPayment();
    if (!pago?.id) return;
    this.paymentsService.confirmPayment(pago.id).subscribe({
      next: () => {
        this.showToast('Pago confirmado', true);
        this.fillListPayments();
        this.closeModal('confirm_payment');
      },
      error: err => this.showToast(err?.error?.message ?? 'Error al confirmar', false),
    });
  }

  openReject(pago: paymentEntity) {
    this.selectedPayment.set(pago);
    this.rejectReason = '';
    (document.getElementById('reject_payment') as HTMLDialogElement | null)?.showModal();
  }

  doReject() {
    const pago = this.selectedPayment();
    if (!pago?.id) return;
    this.paymentsService.rejectPayment(pago.id, this.rejectReason).subscribe({
      next: () => {
        this.showToast('Pago rechazado', true);
        this.fillListPayments();
        this.closeModal('reject_payment');
      },
      error: err => this.showToast(err?.error?.message ?? 'Error al rechazar', false),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  onUploadProof(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.length ? input.files[0] : null;
    this.selectedFile = file;
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => this.proofPreview.set(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      this.proofPreview.set(null);
    }
  }

  clearProof() {
    this.selectedFile = null;
    this.proofPreview.set(null);
    this.userForm.patchValue({ file: '' });
  }


  /** Selected bank account object (reactive off the form value) */
  selectedBankAccount = computed(() => {
    const id = this.userForm.get('methodPay')?.value;
    return this.ListBankAccount().find(b => b.id === id) ?? null;
  });

  isCryptoBank(bank: bankAccountEntity | null): boolean {
    if (!bank) return false;
    return bank.typeAccount.startsWith('crypto_') || ['binance_pay', 'bybit_pay'].includes(bank.typeAccount);
  }

  bankAccountLabel(acc: bankAccountEntity): string {
    const tag = this.isCryptoBank(acc)
      ? (acc.currency ? `${acc.currency}` : '') + (acc.network ? ` · ${acc.network}` : '')
      : acc.cardAccount || acc.number || '';
    return `${acc.name}${tag ? ' · ' + tag : ''} (${acc.country?.countryName || '—'})`;
  }

  currencySymbol(code: string | null | undefined): string {
    return this.CURRENCIES.find(c => c.code === code)?.symbol ?? code ?? '';
  }

  currencyName(code: string | null | undefined): string {
    return this.CURRENCIES.find(c => c.code === code)?.name ?? '';
  }

  stateClass(state: string): string {
    switch (state) {
      case 'Aceptado':    return 'badge-success';
      case 'Varificando':
      case 'Pendiente':   return 'badge-warning';
      case 'Devuelto':    return 'badge-error';
      case 'Pagado':      return 'badge-info';
      default:            return 'badge-ghost';
    }
  }

  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }

  cerrarDialogo() {
    this.closeModal('add_payment');
  }

  closeModal(id: string) {
    (document.getElementById(id) as HTMLDialogElement | null)?.close();
  }

  openModal(id: string) {
    (document.getElementById(id) as HTMLDialogElement | null)?.showModal();
  }

  openVoucher(url: string | null | undefined) {
    const full = this.fullPictureUrl(url);
    if (full) window.open(full, '_blank');
  }

  /** Ensures picture URLs are always absolute.
   *  Relative paths (e.g. /uploads/xxx.jpg) get the API server base prepended. */
  fullPictureUrl(url: string | null | undefined): string {
    if (!url) return '';
    // Already an absolute URL or data URI → use as-is
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    const serverBase = environment.apiUrl.replace(/\/api$/, '');
    // Bare filename (no directory separator) → backend stores vouchers at storage/vouchers/
    if (!url.includes('/')) return `${serverBase}/storage/vouchers/${url}`;
    // Relative path already containing directory segments
    return `${serverBase}/${url.replace(/^\//, '')}`;
  }

  /** Opens the view_payment modal and loads the voucher image via HttpClient (respects auth interceptor). */
  openPaymentDetail(p: paymentEntity) {
    this.selectedPayment.set(p);
    this._revokeVoucherBlob();
    this.voucherBlobUrl.set(null);
    const url = this.fullPictureUrl(p.picture);
    if (url) {
      this.voucherLoading.set(true);
      this.http.get(url, { responseType: 'blob' }).subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);
          this._currentBlobUrl = objectUrl;
          this.voucherBlobUrl.set(objectUrl);
          this.voucherLoading.set(false);
        },
        error: () => {
          // Fallback: try direct URL (works if file is truly public)
          this.voucherBlobUrl.set(url);
          this.voucherLoading.set(false);
        },
      });
    }
    this.openModal('view_payment');
  }

  closePaymentDetail() {
    this._revokeVoucherBlob();
    this.voucherBlobUrl.set(null);
    this.closeModal('view_payment');
  }

  private _revokeVoucherBlob() {
    if (this._currentBlobUrl) {
      URL.revokeObjectURL(this._currentBlobUrl);
      this._currentBlobUrl = null;
    }
  }

  // ── Export payments ───────────────────────────────────────────────────────
  downloadPaymentsReport() {
    const rows = this.filteredPayments().map(p => ({
      ID:             p.id ?? '',
      Usuario:        p.user_name ?? '',
      Email:          p.user_email ?? '',
      Servicio:       p.plan?.service_sortName ?? '',
      Plan:           `${p.plan?.plan_title_prefix ?? ''} ${p.plan?.plan_title_name ?? ''}`.trim(),
      Monto:          p.amount ?? 0,
      Moneda:         p.plan?.currencyCode ?? '',
      Estado:         p.state ?? '',
      Metodo:         p.method ?? '',
      Cuenta_destino: `${p.methodPay?.name ?? ''} · ${p.methodPay?.number ?? ''}`.trim(),
      Periodo:        p.period ?? '',
      Nota:           p.note ?? '',
      Creado:         p.createdAt ? new Date(p.createdAt).toLocaleString('es') : '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    this._autoWidth(ws);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pagos');

    const activeFilters: string[] = [];
    if (this.filterState())   activeFilters.push(`Estado: ${this.filterState()}`);
    if (this.filterMethod())  activeFilters.push(`Método: ${this.filterMethod()}`);
    if (this.filterService()) activeFilters.push(`Servicio: ${this.filterService()}`);
    if (this.filterPeriod() !== 'all') activeFilters.push(`Período: ${this.filterPeriod()}`);
    if (this.dateFrom()) activeFilters.push(`Desde: ${this.dateFrom()}`);
    if (this.dateTo())   activeFilters.push(`Hasta: ${this.dateTo()}`);
    if (this.searchQuery()) activeFilters.push(`Búsqueda: ${this.searchQuery()}`);

    if (activeFilters.length) {
      const metaWs = XLSX.utils.aoa_to_sheet([
        ['Filtros aplicados en la exportación'],
        ...activeFilters.map(f => [f]),
        [],
        ['Total de registros exportados', rows.length],
        ['Fecha de exportación', new Date().toLocaleString('es')],
      ]);
      XLSX.utils.book_append_sheet(wb, metaWs, 'Filtros');
    }

    const ts = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `pagos_${ts}.xlsx`);
  }

  private _autoWidth(ws: XLSX.WorkSheet) {
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const colWidths = data.reduce((acc, row) => {
      row.forEach((cell: any, i: number) => {
        acc[i] = Math.max(acc[i] ?? 10, String(cell ?? '').length + 2);
      });
      return acc;
    }, [] as number[]);
    ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 50) }));
  }

  // ── Download single payment as PDF ────────────────────────────────────────
  async downloadPaymentInfo(p: paymentEntity) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const lm  = 18;
    const rm  = 192;
    let   y   = 18;

    // Sanitize any non-Latin-1 character for jsPDF Helvetica
    const safe = (s: string | null | undefined): string => {
      if (!s) return '-';
      return s
        .replace(/\u2192/g, '->')   // →
        .replace(/\u2190/g, '<-')   // ←
        .replace(/\u2013/g, '-')    // –
        .replace(/\u2014/g, '--')   // —
        .replace(/\u2026/g, '...')  // …
        .replace(/[^\x00-\xFF]/g, '?');  // cualquier otro Unicode → ?
    };

    const hr = (color = 185) => {
      doc.setDrawColor(color); doc.line(lm, y, rm, y); y += 5;
    };

    const row = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(110);
      doc.text(label, lm, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30);
      doc.text(safe(value), lm + 46, y);
      y += 5.8;
    };

    const sectionTitle = (title: string) => {
      y += 3;
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(lm - 2, y - 4.5, rm - lm + 4, 9, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40);
      doc.text(title, lm, y); y += 8;
    };

    // ── Encabezado ──
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 28, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255);
    doc.text('Comprobante de Pago', lm, 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(200, 210, 255);
    const genDate = new Date().toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(`Generado el ${genDate}`, lm, 21);
    y = 36;

    // ── Estado badge ──
    const stateColors: Record<string, [number,number,number]> = {
      Aceptado:    [22, 163, 74],
      Varificando: [202, 138, 4],
      Pendiente:   [59, 130, 246],
      Devuelto:    [220, 38, 38],
    };
    const [sr, sg, sb] = stateColors[p.state] ?? [100, 100, 100];
    doc.setFillColor(sr, sg, sb);
    doc.roundedRect(lm, y - 4.5, 44, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255);
    doc.text(p.state, lm + 4, y); y += 11;

    // ── Datos del pago ──
    sectionTitle('Datos del pago');
    row('ID del pago:',     p.id ?? '-');
    row('Fecha creado:',    p.createdAt ? new Date(p.createdAt).toLocaleDateString('es') : '-');
    row('Periodo:',         (p.period ?? '-').replace(/\u2192/g, 'al').replace(/[^\x00-\xFF]/g, '?'));
    row('Monto pagado:',    `${p.amount ?? 0} ${p.plan?.currencyCode ?? ''}`);
    row('Metodo de pago:',  p.method ?? '-');
    row('Cuenta destino:',  `${p.methodPay?.name ?? ''} ${p.methodPay?.number ?? ''}`.trim() || '-');

    y += 2; hr();

    // ── Cliente ──
    sectionTitle('Cliente');
    row('Nombre:',   p.user_name  ?? '-');
    row('Email:',    p.user_email ?? '-');

    y += 2; hr();

    // ── Servicio / Plan ──
    sectionTitle('Servicio y Plan');
    row('Servicio:',        p.plan?.service_sortName ?? '-');
    row('Plan:',            `${p.plan?.plan_title_prefix ?? ''} ${p.plan?.plan_title_name ?? ''}`.trim() || '-');
    row('Precio del plan:', `${p.plan?.price ?? '-'} ${p.plan?.currencyCode ?? ''}/${p.plan?.kind ?? ''}`);
    row('Dispositivos:',    String(p.plan?.limitDevices ?? '-'));

    if (p.note) {
      y += 2; hr();
      sectionTitle('Nota interna');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60);
      const noteLines = doc.splitTextToSize(safe(p.note), 162);
      doc.text(noteLines, lm, y);
      y += noteLines.length * 5.5 + 4;
    }

    // ── Comprobante (imagen) ──
    const picUrl = this.fullPictureUrl(p.picture);
    if (picUrl) {
      y += 2; hr();
      sectionTitle('Comprobante adjunto');

      // Use the already-loaded blob URL if available, otherwise try HttpClient
      let imgDataUrl: string | null = null;

      // If we have a blob URL already loaded in the modal, use it
      const blobUrl = this.voucherBlobUrl();
      if (blobUrl && blobUrl.startsWith('blob:')) {
        imgDataUrl = await this._blobUrlToBase64(blobUrl);
      }

      // Fallback: load via HttpClient (sends auth headers)
      if (!imgDataUrl) {
        imgDataUrl = await this._loadImageViaHttp(picUrl);
      }

      if (imgDataUrl) {
        if (y + 90 > 285) { doc.addPage(); y = 18; }
        const imgW = rm - lm;
        const imgH = 90;
        const fmt  = imgDataUrl.includes('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(imgDataUrl, fmt, lm, y, imgW, imgH, undefined, 'FAST');
        y += imgH + 4;
      } else {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(150);
        const wrapped = doc.splitTextToSize(`Ver comprobante en: ${picUrl}`, 160);
        doc.text(wrapped, lm, y);
        y += wrapped.length * 5 + 4;
      }
    }

    // ── Signed footer (all pages) ──
    await addSignedFooter(doc, p.id ?? 'sin-id', (p.id ?? '').slice(0, 8).toUpperCase());

    doc.save(`pago_${(p.id ?? 'info').slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  /** Converts an existing blob: URL back to a base64 data URL */
  private _blobUrlToBase64(blobUrl: string): Promise<string | null> {
    return new Promise(resolve => {
      fetch(blobUrl)  // same-origin blob: URL, no CORS issue
        .then(r => r.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        })
        .catch(() => resolve(null));
    });
  }

  /** Loads an image via HttpClient (auth interceptor fires) and returns base64 data URL */
  private async _loadImageViaHttp(url: string): Promise<string | null> {
    try {
      const blob = await firstValueFrom(this.http.get(url, { responseType: 'blob' }));
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  // ── Notify payment ────────────────────────────────────────────────────────
  notifyPayTarget   = signal<paymentEntity | null>(null);
  notifyPayChannels = signal<string[]>(['in_app']);
  notifyPaySubject  = signal('');
  notifyPayBody     = signal('');
  sendingPayNotify  = signal(false);

  openNotifyPayment(p: paymentEntity) {
    this.notifyPayTarget.set(p);
    this.notifyPaySubject.set(this._buildNotifySubject(p));
    this.notifyPayBody.set(this._buildNotifyBody(p));
    this.notifyPayChannels.set(['in_app']);
    this.sendingPayNotify.set(false);
    this.openModal('notify_payment');
  }

  toggleNotifyChannel(channel: string) {
    const current = this.notifyPayChannels();
    if (current.includes(channel)) {
      if (current.length === 1) return; // keep at least one
      this.notifyPayChannels.set(current.filter(c => c !== channel));
    } else {
      this.notifyPayChannels.set([...current, channel]);
    }
  }

  async sendPaymentNotify() {
    const p = this.notifyPayTarget();
    if (!p?.user_id) return;
    this.sendingPayNotify.set(true);

    // Build voucher attachment as base64 image so it shows inline in client messages
    const attachments: any[] = [];
    const picUrl = this.fullPictureUrl(p.picture);
    if (picUrl) {
      // Reuse already-loaded blob if the detail modal was open, otherwise fetch now
      let imgDataUrl: string | null = null;
      const blobUrl = this.voucherBlobUrl();
      if (blobUrl?.startsWith('blob:')) imgDataUrl = await this._blobUrlToBase64(blobUrl);
      if (!imgDataUrl)                  imgDataUrl = await this._loadImageViaHttp(picUrl);

      if (imgDataUrl) {
        const mimeType = imgDataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
        const base64   = imgDataUrl.split(',')[1];
        const ext      = mimeType.includes('png') ? 'png' : 'jpg';
        attachments.push({
          type:     'image',
          name:     `comprobante-pago.${ext}`,
          mimeType,
          data:     base64,
          size:     Math.round(base64.length * 0.75),
        });
      } else {
        // Fallback: plain link if image couldn't be loaded
        attachments.push({ type: 'link', name: 'Comprobante de pago', mimeType: 'image/jpeg', url: picUrl });
      }
    }

    // Hidden JSON attachment with structured payment data for client PDF generation
    const paymentData = {
      id:         p.id,
      state:      p.state,
      user_name:  p.user_name,
      user_email: p.user_email,
      amount:     p.amount,
      method:     p.method,
      period:     p.period,
      createdAt:  p.createdAt ? new Date(p.createdAt).toISOString() : null,
      plan: {
        service_sortName:   p.plan?.service_sortName,
        plan_title_prefix:  p.plan?.plan_title_prefix,
        plan_title_name:    p.plan?.plan_title_name,
        price:              p.plan?.price,
        currencyCode:       p.plan?.currencyCode,
        kind:               p.plan?.kind,
        limitDevices:       p.plan?.limitDevices,
      },
      methodPay: {
        name:   p.methodPay?.name,
        number: p.methodPay?.number,
      },
      note: p.note,
    };
    const jsonStr = JSON.stringify(paymentData);
    attachments.push({
      type:     'document',
      name:     '__payment_data__.json',
      mimeType: 'application/json',
      data:     btoa(unescape(encodeURIComponent(jsonStr))),
      size:     jsonStr.length,
    });

    this.msgService.send({
      to:          [p.user_id],
      to_label:    p.user_name ?? p.user_email ?? '',
      subject:     this.notifyPaySubject(),
      body:        this.notifyPayBody(),
      channels:    this.notifyPayChannels(),
      attachments,
    }).subscribe({
      next: () => {
        this.sendingPayNotify.set(false);
        this.showToast('Notificacion enviada al cliente', true);
        this.closeModal('notify_payment');
      },
      error: (err: any) => {
        this.sendingPayNotify.set(false);
        this.showToast(err?.error?.message ?? 'Error al enviar notificacion', false);
      },
    });
  }

  _buildNotifySubject(p: paymentEntity): string {
    const stateMap: Record<string, string> = {
      Aceptado:    'Pago confirmado',
      Varificando: 'Pago en revisión',
      Pendiente:   'Pago pendiente de confirmación',
      Devuelto:    'Pago devuelto',
    };
    return stateMap[p.state] ?? `Actualización de tu pago · ${p.id}`;
  }

  _buildNotifyBody(p: paymentEntity): string {
    const stateMsg: Record<string, string> = {
      Aceptado:    'Nos complace informarte que tu pago ha sido revisado y confirmado exitosamente.',
      Varificando: 'Hemos recibido tu comprobante y esta siendo revisado por nuestro equipo. Te notificaremos en breve.',
      Pendiente:   'Tu pago se encuentra pendiente de confirmacion. Si ya realizaste la transferencia, asegurate de haber subido el comprobante.',
      Devuelto:    'Lamentamos informarte que tu pago ha sido devuelto. Por favor contactate con nosotros para mas informacion.',
    };
    const serviceName = p.plan?.service_sortName ?? '';
    const planName    = `${p.plan?.plan_title_prefix ?? ''} ${p.plan?.plan_title_name ?? ''}`.trim();
    const amount      = `${p.amount} ${p.plan?.currencyCode ?? ''}`.trim();

    return `Estimado/a cliente,

${stateMsg[p.state] ?? 'Hay una actualizacion sobre tu pago.'}

Plan        : ${planName    || '-'}
Monto       : ${amount      || '-'}
Metodo      : ${p.method    ?? '-'}
Periodo     : ${p.period    ?? '-'}
Fecha       : ${p.createdAt ? new Date(p.createdAt).toLocaleDateString('es') : '-'}

El comprobante de pago y los detalles completos estan disponibles en el archivo adjunto. Puedes descargarlo como PDF usando el boton que aparece debajo de este mensaje.

Si tienes alguna pregunta no dudes en contactarnos.

Gracias por tu confianza.`;
  }
}
