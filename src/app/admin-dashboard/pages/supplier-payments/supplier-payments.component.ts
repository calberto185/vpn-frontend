import { Component, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { SupplierPaymentsService } from '../../services/supplier-payments/supplier-payments.service';
import { AdminMessagesService }    from '../../services/messages/messages.service';
import {
  SupplierPaymentEntity,
  PAYMENT_STATES,
  PAYMENT_METHODS,
  EXPENSE_CATEGORIES,
} from '../../interfaces/supplier-payment.interface';
import { PermissionsService } from '../../services/permissions/permissions.service';

@Component({
  selector: 'app-supplier-payments',
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule],
  templateUrl: './supplier-payments.component.html',
  styleUrl: './supplier-payments.component.css',
})
export class SupplierPaymentsComponent implements OnInit, OnDestroy {

  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions = inject(PermissionsService);
  canCreate = computed(() => this.permissions.canDo('supplier-payments', 'create'));
  canUpdate = computed(() => this.permissions.canDo('supplier-payments', 'update'));
  canDelete = computed(() => this.permissions.canDo('supplier-payments', 'delete'));

  private svc     = inject(SupplierPaymentsService);
  private msgSvc  = inject(AdminMessagesService);
  private fb      = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  payments          = signal<SupplierPaymentEntity[]>([]);
  paymentStates     = PAYMENT_STATES;
  paymentMethods    = PAYMENT_METHODS;
  expenseCategories = EXPENSE_CATEGORIES;

  toast        = signal<{ msg: string; ok: boolean } | null>(null);
  saving       = signal(false);
  deleting     = signal(false);
  editTarget   = signal<SupplierPaymentEntity | null>(null);
  deleteTarget = signal<SupplierPaymentEntity | null>(null);

  // Filters
  filterSupplierId = signal('');
  filterState      = signal('');
  filterYear       = signal(String(new Date().getFullYear()));

  // ── Stats ─────────────────────────────────────────────────────────────────
  total         = computed(() => this.payments().length);
  totalAmount   = computed(() => this.payments().reduce((s, p) => s + (p.amount || 0), 0));
  paidAmount    = computed(() => this.payments().filter(p => p.state === 'paid').reduce((s, p) => s + p.amount, 0));
  pendingAmount = computed(() => this.payments().filter(p => p.state === 'pending' || p.state === 'overdue').reduce((s, p) => s + p.amount, 0));

  filtered = computed(() => {
    let list = this.payments();
    if (this.filterSupplierId()) list = list.filter(p => p.supplierId === this.filterSupplierId());
    if (this.filterState())      list = list.filter(p => p.state === this.filterState());
    return list;
  });

  // Unique suppliers for filter dropdown (from loaded payments)
  supplierOptions = computed(() => {
    const seen = new Map<string, string>();
    for (const p of this.payments()) {
      if (p.supplierId && !seen.has(p.supplierId)) seen.set(p.supplierId, p.supplierName);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  });

  // ── Recipient Autocomplete ─────────────────────────────────────────────────
  recipientSuggestions = signal<{ name: string; supplierId: string | null; recipientId: string | null; source: string; email: string | null }[]>([]);
  showSuggestions      = signal(false);
  private recipientSearch$ = new Subject<string>();

  // ── Reference ─────────────────────────────────────────────────────────────
  refLoading = signal(false);

  // ── Post-create modal ─────────────────────────────────────────────────────
  createdPayment    = signal<SupplierPaymentEntity | null>(null);
  notifyEmailAddr   = signal('');
  notifyEmailMsg    = signal('');
  emailSending      = signal(false);
  panelMsgSending   = signal(false);
  pdfGenerating     = signal(false);

  // ── Forms ─────────────────────────────────────────────────────────────────
  createForm = this.fb.group({
    supplierName: ['', Validators.required],
    supplierId:   [''],
    recipientId:  [''],
    concept:      ['', Validators.required],
    category:     ['other'],
    amount:       [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency:     ['USD'],
    method:       ['bank_transfer'],
    reference:    [''],
    period:       [this.currentPeriod()],
    dueDate:      [''],
    paidAt:       [''],
    state:        ['pending'],
    notes:        [''],
  });

  editForm = this.fb.group({
    concept:      ['', Validators.required],
    category:     ['other'],
    supplierName: [''],
    amount:       [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency:     ['USD'],
    method:       ['bank_transfer'],
    reference:    [''],
    period:       [''],
    dueDate:      [''],
    paidAt:       [''],
    state:        ['pending'],
    notes:        [''],
    picture:      [''],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadPayments();
    this.recipientSearch$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(q => this.fetchSuggestions(q));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPayments(): void {
    const filters: any = {};
    if (this.filterYear()) filters.year = this.filterYear();
    this.svc.list(filters).subscribe({
      next: r => this.payments.set(r.data ?? []),
      error: () => this.showToast('Error al cargar pagos', false),
    });
  }

  applyFilters(): void { this.loadPayments(); }

  currentPeriod(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // ── Recipient autocomplete ─────────────────────────────────────────────────
  onBeneficiaryInput(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.createForm.patchValue({ supplierId: '', recipientId: '' });
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

  selectSuggestion(s: { name: string; supplierId: string | null; recipientId: string | null }): void {
    this.createForm.patchValue({
      supplierName: s.name,
      supplierId:   s.supplierId ?? '',
      recipientId:  s.recipientId ?? '',
    });
    this.showSuggestions.set(false);
  }

  hideSuggestions(): void {
    setTimeout(() => this.showSuggestions.set(false), 200);
  }

  sourceLabel(source: string): string {
    if (source === 'supplier') return 'Proveedor';
    if (source === 'client')   return 'Cliente';
    return 'Historial';
  }

  sourceBadge(source: string): string {
    if (source === 'supplier') return 'badge-accent';
    if (source === 'client')   return 'badge-info';
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
    this.createForm.reset({ currency: 'USD', method: 'bank_transfer', state: 'pending', period: this.currentPeriod(), category: 'other' });
    this.recipientSuggestions.set([]);
    this.showSuggestions.set(false);
    this.generateRef();
    (document.getElementById('modal_spayment_create') as HTMLDialogElement)?.showModal();
  }

  submitCreate(): void {
    if (this.createForm.invalid) { this.showToast('Revisa los campos requeridos', false); return; }
    const v: any = { ...this.createForm.value };
    if (!v.dueDate)     delete v.dueDate;
    if (!v.paidAt)      delete v.paidAt;
    if (!v.supplierId)  delete v.supplierId;
    if (!v.recipientId) delete v.recipientId;
    this.saving.set(true);
    this.svc.create(v).subscribe({
      next: r => {
        this.saving.set(false);
        this.loadPayments();
        (document.getElementById('modal_spayment_create') as HTMLDialogElement)?.close();
        this.createdPayment.set(r.data);
        this.notifyEmailAddr.set('');
        this.notifyEmailMsg.set('');
        (document.getElementById('modal_spayment_receipt') as HTMLDialogElement)?.showModal();
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al crear pago', false);
      },
    });
  }

  // ── Receipt modal for existing payment ────────────────────────────────────
  openReceiptModal(p: SupplierPaymentEntity): void {
    this.createdPayment.set(p);
    this.notifyEmailAddr.set('');
    this.notifyEmailMsg.set('');
    (document.getElementById('modal_spayment_receipt') as HTMLDialogElement)?.showModal();
  }

  // ── PDF Download ──────────────────────────────────────────────────────────
  async downloadPdf(p: SupplierPaymentEntity): Promise<void> {
    this.pdfGenerating.set(true);
    try {
      const { jsPDF } = await import('jspdf' as any);
      const QRCode    = await import('qrcode' as any);

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const W = 210, ml = 20, mr = 190;

      // Header
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, W, 36, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('COMPROBANTE DE PAGO A PROVEEDOR', W / 2, 16, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal');
      doc.text(`Ref: ${p.reference || '—'}`, W / 2, 26, { align: 'center' });

      // Sub-header
      doc.setFillColor(241, 245, 249);
      doc.rect(0, 36, W, 12, 'F');
      doc.setTextColor(71, 85, 105);
      doc.setFontSize(9);
      doc.text(`Método: ${this.methodLabel(p.method)}`, ml, 44);
      const stateColor = p.state === 'paid' ? [22, 163, 74] : p.state === 'pending' ? [202, 138, 4] : p.state === 'overdue' ? [220, 38, 38] : [107, 114, 128];
      doc.setTextColor(stateColor[0], stateColor[1], stateColor[2]);
      doc.text(`Estado: ${this.stateLabel(p.state)}`, mr, 44, { align: 'right' });

      // Data rows
      doc.setTextColor(0, 0, 0);
      const rows: [string, string][] = [
        ['Beneficiario',  p.supplierName],
        ['Concepto',      p.concept],
        ['Monto',         `${p.currency} ${Number(p.amount).toFixed(2)}`],
        ['Método de pago',this.methodLabel(p.method)],
        ['Período',       p.period || '—'],
      ];
      if (p.dueDate) rows.push(['Fecha de vencimiento', new Date(p.dueDate).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })]);
      if (p.paidAt)  rows.push(['Fecha de pago',        new Date(p.paidAt).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })]);
      rows.push(['Fecha de registro', new Date(p.createdAt).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })]);
      if (p.notes) rows.push(['Notas', p.notes]);

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
      const sigLines = doc.splitTextToSize(p.signature ?? 'N/A', mr - ml - 8);
      doc.text(sigLines, ml + 4, y + 12);
      doc.setTextColor(100, 116, 139);
      doc.text(`Firmado: ${p.signedAt ? new Date(p.signedAt).toLocaleString('es-PE') : '—'}`, ml + 4, y + 24);

      // QR code
      const qrData = `SP:${p.id}|REF:${p.reference}|AMT:${p.amount}|SIG:${(p.signature ?? '').slice(0, 16)}`;
      const qrDataUrl: string = await QRCode.toDataURL(qrData, { width: 80, margin: 1 });
      doc.addImage(qrDataUrl, 'PNG', mr - 28, y, 28, 28);

      // Footer
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 280, W, 17, 'F');
      doc.setTextColor(156, 163, 175);
      doc.setFontSize(7);
      doc.text('Documento generado automáticamente por el sistema. ID: ' + p.id, W / 2, 288, { align: 'center' });

      doc.save(`pago-proveedor-${p.reference || p.id.slice(0, 8)}.pdf`);
    } catch (e) {
      this.showToast('Error al generar PDF', false);
    }
    this.pdfGenerating.set(false);
  }

  // ── Notify Email ───────────────────────────────────────────────────────────
  sendNotifyEmail(): void {
    const p = this.createdPayment(); if (!p) return;
    const to = this.notifyEmailAddr().trim();
    if (!to) { this.showToast('Ingresa un email válido', false); return; }
    this.emailSending.set(true);
    this.svc.notifyEmail(p.id, { to, customMessage: this.notifyEmailMsg().trim() || undefined }).subscribe({
      next: () => { this.emailSending.set(false); this.showToast(`Email enviado a ${to}`, true); },
      error: err => { this.emailSending.set(false); this.showToast(err?.error?.message ?? 'Error al enviar email', false); },
    });
  }

  // ── Notify Telegram ────────────────────────────────────────────────────────
  openTelegram(p: SupplierPaymentEntity): void {
    const text = this.buildShareText(p);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent(text)}`, '_blank');
  }

  // ── Notify WhatsApp ────────────────────────────────────────────────────────
  openWhatsApp(p: SupplierPaymentEntity): void {
    const text = this.buildShareText(p);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  // ── Notify Panel Message ───────────────────────────────────────────────────
  sendPanelMessage(p: SupplierPaymentEntity): void {
    const recipientId = p.recipientId;
    if (!recipientId) { this.showToast('Este pago no tiene cliente del panel vinculado', false); return; }
    this.panelMsgSending.set(true);
    this.msgSvc.send({
      to: [recipientId],
      subject: `Comprobante de pago ${p.reference}`,
      body: this.buildShareText(p),
      channels: ['panel'],
    }).subscribe({
      next: () => { this.panelMsgSending.set(false); this.showToast('Mensaje enviado por el panel', true); },
      error: err => { this.panelMsgSending.set(false); this.showToast(err?.error?.message ?? 'Error al enviar mensaje', false); },
    });
  }

  private buildShareText(p: SupplierPaymentEntity): string {
    const methodLabel = this.methodLabel(p.method);
    const stateLabel  = this.stateLabel(p.state);
    const date        = p.paidAt
      ? new Date(p.paidAt).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date(p.createdAt).toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' });
    return [
      `📋 *Comprobante de Pago a Proveedor*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🔖 Ref: ${p.reference || '—'}`,
      `🏢 Beneficiario: ${p.supplierName}`,
      `💬 Concepto: ${p.concept}`,
      `💰 Monto: ${p.currency} ${Number(p.amount).toFixed(2)}`,
      `💳 Método: ${methodLabel}`,
      `📊 Estado: ${stateLabel}`,
      `📅 Fecha: ${date}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🔐 Firma: ${(p.signature ?? 'N/A').slice(0, 16)}...`,
    ].join('\n');
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  openEditModal(p: SupplierPaymentEntity): void {
    this.editTarget.set(p);
    this.editForm.patchValue({
      concept:      p.concept,
      category:     p.category ?? 'other',
      supplierName: p.supplierName,
      amount:       p.amount,
      currency:     p.currency,
      method:       p.method,
      reference:    p.reference,
      period:       p.period,
      dueDate:      p.dueDate ? p.dueDate.slice(0, 10) : '',
      paidAt:       p.paidAt  ? p.paidAt.slice(0, 10)  : '',
      state:        p.state,
      notes:        p.notes,
      picture:      p.picture,
    });
    (document.getElementById('modal_spayment_edit') as HTMLDialogElement)?.showModal();
  }

  submitEdit(): void {
    if (this.editForm.invalid || !this.editTarget()) return;
    const v: any = { ...this.editForm.value };
    if (!v.dueDate) delete v.dueDate;
    if (!v.paidAt)  delete v.paidAt;
    this.saving.set(true);
    this.svc.update(this.editTarget()!.id, v).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadPayments();
        (document.getElementById('modal_spayment_edit') as HTMLDialogElement)?.close();
        this.showToast('Pago actualizado', true);
      },
      error: err => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al actualizar', false);
      },
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  openDeleteModal(p: SupplierPaymentEntity): void {
    this.deleteTarget.set(p);
    (document.getElementById('modal_spayment_delete') as HTMLDialogElement)?.showModal();
  }

  confirmDelete(): void {
    const p = this.deleteTarget(); if (!p) return;
    this.deleting.set(true);
    this.svc.remove(p.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.loadPayments();
        (document.getElementById('modal_spayment_delete') as HTMLDialogElement)?.close();
        this.showToast('Pago eliminado', true);
      },
      error: err => {
        this.deleting.set(false);
        this.showToast(err?.error?.message ?? 'Error al eliminar', false);
      },
    });
  }

  // ── Quick state update ────────────────────────────────────────────────────
  markAsPaid(p: SupplierPaymentEntity): void {
    this.svc.update(p.id, { state: 'paid', paidAt: new Date().toISOString() }).subscribe({
      next: () => { this.loadPayments(); this.showToast('Marcado como pagado', true); },
      error: () => this.showToast('Error al actualizar estado', false),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  stateBadge(state: string) { return this.paymentStates.find(s => s.value === state)?.badge ?? 'badge-ghost'; }
  stateLabel(state: string) { return this.paymentStates.find(s => s.value === state)?.label ?? state; }
  methodLabel(m: string)    { return this.paymentMethods.find(x => x.value === m)?.label ?? m; }

  showToast(msg: string, ok: boolean): void {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
