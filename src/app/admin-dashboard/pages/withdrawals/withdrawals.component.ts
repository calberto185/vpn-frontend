import { Component, computed, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { FormsModule, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { WithdrawalsService } from '../../services/withdrawals/withdrawals.service';
import { AdminMessagesService } from '../../services/messages/messages.service';
import {
  WithdrawalEntity,
  WITHDRAWAL_TYPES,
  WITHDRAWAL_STATES,
  WITHDRAWAL_METHODS,
} from '../../interfaces/withdrawal.interface';
import { PermissionsService } from '../../services/permissions/permissions.service';
import { SocketService } from '../../../shared/services/socket.service';

// jspdf and qrcode imported dynamically to avoid SSR issues
declare const jsPDF: any;

@Component({
  selector: 'app-withdrawals',
  imports: [DatePipe, DecimalPipe, NgClass, FormsModule, ReactiveFormsModule],
  templateUrl: './withdrawals.component.html',
})
export class WithdrawalsComponent implements OnInit, OnDestroy {

  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions = inject(PermissionsService);
  canCreate = computed(() => this.permissions.canDo('withdrawals', 'create'));
  canUpdate = computed(() => this.permissions.canDo('withdrawals', 'update'));
  canDelete = computed(() => this.permissions.canDo('withdrawals', 'delete'));

  private svc       = inject(WithdrawalsService);
  private msgSvc    = inject(AdminMessagesService);
  private fb        = inject(FormBuilder);
  private socketSvc = inject(SocketService);
  private destroy$  = new Subject<void>();

  // Badge: número de retiros llegados por WS sin ver todavía
  newWithdrawalsCount = signal(0);

  withdrawals       = signal<WithdrawalEntity[]>([]);
  withdrawalTypes   = WITHDRAWAL_TYPES;
  withdrawalStates  = WITHDRAWAL_STATES;
  withdrawalMethods = WITHDRAWAL_METHODS;

  toast        = signal<{ msg: string; ok: boolean } | null>(null);
  saving       = signal(false);
  deleting     = signal(false);
  editTarget   = signal<WithdrawalEntity | null>(null);
  deleteTarget = signal<WithdrawalEntity | null>(null);

  // ── Filters ────────────────────────────────────────────────────────────────
  filterType  = '';
  filterState = '';
  filterYear  = String(new Date().getFullYear());

  // ── Stats ─────────────────────────────────────────────────────────────────
  total           = computed(() => this.withdrawals().length);
  totalAmount     = computed(() => this.withdrawals().reduce((s, w) => s + (w.amount || 0), 0));
  completedAmount = computed(() => this.withdrawals().filter(w => w.state === 'completed').reduce((s, w) => s + w.amount, 0));
  pendingAmount   = computed(() => this.withdrawals().filter(w => w.state === 'pending').reduce((s, w) => s + w.amount, 0));

  get filtered(): WithdrawalEntity[] {
    let list = this.withdrawals();
    if (this.filterType)  list = list.filter(w => w.type  === this.filterType);
    if (this.filterState) list = list.filter(w => w.state === this.filterState);
    return list;
  }

  // ── Recipient Autocomplete ─────────────────────────────────────────────────
  recipientSuggestions = signal<{ name: string; id: string | null; source: string; email: string | null }[]>([]);
  showSuggestions      = signal(false);
  private recipientSearch$ = new Subject<string>();

  // ── Reference ─────────────────────────────────────────────────────────────
  refLoading = signal(false);

  // ── Post-create modal ─────────────────────────────────────────────────────
  createdWithdrawal  = signal<WithdrawalEntity | null>(null);
  notifyEmailAddr    = signal('');
  notifyEmailMsg     = signal('');
  emailSending       = signal(false);
  panelMsgRecipId    = signal('');
  panelMsgSending    = signal(false);
  pdfGenerating      = signal(false);

  // ── Forms ─────────────────────────────────────────────────────────────────
  createForm = this.fb.group({
    type:          ['other'],
    recipient:     ['', Validators.required],
    recipientId:   [''],
    concept:       ['', Validators.required],
    amount:        [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency:      ['USD'],
    method:        ['cash'],
    reference:     [''],
    period:        [this.currentPeriod()],
    executedAt:    [''],
    state:         ['pending'],
    attachmentUrl: [''],
    notes:         [''],
  });

  editForm = this.fb.group({
    type:          ['other'],
    recipient:     ['', Validators.required],
    recipientId:   [''],
    concept:       ['', Validators.required],
    amount:        [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency:      ['USD'],
    method:        ['cash'],
    reference:     [''],
    period:        [''],
    executedAt:    [''],
    state:         ['pending'],
    attachmentUrl: [''],
    notes:         [''],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadWithdrawals();
    this.recipientSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(q => this.fetchSuggestions(q));

    // Tiempo real: prepend nuevos retiros creados por otros admins / sistema
    this.socketSvc.onWithdrawalNew().pipe(takeUntil(this.destroy$)).subscribe(w => {
      // Solo añadir si no está ya en la lista (puede haberse creado localmente)
      if (!this.withdrawals().some(x => x.id === w.id)) {
        this.withdrawals.update(list => [w as any, ...list]);
        this.newWithdrawalsCount.update(n => n + 1);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadWithdrawals(): void {
    const filters: any = {};
    if (this.filterYear) filters.year = this.filterYear;
    this.newWithdrawalsCount.set(0);
    this.svc.list(filters).subscribe({
      next: r => this.withdrawals.set(r.data ?? []),
      error: () => this.showToast('Error al cargar retiros', false),
    });
  }

  applyFilters(): void { this.loadWithdrawals(); }

  currentPeriod(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // ── Recipient autocomplete ─────────────────────────────────────────────────
  onRecipientInput(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.createForm.patchValue({ recipientId: '' });
    this.recipientSearch$.next(q);
  }

  fetchSuggestions(q: string): void {
    this.svc.searchRecipients(q).subscribe({
      next: r => {
        this.recipientSuggestions.set(r.data ?? []);
        this.showSuggestions.set((r.data ?? []).length > 0);
      },
      error: () => this.showSuggestions.set(false),
    });
  }

  selectSuggestion(s: { name: string; id: string | null }): void {
    this.createForm.patchValue({ recipient: s.name, recipientId: s.id ?? '' });
    this.showSuggestions.set(false);
  }

  hideSuggestions(): void {
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  sourceLabel(source: string): string {
    if (source === 'client')   return 'Cliente';
    if (source === 'supplier') return 'Proveedor';
    return 'Historial';
  }

  sourceBadge(source: string): string {
    if (source === 'client')   return 'badge-info';
    if (source === 'supplier') return 'badge-accent';
    return 'badge-ghost';
  }

  // ── Reference generation ───────────────────────────────────────────────────
  generateRef(): void {
    this.refLoading.set(true);
    this.svc.nextReference().subscribe({
      next: r => {
        this.refLoading.set(false);
        this.createForm.patchValue({ reference: r.data?.reference ?? '' });
      },
      error: () => this.refLoading.set(false),
    });
  }

  // ── Create ────────────────────────────────────────────────────────────────
  openCreateModal(): void {
    this.createForm.reset({ type: 'other', currency: 'USD', method: 'cash', state: 'pending', period: this.currentPeriod() });
    this.recipientSuggestions.set([]);
    this.showSuggestions.set(false);
    // Pre-load next reference
    this.generateRef();
    (document.getElementById('modal_wd_create') as HTMLDialogElement)?.showModal();
  }

  submitCreate(): void {
    if (this.createForm.invalid) { this.showToast('Revisa los campos requeridos', false); return; }
    const v: any = { ...this.createForm.value };
    if (!v.executedAt)  delete v.executedAt;
    if (!v.recipientId) delete v.recipientId;
    this.saving.set(true);
    this.svc.create(v).subscribe({
      next: r => {
        this.saving.set(false);
        this.loadWithdrawals();
        (document.getElementById('modal_wd_create') as HTMLDialogElement)?.close();
        this.createdWithdrawal.set(r.data);
        this.notifyEmailAddr.set('');
        this.notifyEmailMsg.set('');
        (document.getElementById('modal_wd_receipt') as HTMLDialogElement)?.showModal();
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al registrar retiro', false);
      },
    });
  }

  // ── Receipt modal for existing withdrawal ─────────────────────────────────
  openReceiptModal(w: WithdrawalEntity): void {
    this.createdWithdrawal.set(w);
    this.notifyEmailAddr.set('');
    this.notifyEmailMsg.set('');
    (document.getElementById('modal_wd_receipt') as HTMLDialogElement)?.showModal();
  }

  // ── PDF Download ──────────────────────────────────────────────────────────
  async downloadPdf(w: WithdrawalEntity): Promise<void> {
    this.pdfGenerating.set(true);
    try {
      const { jsPDF } = await import('jspdf' as any);
      const QRCode    = await import('qrcode' as any);

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W = 210, ml = 20, mr = 190;

      // Header block
      doc.setFillColor(30, 41, 59); // slate-800
      doc.rect(0, 0, W, 36, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('COMPROBANTE DE RETIRO DE DINERO', W / 2, 16, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`Ref: ${w.reference || '—'}`, W / 2, 26, { align: 'center' });

      // Type + state badge area
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(0, 36, W, 12, 'F');
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9);
      doc.text(`Tipo: ${this.typeInfo(w.type)?.label ?? w.type}`, ml, 44);
      const stateColor = w.state === 'completed' ? [22, 163, 74] : w.state === 'pending' ? [202, 138, 4] : [107, 114, 128];
      doc.setTextColor(stateColor[0], stateColor[1], stateColor[2]);
      doc.text(`Estado: ${this.stateLabel(w.state)}`, mr, 44, { align: 'right' });

      // Data rows
      doc.setTextColor(0, 0, 0);
      const rows: [string, string][] = [
        ['Beneficiario',      w.recipient],
        ['Concepto',          w.concept],
        ['Monto',             `${w.currency} ${Number(w.amount).toFixed(2)}`],
        ['Método de pago',    this.methodLabel(w.method)],
        ['Período',           w.period || '—'],
        ['Fecha de ejecución', w.executedAt
          ? new Date(w.executedAt).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })
          : '—'],
        ['Fecha de registro', new Date(w.createdAt).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })],
      ];
      if (w.notes) rows.push(['Notas', w.notes]);

      let y = 58;
      for (const [label, value] of rows) {
        doc.setFontSize(9); doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(label, ml, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        const lines = doc.splitTextToSize(value, 110);
        doc.text(lines, 85, y);
        y += 8 * lines.length;
      }

      // Digital signature block
      y += 4;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.rect(ml, y, mr - ml, 28, 'FD');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text('FIRMA DIGITAL DEL SISTEMA', ml + 4, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      const sigLines = doc.splitTextToSize(w.signature ?? 'N/A', mr - ml - 8);
      doc.text(sigLines, ml + 4, y + 12);
      doc.setTextColor(100, 116, 139);
      doc.text(`Firmado: ${w.signedAt ? new Date(w.signedAt).toLocaleString('es-PE') : '—'}`, ml + 4, y + 24);

      // QR code with signature
      const qrData = `WD:${w.id}|REF:${w.reference}|AMT:${w.amount}|SIG:${(w.signature ?? '').slice(0, 16)}`;
      const qrDataUrl: string = await QRCode.toDataURL(qrData, { width: 80, margin: 1 });
      doc.addImage(qrDataUrl, 'PNG', mr - 28, y, 28, 28);

      // Footer
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 280, W, 17, 'F');
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(7);
      doc.text('Documento generado automáticamente por el sistema. ID: ' + w.id, W / 2, 288, { align: 'center' });

      doc.save(`retiro-${w.reference || w.id.slice(0, 8)}.pdf`);
    } catch (e) {
      this.showToast('Error al generar PDF', false);
    }
    this.pdfGenerating.set(false);
  }

  // ── Notify Email ───────────────────────────────────────────────────────────
  sendNotifyEmail(): void {
    const w = this.createdWithdrawal(); if (!w) return;
    const to = this.notifyEmailAddr().trim();
    if (!to) { this.showToast('Ingresa un email válido', false); return; }
    this.emailSending.set(true);
    this.svc.notifyEmail(w.id, { to, customMessage: this.notifyEmailMsg().trim() || undefined }).subscribe({
      next: () => { this.emailSending.set(false); this.showToast(`Email enviado a ${to}`, true); },
      error: err => { this.emailSending.set(false); this.showToast(err?.error?.message ?? 'Error al enviar email', false); },
    });
  }

  // ── Notify Telegram ────────────────────────────────────────────────────────
  openTelegram(w: WithdrawalEntity): void {
    const text = this.buildShareText(w);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(text)}`, '_blank');
  }

  // ── Notify WhatsApp ────────────────────────────────────────────────────────
  openWhatsApp(w: WithdrawalEntity): void {
    const text = this.buildShareText(w);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  // ── Notify Panel Message ───────────────────────────────────────────────────
  sendPanelMessage(w: WithdrawalEntity): void {
    const recipientId = this.panelMsgRecipId().trim() || w.recipientId;
    if (!recipientId) { this.showToast('Este retiro no tiene cliente del panel vinculado', false); return; }
    this.panelMsgSending.set(true);
    const body = this.buildShareText(w);
    this.msgSvc.send({
      to: [recipientId],
      subject: `Comprobante de retiro ${w.reference}`,
      body,
      channels: ['panel'],
    }).subscribe({
      next: () => { this.panelMsgSending.set(false); this.showToast('Mensaje enviado por el panel', true); },
      error: err => { this.panelMsgSending.set(false); this.showToast(err?.error?.message ?? 'Error al enviar mensaje', false); },
    });
  }

  private buildShareText(w: WithdrawalEntity): string {
    const typeLabel   = this.typeInfo(w.type)?.label ?? w.type;
    const methodLabel = this.methodLabel(w.method);
    const stateLabel  = this.stateLabel(w.state);
    const date        = w.executedAt
      ? new Date(w.executedAt).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date(w.createdAt).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });
    return [
      `📋 *Comprobante de Retiro de Dinero*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🔖 Ref: ${w.reference || '—'}`,
      `👤 Beneficiario: ${w.recipient}`,
      `📌 Tipo: ${typeLabel}`,
      `💬 Concepto: ${w.concept}`,
      `💰 Monto: ${w.currency} ${Number(w.amount).toFixed(2)}`,
      `💳 Método: ${methodLabel}`,
      `📊 Estado: ${stateLabel}`,
      `📅 Fecha: ${date}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🔐 Firma: ${(w.signature ?? 'N/A').slice(0, 16)}...`,
    ].join('\n');
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  openEditModal(w: WithdrawalEntity): void {
    this.editTarget.set(w);
    this.editForm.patchValue({
      type:          w.type,
      recipient:     w.recipient,
      recipientId:   w.recipientId ?? '',
      concept:       w.concept,
      amount:        w.amount,
      currency:      w.currency,
      method:        w.method,
      reference:     w.reference,
      period:        w.period,
      executedAt:    w.executedAt ? w.executedAt.slice(0, 10) : '',
      state:         w.state,
      attachmentUrl: w.attachmentUrl,
      notes:         w.notes,
    });
    (document.getElementById('modal_wd_edit') as HTMLDialogElement)?.showModal();
  }

  submitEdit(): void {
    if (this.editForm.invalid || !this.editTarget()) return;
    const v: any = { ...this.editForm.value };
    if (!v.executedAt)  delete v.executedAt;
    if (!v.recipientId) delete v.recipientId;
    this.saving.set(true);
    this.svc.update(this.editTarget()!.id, v).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadWithdrawals();
        (document.getElementById('modal_wd_edit') as HTMLDialogElement)?.close();
        this.showToast('Retiro actualizado', true);
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al actualizar', false);
      },
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  openDeleteModal(w: WithdrawalEntity): void {
    this.deleteTarget.set(w);
    (document.getElementById('modal_wd_delete') as HTMLDialogElement)?.showModal();
  }

  confirmDelete(): void {
    const w = this.deleteTarget(); if (!w) return;
    this.deleting.set(true);
    this.svc.remove(w.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.loadWithdrawals();
        (document.getElementById('modal_wd_delete') as HTMLDialogElement)?.close();
        this.showToast('Retiro eliminado', true);
      },
      error: err => {
        this.deleting.set(false);
        this.showToast(err?.error?.message ?? 'Error al eliminar', false);
      },
    });
  }

  // ── Quick complete ────────────────────────────────────────────────────────
  markAsCompleted(w: WithdrawalEntity): void {
    this.svc.update(w.id, { state: 'completed', executedAt: new Date().toISOString() }).subscribe({
      next: () => { this.loadWithdrawals(); this.showToast('Marcado como completado', true); },
      error: () => this.showToast('Error al actualizar estado', false),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  typeInfo(type: string)    { return this.withdrawalTypes.find(t => t.value === type); }
  stateBadge(state: string) { return this.withdrawalStates.find(s => s.value === state)?.badge ?? 'badge-ghost'; }
  stateLabel(state: string) { return this.withdrawalStates.find(s => s.value === state)?.label ?? state; }
  methodLabel(m: string)    { return this.withdrawalMethods.find(x => x.value === m)?.label ?? m; }

  showToast(msg: string, ok: boolean): void {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
