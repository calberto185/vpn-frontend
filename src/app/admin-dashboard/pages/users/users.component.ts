import * as XLSX from 'xlsx';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CountriesService } from '../../services/countries/countries.service';
import { CountryEntity } from '../../interfaces/country.interface';
import UserEntity from '../../interfaces/user.interface';
import { UsersService } from '../../services/users/users.service';
import { DatePipe, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PlansService } from '../../services/plans/plans.service';
import PlanEntity from '../../interfaces/plan.interface';
import PlanClientDto from '../../interfaces/planClient.interface';
import { ServersService } from '../../services/servers/servers.service';
import serversEntity from '../../interfaces/servers.interface';
import ServicesEntity from '../../interfaces/services.interface';
import { ServicesService } from '../../services/services/services.service';
import PlanClientServerDto from '../../interfaces/planClientServer.interface';
import AdminTelephoneDto from '../../interfaces/AdminTelephone.interface';
import { SocketService } from '../../../shared/services/socket.service';
import { Subscription } from 'rxjs';
import { PermissionsService } from '../../services/permissions/permissions.service';
import { RolesService } from '../../services/roles/roles.service';
import { RoleEntity } from '../../interfaces/role.interface';
import { AdminMessagesService } from '../../services/messages/messages.service';
import { PaymentsService } from '../../services/payments/payments.service';
import { MessageAttachment } from '../../../client-dashboard/interfaces/message.interface';

interface AttachFile {
  name: string; mimeType: string; data: string;
  type: 'image' | 'video' | 'document'; size: number;
}

@Component({
  selector: 'app-users',
  imports: [NgClass, DatePipe, ReactiveFormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css'
})
export class UsersComponent implements OnInit, OnDestroy {

  ListCountries = signal<CountryEntity[]>([]);
  ListUsers     = signal<UserEntity[]>([]);
  ListPlan      = signal<PlanEntity[]>([]);
  ListServices  = signal<ServicesEntity[]>([]);
  ListServers   = signal<serversEntity[]>([]);
  ListRoles     = signal<RoleEntity[]>([]);

  // ── Filters ───────────────────────────────────────────────────────────────
  searchQuery    = signal('');
  filterState    = signal('');
  filterRole     = signal('');
  filterVerified = signal<string>('');

  filteredUsers = computed(() => {
    const q        = this.searchQuery().toLowerCase().trim();
    const state    = this.filterState();
    const role     = this.filterRole();
    const verified = this.filterVerified();
    return this.ListUsers().filter(u => {
      const matchQ = !q || (
        `${u.firstNames} ${u.lastNames}`.toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q) ||
        (u.dni   ?? '').toLowerCase().includes(q) ||
        (u.id    ?? '').toLowerCase().includes(q)
      );
      const matchState    = !state    || u.state === state;
      const matchRole     = !role
        ? true
        : role === '__norole__'
          ? this.isClientUser(u)
          : u.role === role;
      const matchVerified = !verified || String(u.verified) === verified;
      return matchQ && matchState && matchRole && matchVerified;
    });
  });

  // ── Pagination ────────────────────────────────────────────────────────────
  currentPage = signal(1);
  pageSize    = signal(25);

  paginatedUsers = computed(() => {
    const all   = this.filteredUsers();
    const page  = this.currentPage();
    const size  = this.pageSize();
    const start = (page - 1) * size;
    return all.slice(start, start + size);
  });

  totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredUsers().length / this.pageSize()))
  );

  pageNumbers = computed<(number | '...')[]>(() => {
    const total   = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  });

  pageRangeText = computed(() => {
    const total   = this.filteredUsers().length;
    const page    = this.currentPage();
    const size    = this.pageSize();
    if (total === 0) return 'Sin resultados';
    const from = (page - 1) * size + 1;
    const to   = Math.min(page * size, total);
    return `${from}–${to} de ${total}`;
  });

  goToPage(p: number) {
    const total = this.totalPages();
    if (p >= 1 && p <= total) this.currentPage.set(p);
  }

  resetPage() { this.currentPage.set(1); }

  setPageSize(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  /** Label shown in the role filter button */
  filterRoleLabel = computed(() => {
    const r = this.filterRole();
    if (!r) return 'Rol';
    if (r === '__norole__') return 'Sin rol';
    return this.ListRoles().find(role => role.name === r)?.label ?? r;
  });

  // ── Permissions ───────────────────────────────────────────────────────────
  private permissions = inject(PermissionsService);
  canCreate = computed(() => this.permissions.canDo('users', 'create'));
  canUpdate = computed(() => this.permissions.canDo('users', 'update'));
  canDelete = computed(() => this.permissions.canDo('users', 'delete'));
  canExport = computed(() => this.permissions.canDo('users', 'view'));

  // ── Stats ─────────────────────────────────────────────────────────────────
  totalUsers       = computed(() => this.ListUsers().length);
  usersActivos     = computed(() => this.ListUsers().filter(u => u.state === 'Activo').length);
  usersPendientes  = computed(() => this.ListUsers().filter(u => u.state === 'Pendiente').length);
  usersSuspendidos = computed(() => this.ListUsers().filter(u => u.suspend).length);
  usersClientes    = computed(() => this.ListUsers().filter(u => this.isClientUser(u)).length);
  usersPanel       = computed(() => this.ListUsers().filter(u => !this.isClientUser(u)).length);

  // ── Online users (real-time via WebSocket) ─────────────────────────────
  onlineUserIds = signal<Set<string>>(new Set());
  isOnline = (userId: string) => this.onlineUserIds().has(userId);

  selectedCountry = signal(new CountryEntity());
  selectedUser    = signal<UserEntity>(new UserEntity());
  toggleDropdown  = signal(false);

  toast    = signal<{ msg: string; ok: boolean } | null>(null);
  kicking  = signal(false);
  deleting = signal(false);

  // ── VPN usage (S-UI) ─────────────────────────────────────────────────────
  vpnUsage        = signal<Record<string, { gb_usado: number; gb_total: number }>>({});
  vpnUsageLoading = signal(false);

  // ── Selected user devices (loaded on detail open) ────────────────────────
  selectedUserDevices = signal<any[]>([]);

  // ── Notify service status ─────────────────────────────────────────────────
  notifyTarget      = signal<{ user: UserEntity; svc: PlanClientDto } | null>(null);
  notifyChannels    = signal<string[]>(['in_app']);
  sendingNotify     = signal(false);
  notifySubjectEdit = signal('');
  notifyBodyEdit    = signal('');
  notifyFiles       = signal<AttachFile[]>([]);

  // ── Send service config ───────────────────────────────────────────────────
  configTarget      = signal<{ user: UserEntity; svc: PlanClientDto } | null>(null);
  configChannels    = signal<string[]>(['in_app']);
  sendingConfig     = signal(false);
  configSubjectEdit = signal('');
  configBodyEdit    = signal('');
  configFiles       = signal<AttachFile[]>([]);

  // ── Contact / Send message ────────────────────────────────────────────────
  contactUser     = signal<UserEntity | null>(null);
  sendingMsg      = signal(false);
  contactFiles    = signal<AttachFile[]>([]);
  pendingPayments = signal<Record<string, number>>({});   // userId → count

  private countryService  = inject(CountriesService);
  private userService     = inject(UsersService);
  private planService     = inject(PlansService);
  private serversService  = inject(ServersService);
  private servicesService = inject(ServicesService);
  private rolesService    = inject(RolesService);
  private msgSvc          = inject(AdminMessagesService);
  private paymentsService = inject(PaymentsService);
  private socketSvc       = inject(SocketService);
  private fb              = inject(FormBuilder);
  private subs            = new Subscription();

  hasError = signal('');

  userForm = this.fb.group({
    firstNames:   ['', [Validators.required]],
    lastNames:    ['', [Validators.required]],
    phone:        ['', [Validators.required]],
    role:         [''],   // optional: empty = client, any role name = panel user
    country:      ['', [Validators.required]],
    email:        ['', [Validators.required, Validators.email]],
    password:     ['', [Validators.required, Validators.minLength(8)]],
    services:     [''],
    planes:       [''],
    servers:      [''],
    createdAt:    [''],
    observations: [''],
  });

  editForm = this.fb.group({
    firstNames:   ['', [Validators.required]],
    lastNames:    ['', [Validators.required]],
    email:        ['', [Validators.required, Validators.email]],
    role:         [''],   // optional: empty = client, any role name = panel user
    observations: [''],
  });

  userServiceForm = this.fb.group({
    services:     [''],
    planes:       [''],
    servers:      [''],
    createdAt:    [''],
    observations: [''],
  });

  contactForm = this.fb.group({
    subject: ['', [Validators.required, Validators.minLength(3)]],
    body:    [''],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.fillListCountries();    // public endpoint
    this.fillListUsers();
    this.fillListPlan();         // public endpoint
    if (this.permissions.canDo('settings/servers', 'view'))  this.fillListServers();
    if (this.permissions.canDo('settings/services', 'view')) this.fillListServices();
    if (this.permissions.canDo('roles', 'view'))             this.fillListRoles();
    this.loadVpnUsage();
    this.listenSockets();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  private listenSockets(): void {
    // Actualizar estado en la lista sin recargar toda la colección
    this.subs.add(
      this.socketSvc.onUserUpdated().subscribe(evt => {
        this.ListUsers.update(list => {
          const u = list.find(x => x.id === evt.user_id);
          if (u) {
            u.state    = evt.state as any;
            if (evt.verified !== undefined) u.verified = evt.verified;
            if (evt.suspend  !== undefined) u.suspend  = evt.suspend;
          }
          return [...list];
        });
      })
    );

    // Indicador de usuario conectado en tiempo real
    this.subs.add(
      this.socketSvc.onUserOnline().subscribe(evt => {
        this.onlineUserIds.update(s => { const n = new Set(s); n.add(evt.user_id); return n; });
      })
    );
    this.subs.add(
      this.socketSvc.onUserOffline().subscribe(evt => {
        this.onlineUserIds.update(s => { const n = new Set(s); n.delete(evt.user_id); return n; });
      })
    );
  }

  // ── Data loaders ──────────────────────────────────────────────────────────
  fillListCountries() {
    this.countryService.getAllCountries().subscribe(resp => this.ListCountries.set(resp.data ?? []));
  }

  fillListUsers() {
    this.userService.getUsers().subscribe(resp => this.ListUsers.set(resp.data ?? []));
    this.paymentsService.getPayments().subscribe({
      next: resp => {
        const map: Record<string, number> = {};
        for (const p of (resp.data ?? [])) {
          if (p.state === 'Pendiente' || p.state === 'Varificando') {
            map[p.user_id] = (map[p.user_id] ?? 0) + 1;
          }
        }
        this.pendingPayments.set(map);
      },
      error: () => {},
    });
  }

  hasPendingPayment(userId: string): boolean {
    return (this.pendingPayments()[userId] ?? 0) > 0;
  }

  // ── VPN usage ─────────────────────────────────────────────────────────────
  loadVpnUsage() {
    this.vpnUsageLoading.set(true);
    this.userService.getVpnUsage().subscribe({
      next: r => { this.vpnUsage.set(r.data ?? {}); this.vpnUsageLoading.set(false); },
      error: ()  => this.vpnUsageLoading.set(false),
    });
  }

  /** "12.5 / 50 GB"  |  "8.3 GB / ∞"  |  "— GB" */
  gbText(userId: string): string {
    const u = this.vpnUsage()[userId];
    if (!u) return '—';
    const usado = u.gb_usado.toFixed(2);
    const total = u.gb_total === 0 ? '∞' : `${u.gb_total} GB`;
    return `${usado} / ${total} GB`;
  }

  /** Returns CSS class for GB usage bar colour */
  gbClass(userId: string): string {
    const u = this.vpnUsage()[userId];
    if (!u || u.gb_total === 0) return 'text-base-content';
    const pct = u.gb_usado / u.gb_total;
    if (pct >= 0.9) return 'text-error';
    if (pct >= 0.7) return 'text-warning';
    return 'text-success';
  }

  // ── Excel report (multi-hoja) ─────────────────────────────────────────────
  downloadReport() {
    const users = this.filteredUsers();
    const fmt   = (d: Date | string | null | undefined) =>
      d ? new Date(d).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
    const fmtDt = (d: Date | string | null | undefined) =>
      d ? new Date(d).toLocaleString('es') : '';

    // ── Hoja 1: Usuarios ─────────────────────────────────────────────────────
    // Columnas con nombres descriptivos listos para filtros de Excel
    const sheetUsuarios = users.map(u => ({
      'ID_Usuario':          u.id ?? '',
      'Nombres':             u.firstNames ?? '',
      'Apellidos':           u.lastNames  ?? '',
      'Email':               u.email      ?? '',
      'DNI / Documento':     u.dni        ?? '',
      'País':                u.country?.countryName ?? '',
      'Código_País':         u.country?.countryCode ?? '',
      'Teléfono':            u.telephone?.[0]?.phone ?? '',
      'WhatsApp_ID':         u.telephone?.[0]?.whatsapp_id ?? '',
      'Rol':                 this.roleLabelFor(u.role),
      'Estado':              u.state      ?? '',
      'Verificado':          u.verified   ? 'Sí' : 'No',
      'Suspendido':          u.suspend    ? 'Sí' : 'No',
      'Bloqueado':           u.bloqued    ? 'Sí' : 'No',
      'Pago_Pendiente':      this.hasPendingPayment(u.id) ? 'Sí' : 'No',
      'Cant_Pagos_Pend':     this.pendingPayments()[u.id] ?? 0,
      'En_Línea':            this.isOnline(u.id) ? 'Sí' : 'No',
      'Qty_Servicios':       (u.services ?? []).length,
      'Servicios':           (u.services ?? []).map(s => s.service_sortName || s.service_longName).filter(Boolean).join(' | '),
      'Planes':              (u.services ?? []).map(s => s.plan_title_name).filter(Boolean).join(' | '),
      'Consumo_GB_Usado':    this.vpnUsage()[u.id]?.gb_usado ?? '',
      'Consumo_GB_Total':    this.vpnUsage()[u.id]
                               ? (this.vpnUsage()[u.id]!.gb_total === 0 ? 'Ilimitado' : this.vpnUsage()[u.id]!.gb_total)
                               : '',
      'Observaciones':       (u as any).observations ?? '',
      'Fecha_Registro':      fmtDt(u.createdAt),
      'Fecha_Actualización': fmtDt((u as any).updatedAt),
    }));

    // ── Hoja 2: Servicios (una fila por servicio por usuario) ────────────────
    const sheetServicios: object[] = [];
    for (const u of users) {
      for (const svc of (u.services ?? [])) {
        const vpn = this.vpnUsage()[u.id];
        sheetServicios.push({
          'ID_Usuario':          u.id ?? '',
          'Nombres':             u.firstNames ?? '',
          'Apellidos':           u.lastNames  ?? '',
          'Email':               u.email      ?? '',
          'Estado_Usuario':      u.state      ?? '',
          'Servicio_Nombre':     svc.service_sortName || svc.service_longName || '',
          'Plan_Nombre':         svc.plan_title_name  ?? '',
          'Plan_Prefijo':        svc.plan_title_prefix ?? '',
          'Plan_Sufijo':         svc.plan_title_suffix ?? '',
          'Tipo_Plan':           svc.kind     ?? '',
          'Precio':              svc.price    ?? '',
          'Moneda':              svc.currencyCode ?? '',
          'Símbolo_Moneda':      svc.currencySymbol ?? '',
          'Límite_Dispositivos': svc.limitDevices ?? '',
          'Plan_Activo':         svc.active   ? 'Sí' : 'No',
          'Fecha_Inicio':        fmt(svc.startedAt),
          'Fecha_Vencimiento':   fmt(svc.endedAt),
          'Vence_Pronto':        this.isExpiredOrSoon(svc.endedAt) ? 'Sí' : 'No',
          'Servidor_Nombre':     svc.servers?.[0]?.server_name    ?? '',
          'Servidor_País':       svc.servers?.[0]?.server_country ?? '',
          'Consumo_GB_Usado':    vpn?.gb_usado ?? '',
          'Consumo_GB_Total':    vpn ? (vpn.gb_total === 0 ? 'Ilimitado' : vpn.gb_total) : '',
        });
      }
    }

    // ── Hoja 3: Consumo VPN (solo usuarios con dato S-UI) ────────────────────
    const sheetVpn: object[] = [];
    for (const u of users) {
      const vpn = this.vpnUsage()[u.id];
      if (!vpn) continue;
      const pct = vpn.gb_total > 0 ? Math.round((vpn.gb_usado / vpn.gb_total) * 100) : null;
      sheetVpn.push({
        'ID_Usuario':       u.id ?? '',
        'Nombres':          u.firstNames ?? '',
        'Apellidos':        u.lastNames  ?? '',
        'Email':            u.email      ?? '',
        'Estado_Usuario':   u.state      ?? '',
        'GB_Usado':         vpn.gb_usado,
        'GB_Total':         vpn.gb_total === 0 ? 'Ilimitado' : vpn.gb_total,
        'Porcentaje_Uso_%': pct !== null ? pct : 'N/A (ilimitado)',
        'Alerta':           vpn.gb_total > 0
                              ? (pct! >= 90 ? 'Crítico' : pct! >= 70 ? 'Alto' : 'Normal')
                              : '',
      });
    }

    // ── Construir workbook ───────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();

    const wsU = XLSX.utils.json_to_sheet(sheetUsuarios.length ? sheetUsuarios : [{}]);
    this._autoWidth(wsU);
    XLSX.utils.book_append_sheet(wb, wsU, 'Usuarios');

    const wsS = XLSX.utils.json_to_sheet(sheetServicios.length ? sheetServicios : [{}]);
    this._autoWidth(wsS);
    XLSX.utils.book_append_sheet(wb, wsS, 'Servicios');

    const wsV = XLSX.utils.json_to_sheet(sheetVpn.length ? sheetVpn : [{}]);
    this._autoWidth(wsV);
    XLSX.utils.book_append_sheet(wb, wsV, 'Consumo VPN');

    XLSX.writeFile(wb, `reporte_usuarios_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  /** Ajusta el ancho de columna al contenido más largo de cada columna */
  private _autoWidth(ws: XLSX.WorkSheet) {
    const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!data.length) return;
    const colWidths = data[0].map((_: any, ci: number) =>
      Math.min(60, Math.max(10, ...data.map(row => String(row[ci] ?? '').length + 2)))
    );
    ws['!cols'] = colWidths.map(w => ({ wch: w }));
  }

  fillListPlan() {
    this.planService.getPlans().subscribe(resp => this.ListPlan.set(resp.data ?? []));
  }

  fillListServers() {
    this.serversService.getServers().subscribe(resp => this.ListServers.set(resp.data ?? []));
  }

  fillListServices() {
    this.servicesService.get().subscribe(resp => this.ListServices.set(resp.data ?? []));
  }

  fillListRoles() {
    this.rolesService.getAll().subscribe(resp => this.ListRoles.set(resp?.data ?? []));
  }

  // ── Create user ───────────────────────────────────────────────────────────
  onSubmit() {
    if (this.userForm.invalid) {
      this.showToast('Formulario inválido. Revisa los campos.', false);
      return;
    }
    const { services, planes, servers, createdAt, ...data } = this.userForm.value;
    const dataToSave = new UserEntity();
    dataToSave.set(data);

    const modelPhone = new AdminTelephoneDto();
    modelPhone.countryCode = this.selectedCountry().countryCode;
    modelPhone.countryName = this.selectedCountry().countryName;
    modelPhone.flag        = this.selectedCountry().flag;
    modelPhone.phoneCode   = this.selectedCountry().phoneCode;
    modelPhone.isActive    = true;
    modelPhone.phone       = data.phone || '';
    modelPhone.whatsapp_id = modelPhone.phoneCode.replace('+', '') + '' + modelPhone.phone + '@c.us';
    dataToSave.telephone   = modelPhone?.phone ? [modelPhone] : [];

    const exist_Country = this.ListCountries().find(f => f.id === data.country);
    if (!exist_Country) { this.showToast('Selecciona un país válido', false); return; }
    const country = new CountryEntity(); country.set(exist_Country);
    dataToSave.country = country;

    const exist_Service = this.ListServices().find(f => f.id === services);
    const svcEntity = new ServicesEntity();
    if (exist_Service) svcEntity.set(exist_Service);

    const exist_Servers = this.ListServers().find(f => f.id === servers);
    const srvEntity = new PlanClientServerDto();
    if (exist_Servers) {
      srvEntity.access_permmit  = exist_Servers.active;
      srvEntity.addAt           = new Date();
      srvEntity.server_country  = exist_Servers.country.countryName;
      srvEntity.server_id       = exist_Servers.id;
      srvEntity.server_name     = exist_Servers.name;
      srvEntity.visible         = exist_Servers.visible;
    }

    const exist_plan = this.ListPlan().find(f => f.id === planes);
    const planClient = new PlanClientDto();
    if (exist_plan) {
      planClient.service_id          = svcEntity.id;
      planClient.service_longName    = svcEntity.longName;
      planClient.service_sortName    = svcEntity.sortName;
      planClient.plan_id             = exist_plan.id;
      planClient.plan_title_name     = exist_plan.title_name;
      planClient.plan_title_prefix   = exist_plan.title_prefix;
      planClient.plan_title_suffix   = exist_plan.title_suffix;
      planClient.price               = exist_plan.price;
      planClient.currencyCode        = exist_plan.currencyCode;
      planClient.currencyFormat      = exist_plan.currencyFormat;
      planClient.currencyName        = exist_plan.currencyName;
      planClient.currencySymbol      = exist_plan.currencySymbol;
      planClient.kind                = exist_plan.kind;
      planClient.limitDevices        = exist_plan.limitDevices;
      planClient.startedAt           = new Date(createdAt || new Date());
      planClient.active              = exist_plan.active;
      planClient.endedAt             = null;
      if (srvEntity.server_id) {
        srvEntity.plan_id    = exist_plan.id;
        planClient.servers   = [srvEntity];
      }
    }
    dataToSave.services = [planClient];

    this.userService.register(dataToSave.get()).subscribe({
      next: () => {
        this.fillListUsers();
        this.cerrarDialogo();
        this.userForm.reset();
        this.showToast('Usuario creado exitosamente.', true);
      },
      error: err => this.showToast(err?.error?.message ?? 'Error al registrar', false),
    });
  }

  // ── Assign service ────────────────────────────────────────────────────────
  onSubmitAssignService() {
    if (this.userServiceForm.invalid) { this.showToast('Formulario inválido.', false); return; }
    const { services, planes, servers, createdAt } = this.userServiceForm.value;

    const exist_Service = this.ListServices().find(f => f.id === services);
    if (!exist_Service) { this.showToast('Selecciona un servicio válido', false); return; }
    const svcEntity = new ServicesEntity(); svcEntity.set(exist_Service);

    const exist_Servers = this.ListServers().find(f => f.id === servers);
    const srvEntity = new PlanClientServerDto();
    if (exist_Servers) {
      srvEntity.access_permmit  = exist_Servers.active;
      srvEntity.addAt           = new Date();
      srvEntity.server_country  = exist_Servers.country.countryName;
      srvEntity.server_id       = exist_Servers.id;
      srvEntity.server_name     = exist_Servers.name;
      srvEntity.visible         = exist_Servers.visible;
    }

    const exist_plan = this.ListPlan().find(f => f.id === planes);
    if (!exist_plan) { this.showToast('Selecciona un plan válido', false); return; }
    const planClient = new PlanClientDto();
    planClient.service_id        = svcEntity.id;
    planClient.service_longName  = svcEntity.longName;
    planClient.service_sortName  = svcEntity.sortName;
    planClient.plan_id           = exist_plan.id;
    planClient.plan_title_name   = exist_plan.title_name;
    planClient.plan_title_prefix = exist_plan.title_prefix;
    planClient.plan_title_suffix = exist_plan.title_suffix;
    planClient.price             = exist_plan.price;
    planClient.currencyCode      = exist_plan.currencyCode;
    planClient.currencyFormat    = exist_plan.currencyFormat;
    planClient.currencyName      = exist_plan.currencyName;
    planClient.currencySymbol    = exist_plan.currencySymbol;
    planClient.kind              = exist_plan.kind;
    planClient.limitDevices      = exist_plan.limitDevices;
    planClient.startedAt         = new Date(createdAt || new Date());
    planClient.active            = exist_plan.active;
    planClient.endedAt           = null;
    if (srvEntity.server_id) {
      srvEntity.plan_id   = exist_plan.id;
      planClient.servers  = [srvEntity];
    }

    this.userService.updateServices({ user_id: this.selectedUser().id, services: [planClient] }).subscribe({
      next: () => {
        this.fillListUsers();
        this.cerrarDialogoAssignService();
        this.userServiceForm.reset();
        this.selectedUser.set(new UserEntity());
        this.showToast('Servicio asignado exitosamente.', true);
      },
      error: err => this.showToast(err?.error?.message ?? 'Error al asignar servicio', false),
    });
  }

  // ── State actions ─────────────────────────────────────────────────────────
  verify(user: UserEntity) {
    this.userService.verify(user.id).subscribe({
      next: () => { this.fillListUsers(); this.showToast('Usuario verificado.', true); },
      error: err => this.showToast(err?.error?.message ?? 'Error', false),
    });
  }

  suspend(user: UserEntity) {
    this.userService.suspend(user.id).subscribe({
      next: () => { this.fillListUsers(); this.showToast('Usuario suspendido.', true); },
      error: err => this.showToast(err?.error?.message ?? 'Error', false),
    });
  }

  reactivate(user: UserEntity) {
    this.userService.reactivate(user.id).subscribe({
      next: () => { this.fillListUsers(); this.showToast('Usuario reactivado.', true); },
      error: err => this.showToast(err?.error?.message ?? 'Error', false),
    });
  }

  // ── Kick session ──────────────────────────────────────────────────────────
  kickSession(user: UserEntity) {
    this.kicking.set(true);
    this.userService.kickSession(user.id).subscribe({
      next: () => {
        this.kicking.set(false);
        this.showToast('Sesión cerrada. El usuario deberá autenticarse de nuevo.', true);
      },
      error: err => {
        this.kicking.set(false);
        this.showToast(err?.error?.message ?? 'Error al cerrar sesión', false);
      },
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  deleteUser(user: UserEntity) {
    this.deleting.set(true);
    this.userService.delete(user.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.fillListUsers();
        this.cerrarDialogoDeleteUser();
        this.selectedUser.set(new UserEntity());
        this.showToast('Usuario eliminado.', true);
      },
      error: err => {
        this.deleting.set(false);
        this.showToast(err?.error?.message ?? 'Error al eliminar', false);
      },
    });
  }

  // ── View / Edit ───────────────────────────────────────────────────────────
  openView(user: UserEntity) {
    const u = new UserEntity(); u.set(user);
    this.selectedUser.set(u);
    this.selectedUserDevices.set([]);
    // Load devices (needed for config URLs)
    this.userService.getUser(user.id).subscribe({
      next: r => this.selectedUserDevices.set((r.data as any)?.devices ?? []),
      error: () => {},
    });
    (document.getElementById('user_drawer') as HTMLDialogElement | null)?.showModal();
  }

  openEdit(user: UserEntity) {
    const u = new UserEntity(); u.set(user);
    this.selectedUser.set(u);
    this.editForm.patchValue({
      firstNames:   user.firstNames,
      lastNames:    user.lastNames,
      email:        user.email,
      role:         user.role,
      observations: user.observations,
    });
    (document.getElementById('edit_user') as HTMLDialogElement | null)?.showModal();
  }

  onEditSubmit() {
    if (this.editForm.invalid) { this.showToast('Formulario inválido.', false); return; }
    const id = this.selectedUser().id;
    if (!id) return;
    this.userService.edit(id, this.editForm.value as any).subscribe({
      next: () => {
        this.fillListUsers();
        this.cerrarDialogoEditUser();
        this.editForm.reset();
        this.showToast('Usuario actualizado.', true);
      },
      error: err => this.showToast(err?.error?.message ?? 'Error al editar', false),
    });
  }

  openDelete(user: UserEntity) {
    const u = new UserEntity(); u.set(user);
    this.selectedUser.set(u);
    (document.getElementById('delete_user') as HTMLDialogElement | null)?.showModal();
  }

  // ── Notify service status ─────────────────────────────────────────────────
  openNotify(user: UserEntity, svc: PlanClientDto) {
    this.notifyTarget.set({ user, svc });
    this.notifyChannels.set(['in_app']);
    this.notifyFiles.set([]);
    // seed editable fields — must set target first so notifySubject/Body() work
    setTimeout(() => {
      this.notifySubjectEdit.set(this.notifySubject());
      this.notifyBodyEdit.set(this.notifyBody());
    });
    (document.getElementById('notify_service_modal') as HTMLDialogElement | null)?.showModal();
  }

  cerrarDialogoNotify() {
    (document.getElementById('notify_service_modal') as HTMLDialogElement | null)?.close();
  }

  toggleChannel(ch: string) {
    this.notifyChannels.update(list =>
      list.includes(ch) ? list.filter(c => c !== ch) : [...list, ch]
    );
  }

  isChannelSelected(ch: string): boolean {
    return this.notifyChannels().includes(ch);
  }

  notifySubject(): string {
    const t = this.notifyTarget();
    if (!t) return '';
    const svc = t.svc.service_sortName || t.svc.service_longName || 'Servicio';
    return `Estado de tu servicio ${svc} — ${t.svc.plan_title_name}`;
  }

  notifyBody(): string {
    const t = this.notifyTarget();
    if (!t) return '';
    const { user, svc } = t;
    const fmt = (d: Date | string | null) =>
      d ? new Date(d).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
    const inicio    = fmt(svc.startedAt);
    const vence     = svc.endedAt ? fmt(svc.endedAt) : '∞ Sin vencimiento';
    const precio    = svc.price   ? `${svc.currencySymbol}${svc.price}/${svc.kind}`          : '—';
    const devices   = svc.limitDevices ? `${svc.limitDevices} dispositivo(s)` : '—';
    const servidor  = svc.servers?.[0]?.server_name ?? '—';

    return `Hola ${user.firstNames},

Te informamos el estado actual de tu servicio:

  Servicio  : ${svc.service_sortName || svc.service_longName || '—'}
  Plan      : ${svc.plan_title_name}
  Precio    : ${precio}
  Dispositivos: ${devices}
  Servidor  : ${servidor}
  Inicio    : ${inicio}
  Vencimiento: ${vence}

Si tienes alguna duda o necesitas renovar tu plan, por favor contáctanos.

Gracias por preferirnos.`;
  }

  sendNotify() {
    if (this.sendingNotify()) return;
    const t = this.notifyTarget();
    if (!t) return;
    const channels = this.notifyChannels();
    if (!channels.length) { this.showToast('Selecciona al menos un canal de envío', false); return; }
    const subject = this.notifySubjectEdit().trim();
    if (!subject) { this.showToast('El asunto es obligatorio', false); return; }

    this.sendingNotify.set(true);
    this.msgSvc.send({
      to:          [t.user.id],
      to_label:    `${t.user.firstNames} ${t.user.lastNames}`,
      subject,
      body:        this.notifyBodyEdit(),
      channels,
      attachments: this.notifyFiles() as unknown as MessageAttachment[],
    }).subscribe({
      next: () => {
        this.sendingNotify.set(false);
        this.cerrarDialogoNotify();
        this.showToast(`Notificación enviada a ${t.user.firstNames}`, true);
      },
      error: (err: any) => {
        this.sendingNotify.set(false);
        this.showToast(err?.error?.message ?? 'Error al enviar', false);
      },
    });
  }

  async handleNotifyFiles(event: Event) {
    const files = await this._readFiles(event);
    this.notifyFiles.update(l => [...l, ...files]);
  }
  removeNotifyFile(i: number) { this.notifyFiles.update(l => l.filter((_, idx) => idx !== i)); }

  // ── Send service config ───────────────────────────────────────────────────
  openSendConfig(user: UserEntity, svc: PlanClientDto) {
    this.configTarget.set({ user, svc });
    this.configChannels.set(['in_app']);
    this.configFiles.set([]);
    setTimeout(() => {
      this.configSubjectEdit.set(this.configSubject());
      this.configBodyEdit.set(this.configBody());
    });
    (document.getElementById('send_config_modal') as HTMLDialogElement | null)?.showModal();
  }

  cerrarDialogoConfig() {
    (document.getElementById('send_config_modal') as HTMLDialogElement | null)?.close();
  }

  toggleConfigChannel(ch: string) {
    this.configChannels.update(list =>
      list.includes(ch) ? list.filter(c => c !== ch) : [...list, ch]
    );
  }

  isConfigChannelSelected(ch: string): boolean {
    return this.configChannels().includes(ch);
  }

  configSubject(): string {
    const t = this.configTarget();
    if (!t) return '';
    return `Configuración de acceso — ${t.svc.service_sortName || t.svc.service_longName || 'Servicio'} ${t.svc.plan_title_name}`;
  }

  configBody(): string {
    const t = this.configTarget();
    if (!t) return '';
    const { user, svc } = t;
    const fmt = (d: Date | string | null) =>
      d ? new Date(d).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

    // Find the device for this service
    const device = this.selectedUserDevices().find(
      (d: any) => d.service_id === svc.service_id && d.plan_id === svc.plan_id && d.protocol === 's-ui'
    ) ?? this.selectedUserDevices().find(
      (d: any) => d.service_id === svc.service_id && d.protocol === 's-ui'
    );

    // Build subscription URL
    let subUrl = '';
    if (device?.sui_sub_id) {
      const server = this.ListServers().find(s => s.id === device.server_id);
      const base   = server?.sui_sub_url?.trim().replace(/\/$/, '') || '';
      subUrl = base ? `${base}/${device.sui_sub_id}` : device.sui_sub_id;
    }

    const serverName = svc.servers?.[0]?.server_name ?? device?.server_name ?? '—';
    const serverCountry = svc.servers?.[0]?.server_country ?? '—';
    const protocol   = device?.protocol === 's-ui' ? 'S-UI / Sing-box' : device?.protocol ?? 'VPN';
    const inicio     = fmt(svc.startedAt);
    const vence      = svc.endedAt ? fmt(svc.endedAt) : '∞ Sin vencimiento';
    const precio     = svc.price ? `${svc.currencySymbol}${svc.price}/${svc.kind}` : '—';
    const devices    = svc.limitDevices ? `${svc.limitDevices} dispositivo(s)` : '—';

    return `Hola ${user.firstNames},

Te enviamos los datos de configuración de tu servicio VPN.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 DETALLES DEL SERVICIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Servicio      : ${svc.service_sortName || svc.service_longName || '—'}
  Plan          : ${svc.plan_title_name}
  Protocolo     : ${protocol}
  Servidor      : ${serverName}${serverCountry !== '—' ? ` (${serverCountry})` : ''}
  Dispositivos  : ${devices}
  Precio        : ${precio}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 VIGENCIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Inicio        : ${inicio}
  Vencimiento   : ${vence}

${subUrl ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 URL DE SUSCRIPCIÓN (importar en la app)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ${subUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 PASOS PARA CONECTARSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Descarga Hiddify o Sing-box desde tu tienda de apps
  2. Abre la app y elige "Agregar suscripción"
  3. Copia y pega la URL de suscripción de arriba
  4. Selecciona el servidor y conecta

` : ''}Si necesitas ayuda para configurar tu dispositivo, contáctanos por este mismo medio.

¡Gracias por preferirnos!`;
  }

  sendConfig() {
    if (this.sendingConfig()) return;
    const t = this.configTarget();
    if (!t) return;
    const channels = this.configChannels();
    if (!channels.length) { this.showToast('Selecciona al menos un canal de envío', false); return; }
    const subject = this.configSubjectEdit().trim();
    if (!subject) { this.showToast('El asunto es obligatorio', false); return; }

    this.sendingConfig.set(true);
    this.msgSvc.send({
      to:          [t.user.id],
      to_label:    `${t.user.firstNames} ${t.user.lastNames}`,
      subject,
      body:        this.configBodyEdit(),
      channels,
      attachments: this.configFiles() as unknown as MessageAttachment[],
    }).subscribe({
      next: () => {
        this.sendingConfig.set(false);
        this.cerrarDialogoConfig();
        this.showToast(`Configuración enviada a ${t.user.firstNames}`, true);
      },
      error: (err: any) => {
        this.sendingConfig.set(false);
        this.showToast(err?.error?.message ?? 'Error al enviar', false);
      },
    });
  }

  async handleConfigFiles(event: Event) {
    const files = await this._readFiles(event);
    this.configFiles.update(l => [...l, ...files]);
  }
  removeConfigFile(i: number) { this.configFiles.update(l => l.filter((_, idx) => idx !== i)); }

  // ── Contact user ──────────────────────────────────────────────────────────
  openContact(user: UserEntity) {
    this.contactUser.set(user);
    this.contactFiles.set([]);
    this.contactForm.reset({ subject: '', body: '' });
    (document.getElementById('user_contact_modal') as HTMLDialogElement | null)?.showModal();
  }

  async handleContactFiles(event: Event) {
    const files = await this._readFiles(event);
    this.contactFiles.update(l => [...l, ...files]);
  }
  removeContactFile(i: number) { this.contactFiles.update(l => l.filter((_, idx) => idx !== i)); }

  sendContact() {
    if (this.sendingMsg()) return;
    const user = this.contactUser();
    if (!user) return;
    const { subject, body } = this.contactForm.value;
    if (!subject?.trim()) { this.showToast('El asunto es obligatorio', false); return; }

    this.sendingMsg.set(true);
    this.msgSvc.send({
      to:          [user.id],
      to_label:    `${user.firstNames} ${user.lastNames}`,
      subject:     subject!,
      body:        body || '',
      channels:    ['in_app'],
      attachments: this.contactFiles() as unknown as MessageAttachment[],
    }).subscribe({
      next: () => {
        this.sendingMsg.set(false);
        this.cerrarDialogoContact();
        this.showToast(`Mensaje enviado a ${user.firstNames}`, true);
      },
      error: (err: any) => {
        this.sendingMsg.set(false);
        this.showToast(err?.error?.message ?? 'Error al enviar', false);
      },
    });
  }

  cerrarDialogoContact() {
    (document.getElementById('user_contact_modal') as HTMLDialogElement | null)?.close();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** True when the user has no panel role (goes to client module) */
  isClientUser(u: UserEntity): boolean {
    return !u.role || u.role === '' || u.role === 'client';
  }

  /** Returns the display label for a role name */
  roleLabelFor(roleName: string | null | undefined): string {
    if (!roleName || roleName === '' || roleName === 'client') return 'Cliente';
    return this.ListRoles().find(r => r.name === roleName)?.label ?? roleName;
  }

  roleBadgeClass(roleName: string | null | undefined): string {
    if (!roleName || roleName === '' || roleName === 'client') return 'badge-ghost';
    return 'badge-' + (this.ListRoles().find(r => r.name === roleName)?.color ?? 'secondary');
  }

  cerrarDialogo() {
    (document.getElementById('add_user') as HTMLDialogElement | null)?.close();
  }

  cerrarDialogoEditUser() {
    (document.getElementById('edit_user') as HTMLDialogElement | null)?.close();
  }

  cerrarDialogoDeleteUser() {
    (document.getElementById('delete_user') as HTMLDialogElement | null)?.close();
  }

  cerrarDialogoAssignService() {
    (document.getElementById('add_service_user') as HTMLDialogElement | null)?.close();
  }

  changeCountry(selected: CountryEntity | any) {
    this.selectedCountry.set(selected);
    this.toggleDropdown.set(false);
  }

  showDialogAssign(user: any) {
    const element = document.getElementById('add_service_user') as HTMLDialogElement;
    element?.showModal();
    const dataToSave = new UserEntity(); dataToSave.set(user);
    this.selectedUser.set(dataToSave);
  }

  /** True when endedAt is already past or within the next 7 days */
  isExpiredOrSoon(endedAt: Date | string | null): boolean {
    if (!endedAt) return false;
    const ms = new Date(endedAt).getTime() - Date.now();
    return ms <= 7 * 24 * 60 * 60 * 1000;
  }

  stateClass(state: string): string {
    switch (state) {
      case 'Activo':     return 'badge-success';
      case 'Suspendido': return 'badge-warning';
      case 'Bloqueado':  return 'badge-error';
      case 'Pendiente':  return 'badge-ghost';
      default:           return 'badge-ghost';
    }
  }

  // ── Attachment helpers ────────────────────────────────────────────────────

  attachmentPreviewUrl(att: AttachFile): string {
    return `data:${att.mimeType};base64,${att.data}`;
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private async _readFiles(event: Event): Promise<AttachFile[]> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return [];
    const results: AttachFile[] = [];
    for (const file of Array.from(input.files)) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const type: AttachFile['type'] = isImage ? 'image' : isVideo ? 'video' : 'document';
      const data = await this._toBase64(file, isImage);
      results.push({ name: file.name, mimeType: file.type, data, type, size: file.size });
    }
    // Reset so the same file can be re-selected
    input.value = '';
    return results;
  }

  private _toBase64(file: File, compress = false): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!compress || !file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload  = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }
      // Compress images: max 800px, 75% JPEG
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else                { width  = Math.round(width  * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
