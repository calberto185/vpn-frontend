import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { filter, Subscription, take } from 'rxjs';
import { ClientMessagesService } from '../../services/messages/messages.service';
import { AuthService } from '../../../auth/services/auth.service';
import { SocketService } from '../../../shared/services/socket.service';
import { MessagesStateService } from '../../../shared/services/messages-state.service';
import MessageEntity, { MessageAttachment } from '../../interfaces/message.interface';

export type TicketStatus = 'abierto' | 'respondido' | 'cerrado';

export interface TicketItem {
  msg:    MessageEntity;
  status: TicketStatus;
  unread: boolean;
}

@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './support.component.html',
  styleUrl: './support.component.css',
})
export class SupportComponent implements OnInit, OnDestroy {

  private svc           = inject(ClientMessagesService);
  private auth          = inject(AuthService);
  private fb            = inject(FormBuilder);
  private socketSvc     = inject(SocketService);
  private messagesState = inject(MessagesStateService);
  private subs          = new Subscription();

  // ── State ──────────────────────────────────────────────────────────────────
  sent        = signal<MessageEntity[]>([]);
  inbox       = signal<MessageEntity[]>([]);
  loading     = signal(true);
  saving      = signal(false);
  toast       = signal<{ msg: string; ok: boolean } | null>(null);
  selected    = signal<MessageEntity | null>(null);
  userId      = signal<string>('');

  // ── Thread ─────────────────────────────────────────────────────────────────
  threadMessages = signal<MessageEntity[]>([]);
  loadingThread  = signal(false);
  replyBody      = signal('');
  replying       = signal(false);
  replyFiles     = signal<{ name: string; mimeType: string; data: string; type: 'image' | 'video' | 'document'; size: number }[]>([]);

  // ── Form: nuevo ticket ─────────────────────────────────────────────────────
  ticketForm = this.fb.group({
    subject:  ['', [Validators.required, Validators.minLength(5)]],
    category: ['general'],
    body:     ['', [Validators.required, Validators.minLength(10)]],
  });
  ticketFiles = signal<{ name: string; mimeType: string; data: string; type: 'image' | 'video' | 'document'; size: number }[]>([]);

  // ── Computed: tickets (sent messages treated as support tickets) ───────────
  tickets = computed<TicketItem[]>(() => {
    const sentMsgs = this.sent();
    const inboxMsgs = this.inbox();

    return sentMsgs
      .filter(m => !m.reply_to_id)           // only root messages (not replies)
      .map(m => {
        const replies = inboxMsgs.filter(
          r => r.thread_id === m.id || r.reply_to_id === m.id || r.thread_id === m.thread_id
        );
        const unread = replies.some(r => !r.read_by?.includes(this.userId()));
        const status: TicketStatus = replies.length > 0
          ? (unread ? 'respondido' : 'respondido')
          : 'abierto';
        return { msg: m, status, unread };
      })
      .sort((a, b) => new Date(b.msg.updatedAt).getTime() - new Date(a.msg.updatedAt).getTime());
  });

  // ── FAQ data ───────────────────────────────────────────────────────────────
  readonly faqs = [
    {
      q: '¿Cómo conecto mi dispositivo a la VPN?',
      a: 'Descarga la app desde la sección Dispositivos, luego importa la configuración con el botón QR o enlace de configuración.',
    },
    {
      q: 'Mi conexión VPN es lenta o se cae constantemente',
      a: 'Prueba cambiar el protocolo en la configuración de la app. También verifica que no haya restricciones de red en tu ISP. Si el problema persiste, abre un ticket.',
    },
    {
      q: '¿Cuántos dispositivos puedo conectar simultáneamente?',
      a: 'El límite depende de tu plan. Puedes verlo en la sección Dispositivos o en el Dashboard principal.',
    },
    {
      q: '¿Cómo renuevo mi plan o actualizo mi pago?',
      a: 'Ve a la sección Pagos, selecciona el comprobante pendiente y sube tu voucher. El equipo lo revisará y activará tu servicio.',
    },
    {
      q: '¿Mi información está segura con esta VPN?',
      a: 'Sí. Usamos protocolos de cifrado de grado militar (VLESS/VMess/Trojan) y no almacenamos logs de tu actividad.',
    },
  ];
  openFaqIndex = signal<number | null>(null);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit() {
    const user = this.auth.user?.();
    if (user?.id) this.userId.set(user.id);
    this.loadAll();
    this.listenSockets();
  }

  ngOnDestroy() { this.subs.unsubscribe(); }

  private listenSockets() {
    this.subs.add(
      this.socketSvc.onNewMessageForUser().subscribe(ev => {
        if (!ev.reply_to_id) return; // only replies to existing tickets
        this.inbox.update(list => {
          if (list.some(m => m.id === ev.message_id)) return list;
          const r = {
            id:          ev.message_id,
            from_name:   ev.from_name,
            subject:     ev.subject,
            body:        ev.preview,
            type:        'admin_to_client' as const,
            read_by:     [],
            attachments: [],
            thread_id:   ev.thread_id ?? ev.message_id,
            reply_to_id: ev.reply_to_id,
            createdAt:   ev.createdAt,
            updatedAt:   ev.createdAt,
          } as unknown as MessageEntity;
          return [r, ...list];
        });
        // auto-refresh thread if it belongs to the open ticket
        const sel = this.selected();
        if (sel) {
          const inSameThread = ev.thread_id === sel.id || ev.reply_to_id === sel.id || ev.thread_id === sel.thread_id;
          if (inSameThread) this.loadThread(sel);
        }
      })
    );
  }

  loadAll() {
    this.loading.set(true);
    this.svc.getSent().subscribe({
      next: r => {
        this.sent.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.svc.getInbox().subscribe({
      next: r => this.inbox.set(r.data ?? []),
    });
  }

  // ── Ticket detail ──────────────────────────────────────────────────────────
  openTicket(item: TicketItem) {
    this.selected.set(item.msg);
    this.replyBody.set('');
    this.replyFiles.set([]);
    this.loadThread(item.msg);
    if (item.unread) {
      this.inbox()
        .filter(r => r.thread_id === item.msg.id || r.reply_to_id === item.msg.id)
        .filter(r => !r.read_by?.includes(this.userId()))
        .forEach(r => {
          this.svc.markRead(r.id).subscribe();
          this.messagesState.markAsRead(r.id);
        });
      this.messagesState.decrementUnread();
    }
    (document.getElementById('ticket_detail_modal') as HTMLDialogElement | null)?.showModal();
  }

  loadThread(msg: MessageEntity) {
    this.loadingThread.set(true);
    this.svc.getThread(msg.id).subscribe({
      next: r => {
        this.threadMessages.set(r.data?.length ? r.data : [msg]);
        this.loadingThread.set(false);
        this.scrollThread();
      },
      error: () => {
        this.threadMessages.set([msg]);
        this.loadingThread.set(false);
      },
    });
  }

  private scrollThread() {
    setTimeout(() => {
      const el = document.getElementById('support-thread-scroll');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  isMyMessage(msg: MessageEntity) {
    return msg.type === 'client_to_admin' && msg.from_id === this.userId();
  }

  // ── Reply ──────────────────────────────────────────────────────────────────
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

    this.socketSvc.onSendAck().pipe(
      filter(ack => ack.correlationId === correlationId),
      take(1),
    ).subscribe(ack => {
      this.replying.set(false);
      if (ack.ok) {
        this.replyBody.set('');
        this.replyFiles.set([]);
        if (ack.message) {
          this.threadMessages.update(list => [...list, ack.message]);
          this.scrollThread();
        } else {
          this.loadThread(this.selected()!);
        }
        this.showToast('Respuesta enviada', true);
      } else {
        this.showToast(ack.error ?? 'Error al responder', false);
      }
    });
  }

  // ── New ticket ─────────────────────────────────────────────────────────────
  openNewTicket() {
    this.ticketForm.reset({ subject: '', category: 'general', body: '' });
    this.ticketFiles.set([]);
    (document.getElementById('new_ticket_modal') as HTMLDialogElement | null)?.showModal();
  }

  submitTicket() {
    if (this.ticketForm.invalid || this.saving()) return;
    const { subject, category, body } = this.ticketForm.getRawValue();
    const tag = category !== 'general' ? ` [${category}]` : '';
    const fullSubject = `${subject?.trim()}${tag}`;
    const correlationId = crypto.randomUUID();
    const payload = {
      correlationId,
      subject:     fullSubject,
      body:        body || '',
      reply_to_id: null as string | null,
      attachments: this.ticketFiles() as unknown as MessageAttachment[],
    };

    this.saving.set(true);
    const sent = this.socketSvc.sendRaw('messages:send', payload);

    if (!sent) {
      this.svc.send(fullSubject!, body || '', null, this.ticketFiles() as unknown as MessageAttachment[]).subscribe({
        next: () => {
          this.saving.set(false);
          this.showToast('Ticket creado. Te responderemos pronto.', true);
          (document.getElementById('new_ticket_modal') as HTMLDialogElement | null)?.close();
          this.loadAll();
        },
        error: (err: any) => {
          this.saving.set(false);
          this.showToast(err?.error?.message ?? 'Error al crear ticket', false);
        },
      });
      return;
    }

    this.socketSvc.onSendAck().pipe(
      filter(ack => ack.correlationId === correlationId),
      take(1),
    ).subscribe(ack => {
      this.saving.set(false);
      if (ack.ok) {
        this.showToast('Ticket creado. Te responderemos pronto.', true);
        (document.getElementById('new_ticket_modal') as HTMLDialogElement | null)?.close();
        if (ack.message) {
          this.sent.update(list => [ack.message, ...list]);
        } else {
          this.svc.getSent().subscribe({ next: r => this.sent.set(r.data ?? []) });
        }
      } else {
        this.showToast(ack.error ?? 'Error al crear ticket', false);
      }
    });
  }

  // ── File attachments ───────────────────────────────────────────────────────
  async handleReplyFiles(event: Event) {
    const files = await this._readFiles(event);
    this.replyFiles.update(l => [...l, ...files]);
  }

  async handleTicketFiles(event: Event) {
    const files = await this._readFiles(event);
    this.ticketFiles.update(l => [...l, ...files]);
  }

  removeReplyFile(i: number)  { this.replyFiles.update(l => l.filter((_, idx) => idx !== i)); }
  removeTicketFile(i: number) { this.ticketFiles.update(l => l.filter((_, idx) => idx !== i)); }

  private async _readFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return [];
    const result: { name: string; mimeType: string; data: string; type: 'image' | 'video' | 'document'; size: number }[] = [];
    for (const file of Array.from(input.files)) {
      if (file.size > 4 * 1024 * 1024) { this.showToast(`${file.name}: máximo 4 MB`, false); continue; }
      const type = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document';
      const data = await this._toBase64(file, type === 'image');
      result.push({ name: file.name, mimeType: file.type, data, type, size: file.size });
    }
    input.value = '';
    return result;
  }

  private _toBase64(file: File, compress: boolean): Promise<string> {
    return new Promise(resolve => {
      if (compress) {
        const reader = new FileReader();
        reader.onload = e => {
          const img = new Image();
          img.onload = () => {
            const MAX = 900;
            let { width: w, height: h } = img;
            if (w > MAX || h > MAX) { if (w > h) { h = h * MAX / w; w = MAX; } else { w = w * MAX / h; h = MAX; } }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
          };
          img.src = e.target!.result as string;
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = e => resolve((e.target!.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      }
    });
  }

  attachmentUrl(att: MessageAttachment): string {
    if (att.data) return `data:${att.mimeType};base64,${att.data}`;
    if (att.url)  return att.url;
    return '';
  }

  formatBytes(b: number): string {
    if (!b) return '';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── FAQ ────────────────────────────────────────────────────────────────────
  toggleFaq(i: number) {
    this.openFaqIndex.update(v => v === i ? null : i);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  statusLabel(s: TicketStatus) {
    return s === 'abierto' ? 'Abierto' : s === 'respondido' ? 'Respondido' : 'Cerrado';
  }

  statusClass(s: TicketStatus) {
    return s === 'abierto'    ? 'badge-warning'
         : s === 'respondido' ? 'badge-success'
         : 'badge-ghost';
  }

  categoryLabel(subject: string): string {
    if (subject.includes('[conexion]'))  return 'Conexión';
    if (subject.includes('[pago]'))      return 'Pago';
    if (subject.includes('[cuenta]'))    return 'Cuenta';
    if (subject.includes('[tecnico]'))   return 'Técnico';
    return 'General';
  }

  onReplyKeydown(event: Event) {
    if (!(event as KeyboardEvent).shiftKey) {
      event.preventDefault();
      this.onReply();
    }
  }

  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4500);
  }
}
