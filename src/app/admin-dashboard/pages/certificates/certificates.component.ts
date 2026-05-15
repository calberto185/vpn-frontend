import { Component, computed, inject, OnInit, OnDestroy, signal, HostListener } from '@angular/core';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import CertificateEntity from '../../interfaces/certificate.interface';
import { UsersService } from '../../services/users/users.service';
import { ServersService } from '../../services/servers/servers.service';
import { DeviceService } from '../../services/devices/devices.service';
import UserEntity from '../../interfaces/user.interface';
import serversEntity from '../../interfaces/servers.interface';
import DeviceEntity from '../../interfaces/device.interface';
import { CertificatesService } from '../../services/certificates/certificates.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
import { LoadingService } from '../../../shared/services/loading.service';
import { PermissionsService } from '../../services/permissions/permissions.service';
import { SocketService } from '../../../shared/services/socket.service';

export type ServerProtocolSelection = {
  server: serversEntity;
  protocols: Set<'s-ui' | 'openvpn'>;
};

@Component({
  selector: 'app-certificates',
  imports: [DatePipe, ReactiveFormsModule, CommonModule],
  templateUrl: './certificates.component.html',
  styleUrl: './certificates.component.css'
})
export class CertificatesComponent implements OnInit, OnDestroy {

  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions = inject(PermissionsService);
  canCreate = computed(() => this.permissions.canDo('certificates', 'create'));
  canUpdate = computed(() => this.permissions.canDo('certificates', 'update'));
  canDelete = computed(() => this.permissions.canDo('certificates', 'delete'));

  private certificateService = inject(CertificatesService);
  private usersService       = inject(UsersService);
  private serversService     = inject(ServersService);
  private deviceService      = inject(DeviceService);
  private loadingService     = inject(LoadingService);
  private socketSvc          = inject(SocketService);
  private fb                 = inject(FormBuilder);
  private subs               = new Subscription();

  // IDs de usuarios cuyo plan/estado cambió mientras el admin tiene la vista abierta
  staleUserIds = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.fillCertificates();
    if (this.permissions.canDo('users', 'view'))           this.fillUsers();
    if (this.permissions.canDo('settings/servers', 'view')) this.fillServers();
    if (this.permissions.canDo('devices', 'view'))         this.fillDevices();

    // Marcar certificados como "requieren revisión" si el usuario asociado cambió
    this.subs.add(
      this.socketSvc.onUserUpdated().subscribe(evt => {
        this.staleUserIds.update(s => {
          const next = new Set(s);
          next.add(evt.user_id);
          return next;
        });
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  isStale(cert: CertificateEntity): boolean {
    return this.staleUserIds().has((cert as any).user_id ?? '');
  }

  clearStale(): void {
    this.staleUserIds.set(new Set());
  }

  // ── Data lists ─────────────────────────────────────────────────────────────
  ListCertificates = signal<CertificateEntity[]>([]);
  ListUsers        = signal<UserEntity[]>([]);
  ListServers      = signal<serversEntity[]>([]);
  ListDevices      = signal<DeviceEntity[]>([]);

  // ── Filter / search ────────────────────────────────────────────────────────
  searchQuery  = signal('');
  filterEstado = signal('');

  filteredCerts = computed(() => {
    const q      = this.searchQuery().toLowerCase().trim();
    const estado = this.filterEstado();
    return this.ListCertificates().filter(c => {
      const matchQ = !q || (
        (c.user    ?? '').toLowerCase().includes(q) ||
        (c.user_id ?? '').toLowerCase().includes(q) ||
        (c.device  ?? '').toLowerCase().includes(q) ||
        (c.server  ?? '').toLowerCase().includes(q) ||
        (c.id      ?? '').toLowerCase().includes(q) ||
        (c.tags    ?? '').toLowerCase().includes(q)
      );
      const isRevoked   = this.truthy((c as any).revoked);
      const isSuspended = this.truthy((c as any).suspended);
      const expiry      = this.expireAt(c);
      const now  = new Date();
      const soon = new Date(); soon.setDate(soon.getDate() + 7);
      const matchEstado =
        !estado ||
        (estado === 'activo'     && !isRevoked && !isSuspended) ||
        (estado === 'suspendido' && isSuspended) ||
        (estado === 'revocado'   && isRevoked) ||
        (estado === 'expirando'  && expiry != null && expiry >= now && expiry <= soon) ||
        (estado === 'expirado'   && expiry != null && expiry < now);
      return matchQ && matchEstado;
    });
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  countActive(): number {
    return this.ListCertificates()
      .filter(c => !this.truthy((c as any).revoked) && !this.truthy((c as any).suspended)).length;
  }
  countExpiringSoon(days = 7): number {
    const now  = new Date();
    const soon = new Date(); soon.setDate(soon.getDate() + days);
    return this.ListCertificates()
      .map(c => this.expireAt(c))
      .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()))
      .filter(d => d >= now && d <= soon).length;
  }
  countRevoked(): number {
    return this.ListCertificates().filter(c => this.truthy((c as any).revoked)).length;
  }

  // ── Data loaders ───────────────────────────────────────────────────────────
  fillCertificates() {
    this.certificateService.getCertificates().subscribe(resp => this.ListCertificates.set(resp?.data ?? []));
  }
  fillUsers() {
    this.usersService.getUsers().subscribe(resp => this.ListUsers.set(resp?.data ?? []));
  }
  fillServers() {
    this.serversService.getServers().subscribe(resp => this.ListServers.set(resp?.data ?? []));
  }
  fillDevices() {
    this.deviceService.getDevices().subscribe(resp => this.ListDevices.set(resp?.data ?? []));
  }

  // ── Add-cert form ──────────────────────────────────────────────────────────
  certificateForm = this.fb.group({
    user_id:   ['', Validators.required],
    device_id: ['', Validators.required],
    note:      [''],
  });

  // ── Modal step machine ─────────────────────────────────────────────────────
  // 'device_select' → initial, no device chosen yet
  // 'existing_check' → device has certs → show them, ask what to do
  // 'confirm_new' → admin clicked "Crear nuevo" without selecting any existing cert
  // 'server_select' → confirmed new → show server+protocol panel
  addCertStep = signal<'device_select' | 'existing_check' | 'confirm_new' | 'server_select'>('device_select');

  // Selection state
  formUser               = signal<UserEntity | null>(null);
  formDevice             = signal<DeviceEntity | null>(null);
  serverSelections       = signal<ServerProtocolSelection[]>([]);
  selectedExistingCertIds = signal<Set<string>>(new Set());
  isSubmitting           = signal(false);

  /** Certs that already belong to the currently selected device */
  existingDeviceCerts = computed(() => {
    const device = this.formDevice();
    if (!device) return [] as CertificateEntity[];
    return this.ListCertificates().filter(c => c.device_id === device.id);
  });

  devicesForUser = computed(() => {
    const user = this.formUser();
    if (!user) return [] as DeviceEntity[];
    return this.ListDevices().filter(d => d.user_id === user.id);
  });

  serversForDevice = computed(() => {
    const device = this.formDevice();
    const user   = this.formUser();
    if (!device || !user) return [] as serversEntity[];
    const plan = user.services.find(s => s.plan_id === device.plan_id);
    if (!plan) return this.ListServers();
    return plan.servers
      .map(ps => this.ListServers().find(s => s.id === ps.server_id))
      .filter((s): s is serversEntity => s != null);
  });

  // ── Form event handlers ────────────────────────────────────────────────────
  onFormUserChange(event: Event) {
    const id = (event.target as HTMLSelectElement).value;
    const user = this.ListUsers().find(u => u.id === id) ?? null;
    this.formUser.set(user);
    this.formDevice.set(null);
    this.serverSelections.set([]);
    this.certificateForm.patchValue({ device_id: '' });
  }

  onFormDeviceChange(event: Event) {
    const id     = (event.target as HTMLSelectElement).value;
    const device = this.ListDevices().find(d => d.id === id) ?? null;
    this.formDevice.set(device);
    this.serverSelections.set([]);
    this.selectedExistingCertIds.set(new Set());

    if (!device) {
      this.addCertStep.set('device_select');
      return;
    }
    const existing = this.ListCertificates().filter(c => c.device_id === device.id);
    this.addCertStep.set(existing.length > 0 ? 'existing_check' : 'server_select');
  }

  // ── Existing-cert selection ────────────────────────────────────────────────
  isExistingCertSelected(id: string): boolean {
    return this.selectedExistingCertIds().has(id);
  }

  toggleExistingCert(id: string) {
    this.selectedExistingCertIds.update(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  /** Admin clicks "Usar seleccionados" — opens the first selected cert in view modal */
  onUseExistingCerts() {
    const firstId = [...this.selectedExistingCertIds()][0];
    const cert    = this.ListCertificates().find(c => c.id === firstId);
    if (cert) {
      (document.getElementById('add_cert') as HTMLDialogElement)?.close();
      this.resetAddForm();
      // short delay so the previous modal fully closes before opening the next
      setTimeout(() => this.openDialog('view_cert', cert), 120);
    }
  }

  /** Admin clicks "Crear nuevo" from the existing-certs step */
  onRequestCreateNew() {
    if (this.selectedExistingCertIds().size === 0) {
      // No existing cert selected → ask for confirmation first
      this.addCertStep.set('confirm_new');
    } else {
      // Some existing certs were reviewed but admin still wants a new one
      this.addCertStep.set('server_select');
    }
  }

  /** Admin confirms they want to create a new cert even though others exist */
  onConfirmCreateNew() {
    this.addCertStep.set('server_select');
  }

  toggleServer(server: serversEntity) {
    this.serverSelections.update(sels => {
      if (sels.some(s => s.server.id === server.id)) {
        return sels.filter(s => s.server.id !== server.id);
      }
      const protocols = new Set<'s-ui' | 'openvpn'>();
      if (server.protocol === 's-ui')    protocols.add('s-ui');
      if (server.protocol === 'openvpn') protocols.add('openvpn');
      // 'both' → user picks
      return [...sels, { server, protocols }];
    });
  }

  isServerSelected(serverId: string): boolean {
    return this.serverSelections().some(s => s.server.id === serverId);
  }

  hasProtocol(serverId: string, proto: 's-ui' | 'openvpn'): boolean {
    return this.serverSelections().find(s => s.server.id === serverId)?.protocols.has(proto) ?? false;
  }

  toggleProtocol(serverId: string, proto: 's-ui' | 'openvpn', event: Event) {
    event.stopPropagation();
    this.serverSelections.update(sels => sels.map(s => {
      if (s.server.id !== serverId) return s;
      const p = new Set(s.protocols);
      p.has(proto) ? p.delete(proto) : p.add(proto);
      return { ...s, protocols: p };
    }));
  }

  serverSupports(server: serversEntity, proto: 's-ui' | 'openvpn'): boolean {
    return server.protocol === proto || server.protocol === 'both';
  }

  onSubmit() {
    if (this.certificateForm.invalid) {
      this.certificateForm.markAllAsTouched();
      return;
    }
    const user   = this.formUser();
    const device = this.formDevice();
    const note   = this.certificateForm.value.note ?? '';

    if (!user || !device) {
      this.loadingService.warn('Datos incompletos', 'Selecciona usuario y dispositivo.');
      return;
    }
    const selected = this.serverSelections();
    if (selected.length === 0) {
      this.loadingService.warn('Sin servidor', 'Selecciona al menos un servidor.');
      return;
    }
    const withoutProto = selected.filter(s => s.protocols.size === 0);
    if (withoutProto.length > 0) {
      this.loadingService.warn('Protocolo requerido', `Elige al menos un protocolo para "${withoutProto[0].server.name}".`);
      return;
    }

    const pairs: { server: serversEntity; protocol: string }[] = [];
    for (const sel of selected) {
      for (const proto of sel.protocols) {
        pairs.push({ server: sel.server, protocol: proto });
      }
    }

    this.isSubmitting.set(true);
    const requests = pairs.map(pair =>
      this.certificateService.register(
        this.buildCertPayload(user, device, pair.server, pair.protocol, note)
      ).pipe(catchError(err => of({ _err: err?.error?.message ?? 'Error' })))
    );

    forkJoin(requests).subscribe({
      next: (responses: any[]) => {
        this.isSubmitting.set(false);
        const errors = responses.filter(r => r?._err);
        if (errors.length === pairs.length) {
          this.loadingService.warn('Error al crear', errors[0]._err);
        } else {
          const ok = pairs.length - errors.length;
          this.loadingService.success('Certificados creados', `${ok} certificado(s) generado(s) correctamente.`);
          this.fillCertificates();
          this.resetAddForm();
          (document.getElementById('add_cert') as HTMLDialogElement)?.close();
        }
      },
      error: err => {
        this.isSubmitting.set(false);
        this.loadingService.warn('Error', err?.error?.message ?? 'Error al crear certificados.');
      }
    });
  }

  private buildCertPayload(
    user: UserEntity, device: DeviceEntity,
    server: serversEntity, protocol: string, note: string
  ): any {
    const d   = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${pad(d.getDate())}${pad(d.getMonth()+1)}${d.getFullYear()}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

    const cert = new CertificateEntity();
    cert.user_id      = user.id;
    cert.user         = `${server.country.countryCode}-${stamp}-${device.device}-${device.typeDevice}`.replaceAll(' ', '-');
    cert.server_id    = server.id;
    cert.server       = `${server.name}-${server.country.countryCode}-${server.country.currencyCode}`.replaceAll(' ', '-');
    cert.device_id    = device.id;
    cert.device       = device.device;
    cert.ip           = server.host;
    cert.profile_type = user.role;
    cert.tags         = device.typeDevice;
    cert.note         = note;
    (cert as any).valid_days = '365';
    (cert as any).expires_at = '365';
    (cert as any).version    = '2';
    (cert as any).protocol   = protocol;
    return cert.get();
  }

  private resetAddForm() {
    this.certificateForm.reset();
    this.formUser.set(null);
    this.formDevice.set(null);
    this.serverSelections.set([]);
    this.selectedExistingCertIds.set(new Set());
    this.addCertStep.set('device_select');
  }

  onCancel() {
    (document.getElementById('add_cert') as HTMLDialogElement)?.close();
    this.resetAddForm();
  }

  // ── View / download modal ──────────────────────────────────────────────────
  fileCert     = signal<HttpResponse<Blob> | null>(null);
  fileCertText = signal('');
  modalData: CertificateEntity | null = null;

  openDialog(id: string, cert?: CertificateEntity) {
    this.modalData = cert ?? null;
    if (id === 'download_cert') this.getOvpn(cert);
    (document.getElementById(id) as HTMLDialogElement)?.showModal();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      (document.getElementById('search-certs') as HTMLInputElement)?.focus();
    }
  }

  // ── Cert actions ───────────────────────────────────────────────────────────
  getOvpn(c?: CertificateEntity | null) {
    const data = c ?? new CertificateEntity();
    this.certificateService.downloadCertificate(data).subscribe({
      next: async resp => {
        this.fileCert.set(resp);
        this.fileCertText.set((await resp.body?.text() ?? '').toString());
      },
      error: () => {}
    });
  }

  downloadOvpn(c?: CertificateEntity | null) {
    const data = c ?? new CertificateEntity();
    this.certificateService.downloadCertificate(data).subscribe({
      next: (resp: HttpResponse<Blob>) => {
        if (!resp.body || resp.body.size === 0) {
          this.loadingService.warn('Error', 'No llegó contenido del servidor.');
          return;
        }
        const filename = this.getFilename(resp) || `${data.user || 'perfil'}.ovpn`;
        const url = URL.createObjectURL(resp.body);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
      },
      error: async err => {
        try {
          const text = await err.error.text();
          this.loadingService.warn('Error', text || 'Error al descargar el .ovpn');
        } catch { this.loadingService.warn('Error', 'Error al descargar el .ovpn'); }
      }
    });
  }

  copyOvpn(_c?: CertificateEntity | null) {
    const text = this.fileCertText();
    if (text) navigator.clipboard.writeText(text).catch(() => {});
  }

  private getFilename(resp: HttpResponse<Blob>): string | null {
    const dispo = resp.headers.get('content-disposition') || '';
    const mStar = dispo.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (mStar?.[1]) return decodeURIComponent(mStar[1]);
    const m = dispo.match(/filename\s*=\s*"?([^";]+)"?/i);
    return m?.[1] ?? null;
  }

  confirmSuspend(c?: CertificateEntity | null) {
    const data = c ?? new CertificateEntity();
    data.suspended = new Date().toDateString();
    this.certificateService.suspender(data).subscribe({
      next: resp => {
        if (resp?.error?.message) { this.loadingService.warn('Error', resp.error.message); return; }
        this.loadingService.success('Suspendido', 'Certificado suspendido.');
        this.fillCertificates();
        (document.getElementById('suspend_cert') as HTMLDialogElement)?.close();
      },
      error: err => this.loadingService.warn('Error', err?.error?.message ?? 'Error al suspender.')
    });
  }

  confirmReactivar(c?: CertificateEntity | null) {
    const data = c ?? new CertificateEntity();
    data.suspended = '';
    this.certificateService.reactivar(data).subscribe({
      next: resp => {
        if (resp?.error?.message) { this.loadingService.warn('Error', resp.error.message); return; }
        this.loadingService.success('Reactivado', 'Certificado reactivado.');
        this.fillCertificates();
        (document.getElementById('reactivar_cert') as HTMLDialogElement)?.close();
      },
      error: err => this.loadingService.warn('Error', err?.error?.message ?? 'Error al reactivar.')
    });
  }

  confirmRevoke(c?: CertificateEntity | null) {
    const data = c ?? new CertificateEntity();
    data.revoked = new Date().toDateString();
    this.certificateService.revocar(data).subscribe({
      next: resp => {
        if (resp?.error?.message) { this.loadingService.warn('Error', resp.error.message); return; }
        this.loadingService.success('Revocado', 'Certificado revocado.');
        this.fillCertificates();
        (document.getElementById('revoke_cert') as HTMLDialogElement)?.close();
      },
      error: err => this.loadingService.warn('Error', err?.error?.message ?? 'Error al revocar.')
    });
  }

  confirmDelete(_c?: CertificateEntity | null) {
    // stub — no backend endpoint yet
  }

  /** Total certificates to be created from current server selections */
  totalCertsToCreate(): number {
    return this.serverSelections().reduce((acc, s) => acc + s.protocols.size, 0);
  }

  // ── Utils ──────────────────────────────────────────────────────────────────
  truthy(v: any): boolean {
    if (typeof v === 'string') {
      const t = v.trim().toLowerCase();
      return t !== '' && t !== '0' && t !== 'false' && t !== 'null' && t !== 'undefined';
    }
    return !!v;
  }

  expireAt(c?: Partial<CertificateEntity> | null): Date | null {
    if (!c) return null;
    const created = new Date((c as any).createdAt || (c as any).created_at || '');
    const days    = Number((c as any).valid_days ?? (c as any).expires_at ?? 0);
    if (isNaN(created.getTime()) || !days) return null;
    const d = new Date(created);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }
}
