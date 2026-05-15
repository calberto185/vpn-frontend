import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, Subscription, take } from 'rxjs';
import jsPDF from 'jspdf';
import { addSignedFooter } from '../../../shared/utils/pdf-signature.util';
import { ClientMessagesService } from '../../services/messages/messages.service';
import MessageEntity, { MessageAttachment } from '../../interfaces/message.interface';
import { AuthService } from '../../../auth/services/auth.service';
import { SocketService } from '../../../shared/services/socket.service';
import { MessagesStateService } from '../../../shared/services/messages-state.service';

type Tab = 'inbox' | 'sent';
interface AttachFile { name: string; mimeType: string; data: string; type: 'image' | 'video' | 'document'; size: number; }

@Component({
  selector: 'app-client-messages',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.css',
})
export class ClientMessagesComponent implements OnInit, OnDestroy {

  private svc           = inject(ClientMessagesService);
  private auth          = inject(AuthService);
  private fb            = inject(FormBuilder);
  private socketSvc     = inject(SocketService);
  private messagesState = inject(MessagesStateService);
  private route         = inject(ActivatedRoute);
  private router        = inject(Router);
  private subs          = new Subscription();

  private pendingOpenId = signal<string | null>(null);

  // ── State ─────────────────────────────────────────────────────────────────
  activeTab   = signal<Tab>('inbox');
  inbox       = signal<MessageEntity[]>([]);
  sent        = signal<MessageEntity[]>([]);
  unreadCount = signal(0);
  loading     = signal(true);
  saving      = signal(false);
  toast       = signal<{ msg: string; ok: boolean } | null>(null);
  selected    = signal<MessageEntity | null>(null);
  userId      = signal<string>('');

  // ── Thread / Reply state ───────────────────────────────────────────────────
  threadMessages = signal<MessageEntity[]>([]);
  loadingThread  = signal(false);
  replyBody      = signal('');
  replyFiles     = signal<AttachFile[]>([]);
  replying       = signal(false);

  // ── Compose state ──────────────────────────────────────────────────────────
  composeFiles = signal<AttachFile[]>([]);

  // ── Form ───────────────────────────────────────────────────────────────────
  composeForm = this.fb.group({
    subject: ['', [Validators.required, Validators.minLength(3)]],
    body:    [''],
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit() {
    const user = this.auth.user?.();
    if (user?.id) this.userId.set(user.id);
    this.loadAll();
    this.listenSockets();

    // Listen for ?open=<id> and ?compose=1 query params
    this.subs.add(
      this.route.queryParams.subscribe(params => {
        const openId = params['open'];
        if (openId) {
          this.pendingOpenId.set(openId);
          this.tryOpenPending();
        }
        if (params['compose'] === '1') {
          const subject = params['subject'] ?? '';
          setTimeout(() => {
            this.composeForm.reset({ subject, body: '' });
            this.composeFiles.set([]);
            (document.getElementById('client_compose_modal') as HTMLDialogElement | null)?.showModal();
          }, 300);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private listenSockets(): void {
    this.subs.add(
      this.socketSvc.onNewMessageForUser().subscribe(ev => {
        // Only prepend ROOT messages to inbox — replies are visible inside the thread view
        if (!ev.reply_to_id) {
          this.inbox.update(list => {
            if (list.some(m => m.id === ev.message_id)) return list;
            const newMsg = {
              id:          ev.message_id,
              from_name:   ev.from_name,
              subject:     ev.subject,
              body:        ev.preview,
              type:        'admin_to_client' as const,
              read_by:     [],
              attachments: [],
              thread_id:   ev.thread_id ?? ev.message_id,
              reply_to_id: null,
              createdAt:   ev.createdAt,
              updatedAt:   ev.createdAt,
            } as unknown as MessageEntity;
            return [newMsg, ...list];
          });
          this.unreadCount.update(n => n + 1);
        }

        // Auto-refresh thread only if the new message belongs to the open conversation
        const sel = this.selected();
        if (sel) {
          const inSameThread =
            ev.thread_id === sel.thread_id ||
            ev.thread_id === sel.id        ||
            ev.reply_to_id === sel.id;
          if (inSameThread) this.loadThread(sel);
        }
      })
    );
  }

  private tryOpenPending(): void {
    const openId = this.pendingOpenId();
    if (!openId || this.loading()) return;

    // 1. Try direct match in inbox (root messages)
    const direct = this.inbox().find(m => m.id === openId);
    if (direct) {
      this.pendingOpenId.set(null);
      setTimeout(() => this.openDetail(direct), 100);
      return;
    }

    // 2. Notification might point to a reply — load the thread to find the root
    this.pendingOpenId.set(null);
    this.svc.getThread(openId).subscribe({
      next: r => {
        const thread: MessageEntity[] = r.data ?? [];
        if (!thread.length) return;
        // Thread sorted asc; first item is the root
        const root = thread[0];
        const rootMsg = this.inbox().find(m => m.id === root.id) ?? root;
        setTimeout(() => this.openDetail(rootMsg), 100);
      },
    });
  }

  loadAll() {
    this.loading.set(true);
    this.svc.getInbox().subscribe({
      next: r => {
        console.log('[ClientMessages] getInbox response:', r);
        this.inbox.set(r.data ?? []);
        this.loading.set(false);
        this.tryOpenPending();
      },
      error: (err: any) => {
        console.error('[ClientMessages] getInbox error:', err);
        this.loading.set(false);
        this.showToast(`Error cargando bandeja: ${err?.error?.message ?? err?.status ?? 'sin conexión'}`, false);
      },
    });
    this.svc.getSent().subscribe({
      next: r => this.sent.set(r.data ?? []),
      error: (err: any) => console.error('[ClientMessages] getSent error:', err),
    });
    this.svc.getUnreadCount().subscribe({ next: r => this.unreadCount.set(r.data?.count ?? 0) });
  }

  // ── Compose ────────────────────────────────────────────────────────────────
  openCompose() {
    this.composeForm.reset({ subject: '', body: '' });
    this.composeFiles.set([]);
    (document.getElementById('client_compose_modal') as HTMLDialogElement | null)?.showModal();
  }

  onSend() {
    if (this.saving()) return;
    const { subject, body } = this.composeForm.value;
    if (!subject?.trim()) { this.showToast('El asunto es obligatorio', false); return; }
    if (!body?.trim() && !this.composeFiles().length) { this.showToast('Escribe un mensaje o adjunta un archivo', false); return; }

    const correlationId = crypto.randomUUID();
    const payload = {
      correlationId,
      subject:     subject!,
      body:        body || '',
      reply_to_id: null as string | null,
      attachments: this.composeFiles() as unknown as MessageAttachment[],
    };

    this.saving.set(true);

    const sent = this.socketSvc.sendRaw('messages:send', payload);
    if (!sent) {
      // WS not connected — fall back to HTTP
      this.svc.send(subject!, body || '', null, this.composeFiles() as unknown as MessageAttachment[]).subscribe({
        next: () => {
          this.saving.set(false);
          this.showToast('Consulta enviada al administrador', true);
          (document.getElementById('client_compose_modal') as HTMLDialogElement | null)?.close();
          this.activeTab.set('sent');
          this.svc.getSent().subscribe({ next: r => this.sent.set(r.data ?? []) });
        },
        error: (err: any) => {
          this.saving.set(false);
          this.showToast(err?.error?.message ?? 'Error al enviar', false);
        },
      });
      return;
    }

    // Wait for ACK from server
    this.socketSvc.onSendAck().pipe(
      filter(ack => ack.correlationId === correlationId),
      take(1),
    ).subscribe(ack => {
      this.saving.set(false);
      if (ack.ok) {
        this.showToast('Consulta enviada al administrador', true);
        (document.getElementById('client_compose_modal') as HTMLDialogElement | null)?.close();
        this.activeTab.set('sent');
        if (ack.message) {
          this.sent.update(list => [ack.message, ...list]);
        } else {
          this.svc.getSent().subscribe({ next: r => this.sent.set(r.data ?? []) });
        }
      } else {
        this.showToast(ack.error ?? 'Error al enviar', false);
      }
    });
  }

  // ── Detail / Thread ────────────────────────────────────────────────────────
  openDetail(msg: MessageEntity) {
    this.selected.set(msg);
    this.replyBody.set('');
    this.replyFiles.set([]);
    this.loadThread(msg);
    if (!msg.read_by?.includes(this.userId())) {
      this.svc.markRead(msg.id).subscribe({
        next: () => {
          this.unreadCount.update(n => Math.max(0, n - 1));
          this.inbox.update(list =>
            list.map(m => m.id === msg.id ? { ...m, read_by: [...(m.read_by ?? []), this.userId()] } as MessageEntity : m)
          );
          // Tell the layout's bell to remove preview item AND decrement its badge
          this.messagesState.markAsRead(msg.id);
          this.messagesState.decrementUnread();
        },
      });
    } else {
      // Already read — still remove from bell if it arrived via WS before being opened
      this.messagesState.markAsRead(msg.id);
    }
    (document.getElementById('client_detail_modal') as HTMLDialogElement | null)?.showModal();
  }

  loadThread(msg: MessageEntity) {
    this.loadingThread.set(true);
    this.svc.getThread(msg.id).subscribe({
      next: r => {
        this.threadMessages.set(r.data?.length ? r.data : [msg]);
        this.loadingThread.set(false);
        this.scrollThreadToBottom();
      },
      error: () => {
        this.threadMessages.set([msg]);
        this.loadingThread.set(false);
        this.scrollThreadToBottom();
      },
    });
  }

  private scrollThreadToBottom(): void {
    setTimeout(() => {
      const el = document.getElementById('client-thread-scroll');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  isMyMessage(msg: MessageEntity): boolean {
    return msg.type === 'client_to_admin' && msg.from_id === this.userId();
  }

  onReply() {
    const body = this.replyBody().trim();
    if (!body && !this.replyFiles().length) return;
    const msg = this.selected();
    if (!msg) return;

    const subject       = msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`;
    const correlationId = crypto.randomUUID();
    const payload = {
      correlationId,
      subject,
      body:        body || '',
      reply_to_id: msg.id,
      attachments: this.replyFiles() as unknown as MessageAttachment[],
    };

    this.replying.set(true);

    const sent = this.socketSvc.sendRaw('messages:send', payload);
    if (!sent) {
      // WS not connected — fall back to HTTP
      this.svc.send(subject, body || '', msg.id, this.replyFiles() as unknown as MessageAttachment[]).subscribe({
        next: () => {
          this.replying.set(false);
          this.replyBody.set('');
          this.replyFiles.set([]);
          this.loadThread(this.selected()!);
          this.showToast('Respuesta enviada', true);
        },
        error: (err: any) => {
          this.replying.set(false);
          this.showToast(err?.error?.message ?? 'Error al responder', false);
        },
      });
      return;
    }

    // Wait for ACK
    this.socketSvc.onSendAck().pipe(
      filter(ack => ack.correlationId === correlationId),
      take(1),
    ).subscribe(ack => {
      this.replying.set(false);
      if (ack.ok) {
        this.replyBody.set('');
        this.replyFiles.set([]);
        // Append confirmed message to thread immediately
        if (ack.message) {
          this.threadMessages.update(list => [...list, ack.message]);
          this.scrollThreadToBottom();
        } else {
          this.loadThread(this.selected()!);
        }
        this.showToast('Respuesta enviada', true);
      } else {
        this.showToast(ack.error ?? 'Error al responder', false);
      }
    });
  }

  isUnread(msg: MessageEntity): boolean {
    return !(msg.read_by ?? []).includes(this.userId());
  }

  // ── Attachments ────────────────────────────────────────────────────────────
  async handleReplyFiles(event: Event) {
    const files = await this._readFiles(event);
    this.replyFiles.update(list => [...list, ...files]);
  }

  async handleComposeFiles(event: Event) {
    const files = await this._readFiles(event);
    this.composeFiles.update(list => [...list, ...files]);
  }

  removeReplyFile(i: number)   { this.replyFiles.update(l => l.filter((_, idx) => idx !== i)); }
  removeComposeFile(i: number) { this.composeFiles.update(l => l.filter((_, idx) => idx !== i)); }

  private async _readFiles(event: Event): Promise<AttachFile[]> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return [];
    const result: AttachFile[] = [];
    for (const file of Array.from(input.files)) {
      if (file.size > 2 * 1024 * 1024) {
        this.showToast(`${file.name}: demasiado grande (máx 2 MB)`, false);
        continue;
      }
      const type: AttachFile['type'] = file.type.startsWith('image/') ? 'image'
                                     : file.type.startsWith('video/') ? 'video'
                                     : 'document';
      const data = await this._toBase64(file, type === 'image');
      result.push({ name: file.name, mimeType: file.type, data, type, size: file.size });
    }
    input.value = '';
    return result;
  }

  private _toBase64(file: File, compress: boolean): Promise<string> {
    return new Promise((resolve) => {
      if (compress) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const MAX = 800;
            let { width: w, height: h } = img;
            if (w > MAX || h > MAX) {
              if (w > h) { h = h * MAX / w; w = MAX; }
              else       { w = w * MAX / h; h = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.75).split(',')[1]);
          };
          img.src = e.target!.result as string;
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target!.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      }
    });
  }

  attachmentPreviewUrl(att: MessageAttachment): string {
    if (att.data) return `data:${att.mimeType};base64,${att.data}`;
    if (att.url)  return att.url;
    return '';
  }

  formatBytes(b: number): string {
    if (!b) return '';
    if (b < 1024)        return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }

  /** Returns true if the message has a hidden payment JSON attachment */
  hasPaymentData(msg: MessageEntity): boolean {
    return (msg.attachments ?? []).some(a => a.name === '__payment_data__.json' && a.data);
  }

  /** Parses and returns payment data from hidden JSON attachment, or null */
  getPaymentData(msg: MessageEntity): any | null {
    const att = (msg.attachments ?? []).find(a => a.name === '__payment_data__.json' && a.data);
    if (!att) return null;
    try { return JSON.parse(decodeURIComponent(escape(atob(att.data!)))); } catch { return null; }
  }

  /** Navigate in-app to the payments page (closes modal first) */
  navigateToPayment(msg: MessageEntity) {
    const p = this.getPaymentData(msg);
    (document.getElementById('client_detail_modal') as HTMLDialogElement)?.close();
    this.router.navigate(['/client/payments'], p?.id ? { queryParams: { payment_id: p.id } } : {});
  }

  // ── Download message as PDF (with inline images) ──────────────────────────
  async downloadMsgPdf(msg: MessageEntity) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const lm = 18, rm = 192;
    let y = 18;

    const safe = (s: string | null | undefined): string => {
      if (!s) return '-';
      return s
        .replace(/\u2192/g, '->')
        .replace(/\u2190/g, '<-')
        .replace(/\u2013/g, '-')
        .replace(/\u2014/g, '--')
        .replace(/\u2026/g, '...')
        .replace(/[^\x00-\xFF]/g, '?');
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

    // ── Detect hidden payment JSON attachment ──
    const jsonAtt = (msg.attachments ?? []).find(a => a.name === '__payment_data__.json' && a.data);
    const imgAtt  = (msg.attachments ?? []).find(a => a.type === 'image' && (a.data || a.url));

    if (jsonAtt) {
      // ── Structured payment PDF ──
      let p: any = {};
      try { p = JSON.parse(decodeURIComponent(escape(atob(jsonAtt.data!)))); } catch { p = {}; }

      // Header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 210, 28, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255);
      doc.text('Comprobante de Pago', lm, 13);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(200, 210, 255);
      const genDate = new Date().toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' });
      doc.text(`Generado el ${genDate}`, lm, 21);
      y = 36;

      // State badge
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
      doc.text(safe(p.state) || 'Desconocido', lm + 4, y); y += 11;

      // Payment data
      sectionTitle('Datos del pago');
      row('ID del pago:',    p.id ?? '-');
      row('Fecha creado:',   p.createdAt ? new Date(p.createdAt).toLocaleDateString('es') : '-');
      row('Periodo:',        safe(p.period));
      row('Monto pagado:',   `${p.amount ?? 0} ${p.plan?.currencyCode ?? ''}`);
      row('Metodo de pago:', safe(p.method));
      row('Cuenta destino:', safe(`${p.methodPay?.name ?? ''} ${p.methodPay?.number ?? ''}`.trim() || '-'));
      y += 2; hr();

      // Client
      sectionTitle('Cliente');
      row('Nombre:', safe(p.user_name));
      row('Email:',  safe(p.user_email));
      y += 2; hr();

      // Service / Plan
      sectionTitle('Servicio y Plan');
      row('Servicio:',        safe(p.plan?.service_sortName));
      row('Plan:',            safe(`${p.plan?.plan_title_prefix ?? ''} ${p.plan?.plan_title_name ?? ''}`.trim() || '-'));
      row('Precio del plan:', safe(`${p.plan?.price ?? '-'} ${p.plan?.currencyCode ?? ''}/${p.plan?.kind ?? ''}`));
      row('Dispositivos:',    String(p.plan?.limitDevices ?? '-'));

      if (p.note) {
        y += 2; hr();
        sectionTitle('Nota');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(60);
        const noteLines = doc.splitTextToSize(safe(p.note), 162);
        doc.text(noteLines, lm, y);
        y += noteLines.length * 5.5 + 4;
      }

      // Voucher image
      if (imgAtt) {
        y += 2; hr();
        sectionTitle('Comprobante adjunto');
        let dataUrl: string | null = imgAtt.data ? `data:${imgAtt.mimeType};base64,${imgAtt.data}` : null;
        if (!dataUrl && imgAtt.url) {
          try {
            const res = await fetch(imgAtt.url);
            if (res.ok) {
              const blob = await res.blob();
              dataUrl = await new Promise<string>(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
            }
          } catch { /* skip */ }
        }
        if (dataUrl) {
          if (y + 90 > 285) { doc.addPage(); y = 18; }
          const fmt = dataUrl.includes('data:image/png') ? 'PNG' : 'JPEG';
          doc.addImage(dataUrl, fmt, lm, y, rm - lm, 90, undefined, 'FAST');
          y += 94;
        }
      }

      // ── Signed footer (all pages) ──
      await addSignedFooter(doc, p.id ?? msg.id ?? 'sin-id', (p.id ?? '').slice(0, 8).toUpperCase());

      const idSlug = (p.id ?? 'pago').slice(0, 8);
      doc.save(`pago_${idSlug}_${new Date().toISOString().slice(0, 10)}.pdf`);

    } else {
      // ── Generic message PDF (no payment data) ──
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 210, 26, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(255);
      doc.text(safe(msg.subject || 'Mensaje'), lm, 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(200, 210, 255);
      const dateStr = new Date(msg.createdAt).toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' } as any);
      doc.text(`${msg.from_name || 'Administracion'} - ${dateStr}`, lm, 21);
      y = 34;

      if (msg.body) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40);
        const lines = doc.splitTextToSize(safe(msg.body), rm - lm);
        doc.text(lines, lm, y);
        y += lines.length * 5 + 6;
      }

      for (const att of (msg.attachments ?? []).filter(a => a.type === 'image' && (a.data || a.url))) {
        if (y + 90 > 282) { doc.addPage(); y = 18; }
        doc.setDrawColor(200); doc.line(lm, y, rm, y); y += 5;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(80);
        doc.text(safe(att.name || 'Comprobante'), lm, y); y += 6;

        let dataUrl: string | null = att.data ? `data:${att.mimeType};base64,${att.data}` : null;
        if (!dataUrl && att.url) {
          try {
            const res = await fetch(att.url);
            if (res.ok) {
              const blob = await res.blob();
              dataUrl = await new Promise<string>(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
            }
          } catch { /* skip */ }
        }
        if (dataUrl) {
          const fmt = dataUrl.includes('data:image/png') ? 'PNG' : 'JPEG';
          doc.addImage(dataUrl, fmt, lm, y, rm - lm, 85, undefined, 'FAST');
          y += 89;
        }
      }

      // ── Signed footer (all pages) ──
      await addSignedFooter(doc, msg.id ?? 'sin-id', (msg.id ?? '').slice(0, 8).toUpperCase());

      const ts = new Date().toISOString().slice(0, 10);
      const slug = safe(msg.subject || 'mensaje').toLowerCase().replace(/\s+/g, '-').slice(0, 30);
      doc.save(`${slug}_${ts}.pdf`);
    }
  }

  onReplyKeydown(event: Event) {
    if (!(event as KeyboardEvent).shiftKey) {
      event.preventDefault();
      this.onReply();
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4500);
  }
}
