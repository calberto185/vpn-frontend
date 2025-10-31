// Angular 18 (2025) + TailwindCSS
// Standalone Support template: tickets list + ticket detail with threaded messages
// Usa el mismo modelo de Cliente y agrega modelos de Ticket y Mensaje.
// Admin board: <app-soporte-board [tickets]="tickets" [clientes]="clientes" (send)="onSend($event)" (meta)="onMeta($event)" (create)="onCreate($event)" />
// Formulario cliente: <app-client-new-ticket [customer]="cliente" (create)="onCreate($event)" />

import { Component, EventEmitter, Input, Output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';

// ======================= Tipos base =======================
export type Plan = {
  plan_id: string;
  devicesLimit: number;
  name: string;
  amount: number;
  coinSymbol: string;
  symbol: string;
  period: string;
  startedAt: string;
  endedAt: string | null;
  state: boolean;
};

export type Cliente = {
  id: string;
  firstNames: string;
  lastNames: string;
  telephone: string[];
  picture: string;
  role: 'standar' | 'admin' | 'user' | 'manager';
  isAdmin: boolean;
  email: string;
  password: string;
  country: string;
  dni: string;
  state: string; // Pendiente | Aprobado | Rechazado
  verified: boolean;
  verifiedAt: string;
  bloqued: boolean;
  bloquedAt: string;
  suspend: boolean;
  suspendAt: string;
  onService: boolean;
  onServiceAt: string;
  services: string[];
  observations: string;
  amount: number;
  coinSymbol: string;
  plan: Plan;
  plans: Plan[];
  createdAt: string;
};

// ======================= Tipos soporte =======================
export type TicketStatus = 'abierto' | 'pendiente' | 'resuelto' | 'cerrado';
export type TicketPriority = 'baja' | 'media' | 'alta' | 'urgente';
export type TicketChannel = 'email' | 'portal';

export type SupportMessage = {
  id: string;
  ticketId: string;
  from: 'admin' | 'cliente';
  authorId?: string; // id de Cliente si from=cliente
  authorName?: string;
  authorEmail?: string;
  body: string; // markdown/HTML simple
  sentAt: string; // ISO
  attachments?: { name: string; url?: string }[];
  internal?: boolean; // nota interna (no se envía al cliente)
};

export type SupportTicket = {
  id: string;
  subject: string;
  customerId: string; // FK -> Cliente.id
  channel: TicketChannel;
  status: TicketStatus;
  priority: TicketPriority;
  tags: string[];
  assignedTo?: string; // agente/usuario admin
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[]; // hilo
};

// ======================= Componente ADMIN =======================
@Component({
  selector: 'app-support',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
  <div class="mx-auto max-w-7xl p-4 md:p-8">
    <div class="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="text-3xl font-semibold tracking-tight">Soporte</h1>
        <p class="mt-1 text-sm text-gray-500">Tickets por correo y mensajes entre administrador y cliente.</p>
      </div>
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center gap-2">
        <input type="search" placeholder="Buscar tickets…" [(ngModel)]="query" class="w-64 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
        <select [(ngModel)]="statusFilter" class="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm">
          <option value="">Todos</option>
          <option value="abierto">Abiertos</option>
          <option value="pendiente">Pendientes</option>
          <option value="resuelto">Resueltos</option>
          <option value="cerrado">Cerrados</option>
        </select>
        <button type="button" (click)="openNew()" class="ml-auto rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90">➕ Nuevo ticket</button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-12">
      <!-- LISTA DE TICKETS -->
      <aside class="md:col-span-4 space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold tracking-tight">Tickets</h2>
          <span class="text-xs text-gray-500">{{ filteredTickets().length }} resultados</span>
        </div>
        <div class="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
          <ul class="divide-y divide-gray-100 max-h-[70vh] overflow-auto">
            <li *ngFor="let t of filteredTickets()" (click)="open(t)" class="cursor-pointer px-4 py-3 hover:bg-gray-50" [class.bg-gray-50]="t.id===selectedId()">
              <div class="flex items-start gap-3">
                <div class="mt-1 h-2 w-2 rounded-full" [class.bg-emerald-500]="t.status==='abierto'" [class.bg-amber-500]="t.status==='pendiente'" [class.bg-gray-400]="t.status==='resuelto' || t.status==='cerrado'"></div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <p class="truncate font-medium">{{ t.subject }}</p>
                    <span class="ml-2 shrink-0 rounded-full border px-2 py-0.5 text-xs" [ngClass]="priorityClass(t.priority)">{{ t.priority }}</span>
                  </div>
                  <p class="mt-0.5 truncate text-xs text-gray-500">{{ clienteName(t.customerId) }} • {{ t.channel }}</p>
                  <p class="mt-1 line-clamp-2 text-sm text-gray-600" [innerText]="lastLine(t)"></p>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </aside>

      <!-- DETALLE DEL TICKET -->
      <section class="md:col-span-8 space-y-4">
        <ng-container *ngIf="current(); else empty">
          <!-- Header -->
          <div class="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-semibold">{{ current()?.subject }}</h2>
                <p class="text-xs text-gray-500">Cliente: <span class="font-medium">{{ clienteName(current()!.customerId) }}</span> • Ticket #{{ current()?.id }}</p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <select [ngModel]="current()?.status" (ngModelChange)="setStatus($event)" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
                  <option value="abierto">Abierto</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="resuelto">Resuelto</option>
                  <option value="cerrado">Cerrado</option>
                </select>
                <select [ngModel]="current()?.priority" (ngModelChange)="setPriority($event)" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm">
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
                <input type="text" placeholder="Asignado a…" [ngModel]="current()?.assignedTo" (ngModelChange)="setAssignedTo($event)" class="w-40 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm" />
              </div>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span *ngFor="let tag of current()!.tags" class="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">#{{ tag }}</span>
              <button type="button" (click)="addTag()" class="text-xs font-medium text-gray-600 hover:underline">+ etiqueta</button>
            </div>
          </div>

          <!-- Mensajes -->
          <div class="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
            <div class="max-h-[48vh] overflow-auto space-y-4">
              <div *ngFor="let m of current()!.messages" class="flex" [class.justify-end]="m.from==='admin' && !m.internal">
                <div class="max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ring-1" [ngClass]="m.internal ? 'bg-amber-50 ring-amber-100' : (m.from==='admin' ? 'bg-gray-900 text-white ring-gray-900' : 'bg-white ring-gray-200')">
                  <div class="mb-1 flex items-center gap-2 text-xs" [class.text-gray-300]="m.from==='admin' && !m.internal">
                    <span class="font-medium">{{ author(m) }}</span>
                    <span>•</span>
                    <time>{{ m.sentAt | date:'short' }}</time>
                    <span *ngIf="m.internal" class="rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Nota interna</span>
                  </div>
                  <div class="prose prose-sm max-w-none" [class.prose-invert]="m.from==='admin' && !m.internal">
                    <p class="whitespace-pre-wrap">{{ m.body }}</p>
                  </div>
                  <div *ngIf="m.attachments?.length" class="mt-2 flex flex-wrap gap-2">
                    <a *ngFor="let a of m.attachments" [href]="a.url || '#'" target="_blank" class="rounded-md border px-2 py-1 text-xs hover:bg-gray-50" >📎 {{ a.name }}</a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Composer -->
          <div class="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm">
            <div class="mb-3 flex items-center gap-2">
              <button type="button" (click)="mode.set('respuesta')" [class.bg-gray-900]="mode()==='respuesta'" [class.text-white]="mode()==='respuesta'" class="rounded-xl px-3 py-1.5 text-sm font-medium">Respuesta</button>
              <button type="button" (click)="mode.set('nota')" [class.bg-amber-600]="mode()==='nota'" [class.text-white]="mode()==='nota'" class="rounded-xl px-3 py-1.5 text-sm font-medium">Nota interna</button>
            </div>

            <form [formGroup]="form" (ngSubmit)="sendMessage()" class="space-y-3">
              <div class="grid gap-3 md:grid-cols-2" *ngIf="mode()==='respuesta'">
                <input class="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm" placeholder="Para" [value]="clienteEmail(current()!.customerId)" disabled />
                <input class="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm" placeholder="Asunto" [value]="current()?.subject" disabled />
              </div>
              <textarea class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10" rows="4" formControlName="body" placeholder="Escribe tu mensaje…"></textarea>
              <div class="flex items-center justify-between">
                <div class="text-xs text-gray-500">Se enviará como {{ mode()==='respuesta' ? 'correo al cliente' : 'nota interna (solo admins)' }}.</div>
                <div class="flex gap-2">
                  <button type="button" (click)="quick('Gracias por contactar, estamos revisando tu caso.')" class="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50">Insertar saludo</button>
                  <button type="submit" [disabled]="form.invalid" class="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90">Enviar</button>
                </div>
              </div>
            </form>
          </div>
        </ng-container>
        <ng-template #empty>
          <div class="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-gray-600">Selecciona un ticket de la lista</div>
        </ng-template>
      </section>
    </div>

    <!-- ===== MODAL NUEVO TICKET (ADMIN) ===== -->
    <div *ngIf="showNew()" class="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 p-2">
      <div class="w-full max-w-2xl rounded-2xl border border-gray-200/80 bg-white p-5 shadow-xl">
        <div class="mb-3 flex items-start justify-between">
          <h3 class="text-lg font-semibold">Nuevo ticket</h3>
          <button type="button" (click)="closeNew()" class="rounded-full px-2 py-1 text-sm text-gray-500 hover:bg-gray-50">✕</button>
        </div>
        <form [formGroup]="newForm" (ngSubmit)="submitNew()" class="grid gap-4 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="text-xs font-medium text-gray-600">Cliente</label>
            <select class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm" formControlName="customerId">
              <option *ngFor="let c of clientes" [value]="c.id">{{ c.firstNames }} {{ c.lastNames }} — {{ c.email }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600">Asunto</label>
            <input class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm" formControlName="subject" placeholder="Describe el problema" />
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600">Prioridad</label>
            <select class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm" formControlName="priority">
              <option value="baja">Baja</option>
              <option value="media">Media</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600">Canal</label>
            <select class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm" formControlName="channel">
              <option value="email">Email</option>
              <option value="portal">Portal</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-medium text-gray-600">Tags (opcional)</label>
            <input class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm" formControlName="tags" placeholder="soporte, facturación" />
          </div>
          <div class="md:col-span-2">
            <label class="text-xs font-medium text-gray-600">Mensaje inicial (opcional)</label>
            <textarea rows="4" class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm" formControlName="body" placeholder="Escribe el primer mensaje al cliente…"></textarea>
          </div>
          <div class="md:col-span-2 flex items-center justify-end gap-2">
            <button type="button" (click)="closeNew()" class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
            <button type="submit" [disabled]="newForm.invalid" class="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90">Crear ticket</button>
          </div>
        </form>
      </div>
    </div>

  </div>
  `,
  styles: []
})
export class SupportComponent {
  @Input({ required: true }) tickets: SupportTicket[] = [];
  @Input() clientes: Cliente[] = [];
  @Output() send = new EventEmitter<{ ticketId: string; message: SupportMessage }>();
  @Output() meta = new EventEmitter<{ ticketId: string; key: 'status'|'priority'|'assignedTo'|'tags'; value: any }>();
  @Output() create = new EventEmitter<SupportTicket>();

  // UI state
  selectedId = signal<string | null>(null);
  query = '';
  statusFilter = '' as TicketStatus | '';

  mode = signal<'respuesta' | 'nota'>('respuesta');
  private fb = new FormBuilder();
  form = this.fb.group({ body: ['', [Validators.required, Validators.minLength(2)]] });

  // Modal Nuevo Ticket
  showNew = signal(false);
  newForm = this.fb.group({
    customerId: ['', Validators.required],
    subject: ['', [Validators.required, Validators.minLength(3)]],
    priority: ['media' as TicketPriority, Validators.required],
    channel: ['email' as TicketChannel, Validators.required],
    body: [''],
    tags: ['']
  });

  // ======= Computados =======
  filteredTickets = computed(() => {
    const q = (this.query || '').toLowerCase();
    const s = this.statusFilter;
    return (this.tickets || [])
      .filter(t => !s || t.status === s)
      .filter(t => !q || t.subject.toLowerCase().includes(q) || this.clienteName(t.customerId).toLowerCase().includes(q))
      .sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  });

  current = computed(() => this.tickets.find(t => t.id === this.selectedId()) || null);

  // ======= Métodos =======
  open(t: SupportTicket) { this.selectedId.set(t.id); }

  lastLine(t: SupportTicket) {
    const last = [...(t.messages||[])].sort((a,b)=> new Date(b.sentAt).getTime()-new Date(a.sentAt).getTime())[0];
    return last ? `${last.from==='admin' ? 'Agente' : 'Cliente'}: ${last.body}` : '';
  }

  clienteName(id: string) {
    const c = this.clientes?.find(x => x.id === id);
    return c ? `${c.firstNames} ${c.lastNames}`.trim() : '—';
  }
  clienteEmail(id: string) { return this.clientes?.find(x => x.id === id)?.email || ''; }

  author(m: SupportMessage) {
    if (m.from === 'cliente') {
      const c = m.authorId && this.clientes.find(x => x.id === m.authorId);
      return c ? `${c.firstNames} ${c.lastNames}`.trim() : (m.authorName || 'Cliente');
    }
    return m.internal ? 'Nota interna' : (m.authorName || 'Agente');
  }

  priorityClass(p: TicketPriority) {
    return {
      'text-emerald-700 bg-emerald-50 border-emerald-200': p === 'baja',
      'text-amber-700 bg-amber-50 border-amber-200': p === 'media',
      'text-orange-700 bg-orange-50 border-orange-200': p === 'alta',
      'text-red-700 bg-red-50 border-red-200': p === 'urgente',
    } as any;
  }

  addTag() {
    const tag = prompt('Nueva etiqueta:');
    if (!tag || !this.current()) return;
    this.current()!.tags.push(tag);
    this.emitMeta('tags', [...this.current()!.tags]);
  }

  emitMeta(key: 'status'|'priority'|'assignedTo'|'tags', value: any) {
    if (!this.current()) return;
    this.meta.emit({ ticketId: this.current()!.id, key, value });
  }

  // setters para selects/inputs del header sin usar two-way
  setStatus(v: TicketStatus) { const c = this.current(); if (!c) return; c.status = v; c.updatedAt = new Date().toISOString(); this.emitMeta('status', v); }
  setPriority(v: TicketPriority) { const c = this.current(); if (!c) return; c.priority = v; c.updatedAt = new Date().toISOString(); this.emitMeta('priority', v); }
  setAssignedTo(v: string) { const c = this.current(); if (!c) return; c.assignedTo = v; c.updatedAt = new Date().toISOString(); this.emitMeta('assignedTo', v); }

  quick(text: string) { this.form.patchValue({ body: (this.form.value.body || '') + (this.form.value.body ? '' : '') + text }); }

  sendMessage() {
    if (!this.current() || this.form.invalid) return;
    const now = new Date().toISOString();
    const msg: SupportMessage = {
      id: crypto.randomUUID(),
      ticketId: this.current()!.id,
      from: 'admin',
      authorName: 'Agente',
      body: this.form.value.body!,
      sentAt: now,
      internal: this.mode()==='nota'
    };
    this.send.emit({ ticketId: this.current()!.id, message: msg });
    this.form.reset();
  }

  // ======= Nuevo ticket (admin) =======
  openNew() { this.newForm.reset({ priority: 'media', channel: 'email' }); this.showNew.set(true); }
  closeNew() { this.showNew.set(false); }
  submitNew() {
    if (this.newForm.invalid) return;
    const v = this.newForm.getRawValue();
    const now = new Date().toISOString();
    const tags = (v.tags || '').split(',').map(s => s.trim()).filter(Boolean);

    const ticket: SupportTicket = {
      id: crypto.randomUUID(),
      subject: v.subject!,
      customerId: v.customerId!,
      channel: v.channel!,
      status: 'abierto',
      priority: v.priority!,
      tags,
      assignedTo: '',
      createdAt: now,
      updatedAt: now,
      messages: v.body ? [{
        id: crypto.randomUUID(),
        ticketId: 'temp',
        from: 'admin',
        authorName: 'Agente',
        body: v.body!,
        sentAt: now,
      }] : []
    };
    // corrige ticketId en mensajes, si hay
    ticket.messages.forEach(m => m.ticketId = ticket.id);

    this.create.emit(ticket);
    this.closeNew();
  }
}

// ======================= Componente CLIENTE (iniciar ticket) =======================
@Component({
  selector: 'app-client-new-ticket',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
  <div class="mx-auto w-full max-w-2xl rounded-2xl border border-gray-200/80 bg-white p-6 shadow-sm">
    <h2 class="text-xl font-semibold tracking-tight">Nuevo ticket de soporte</h2>
    <p class="mt-1 text-sm text-gray-500">Responderemos a <span class="font-medium">{{ customer?.email }}</span>.</p>

    <form [formGroup]="form" (ngSubmit)="submit()" class="mt-4 grid gap-4">
      <div>
        <label class="text-xs font-medium text-gray-600">Asunto</label>
        <input class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm" formControlName="subject" placeholder="Ej. No puedo conectarme a la VPN" />
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Prioridad</label>
        <select class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm" formControlName="priority">
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="urgente">Urgente</option>
        </select>
      </div>
      <div>
        <label class="text-xs font-medium text-gray-600">Mensaje</label>
        <textarea rows="5" class="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm shadow-sm" formControlName="body" placeholder="Describe el problema con el mayor detalle posible…"></textarea>
      </div>
      <div class="flex items-center justify-end gap-2">
        <button type="reset" class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50">Limpiar</button>
        <button type="submit" [disabled]="form.invalid" class="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90">Enviar ticket</button>
      </div>
    </form>
  </div>
  `
})
export class ClientNewTicketFormComponent {
  @Input({ required: true }) customer!: Cliente;
  @Output() create = new EventEmitter<SupportTicket>();

  private fb = new FormBuilder();
  form = this.fb.group({
    subject: ['', [Validators.required, Validators.minLength(3)]],
    priority: ['media' as TicketPriority, Validators.required],
    body: ['', [Validators.required, Validators.minLength(5)]],
  });

  submit() {
    if (!this.customer || this.form.invalid) return;
    const v = this.form.getRawValue();
    const now = new Date().toISOString();

    const ticket: SupportTicket = {
      id: crypto.randomUUID(),
      subject: v.subject!,
      customerId: this.customer.id,
      channel: 'portal',
      status: 'abierto',
      priority: v.priority!,
      tags: [],
      createdAt: now,
      updatedAt: now,
      messages: [{
        id: crypto.randomUUID(),
        ticketId: 'temp',
        from: 'cliente',
        authorId: this.customer.id,
        authorName: `${this.customer.firstNames} ${this.customer.lastNames}`.trim(),
        authorEmail: this.customer.email,
        body: v.body!,
        sentAt: now
      }]
    };
    ticket.messages.forEach(m => m.ticketId = ticket.id);

    this.create.emit(ticket);
    this.form.reset({ priority: 'media' });
  }
}

// ======================= Notas =======================
// • El board de admin ahora incluye un botón "Nuevo ticket" (arriba a la derecha) con un modal para crearlo.
// • Para el cliente, usa <app-client-new-ticket> en su portal. Emite (create) con el ticket listo para persistir y enviar emails.
// • Backend sugerido:
//   - POST /tickets  -> crea ticket
//   - POST /tickets/:id/messages -> agrega mensaje (y envía correo si from=admin && !internal)
//   - PATCH /tickets/:id -> meta (status/priority/assignedTo/tags)
