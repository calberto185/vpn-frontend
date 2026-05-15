import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, Subscription, take } from 'rxjs';
import jsPDF from 'jspdf';
import { AdminMessagesService } from '../../services/messages/messages.service';
import MessageEntity, { MessageAttachment } from '../../../client-dashboard/interfaces/message.interface';
import { addSignedFooter } from '../../../shared/utils/pdf-signature.util';
import { PermissionsService } from '../../services/permissions/permissions.service';
import { AuthService } from '../../../auth/services/auth.service';
import { SocketService } from '../../../shared/services/socket.service';
import { MessagesStateService } from '../../../shared/services/messages-state.service';

type Tab      = 'inbox' | 'sent' | 'received';
type ToMode   = 'all' | 'tag' | 'individual';
type Channel  = 'in_app' | 'email' | 'telegram' | 'whatsapp';

interface ClientOption { id: string; firstNames: string; lastNames: string; email: string; state: string; tags: string[]; }
interface AttachFile   { name: string; mimeType: string; data: string; type: 'image' | 'video' | 'document'; size: number; }

@Component({
  selector: 'app-admin-messages',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.css',
})
export class AdminMessagesComponent implements OnInit, OnDestroy {

  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions    = inject(PermissionsService);
  private auth           = inject(AuthService);
  private socketSvc      = inject(SocketService);
  private messagesState  = inject(MessagesStateService);
  canCreate = computed(() => this.permissions.canDo('messages', 'create'));
  canUpdate = computed(() => this.permissions.canDo('messages', 'update'));
  canDelete = computed(() => this.permissions.canDo('messages', 'delete'));

  private svc   = inject(AdminMessagesService);
  private fb    = inject(FormBuilder);
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private subs  = new Subscription();

  private pendingOpenId = signal<string | null>(null);

  adminId = signal('');

  // ── State ─────────────────────────────────────────────────────────────────
  activeTab            = signal<Tab>('inbox');
  inbox                = signal<MessageEntity[]>([]);
  sent                 = signal<MessageEntity[]>([]);
  received             = signal<MessageEntity[]>([]);
  unreadCount          = signal(0);
  receivedUnreadCount  = signal(0);
  loading              = signal(true);
  saving               = signal(false);
  toast                = signal<{ msg: string; ok: boolean } | null>(null);
  selected             = signal<MessageEntity | null>(null);
  clients              = signal<ClientOption[]>([]);

  // ── Thread / Detail state ─────────────────────────────────────────────────
  threadMessages  = signal<MessageEntity[]>([]);
  loadingThread   = signal(false);
  replyBody       = signal('');
  replyFiles      = signal<AttachFile[]>([]);
  replying        = signal(false);

  // ── Sent recipients expansion ─────────────────────────────────────────────
  expandedRecipientsId = signal<string | null>(null);

  // ── Compose modal state ───────────────────────────────────────────────────
  toMode        = signal<ToMode>('all');
  channels      = signal<Channel[]>(['in_app']);
  selectedTags  = signal<string[]>([]);
  selectedIds   = signal<string[]>([]);
  clientSearch  = signal('');
  composeFiles  = signal<AttachFile[]>([]);

  readonly AVAILABLE_TAGS: string[] = ['vip', 'latam', 'rusia', 'moroso', 'nuevo'];
  readonly ALL_CHANNELS: { key: Channel; label: string; icon: string }[] = [
    { key: 'in_app',   label: 'Panel',    icon: '🖥️' },
    { key: 'email',    label: 'Email',    icon: '📧' },
    { key: 'telegram', label: 'Telegram', icon: '✈️' },
    { key: 'whatsapp', label: 'WhatsApp', icon: '📱' },
  ];

  // ── Computed ───────────────────────────────────────────────────────────────
  filteredClients = computed(() => {
    const q = this.clientSearch().toLowerCase();
    return this.clients().filter(c =>
      !q || `${c.firstNames} ${c.lastNames} ${c.email}`.toLowerCase().includes(q)
    );
  });

  recipientLabel = computed(() => {
    switch (this.toMode()) {
      case 'all':        return 'Todos los clientes';
      case 'tag':        return this.selectedTags().length ? `Etiquetas: ${this.selectedTags().join(', ')}` : 'Selecciona etiquetas';
      case 'individual': return this.selectedIds().length  ? `${this.selectedIds().length} cliente(s) seleccionado(s)` : 'Selecciona clientes';
    }
  });

  // ── Form ───────────────────────────────────────────────────────────────────
  composeForm = this.fb.group({
    subject: ['', [Validators.required, Validators.minLength(3)]],
    body:    [''],
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit() {
    const user = this.auth.user?.();
    if (user?.id) this.adminId.set(user.id);
    this.loadAll();
    this.svc.getClients().subscribe({ next: r => this.clients.set(r.data ?? []) });
    this.listenSockets();

    // Listen for ?open=<id> — handles both fresh navigation and re-navigation
    this.subs.add(
      this.route.queryParams.subscribe(params => {
        const openId = params['open'];
        if (!openId) return;
        this.pendingOpenId.set(openId);
        this.tryOpenPending();
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private listenSockets(): void {
    // Messages FROM clients TO admins
    this.subs.add(
      this.socketSvc.onNewMessageForAdmin().subscribe(ev => {
        if (!ev.reply_to_id) {
          this.inbox.update(list => {
            if (list.some(m => m.id === ev.message_id)) return list;
            const newMsg = {
              id:          ev.message_id,
              from_id:     ev.from_id,
              from_name:   ev.from_name,
              subject:     ev.subject,
              body:        ev.preview,
              type:        'client_to_admin' as const,
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
        const sel = this.selected();
        if (sel) {
          const inSameThread =
            ev.thread_id   === sel.thread_id ||
            ev.thread_id   === sel.id        ||
            ev.reply_to_id === sel.id        ||
            ev.from_id     === sel.from_id;
          if (inSameThread) this.loadThread(sel);
        }
      })
    );

    // Messages sent BY admin TO this panel user (e.g. finanzas, soporte)
    this.subs.add(
      this.socketSvc.onNewMessageForUser().subscribe(ev => {
        if (!ev.reply_to_id) {
          this.received.update(list => {
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
          this.receivedUnreadCount.update(n => n + 1);
        }
        const sel = this.selected();
        if (sel) {
          const inSameThread =
            ev.thread_id   === sel.thread_id ||
            ev.thread_id   === sel.id        ||
            ev.reply_to_id === sel.id;
          if (inSameThread) this.loadThread(sel);
        }
      })
    );
  }

  private tryOpenPending(): void {
    const openId = this.pendingOpenId();
    if (!openId || this.loading()) return;

    // 1. Try direct match in inbox or received (root messages)
    const direct = this.inbox().find(m => m.id === openId)
                ?? this.received().find(m => m.id === openId);
    if (direct) {
      this.pendingOpenId.set(null);
      setTimeout(() => this.openDetail(direct), 100);
      return;
    }

    // 2. The notification might point to a reply — load the thread to find the root
    this.pendingOpenId.set(null);
    this.svc.getThread(openId).subscribe({
      next: r => {
        const thread: MessageEntity[] = r.data ?? [];
        if (!thread.length) return;
        // Thread is sorted asc by createdAt; first item is the root
        const root = thread[0];
        // Prefer the object already in inbox/received (has full read_by etc.)
        const rootMsg = this.inbox().find(m => m.id === root.id)
                     ?? this.received().find(m => m.id === root.id)
                     ?? root;
        setTimeout(() => this.openDetail(rootMsg), 100);
      },
    });
  }

  loadAll() {
    this.loading.set(true);
    this.svc.getInbox().subscribe({
      next: r => {
        console.log('[AdminMessages] getInbox response:', r);
        this.inbox.set(r.data ?? []);
        this.loading.set(false);
        this.tryOpenPending();
      },
      error: (err: any) => {
        console.error('[AdminMessages] getInbox error:', err);
        this.loading.set(false);
        this.showToast(`Error cargando bandeja: ${err?.error?.message ?? err?.status ?? 'sin conexión'}`, false);
      },
    });
    this.svc.getSent().subscribe({
      next: r => {
        console.log('[AdminMessages] getSent response:', r);
        this.sent.set(r.data ?? []);
      },
      error: (err: any) => console.error('[AdminMessages] getSent error:', err),
    });
    this.svc.getReceived().subscribe({
      next: r => { this.received.set(r.data ?? []); this.tryOpenPending(); },
      error: (err: any) => console.error('[AdminMessages] getReceived error:', err),
    });
    this.svc.getUnreadCount().subscribe({ next: r => this.unreadCount.set(r.data?.count ?? 0) });
    this.svc.getReceivedUnreadCount().subscribe({ next: r => this.receivedUnreadCount.set(r.data?.count ?? 0) });
  }

  // ── Compose ────────────────────────────────────────────────────────────────
  openCompose() {
    this.composeForm.reset({ subject: '', body: '' });
    this.toMode.set('all');
    this.channels.set(['in_app']);
    this.selectedTags.set([]);
    this.selectedIds.set([]);
    this.composeFiles.set([]);
    (document.getElementById('compose_modal') as HTMLDialogElement | null)?.showModal();
  }

  toggleChannel(ch: Channel) {
    const cur = this.channels();
    this.channels.set(cur.includes(ch) ? cur.filter(c => c !== ch) : [...cur, ch]);
  }

  isChannelOn(ch: Channel) { return this.channels().includes(ch); }

  toggleTag(tag: string) {
    const cur = this.selectedTags();
    this.selectedTags.set(cur.includes(tag) ? cur.filter(t => t !== tag) : [...cur, tag]);
  }

  toggleClient(id: string) {
    const cur = this.selectedIds();
    this.selectedIds.set(cur.includes(id) ? cur.filter(i => i !== id) : [...cur, id]);
  }

  resolveRecipients(): string[] | 'all' {
    switch (this.toMode()) {
      case 'all': return 'all';
      case 'tag': {
        const tags = this.selectedTags();
        return this.clients()
          .filter(c => c.tags?.some(t => tags.includes(t)))
          .map(c => c.id);
      }
      case 'individual': return this.selectedIds();
    }
  }

  onSend() {
    if (this.saving()) return;
    const { subject, body } = this.composeForm.value;
    if (!subject?.trim()) { this.showToast('El asunto es obligatorio', false); return; }
    if (!body?.trim() && !this.composeFiles().length) { this.showToast('Escribe un mensaje o adjunta un archivo', false); return; }

    const to = this.resolveRecipients();
    if (Array.isArray(to) && to.length === 0) {
      this.showToast('No hay destinatarios seleccionados', false);
      return;
    }

    const correlationId = crypto.randomUUID();
    const payload = {
      correlationId,
      to,
      to_label:    this.recipientLabel(),
      subject:     subject!,
      body:        body || '',
      channels:    this.channels(),
      attachments: this.composeFiles() as unknown as MessageAttachment[],
    };

    this.saving.set(true);

    console.log('[AdminMessages] onSend payload:', { to, subject, channels: this.channels() });
    const sent = this.socketSvc.sendRaw('messages:send', payload);
    console.log('[AdminMessages] sendRaw result (true=WS, false=HTTP fallback):', sent);
    if (!sent) {
      // WS not connected — fall back to HTTP
      this.svc.send(payload).subscribe({
        next: (r: any) => {
          console.log('[AdminMessages] HTTP send success:', r);
          this.saving.set(false);
          this.showToast('Mensaje enviado', true);
          (document.getElementById('compose_modal') as HTMLDialogElement | null)?.close();
          this.activeTab.set('sent');
          this.svc.getSent().subscribe({ next: r2 => this.sent.set(r2.data ?? []) });
        },
        error: (err: any) => {
          console.error('[AdminMessages] HTTP send error:', err);
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
      console.log('[AdminMessages] WS ACK received:', ack);
      this.saving.set(false);
      if (ack.ok) {
        this.showToast('Mensaje enviado', true);
        (document.getElementById('compose_modal') as HTMLDialogElement | null)?.close();
        this.activeTab.set('sent');
        if (ack.message) {
          this.sent.update(list => [ack.message as MessageEntity, ...list]);
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

    const isReceivedMsg = msg.type === 'admin_to_client';

    if (this.isUnread(msg)) {
      this.svc.markRead(msg.id).subscribe({
        next: () => {
          if (isReceivedMsg) {
            this.receivedUnreadCount.update(n => Math.max(0, n - 1));
            this.received.update(list =>
              list.map(m => m.id === msg.id ? { ...m, read_by: [...(m.read_by ?? []), this.adminId()] } as MessageEntity : m)
            );
          } else {
            this.unreadCount.update(n => Math.max(0, n - 1));
            this.inbox.update(list =>
              list.map(m => m.id === msg.id ? { ...m, read_by: [...(m.read_by ?? []), this.adminId()] } as MessageEntity : m)
            );
            this.messagesState.markAsRead(msg.id);
            this.messagesState.decrementUnread();
          }
        },
      });
    } else {
      if (!isReceivedMsg) {
        this.messagesState.markAsRead(msg.id);
      }
    }
    (document.getElementById('detail_modal') as HTMLDialogElement | null)?.showModal();
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
      const el = document.getElementById('admin-thread-scroll');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  isMyMessage(msg: MessageEntity): boolean {
    return msg.from_id === this.adminId();
  }

  onReply() {
    const body = this.replyBody().trim();
    if (!body && !this.replyFiles().length) return;
    const msg = this.selected();
    if (!msg) return;

    const subject = msg.subject.startsWith('Re:') ? msg.subject : `Re: ${msg.subject}`;
    const correlationId = crypto.randomUUID();
    const payload = {
      correlationId,
      to:          [msg.from_id],
      to_label:    msg.from_name,
      subject,
      body:        body || '',
      channels:    ['in_app'],
      reply_to_id: msg.id,
      attachments: this.replyFiles() as unknown as MessageAttachment[],
    };

    this.replying.set(true);

    const sent = this.socketSvc.sendRaw('messages:send', payload);
    if (!sent) {
      // WS not connected — fall back to HTTP
      this.svc.send(payload).subscribe({
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
        // Append the confirmed message to the thread immediately
        if (ack.message) {
          this.threadMessages.update(list => [...list, ack.message as MessageEntity]);
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
    return !(msg.read_by ?? []).includes(this.adminId());
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
    if (!att.data) return '';
    return `data:${att.mimeType};base64,${att.data}`;
  }

  formatBytes(b: number): string {
    if (!b) return '';
    if (b < 1024)       return `${b} B`;
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
    (document.getElementById('detail_modal') as HTMLDialogElement)?.close();
    this.router.navigate(['/panel/payments'], p?.id ? { queryParams: { payment_id: p.id } } : {});
  }

  /** Download message with payment data as a structured PDF */
  async downloadMsgPdf(msg: MessageEntity) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const lm = 18, rm = 192;
    let y = 18;

    const safe = (s: string | null | undefined): string => {
      if (!s) return '-';
      return s.replace(/\u2192/g, '->').replace(/\u2190/g, '<-')
               .replace(/\u2013/g, '-').replace(/\u2014/g, '--')
               .replace(/\u2026/g, '...').replace(/[^\x00-\xFF]/g, '?');
    };
    const hr = (color = 185) => { doc.setDrawColor(color); doc.line(lm, y, rm, y); y += 5; };
    const row = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(110);
      doc.text(label, lm, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30);
      doc.text(safe(value), lm + 46, y); y += 5.8;
    };
    const sectionTitle = (title: string) => {
      y += 3;
      doc.setFillColor(243, 244, 246);
      doc.roundedRect(lm - 2, y - 4.5, rm - lm + 4, 9, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(40);
      doc.text(title, lm, y); y += 8;
    };

    const jsonAtt = (msg.attachments ?? []).find(a => a.name === '__payment_data__.json' && a.data);
    const imgAtt  = (msg.attachments ?? []).find(a => a.type === 'image' && (a.data || a.url));

    if (jsonAtt) {
      let p: any = {};
      try { p = JSON.parse(decodeURIComponent(escape(atob(jsonAtt.data!)))); } catch { p = {}; }

      doc.setFillColor(37, 99, 235); doc.rect(0, 0, 210, 28, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(255);
      doc.text('Comprobante de Pago', lm, 13);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(200, 210, 255);
      doc.text(`Generado el ${new Date().toLocaleDateString('es', { day: '2-digit', month: 'long', year: 'numeric' })}`, lm, 21);
      y = 36;

      const stateColors: Record<string, [number,number,number]> = {
        Aceptado: [22,163,74], Varificando: [202,138,4], Pendiente: [59,130,246], Devuelto: [220,38,38],
      };
      const [sr,sg,sb] = stateColors[p.state] ?? [100,100,100];
      doc.setFillColor(sr,sg,sb); doc.roundedRect(lm, y-4.5, 44, 8, 2, 2, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(255);
      doc.text(safe(p.state)||'Desconocido', lm+4, y); y += 11;

      sectionTitle('Datos del pago');
      row('ID del pago:',    p.id ?? '-');
      row('Fecha creado:',   p.createdAt ? new Date(p.createdAt).toLocaleDateString('es') : '-');
      row('Periodo:',        safe(p.period));
      row('Monto pagado:',   `${p.amount ?? 0} ${p.plan?.currencyCode ?? ''}`);
      row('Metodo de pago:', safe(p.method));
      row('Cuenta destino:', safe(`${p.methodPay?.name ?? ''} ${p.methodPay?.number ?? ''}`.trim() || '-'));
      y += 2; hr();

      sectionTitle('Cliente');
      row('Nombre:', safe(p.user_name));
      row('Email:',  safe(p.user_email));
      y += 2; hr();

      sectionTitle('Servicio y Plan');
      row('Servicio:',        safe(p.plan?.service_sortName));
      row('Plan:',            safe(`${p.plan?.plan_title_prefix ?? ''} ${p.plan?.plan_title_name ?? ''}`.trim() || '-'));
      row('Precio del plan:', safe(`${p.plan?.price ?? '-'} ${p.plan?.currencyCode ?? ''}/${p.plan?.kind ?? ''}`));
      row('Dispositivos:',    String(p.plan?.limitDevices ?? '-'));

      if (p.note) {
        y += 2; hr(); sectionTitle('Nota');
        doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(60);
        const noteLines = doc.splitTextToSize(safe(p.note), 162);
        doc.text(noteLines, lm, y); y += noteLines.length * 5.5 + 4;
      }

      if (imgAtt) {
        y += 2; hr(); sectionTitle('Comprobante adjunto');
        let dataUrl: string | null = imgAtt.data ? `data:${imgAtt.mimeType};base64,${imgAtt.data}` : null;
        if (!dataUrl && imgAtt.url) {
          try {
            const res = await fetch(imgAtt.url);
            if (res.ok) {
              const blob = await res.blob();
              dataUrl = await new Promise<string>(resolve => {
                const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.readAsDataURL(blob);
              });
            }
          } catch { /* skip */ }
        }
        if (dataUrl) {
          if (y + 90 > 285) { doc.addPage(); y = 18; }
          doc.addImage(dataUrl, dataUrl.includes('data:image/png') ? 'PNG' : 'JPEG', lm, y, rm-lm, 90, undefined, 'FAST');
          y += 94;
        }
      }
    } else {
      doc.setFillColor(37, 99, 235); doc.rect(0, 0, 210, 26, 'F');
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(255);
      doc.text(safe(msg.subject || 'Mensaje'), lm, 12);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(200, 210, 255);
      doc.text(`${msg.from_name || 'Administracion'} - ${new Date(msg.createdAt).toLocaleDateString('es')}`, lm, 21);
      y = 34;
      if (msg.body) {
        doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(40);
        const lines = doc.splitTextToSize(safe(msg.body), rm-lm);
        doc.text(lines, lm, y); y += lines.length * 5 + 6;
      }
    }

    await addSignedFooter(doc, this.getPaymentData(msg)?.id ?? msg.id ?? 'sin-id');
    const idSlug = (this.getPaymentData(msg)?.id ?? msg.id ?? 'msg').slice(0, 8);
    doc.save(`comprobante_${idSlug}_${new Date().toISOString().slice(0, 10)}.pdf`);
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

  channelIcon(ch: string): string {
    return this.ALL_CHANNELS.find(c => c.key === ch)?.icon ?? '📌';
  }

  /** Resolve the list of recipient full names for a sent message. */
  getRecipientNames(msg: MessageEntity): string[] {
    if (msg.to === 'all') return ['Todos los clientes activos'];
    if (!Array.isArray(msg.to) || msg.to.length === 0) return [msg.to_label || '—'];
    return msg.to.map(id => {
      const c = this.clients().find(cl => cl.id === id);
      return c ? `${c.firstNames} ${c.lastNames}` : id;
    });
  }
}
