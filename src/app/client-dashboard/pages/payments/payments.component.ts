import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import jsPDF from 'jspdf';
import { addSignedFooter } from '../../../shared/utils/pdf-signature.util';
import { environment } from '../../../../environments/environment';
import { ClientService } from '../../services/client/client.service';
import { PaymentsService } from '../../services/payments/payments.service';
import { BankAccountService } from '../../services/bankAccount/bankAccount.service';
import { TermsService } from '../../services/terms/terms.service';
import { CryptoPaymentService, BinanceBybitOrder } from '../../services/crypto/crypto-payment.service';
import PaymentEntity from '../../interfaces/payment.interface';
import bankAccountEntity from '../../interfaces/bankAccount.interface';
import TermsEntity from '../../interfaces/terms.interface';
import UserEntity from '../../interfaces/user.interface';
import PlanClientDto from '../../interfaces/planClient.interface';
import { PrintperiodPipe } from '../../pipes/printPeriod.pipe';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-payments',
  imports: [DatePipe, ReactiveFormsModule, CommonModule, PrintperiodPipe],
  templateUrl: './payments.component.html',
  styleUrl: './payments.component.css',
})
export class PaymentsComponent implements OnInit, OnDestroy {

  private clientService   = inject(ClientService);
  private paymentsService = inject(PaymentsService);
  private bankService     = inject(BankAccountService);
  private termsService    = inject(TermsService);
  private cryptoSvc       = inject(CryptoPaymentService);
  private fb              = inject(FormBuilder);
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);
  private http            = inject(HttpClient);

  // ── Crypto payment state ───────────────────────────────────────────────────
  txHash           = signal('');
  cryptoSubmitting = signal(false);
  // Binance/Bybit Pay order result (QR + link)
  gatewayOrder     = signal<BinanceBybitOrder | null>(null);
  gatewayLoading   = signal(false);
  gatewayError     = signal('');

  // ── State ──────────────────────────────────────────────────────────────────
  profile         = signal<UserEntity>(new UserEntity());
  payments        = signal<PaymentEntity[]>([]);
  bankAccounts    = signal<bankAccountEntity[]>([]);
  terms           = signal<TermsEntity[]>([]);
  loading         = signal(true);
  saving          = signal(false);
  uploadProgress  = signal(0);
  toast           = signal<{ msg: string; ok: boolean } | null>(null);
  selectedPayment  = signal<PaymentEntity | null>(null);
  voucherBlobUrl   = signal<string | null>(null);
  voucherLoading   = signal(false);

  // ── Filter / pagination state ──────────────────────────────────────────────
  filterPeriod  = signal<'today'|'week'|'month'|'year'|'range'|'all'>('all');
  filterFrom    = signal('');
  filterTo      = signal('');
  filterState   = signal('');
  pageSize      = signal<number>(20);
  currentPage   = signal(1);

  filteredPayments = computed(() => {
    let list = this.payments();
    const period = this.filterPeriod();
    const now    = new Date(); now.setHours(23,59,59,999);

    if (period !== 'all') {
      let from: Date | null = null;
      let to: Date | null   = now;
      if (period === 'today') {
        from = new Date(); from.setHours(0,0,0,0);
      } else if (period === 'week') {
        from = new Date(); from.setDate(from.getDate() - 7); from.setHours(0,0,0,0);
      } else if (period === 'month') {
        from = new Date(); from.setDate(from.getDate() - 30); from.setHours(0,0,0,0);
      } else if (period === 'year') {
        from = new Date(); from.setFullYear(from.getFullYear() - 1); from.setHours(0,0,0,0);
      } else if (period === 'range') {
        from = this.filterFrom() ? new Date(this.filterFrom() + 'T00:00:00') : null;
        to   = this.filterTo()   ? new Date(this.filterTo()   + 'T23:59:59') : now;
      }
      if (from) list = list.filter(p => new Date(p.createdAt) >= from! && new Date(p.createdAt) <= to!);
    }

    if (this.filterState()) list = list.filter(p => p.state === this.filterState());
    return list;
  });

  totalPages = computed(() => {
    const ps = this.pageSize();
    if (ps === 0) return 1;
    return Math.max(1, Math.ceil(this.filteredPayments().length / ps));
  });

  paginatedPayments = computed(() => {
    const ps   = this.pageSize();
    const list = this.filteredPayments();
    if (ps === 0) return list;
    const start = (this.currentPage() - 1) * ps;
    return list.slice(start, start + ps);
  });

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const cur   = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number|'…')[] = [1];
    if (cur > 3)        pages.push('…');
    for (let p = Math.max(2, cur-1); p <= Math.min(total-1, cur+1); p++) pages.push(p);
    if (cur < total-2)  pages.push('…');
    pages.push(total);
    return pages;
  });

  setPage(p: number) {
    this.currentPage.set(Math.max(1, Math.min(p, this.totalPages())));
  }

  setFilter(period: 'today'|'week'|'month'|'year'|'range'|'all') {
    this.filterPeriod.set(period);
    this.currentPage.set(1);
  }

  setPageSize(n: number) {
    this.pageSize.set(n);
    this.currentPage.set(1);
  }

  // ── Export all payments (xlsx) ─────────────────────────────────────────────
  downloadAllPayments() {
    const list = this.filteredPayments();
    if (!list.length) return;
    const rows = list.map(p => ({
      'ID':            p.id,
      'Fecha':         p.createdAt ? new Date(p.createdAt).toLocaleDateString('es') : '',
      'Estado':        p.state,
      'Servicio':      p.plan?.service_sortName ?? '',
      'Plan':          `${p.plan?.plan_title_prefix ?? ''} ${p.plan?.plan_title_name ?? ''}`.trim(),
      'Periodo':       p.period ?? '',
      'Monto':         p.amount,
      'Moneda':        p.plan?.currencyCode ?? '',
      'Precio/Plan':   `${p.plan?.price ?? ''} ${p.plan?.currencyCode ?? ''}/${p.plan?.kind ?? ''}`,
      'Metodo':        p.method ?? '',
      'Cuenta':        p.methodPay?.name ?? '',
      'Numero cuenta': p.methodPay?.number ?? '',
      'Tipo cuenta':   p.methodPay?.typeAccount ?? '',
      'Nota':          p.note ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [20,16,14,16,22,28,10,10,18,16,16,22,16,30].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pagos');

    // Metadata sheet
    const meta = XLSX.utils.aoa_to_sheet([
      ['Reporte de Pagos'],
      ['Generado:', new Date().toLocaleString('es')],
      ['Total registros:', list.length],
      ['Filtro:', this.filterPeriod()],
      ['Usuario:', this.profile().email ?? ''],
    ]);
    XLSX.utils.book_append_sheet(wb, meta, 'Info');

    const date = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `pagos_${date}.xlsx`);
  }

  // ── Payment modal state ────────────────────────────────────────────────────
  selectedPlan = signal<PlanClientDto | null>(null);
  selectedBank = signal<bankAccountEntity | null>(null);
  months       = signal(1);
  selectedFile: File | null = null;

  readonly PERIOD_OPTIONS = [1, 2, 3, 6, 12];

  /** Human-readable period range for the currently selected plan + months() */
  periodRange = computed(() => {
    const plan = this.selectedPlan();
    if (!plan) return null;
    const qty = this.months();

    // "desde": day after current expiry if still valid, otherwise today
    const now       = new Date();
    const expiry    = plan.endedAt ? new Date(plan.endedAt) : null;
    const fromDate  = expiry && expiry > now ? this._dayAfter(expiry) : now;

    // "hasta": fromDate + qty * kind (last day inclusive)
    const toDate    = this._addPeriods(new Date(fromDate), plan.kind, qty);

    const fmt = (d: Date) => d.toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });
    return {
      from:  fmt(fromDate),
      to:    fmt(toDate),
      days:  Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      label: this._kindLabel(plan.kind, qty),
    };
  });

  private _dayAfter(d: Date): Date {
    const n = new Date(d); n.setDate(n.getDate() + 1); return n;
  }

  /** Returns the LAST day of `qty` consecutive periods (inclusive) */
  private _addPeriods(from: Date, kind: string, qty: number): Date {
    const d = new Date(from);
    switch ((kind ?? '').toLowerCase()) {
      case 'dia':       d.setDate(d.getDate() + qty - 1);                         break;
      case 'semana':    d.setDate(d.getDate() + qty * 7 - 1);                     break;
      case 'mes':       d.setMonth(d.getMonth() + qty); d.setDate(d.getDate() - 1); break;
      case 'trimestre': d.setMonth(d.getMonth() + qty * 3); d.setDate(d.getDate() - 1); break;
      case 'semestre':  d.setMonth(d.getMonth() + qty * 6); d.setDate(d.getDate() - 1); break;
      case 'año':       d.setFullYear(d.getFullYear() + qty); d.setDate(d.getDate() - 1); break;
      default:          d.setMonth(d.getMonth() + qty); d.setDate(d.getDate() - 1); break;
    }
    return d;
  }

  private _kindLabel(kind: string, qty: number): string {
    const map: Record<string, [string, string]> = {
      dia:       ['día',       'días'],
      semana:    ['semana',    'semanas'],
      mes:       ['mes',       'meses'],
      trimestre: ['trimestre', 'trimestres'],
      semestre:  ['semestre',  'semestres'],
      año:       ['año',       'años'],
    };
    const pair = map[(kind ?? '').toLowerCase()] ?? [kind, kind + 's'];
    return `${qty} ${qty === 1 ? pair[0] : pair[1]}`;
  }

  // ── Computed ───────────────────────────────────────────────────────────────
  totalPrice = computed(() => {
    const plan = this.selectedPlan();
    return plan ? +(plan.price * this.months()).toFixed(2) : 0;
  });

  visibleBanks = computed(() =>
    this.bankAccounts().filter(b => b.active && b.visible)
  );

  activeTerms = computed(() =>
    this.terms().filter(t => t.active)
  );

  contractedServices = computed(() =>
    (this.profile().services as PlanClientDto[]).filter(s => s.active)
  );

  needsPersonalData = computed(() => {
    const u = this.profile();
    return !u.country?.countryName || !u.telephone?.length;
  });

  summary = computed(() => {
    const list = this.payments();
    return {
      total:    list.length,
      accepted: list.filter(p => p.state === 'Aceptado').length,
      pending:  list.filter(p => ['Varificando', 'Pendiente'].includes(p.state)).length,
      returned: list.filter(p => p.state === 'Devuelto').length,
    };
  });

  // ── Form ───────────────────────────────────────────────────────────────────
  paymentForm = this.fb.group({
    plan_id:  ['', Validators.required],
    bank_id:  ['', Validators.required],
    terms_id: ['', Validators.required],
    note:     [''],
    // Personal data — only required when needsPersonalData()
    pd_country:   [''],
    pd_tel_number: [''],
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loadProfile();
    this.loadPayments();
    this.loadBankAccounts();
    this.loadTerms();
  }

  loadProfile() {
    this.clientService.getMe().subscribe({
      next: resp => {
        if (resp?.data) {
          const u = new UserEntity();
          u.set(resp.data as any);
          this.profile.set(u);
        }
      },
    });
  }

  loadPayments() {
    this.loading.set(true);
    this.paymentsService.getPayments().subscribe({
      next: resp => {
        this.payments.set(resp.data ?? []);
        this.currentPage.set(1);
        this.loading.set(false);
        this._openFromQueryParam();
      },
      error: () => this.loading.set(false),
    });
  }

  /** Abre el modal de detalle si la URL incluye ?payment_id=xxx */
  private _openFromQueryParam() {
    const paymentId = this.route.snapshot.queryParamMap.get('payment_id');
    if (!paymentId) return;
    const payment = this.payments().find(p => p.id === paymentId);
    if (payment) {
      // Small delay to ensure the DOM modal element is rendered
      setTimeout(() => this.openDetail(payment), 50);
    }
  }

  loadBankAccounts() {
    this.bankService.getBankAccount().subscribe(resp =>
      this.bankAccounts.set(resp.data ?? [])
    );
  }

  loadTerms() {
    this.termsService.get().subscribe(resp =>
      this.terms.set(resp.data ?? [])
    );
  }

  // ── Payment modal ──────────────────────────────────────────────────────────
  openNewPayment(plan?: PlanClientDto) {
    const defaultPlan = plan ?? this.contractedServices()[0] ?? null;
    this.selectedPlan.set(defaultPlan);
    this.selectedBank.set(null);
    this.months.set(1);
    this.selectedFile = null;
    this.uploadProgress.set(0);
    this.txHash.set('');
    this.gatewayOrder.set(null);
    this.gatewayError.set('');
    this.paymentForm.reset({
      plan_id:  defaultPlan?.plan_id ?? '',
      bank_id:  '',
      terms_id: this.activeTerms()[0]?.id ?? '',
      note:     '',
    });
    (document.getElementById('pay_modal') as HTMLDialogElement | null)?.showModal();
  }

  setMonths(n: number) { this.months.set(n); }

  onPlanChange(event: Event) {
    const planId = (event.target as HTMLSelectElement).value;
    const plan   = this.contractedServices().find(p => p.plan_id === planId) ?? null;
    this.selectedPlan.set(plan);
  }

  selectBank(bankId: string) {
    const bank = this.visibleBanks().find(b => b.id === bankId) ?? null;
    this.selectedBank.set(bank);
    this.paymentForm.patchValue({ bank_id: bankId });
    this.txHash.set('');
    this.gatewayOrder.set(null);
    this.gatewayError.set('');
  }

  onTermsCheck(checked: boolean) {
    const id = checked ? (this.activeTerms()[0]?.id ?? '') : '';
    this.paymentForm.patchValue({ terms_id: id });
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.length ? input.files[0] : null;
  }

  isCrypto(bank: bankAccountEntity): boolean {
    return bank.typeAccount.startsWith('crypto_') ||
           ['binance_pay', 'bybit_pay'].includes(bank.typeAccount);
  }

  /** Binance Pay / Bybit Pay — have automated QR order flow */
  isGatewayCrypto(bank: bankAccountEntity | null): boolean {
    return bank?.typeAccount === 'binance_pay' || bank?.typeAccount === 'bybit_pay';
  }

  /** Manual crypto (USDT, BTC, ETH…) — requires TX hash from client */
  isManualCrypto(bank: bankAccountEntity | null): boolean {
    return !!bank && bank.typeAccount.startsWith('crypto_');
  }

  bankTypeIcon(bank: bankAccountEntity): string {
    if (this.isCrypto(bank)) return '₿';
    if (bank.typeAccount === 'cash') return '💵';
    if (bank.typeAccount === 'card') return '💳';
    if (['sbp', 'tbank', 'yoomoney'].includes(bank.typeAccount)) return '📱';
    return '🏦';
  }

  canSubmit(): boolean {
    const bank = this.selectedBank();
    if (this.paymentForm.invalid || this.saving()) return false;
    // Gateway crypto (Binance/Bybit): gateway flow handles its own submit
    if (this.isGatewayCrypto(bank)) return false;
    // Manual crypto: TX hash required instead of file
    if (this.isManualCrypto(bank)) return this.txHash().trim().length > 0;
    // Bank transfer / cash: file required
    return !!this.selectedFile;
  }

  /** Submit for manual crypto (USDT, BTC, etc.) using TX hash */
  onCryptoSubmit() {
    const plan = this.selectedPlan();
    const bank = this.selectedBank();
    if (!plan || !bank || this.cryptoSubmitting()) return;
    const hash = this.txHash().trim();
    if (!hash) { this.showToast('Ingresa el TX Hash de la transacción', false); return; }

    this.cryptoSubmitting.set(true);
    this.cryptoSvc.registerPayment({
      methodId: bank.id,
      planId:   plan.plan_id,
      amount:   this.totalPrice(),
      txHash:   hash,
      payTo:    this.months(),
      network:  (bank as any).network,
    }).subscribe({
      next: () => {
        this.cryptoSubmitting.set(false);
        this.showToast('Pago cripto registrado. Verificación en curso (24-48h).', true);
        this.txHash.set('');
        (document.getElementById('pay_modal') as HTMLDialogElement | null)?.close();
        this.paymentForm.reset();
        this.loadPayments();
      },
      error: (err: any) => {
        this.cryptoSubmitting.set(false);
        this.showToast(err?.error?.message ?? 'Error al registrar el pago cripto', false);
      },
    });
  }

  /** Create Binance Pay or Bybit Pay order and show QR */
  onGatewayPayClick() {
    const plan = this.selectedPlan();
    const bank = this.selectedBank();
    if (!plan || !bank || this.gatewayLoading()) return;

    this.gatewayOrder.set(null);
    this.gatewayError.set('');
    this.gatewayLoading.set(true);

    const obs$ = bank.typeAccount === 'binance_pay'
      ? this.cryptoSvc.createBinanceOrder(plan.plan_id, this.months())
      : this.cryptoSvc.createBybitOrder(plan.plan_id, this.months());

    obs$.subscribe({
      next: (resp: any) => {
        this.gatewayLoading.set(false);
        this.gatewayOrder.set(resp?.data ?? null);
        if (resp?.data?.payment_id) {
          // Show success and close; payment tracked by payment_id
          this.showToast('Orden creada. Completa el pago en tu app.', true);
          this.loadPayments();
        }
      },
      error: (err: any) => {
        this.gatewayLoading.set(false);
        this.gatewayError.set(err?.error?.message ?? 'Error al crear la orden');
      },
    });
  }

  onPaySubmit() {
    if (!this.canSubmit()) return;

    const plan = this.selectedPlan();
    const user = this.profile();
    const v    = this.paymentForm.value;
    const bank = this.visibleBanks().find(b => b.id === v.bank_id);

    if (!plan) { this.showToast('Selecciona un servicio', false); return; }
    if (!bank) { this.showToast('Selecciona un método de pago', false); return; }

    const personalData = {
      country:   user.country?.id || (v.pd_country ?? ''),
      telephone: {
        country: user.country?.id || (v.pd_country ?? ''),
        number:  user.telephone?.[0]?.phone || (v.pd_tel_number ?? ''),
      },
    };

    const payload: any = {
      plan:         plan.plan_id,
      bank:         bank.id,
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
          this.showToast('Pago enviado. El administrador lo revisará en breve.', true);
          (document.getElementById('pay_modal') as HTMLDialogElement | null)?.close();
          this.paymentForm.reset();
          this.selectedFile = null;
          this.uploadProgress.set(0);
          this.loadPayments();
        }
      },
      error: (err: any) => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al enviar el pago', false);
      },
    });
  }

  ngOnDestroy() {
    const url = this.voucherBlobUrl();
    if (url) URL.revokeObjectURL(url);
  }

  // ── Payment detail ─────────────────────────────────────────────────────────
  openDetail(p: PaymentEntity) {
    // Revoke previous blob
    const prev = this.voucherBlobUrl();
    if (prev) URL.revokeObjectURL(prev);
    this.voucherBlobUrl.set(null);

    this.selectedPayment.set(p);
    (document.getElementById('detail_modal') as HTMLDialogElement | null)?.showModal();

    // Load voucher image via HttpClient (sends auth headers)
    if (p.picture) {
      this.voucherLoading.set(true);
      this.http.get(this.fullPictureUrl(p.picture), { responseType: 'blob' }).subscribe({
        next: blob => {
          this.voucherBlobUrl.set(URL.createObjectURL(blob));
          this.voucherLoading.set(false);
        },
        error: () => this.voucherLoading.set(false),
      });
    }
  }

  closeDetail() {
    const url = this.voucherBlobUrl();
    if (url) URL.revokeObjectURL(url);
    this.voucherBlobUrl.set(null);
    this.selectedPayment.set(null);
    (document.getElementById('detail_modal') as HTMLDialogElement | null)?.close();
  }

  /** Build full URL for a voucher picture */
  fullPictureUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    const serverBase = environment.apiUrl.replace(/\/api$/, '');
    if (!url.includes('/')) return `${serverBase}/storage/vouchers/${url}`;
    return `${serverBase}/${url.replace(/^\//, '')}`;
  }

  // ── PDF download ───────────────────────────────────────────────────────────
  async downloadPaymentPdf(p: PaymentEntity) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const lm = 18, rm = 192;
    let y = 18;

    const safe = (s: string | null | undefined): string => {
      if (!s) return '-';
      return s.replace(/\u2192/g, '->').replace(/\u2190/g, '<-')
               .replace(/\u2013/g, '-').replace(/\u2014/g, '--')
               .replace(/\u2026/g, '...').replace(/[^\x00-\xFF]/g, '?');
    };
    const hr = () => { doc.setDrawColor(185); doc.line(lm, y, rm, y); y += 5; };
    const row = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(110);
      doc.text(label, lm, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30);
      doc.text(safe(value), lm + 46, y); y += 5.8;
    };
    const section = (title: string) => {
      y += 3;
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(lm - 2, y - 4.5, rm - lm + 4, 9, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40);
      doc.text(title, lm, y); y += 8;
    };

    // Header
    doc.setFillColor(37, 99, 235); doc.rect(0, 0, 210, 28, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255);
    doc.text('Comprobante de Pago', lm, 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(200, 210, 255);
    doc.text(`Generado el ${new Date().toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })}`, lm, 21);
    y = 36;

    // State badge
    const stateColors: Record<string, [number,number,number]> = {
      Aceptado: [22,163,74], Varificando: [202,138,4], Pendiente: [59,130,246], Devuelto: [220,38,38],
    };
    const [sr,sg,sb] = stateColors[p.state] ?? [100,100,100];
    doc.setFillColor(sr,sg,sb); doc.roundedRect(lm, y-4.5, 44, 8, 2, 2, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(255);
    doc.text(safe(p.state), lm+4, y); y += 11;

    // Payment data
    section('Datos del pago');
    row('ID del pago:',    p.id);
    row('Fecha:',          p.createdAt ? new Date(p.createdAt).toLocaleDateString('es') : '-');
    row('Periodo:',        safe(p.period));
    row('Monto pagado:',   `${p.amount} ${p.plan?.currencyCode ?? ''}`);
    row('Metodo de pago:', safe(p.method));
    row('Cuenta destino:', safe(`${p.methodPay?.name ?? ''} ${p.methodPay?.number ?? ''}`.trim() || '-'));
    y += 2; hr();

    // Service
    section('Servicio y Plan');
    row('Servicio:',        safe(p.plan?.service_sortName));
    row('Plan:',            safe(`${p.plan?.plan_title_prefix ?? ''} ${p.plan?.plan_title_name ?? ''}`.trim() || '-'));
    row('Precio del plan:', safe(`${p.plan?.price ?? '-'} ${p.plan?.currencyCode ?? ''}/${p.plan?.kind ?? ''}`));
    y += 2; hr();

    // Note
    if (p.note) {
      section('Nota');
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(60);
      const nl = doc.splitTextToSize(safe(p.note), 162);
      doc.text(nl, lm, y); y += nl.length * 5.5 + 4;
    }

    // Voucher image
    const picUrl = this.fullPictureUrl(p.picture);
    if (picUrl) {
      y += 2; hr(); section('Comprobante adjunto');
      let imgDataUrl: string | null = null;
      const blobUrl = this.voucherBlobUrl();
      if (blobUrl?.startsWith('blob:')) {
        imgDataUrl = await this._blobUrlToBase64(blobUrl);
      }
      if (!imgDataUrl) imgDataUrl = await this._loadImageViaHttp(picUrl);
      if (imgDataUrl) {
        if (y + 90 > 285) { doc.addPage(); y = 18; }
        const fmt = imgDataUrl.includes('data:image/png') ? 'PNG' : 'JPEG';
        doc.addImage(imgDataUrl, fmt, lm, y, rm - lm, 90, undefined, 'FAST');
        y += 94;
      }
    }

    await addSignedFooter(doc, p.id, p.id.slice(0, 8).toUpperCase());
    doc.save(`pago_${p.id.slice(0,8)}_${new Date().toISOString().slice(0,10)}.pdf`);
  }

  private _loadImageViaHttp(url: string): Promise<string | null> {
    return firstValueFrom(
      this.http.get(url, { responseType: 'blob' })
    ).then(blob => new Promise<string | null>(resolve => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    })).catch(() => null);
  }

  private _blobUrlToBase64(blobUrl: string): Promise<string | null> {
    return fetch(blobUrl).then(r => r.blob()).then(blob =>
      new Promise<string | null>(resolve => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      })
    ).catch(() => null);
  }

  // ── Share ──────────────────────────────────────────────────────────────────
  private _shareText(p: PaymentEntity): string {
    return `Comprobante de pago SVION VPN\n` +
           `Estado: ${p.state}\n` +
           `Servicio: ${p.plan?.service_sortName ?? ''} ${p.plan?.plan_title_prefix ?? ''} ${p.plan?.plan_title_name ?? ''}\n` +
           `Monto: ${p.amount} ${p.plan?.currencyCode ?? ''}\n` +
           `Periodo: ${p.period ?? ''}\n` +
           `Fecha: ${p.createdAt ? new Date(p.createdAt).toLocaleDateString('es') : ''}\n` +
           `ID: ${p.id}`;
  }

  shareViaTelegram(p: PaymentEntity) {
    const text = encodeURIComponent(this._shareText(p));
    window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${text}`, '_blank');
  }

  shareViaWhatsApp(p: PaymentEntity) {
    const text = encodeURIComponent(this._shareText(p));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  shareViaEmail(p: PaymentEntity) {
    const subject = encodeURIComponent(`Comprobante de pago - ${p.state} - ${p.plan?.service_sortName ?? ''}`);
    const body    = encodeURIComponent(this._shareText(p));
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  }

  shareViaMessages(p: PaymentEntity) {
    this.closeDetail();
    this.router.navigate(['/client/messages'], { queryParams: { compose: '1', subject: `Consulta sobre pago ${p.id.slice(0,8)}` } });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  stateClass(state: string): string {
    switch (state) {
      case 'Aceptado':    return 'badge-success';
      case 'Varificando': return 'badge-warning';
      case 'Pendiente':   return 'badge-info';
      case 'Devuelto':    return 'badge-error';
      default:            return 'badge-ghost';
    }
  }

  stateLabel(state: string): string {
    switch (state) {
      case 'Varificando': return 'En revisión';
      default:            return state;
    }
  }

  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 5000);
  }
}
