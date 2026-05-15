import { DatePipe, NgClass, CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import ActivitiesDevicesDashboardEntity from '../../interfaces/activitiesDevicesDashboard.interface';
import { ActivitiesDevicesDashboardService } from '../../services/dashboard/activitiesDevicesDashboard.service';
import { ClientService, ClientDevice, ClientServiceStats } from '../../services/client/client.service';
import { SessionsService } from '../../services/sessions/sessions.service';
import UserEntity from '../../interfaces/user.interface';
import SessionsEntity from '../../interfaces/sessions.interface';
import { PaymentsService } from '../../services/payments/payments.service';
import { BankAccountService } from '../../services/bankAccount/bankAccount.service';
import PaymentsEntity from '../../interfaces/payment.interface';
import PlanClientDto from '../../interfaces/planClient.interface';
import bankAccountEntity from '../../interfaces/bankAccount.interface';
import PaymentMethodPayDto from '../../interfaces/PaymentMethodPay.interface';
import daysjs from 'dayjs';

type PaymentMethod = 'transferencia bancaria' | 'efectivo' | 'crypto' | 'monedero';

@Component({
  selector: 'app-dashboard',
  imports: [NgClass, DatePipe, TranslatePipe, CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  now = new Date();

  // ── Services ───────────────────────────────────────────────────────────────
  activitiesDevicesDashboardService = inject(ActivitiesDevicesDashboardService);
  clientService   = inject(ClientService);
  sessionssService = inject(SessionsService);
  paymentsService = inject(PaymentsService);
  private bankService = inject(BankAccountService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  // ── List signals ───────────────────────────────────────────────────────────
  ListDevices      = signal<ActivitiesDevicesDashboardEntity[]>([]);
  ListSessions     = signal<SessionsEntity[]>([]);
  ListPayments     = signal<PaymentsEntity[]>([]);
  ListUsers        = signal<ActivitiesDevicesDashboardEntity[]>([]);
  sessionsTotal    = signal(0);
  sessionsPage     = signal(1);
  sessionsLoading  = signal(false);
  readonly SESSION_LIMIT = 20;

  sessionsPageCount = computed(() => Math.ceil(this.sessionsTotal() / this.SESSION_LIMIT) || 1);
  sessionsPageNums  = computed(() => {
    const total = this.sessionsPageCount();
    const cur   = this.sessionsPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1) as (number|'…')[];
    const pages: (number | '…')[] = [1];
    if (cur > 3) pages.push('…');
    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) pages.push(p);
    if (cur < total - 2) pages.push('…');
    pages.push(total);
    return pages;
  });

  // ── Profile ────────────────────────────────────────────────────────────────
  profile      = signal<UserEntity>(new UserEntity());
  hasError     = signal('');
  btnAddService = signal(false);

  // ── Computed lists ─────────────────────────────────────────────────────────
  activeServices  = computed(() => this.profile().services.filter((s: any) => s.active));
  expiredServices = computed(() => this.profile().services.filter((s: any) => !s.active));

  // ── Bank accounts ──────────────────────────────────────────────────────────
  bankAccounts = signal<bankAccountEntity[]>([]);
  visibleBanks = computed(() => this.bankAccounts().filter(b => b.active && b.visible));

  // ── Devices & S-UI stats ───────────────────────────────────────────────────
  devices      = signal<ClientDevice[]>([]);
  /** service_id → stats fetched from S-UI (only for s-ui protocol) */
  serviceStats = signal<Record<string, ClientServiceStats>>({});
  statsLoading = signal<string[]>([]);   // service_ids currently fetching

  /** Map from service_id → device list for O(1) lookup in template */
  devicesByService = computed(() => {
    const map = new Map<string, ClientDevice[]>();
    for (const d of this.devices()) {
      if (!map.has(d.service_id)) map.set(d.service_id, []);
      map.get(d.service_id)!.push(d);
    }
    return map;
  });

  // ── Payment modal ──────────────────────────────────────────────────────────
  selectedPlan   = signal<PlanClientDto | null>(null);
  months         = signal(1);
  totalPrice     = computed(() => {
    const plan = this.selectedPlan();
    return plan ? +(plan.price * this.months()).toFixed(2) : 0;
  });
  readonly MONTH_OPTIONS = [1, 2, 3, 6, 12];
  saving         = signal(false);
  uploadProgress = signal(0);
  selectedFile: File | null = null;

  paymentForm = this.fb.group({
    plan_id:   ['', Validators.required],
    method:    ['transferencia bancaria' as PaymentMethod, Validators.required],
    methodPay: [''],
    note:      [''],
  });

  get selectedMethod(): PaymentMethod {
    return (this.paymentForm.get('method')?.value ?? 'transferencia bancaria') as PaymentMethod;
  }

  // ── Action modals ──────────────────────────────────────────────────────────
  targetService = signal<PlanClientDto | null>(null);
  cancelReason  = signal('');
  actionLoading = signal<string | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────────────
  toast = signal<{ msg: string; ok: boolean } | null>(null);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.fillListSessions();
    this.fillListPayments();
    this.fillUser();
    this.loadBankAccounts();
    this.loadDevices();
  }

  fillListSessions(page = 1) {
    this.sessionsLoading.set(true);
    this.sessionsPage.set(page);
    this.sessionssService.get(page, this.SESSION_LIMIT).subscribe({
      next: (resp) => {
        this.ListSessions.set(resp.data ?? []);
        this.sessionsTotal.set(resp.total ?? 0);
        this.sessionsLoading.set(false);
      },
      error: () => this.sessionsLoading.set(false),
    });
  }

  parseUserAgent(ua: string): { browser: string; os: string } {
    if (!ua) return { browser: '—', os: '—' };
    let browser = 'Otro';
    let os = 'Desconocido';
    if (/edg/i.test(ua))           browser = 'Edge';
    else if (/opr|opera/i.test(ua)) browser = 'Opera';
    else if (/chrome/i.test(ua))    browser = 'Chrome';
    else if (/firefox/i.test(ua))   browser = 'Firefox';
    else if (/safari/i.test(ua))    browser = 'Safari';
    if (/windows/i.test(ua))        os = 'Windows';
    else if (/android/i.test(ua))   os = 'Android';
    else if (/iphone|ipad/i.test(ua)) os = 'iOS';
    else if (/mac/i.test(ua))       os = 'macOS';
    else if (/linux/i.test(ua))     os = 'Linux';
    return { browser, os };
  }

  isSessionExpired(s: SessionsEntity): boolean {
    return new Date(s.expiresAt) < new Date();
  }

  async fillListPayments() {
    this.paymentsService.getPayments().subscribe((resp) => {
      this.ListPayments.set(resp.data ?? []);
    });
  }

  loadBankAccounts() {
    this.bankService.getBankAccount().subscribe(resp =>
      this.bankAccounts.set(resp.data ?? [])
    );
  }

  loadDevices() {
    this.clientService.getMyDevices().subscribe({
      next: resp => {
        const devs = resp.data ?? [];
        this.devices.set(devs);

        // For each unique service_id that has at least one s-ui device, fetch stats
        const suiServiceIds = [...new Set(
          devs.filter(d => d.protocol === 's-ui').map(d => d.service_id)
        )];

        if (suiServiceIds.length) {
          this.statsLoading.set(suiServiceIds);
          for (const sid of suiServiceIds) {
            this.clientService.getServiceStats(sid).subscribe({
              next: r => {
                if (r?.data) {
                  this.serviceStats.update(prev => ({ ...prev, [sid]: r.data! }));
                }
                this.statsLoading.update(ids => ids.filter(id => id !== sid));
              },
              error: () => {
                // S-UI unreachable — silently remove from loading state
                this.statsLoading.update(ids => ids.filter(id => id !== sid));
              },
            });
          }
        }
      },
    });
  }

  /** GB usage percentage clamped to [0, 100] */
  gbPercent(stats: ClientServiceStats): number {
    if (!stats.gb_total || stats.gb_total === 0) return 0;
    return Math.min(100, Math.round((stats.gb_usado / stats.gb_total) * 100));
  }

  /** CSS class for the GB progress bar based on usage */
  gbBarClass(stats: ClientServiceStats): string {
    const pct = this.gbPercent(stats);
    if (pct >= 90) return 'progress-error';
    if (pct >= 70) return 'progress-warning';
    return 'progress-success';
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() =>
      this.showToast('URL copiada al portapapeles', true)
    );
  }

  fillUser() {
    this.clientService.getMe().subscribe({
      next: resp => {
        if (!resp?.data) return;
        const u = new UserEntity();
        u.set(resp.data as any);
        this.profile.set(u);

        // Always allow adding more services
        this.btnAddService.set(true);

        this.paymentsService.getPayments().subscribe(pay => {
          const payments = pay.data ?? [];
          const enriched = u.services.map((f: any) => {
            const existPayment = payments.find((p: any) =>
              p.plan?.plan_id === f.plan_id &&
              daysjs(new Date()).isAfter(p.plan.startedAt) &&
              daysjs(new Date()).isBefore(p.plan.endedAt)
            );
            return {
              ...f,
              upToDate:       !!existPayment,
              paymentAdvance: payments.filter((p: any) => p.plan?.plan_id === f.plan_id && !p.isPrePay).length,
            };
          });
          const updated = new UserEntity();
          updated.set({ ...resp.data, services: enriched } as any);
          this.profile.set(updated);
        });
      },
    });
  }

  getUpToDate(item: any)      { return item['upToDate']; }
  getPaymentAdvance(item: any) { return item['paymentAdvance']; }

  daysLeft(plan: PlanClientDto): number {
    if (!plan.endedAt) return 999;
    const diff = new Date(plan.endedAt as any).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86_400_000));
  }

  bankLabel(acc: bankAccountEntity): string {
    return `${acc.name} — ${acc.number} (${acc.typeAccount})`;
  }

  // ── Payment modal ──────────────────────────────────────────────────────────
  openPayment(plan: PlanClientDto) {
    this.selectedPlan.set(plan);
    this.months.set(1);
    this.selectedFile = null;
    this.uploadProgress.set(0);
    this.paymentForm.patchValue({ plan_id: plan.plan_id, method: 'transferencia bancaria', methodPay: '', note: '' });
    (document.getElementById('dash_pay_modal') as HTMLDialogElement | null)?.showModal();
  }

  setMonths(n: number) { this.months.set(n); }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.length ? input.files[0] : null;
  }

  requiresFile(): boolean {
    return this.selectedMethod === 'transferencia bancaria' || this.selectedMethod === 'efectivo';
  }

  requiresBank(): boolean { return this.selectedMethod === 'transferencia bancaria'; }

  canSubmit(): boolean {
    if (this.paymentForm.invalid || this.saving()) return false;
    if (this.requiresFile() && !this.selectedFile) return false;
    if (this.requiresBank() && !this.paymentForm.get('methodPay')?.value) return false;
    return true;
  }

  onPaySubmit() {
    if (!this.canSubmit()) return;
    const plan   = this.selectedPlan()!;
    const user   = this.profile();
    const v      = this.paymentForm.value;
    const method = this.selectedMethod;

    let methodPayDto = new PaymentMethodPayDto();
    if (this.requiresBank()) {
      const account = this.visibleBanks().find(b => b.id === v.methodPay);
      if (!account) { this.showToast('Selecciona una cuenta de pago', false); return; }
      methodPayDto.id = account.id;
      methodPayDto.name = account.name;
      methodPayDto.number = account.number;
      methodPayDto.cardAccount = account.cardAccount;
      methodPayDto.typeAccount = account.typeAccount;
    }

    const payment: any = {
      plan, kind: plan.kind,
      amount: +this.totalPrice().toFixed(2),
      method, methodPay: methodPayDto,
      note: v.note ?? '', period: new Date().toISOString(),
      payTo: this.months(), total: this.totalPrice(),
      user_id: user.id,
      user_name: `${user.firstNames} ${user.lastNames}`,
      user_email: user.email,
    };

    this.saving.set(true);
    this.paymentsService.doesPaymentsInitial(payment, this.selectedFile).subscribe({
      next: ({ progress, response }) => {
        this.uploadProgress.set(progress);
        if (response) {
          this.saving.set(false);
          this.showToast('Pago enviado. El administrador lo revisará pronto.', true);
          (document.getElementById('dash_pay_modal') as HTMLDialogElement | null)?.close();
          this.paymentForm.reset({ method: 'transferencia bancaria' });
          this.selectedFile = null;
          this.uploadProgress.set(0);
          this.fillUser();
        }
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al enviar el pago', false);
      },
    });
  }

  // ── Service actions ────────────────────────────────────────────────────────
  openSuspend(plan: PlanClientDto) {
    this.targetService.set(plan);
    (document.getElementById('dash_suspend_modal') as HTMLDialogElement | null)?.showModal();
  }

  openReactivate(plan: PlanClientDto) {
    this.targetService.set(plan);
    (document.getElementById('dash_reactivate_modal') as HTMLDialogElement | null)?.showModal();
  }

  openCancel(plan: PlanClientDto) {
    this.targetService.set(plan);
    this.cancelReason.set('');
    (document.getElementById('dash_cancel_modal') as HTMLDialogElement | null)?.showModal();
  }

  confirmSuspend() {
    const svc = this.targetService();
    if (!svc) return;
    this.actionLoading.set(svc.service_id);
    this.clientService.suspendService(svc.service_id).subscribe({
      next: (resp: any) => {
        this.actionLoading.set(null);
        (document.getElementById('dash_suspend_modal') as HTMLDialogElement | null)?.close();
        this.showToast(resp?.message ?? 'Servicio suspendido.', true);
        this.fillUser();
      },
      error: err => {
        this.actionLoading.set(null);
        this.showToast(err?.error?.message ?? 'Error al suspender', false);
      },
    });
  }

  confirmReactivate() {
    const svc = this.targetService();
    if (!svc) return;
    this.actionLoading.set(svc.service_id);
    this.clientService.reactivateService(svc.service_id).subscribe({
      next: (resp: any) => {
        this.actionLoading.set(null);
        (document.getElementById('dash_reactivate_modal') as HTMLDialogElement | null)?.close();
        this.showToast(resp?.message ?? 'Servicio reactivado.', true);
        this.fillUser();
      },
      error: err => {
        this.actionLoading.set(null);
        this.showToast(err?.error?.message ?? 'Error al reactivar', false);
      },
    });
  }

  confirmCancel() {
    const svc = this.targetService();
    if (!svc) return;
    this.actionLoading.set(svc.service_id);
    this.clientService.requestCancelService(svc.service_id, this.cancelReason()).subscribe({
      next: (resp: any) => {
        this.actionLoading.set(null);
        (document.getElementById('dash_cancel_modal') as HTMLDialogElement | null)?.close();
        this.showToast(resp?.message ?? 'Solicitud enviada.', true);
      },
      error: err => {
        this.actionLoading.set(null);
        this.showToast(err?.error?.message ?? 'Error al enviar la solicitud', false);
      },
    });
  }

  // ── Toast ──────────────────────────────────────────────────────────────────
  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 5000);
  }

  goToPlans() {
    this.router.navigate(['/client/plans']);
  }
}
