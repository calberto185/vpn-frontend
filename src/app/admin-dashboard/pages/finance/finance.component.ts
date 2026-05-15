import { Component, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceService } from '../../services/finance/finance.service';
import { ActivityService } from '../../services/activity/activity.service';
import { catchError, forkJoin, of, Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import {
  CURRENCIES,
  ExchangeRates,
  FinanceSummary, MonthlyDataPoint, CashflowPoint,
  ServiceRevenue, SupplierExpense, TopClient, CategoryExpense, MethodRevenue,
  WithdrawalRecipient,
} from '../../interfaces/finance.interface';
import { SocketService } from '../../../shared/services/socket.service';
import * as XLSX from 'xlsx';

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

@Component({
  selector: 'app-finance',
  imports: [DecimalPipe, SlicePipe, FormsModule],
  templateUrl: './finance.component.html',
  styleUrl: './finance.component.css',
})
export class FinanceComponent implements OnInit, OnDestroy {

  private svc         = inject(FinanceService);
  private activitySvc = inject(ActivityService);
  private socketSvc   = inject(SocketService);

  private subs      = new Subscription();
  private refresh$  = new Subject<void>();

  // ── Currency ───────────────────────────────────────────────────────────────
  currencies    = CURRENCIES;
  selectedCurrency = signal('USD');
  currencySymbol = computed(() => this.currencies.find(c => c.code === this.selectedCurrency())?.symbol ?? '$');

  // ── Year picker ────────────────────────────────────────────────────────────
  currentYear  = new Date().getFullYear();
  years        = Array.from({ length: 5 }, (_, i) => this.currentYear - i);
  selectedYear = signal(this.currentYear);

  // ── Exchange rates ─────────────────────────────────────────────────────────
  exchangeRates    = signal<ExchangeRates | null>(null);
  showRateModal    = signal(false);
  rateForm         = signal<Record<string, number>>({ USD: 1, EUR: 0.92, PEN: 3.75, RUB: 90.50, USDT: 1, USDC: 1, BTC: 0.000016, ETH: 0.00034, BNB: 0.0017, TON: 0.19, TRX: 10.0 });
  rateSaving       = signal(false);

  // ── Data signals ───────────────────────────────────────────────────────────
  summary         = signal<FinanceSummary | null>(null);
  revenueMonthly  = signal<MonthlyDataPoint[]>([]);
  expensesMonthly = signal<MonthlyDataPoint[]>([]);
  cashflow        = signal<CashflowPoint[]>([]);
  byService       = signal<ServiceRevenue[]>([]);
  byMethod        = signal<MethodRevenue[]>([]);
  bySupplier      = signal<SupplierExpense[]>([]);
  byCategory      = signal<CategoryExpense[]>([]);
  byWithdrawal    = signal<WithdrawalRecipient[]>([]);
  topClients      = signal<TopClient[]>([]);

  loading      = signal(true);
  exporting    = signal(false);
  monthLabels  = MONTH_LABELS;

  // ── Chart helpers ──────────────────────────────────────────────────────────
  readonly CHART_H = 120;

  revenueMax  = computed(() => Math.max(...this.revenueMonthly().map(m => m.total), 1));
  expensesMax = computed(() => Math.max(...this.expensesMonthly().map(m => m.total), 1));
  barChartMax = computed(() => Math.max(...this.cashflow().map(c => Math.max(c.revenue, c.expenses)), 1));

  revenueHasData  = computed(() => this.revenueMonthly().some(m => m.total > 0));
  expensesHasData = computed(() => this.expensesMonthly().some(m => m.total > 0));
  cashflowHasData = computed(() => this.cashflow().some(c => c.revenue > 0 || c.expenses > 0));

  // ── Tooltip ────────────────────────────────────────────────────────────────
  activeTooltip = signal<{ x: number; y: number; title: string; lines: string[] } | null>(null);

  showTip(e: MouseEvent, title: string, lines: string[]) {
    this.activeTooltip.set({ x: e.clientX, y: e.clientY, title, lines });
  }

  hideTip() { this.activeTooltip.set(null); }

  servicePieSlices = computed(() => {
    const data  = this.byService();
    const total = data.reduce((s, d) => s + d.total, 0) || 1;
    const COLORS = ['#6366f1','#22d3ee','#a3e635','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16'];
    let offset = 0;
    return data.map((d, i) => {
      const pct   = (d.total / total) * 100;
      const slice = { label: d._id, total: d.total, pct, color: COLORS[i % COLORS.length], offset };
      offset += pct;
      return slice;
    });
  });

  servicePieGradient = computed(() => {
    const slices = this.servicePieSlices();
    if (!slices.length) return 'conic-gradient(#e5e7eb 0deg 360deg)';
    return 'conic-gradient(' + slices.map(s => `${s.color} ${s.offset}% ${s.offset + s.pct}%`).join(', ') + ')';
  });

  methodTotal = computed(() => this.byMethod().reduce((s, m) => s + m.total, 0) || 1);

  categoryPieSlices = computed(() => {
    const data  = this.byCategory();
    const total = data.reduce((s, d) => s + d.total, 0) || 1;
    const COLORS = ['#f59e0b','#ef4444','#6366f1','#22d3ee','#a3e635','#ec4899','#14b8a6'];
    let offset = 0;
    return data.map((d, i) => {
      const pct   = (d.total / total) * 100;
      const slice = { label: d._id, total: d.total, pct, color: COLORS[i % COLORS.length], offset };
      offset += pct;
      return slice;
    });
  });

  categoryPieGradient = computed(() => {
    const slices = this.categoryPieSlices();
    if (!slices.length) return 'conic-gradient(#e5e7eb 0deg 360deg)';
    return 'conic-gradient(' + slices.map(s => `${s.color} ${s.offset}% ${s.offset + s.pct}%`).join(', ') + ')';
  });

  supplierMax    = computed(() => Math.max(...this.bySupplier().map(s => s.total), 1));
  withdrawalMax        = computed(() => Math.max(...this.byWithdrawal().map(w => w.total), 1));
  withdrawalTotalCount = computed(() => this.byWithdrawal().reduce((s, w) => s + w.count, 0));

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.svc.getExchangeRates().subscribe({
      next: r => {
        this.exchangeRates.set(r.data ?? null);
        if (r.data?.rates) this.rateForm.set({ ...r.data.rates });
      },
      error: () => { /* exchange rates not yet configured — use defaults */ },
    });
    this.loadAll();

    // Recargar charts cuando llega un nuevo pago (debounce 1.5s para agrupar ráfagas)
    this.subs.add(
      this.refresh$.pipe(debounceTime(1500)).subscribe(() => this.loadAll())
    );
    this.subs.add(
      this.socketSvc.onPaymentUpdated().subscribe(() => this.refresh$.next())
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.refresh$.complete();
  }

  loadAll() {
    const y   = this.selectedYear();
    const cur = this.selectedCurrency();
    this.loading.set(true);

    const safe = (obs: any) => obs.pipe(catchError(() => of(null)));

    forkJoin([
      safe(this.svc.summary(y, cur)),
      safe(this.svc.revenueMonthly(y, cur)),
      safe(this.svc.expensesMonthly(y, cur)),
      safe(this.svc.cashflow(12, cur)),
      safe(this.svc.revenueByService(y, cur)),
      safe(this.svc.revenueByMethod(y, cur)),
      safe(this.svc.expensesBySupplier(y, cur)),
      safe(this.svc.expensesByCategory(y, cur)),
      safe(this.svc.topClients(y, 10, cur)),
      safe(this.svc.withdrawalsByRecipient(y, cur)),
    ]).subscribe({
      next: ([summ, revM, expM, cf, bySvc, byMth, bySup, byCat, topC, byWdr]: any[]) => {
        this.summary.set(summ?.data ?? null);
        this.revenueMonthly.set(revM?.data?.months ?? []);
        this.expensesMonthly.set(expM?.data?.months ?? []);
        this.cashflow.set(cf?.data ?? []);
        this.byService.set(bySvc?.data ?? []);
        this.byMethod.set(byMth?.data ?? []);
        this.bySupplier.set(bySup?.data ?? []);
        this.byCategory.set(byCat?.data ?? []);
        this.topClients.set(topC?.data ?? []);
        this.byWithdrawal.set(byWdr?.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onYearChange(y: number) {
    this.selectedYear.set(y);
    this.loadAll();
  }

  onCurrencyChange(code: string) {
    this.selectedCurrency.set(code);
    this.loadAll();
  }

  // ── Exchange rate modal ────────────────────────────────────────────────────
  openRateModal() {
    const r = this.exchangeRates();
    if (r?.rates) this.rateForm.set({ ...r.rates });
    this.showRateModal.set(true);
  }

  closeRateModal() { this.showRateModal.set(false); }

  updateRateField(key: string, value: number) {
    this.rateForm.update(f => ({ ...f, [key]: value }));
  }

  readonly RATE_FIELDS: { key: string; label: string; unit: string; fixed?: boolean; step: number }[] = [
    { key: 'USD',  label: 'USD',  unit: 'base',     fixed: true,  step: 0 },
    { key: 'EUR',  label: 'EUR',  unit: '€/USD',    step: 0.01 },
    { key: 'PEN',  label: 'PEN',  unit: 'S//USD',   step: 0.01 },
    { key: 'RUB',  label: 'RUB',  unit: '₽/USD',    step: 0.5  },
    { key: 'USDT', label: 'USDT', unit: 'USDT/USD', step: 0.0001 },
    { key: 'USDC', label: 'USDC', unit: 'USDC/USD', step: 0.0001 },
    { key: 'BTC',  label: 'BTC',  unit: 'BTC/USD',  step: 0.000001 },
    { key: 'ETH',  label: 'ETH',  unit: 'ETH/USD',  step: 0.00001 },
    { key: 'BNB',  label: 'BNB',  unit: 'BNB/USD',  step: 0.0001 },
    { key: 'TON',  label: 'TON',  unit: 'TON/USD',  step: 0.001 },
    { key: 'TRX',  label: 'TRX',  unit: 'TRX/USD',  step: 0.01 },
  ];

  saveRates() {
    this.rateSaving.set(true);
    this.svc.updateExchangeRates(this.rateForm()).subscribe({
      next: r => {
        if (r.data) this.exchangeRates.set(r.data);
        this.rateSaving.set(false);
        this.closeRateModal();
        this.loadAll(); // reload with updated rates
      },
      error: () => this.rateSaving.set(false),
    });
  }

  // ── Export XLSX ────────────────────────────────────────────────────────────
  exportXLSX() {
    this.exporting.set(true);
    const cur  = this.selectedCurrency();
    const sym  = this.currencySymbol();
    const year = this.selectedYear();
    const wb   = XLSX.utils.book_new();

    // Sheet 1 — Resumen
    const summ = this.summary();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      [`Resumen Financiero — ${year} (${cur})`],
      [],
      ['Concepto', `Valor (${sym})`],
      ['Ingresos',  summ?.revenue  ?? 0],
      ['Gastos',    summ?.expenses ?? 0],
      ['Beneficio', summ?.profit   ?? 0],
      ['Margen (%)', summ?.margin  ?? 0],
      ['Crecimiento ingresos (%)', summ?.revenueGrowth ?? 0],
      ['Pagos pendientes', summ?.pendingPayments ?? 0],
    ]), 'Resumen');

    // Sheet 2 — Ingresos mensuales
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      [`Ingresos Mensuales — ${year} (${cur})`],
      [],
      ['Mes', 'Nombre', `Total (${sym})`, 'Transacciones'],
      ...this.revenueMonthly().map(m => [m.month, MONTH_LABELS[m.month - 1], m.total, m.count]),
    ]), 'Ingresos Mensuales');

    // Sheet 3 — Gastos mensuales
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      [`Gastos Mensuales — ${year} (${cur})`],
      [],
      ['Mes', 'Nombre', `Total (${sym})`, 'Transacciones'],
      ...this.expensesMonthly().map(m => [m.month, MONTH_LABELS[m.month - 1], m.total, m.count]),
    ]), 'Gastos Mensuales');

    // Sheet 4 — Flujo de caja (12 meses)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      [`Flujo de Caja — últimos 12 meses (${cur})`],
      [],
      ['Periodo', `Ingresos (${sym})`, `Gastos (${sym})`, `Beneficio (${sym})`],
      ...this.cashflow().map(c => [c.label, c.revenue, c.expenses, c.profit]),
    ]), 'Flujo de Caja');

    // Sheet 5 — Ingresos por servicio
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      [`Ingresos por Servicio — ${year} (${cur})`],
      [],
      ['Servicio', `Total (${sym})`, 'Transacciones'],
      ...this.byService().map(s => [s._id, s.total, s.count]),
    ]), 'Por Servicio');

    // Sheet 6 — Ingresos por método
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      [`Ingresos por Método de Pago — ${year} (${cur})`],
      [],
      ['Método', `Total (${sym})`, 'Transacciones'],
      ...this.byMethod().map(m => [m._id || 'Desconocido', m.total, m.count]),
    ]), 'Por Método');

    // Sheet 7 — Top clientes
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      [`Top Clientes — ${year} (${cur})`],
      [],
      ['#', 'Nombre', 'Email', `Total (${sym})`, 'Pagos', 'Último pago'],
      ...this.topClients().map((c, i) => [i + 1, c.userName, c.userEmail, c.total, c.count, c.lastPay?.slice(0, 10)]),
    ]), 'Top Clientes');

    // Sheet 8 — Gastos por proveedor
    if (this.bySupplier().length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        [`Gastos por Proveedor — ${year} (${cur})`],
        [],
        ['Proveedor', `Total (${sym})`, 'Transacciones'],
        ...this.bySupplier().map(s => [s.supplierName, s.total, s.count]),
      ]), 'Por Proveedor');
    }

    // Sheet 9 — Gastos por categoría
    if (this.byCategory().length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        [`Gastos por Categoría — ${year} (${cur})`],
        [],
        ['Categoría', `Total (${sym})`, 'Transacciones'],
        ...this.byCategory().map(c => [c._id, c.total, c.count]),
      ]), 'Por Categoría');
    }

    // Sheet 10 — Retiros por destinatario
    if (this.byWithdrawal().length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        [`Retiros por Destinatario — ${year} (${cur})`],
        [],
        ['Destinatario', 'Tipos', `Total (${sym})`, 'Retiros', 'Último retiro'],
        ...this.byWithdrawal().map(w => [
          w._id,
          w.types.map(t => this.withdrawalTypeLabel(t)).join(', '),
          w.total,
          w.count,
          w.lastWithdrawal?.slice(0, 10) ?? '',
        ]),
      ]), 'Retiros');
    }

    // Sheet 10 — Tipos de cambio
    const rates = this.exchangeRates();
    if (rates) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Tipos de Cambio (base USD)'],
        [],
        ['Moneda', 'Tasa'],
        ...Object.entries(rates.rates).map(([k, v]) => [k, v]),
        [],
        ['Actualizado', rates.updatedAt?.slice(0, 10) ?? ''],
      ]), 'Tipos de Cambio');
    }

    XLSX.writeFile(wb, `finanzas-${year}-${cur}.xlsx`);
    this.exporting.set(false);
    this.activitySvc.logAction('export_finance_xlsx', `${year}`, 'finance', { year, currency: cur }).subscribe();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  growthClass(v: number) {
    return v > 0 ? 'text-success' : v < 0 ? 'text-error' : 'text-base-content/50';
  }

  growthIcon(v: number) { return v > 0 ? '▲' : v < 0 ? '▼' : '—'; }

  /** @deprecated use pxH() */
  barH(val: number, max: number) { return Math.max((val / max) * 100, 0); }

  /** Returns bar height in pixels capped to maxPx. Minimum 2px so zero is still a thin line. */
  pxH(val: number, max: number, maxPx = this.CHART_H): number {
    if (!val || !max) return 2;
    return Math.max(Math.round((val / max) * maxPx), 2);
  }

  /** Compact number format: 1 234 567 → 1.2M, 12 500 → 12.5K */
  fmt(v: number): string {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
    if (abs >= 1_000) return (v / 1_000).toFixed(1) + 'K';
    return v.toFixed(0);
  }

  paymentMethodLabel(m: string): string {
    const map: Record<string, string> = {
      // Tradicionales
      bank_transfer:           'Transferencia bancaria',
      'tranferencia bancaria': 'Transferencia bancaria',
      card:                    'Tarjeta',
      cash:                    'Efectivo',
      efectivo:                'Efectivo',
      sbp:                     'Pago Rápido (SBP)',
      tbank:                   'T-Bank',
      yoomoney:                'YooMoney',
      // Cripto
      crypto:                  'Criptomoneda',
      crypto_usdt_trc20:       'USDT TRC-20',
      crypto_usdt_erc20:       'USDT ERC-20',
      crypto_usdt_bep20:       'USDT BEP-20',
      crypto_btc:              'Bitcoin (BTC)',
      crypto_eth:              'Ethereum (ETH)',
      crypto_ton:              'TON',
      crypto_usdc:             'USDC',
      binance_pay:             'Binance Pay',
      bybit_pay:               'Bybit Pay',
      // Legado / fallback
      modeneroLocal:           'Monedero local',
      other:                   'Otro',
      unknow:                  'Desconocido',
    };
    // unknown value: show the raw key rather than a generic label
    return map[m] ?? m ?? 'Desconocido';
  }

  methodColor(method: string): string {
    const map: Record<string, string> = {
      // Tradicionales
      bank_transfer:           '#6366f1',
      'tranferencia bancaria': '#6366f1',
      card:                    '#22d3ee',
      cash:                    '#a3e635',
      efectivo:                '#a3e635',
      sbp:                     '#f59e0b',
      tbank:                   '#f97316',
      yoomoney:                '#8b5cf6',
      // Cripto
      crypto:                  '#f59e0b',
      crypto_usdt_trc20:       '#10b981',
      crypto_usdt_erc20:       '#6366f1',
      crypto_usdt_bep20:       '#f59e0b',
      crypto_btc:              '#f97316',
      crypto_eth:              '#8b5cf6',
      crypto_ton:              '#0ea5e9',
      crypto_usdc:             '#2563eb',
      binance_pay:             '#eab308',
      bybit_pay:               '#ef4444',
      // Legado / fallback
      modeneroLocal:           '#94a3b8',
      other:                   '#94a3b8',
      unknow:                  '#94a3b8',
    };
    return map[method] ?? '#94a3b8';
  }

  categoryLabel(cat: string) {
    const map: Record<string, string> = {
      infrastructure: 'Infraestructura', hosting: 'Hosting',
      bandwidth: 'Ancho de banda', software: 'Software',
      marketing: 'Marketing', telecom: 'Telecom', other: 'Otro',
    };
    return map[cat] ?? cat;
  }

  withdrawalTypeLabel(type: string) {
    const map: Record<string, string> = {
      employee_payment: 'Pago empleado',
      client_refund:    'Devolución cliente',
      client_loan:      'Préstamo cliente',
      office_expense:   'Gasto oficina',
      tax_payment:      'Impuesto',
      other:            'Otro',
    };
    return map[type] ?? type;
  }
}
