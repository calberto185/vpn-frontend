import { Component, inject, OnInit, signal, computed } from '@angular/core';
import serversEntity from '../../interfaces/servers.interface';
import { ServersService } from '../../services/servers/servers.service';
import { SuiService, SuiClientRaw, SuiSyncResult } from '../../services/sui/sui.service';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CountryEntity } from '../../interfaces/country.interface';
import { CountriesService } from '../../services/countries/countries.service';
import { PermissionsService } from '../../services/permissions/permissions.service';

@Component({
  selector: 'app-servers',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './servers.component.html',
  styleUrl: './servers.component.css',
})
export class ServersComponent implements OnInit {

  // ── Services ──────────────────────────────────────────────────────────────
  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions = inject(PermissionsService);
  canCreate = computed(() => this.permissions.canDo('settings/servers', 'create'));
  canUpdate = computed(() => this.permissions.canDo('settings/servers', 'update'));
  canDelete = computed(() => this.permissions.canDo('settings/servers', 'delete'));

  private serverService  = inject(ServersService);
  private suiService     = inject(SuiService);
  private countryService = inject(CountriesService);
  private fb             = inject(FormBuilder);

  // ── State ─────────────────────────────────────────────────────────────────
  servers         = signal<serversEntity[]>([]);
  countries       = signal<CountryEntity[]>([]);
  poolServers     = signal<{ id: string; name: string }[]>([]);
  selectedServer  = signal<serversEntity | null>(null);
  suiClientes     = signal<SuiClientRaw[]>([]);
  syncResult      = signal<SuiSyncResult[]>([]);
  clienteTarget   = signal<SuiClientRaw | null>(null);

  loadingClientes = signal(false);
  syncing         = signal(false);
  saving          = signal(false);
  loading         = signal(false);
  toast           = signal<{ msg: string; ok: boolean } | null>(null);

  // ── Search / Filter ───────────────────────────────────────────────────────
  searchQuery  = signal('');
  filterActive = signal('');  // '' | 'active' | 'inactive'

  filteredServers = computed(() => {
    const q  = this.searchQuery().toLowerCase().trim();
    const fa = this.filterActive();
    return this.servers().filter(s => {
      const matchQ = !q || (
        (s.name ?? '').toLowerCase().includes(q) ||
        (s.host ?? '').toLowerCase().includes(q) ||
        ((s as any).country?.countryName ?? '').toLowerCase().includes(q)
      );
      const matchActive =
        !fa ||
        (fa === 'active'   &&  s.active) ||
        (fa === 'inactive' && !s.active);
      return matchQ && matchActive;
    });
  });

  // ── Computed ──────────────────────────────────────────────────────────────
  totalServers  = computed(() => this.servers().length);
  activeServers = computed(() => this.servers().filter(s => s.active).length);
  poolCount     = computed(() => this.poolServers().length);

  // ── Renew form ────────────────────────────────────────────────────────────
  renewForm = this.fb.group({
    gbLimite: [50,  [Validators.required, Validators.min(1)]],
    dias:     [30,  [Validators.required, Validators.min(1)]],
  });

  // ── Add server form ───────────────────────────────────────────────────────
  serverForm = this.fb.group({
    name:          ['', Validators.required],
    host:          ['', Validators.required],
    protocol:      ['s-ui', Validators.required],
    active:        [true],
    visible:       [true],
    note:          [''],
    // SSH
    port:          [22],
    userName:      ['root'],
    password:      [''],
    privateKeyPath:[''],
    country:       [''],
    // S-UI
    sui_url:       [''],
    sui_username:  [''],
    sui_password:  [''],
    sui_token:     [''],
    sui_sub_url:   [''],
    sui_inbound_id:[1],
  });

  // ── Edit server form ──────────────────────────────────────────────────────
  editForm = this.fb.group({
    id:            ['', Validators.required],
    name:          ['', Validators.required],
    host:          ['', Validators.required],
    protocol:      ['s-ui', Validators.required],
    active:        [true],
    visible:       [true],
    note:          [''],
    port:          [22],
    userName:      ['root'],
    password:      [''],
    privateKeyPath:[''],
    country:       [''],
    sui_url:       [''],
    sui_username:  [''],
    sui_password:  [''],
    sui_token:     [''],
    sui_sub_url:   [''],
    sui_inbound_id:[1],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadServers();
    this.loadCountries();
    this.loadPoolStatus();
  }

  loadServers() {
    this.loading.set(true);
    this.serverService.getServers().subscribe({
      next:  resp => { this.servers.set(resp.data ?? []); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  loadCountries() {
    this.countryService.getAllCountries().subscribe(resp => this.countries.set(resp.data ?? []));
  }

  loadPoolStatus() {
    this.suiService.poolStatus().subscribe({
      next:  resp => this.poolServers.set(resp.data?.servers ?? []),
      error: ()   => {},
    });
  }

  // ── Pool ──────────────────────────────────────────────────────────────────

  refreshPool() {
    this.suiService.refreshPool().subscribe({
      next: resp => {
        this.showToast(`Pool recargado — ${resp.data?.count ?? 0} servidor(es)`, true);
        this.loadPoolStatus();
      },
      error: err => this.showToast(err.error?.message ?? 'Error al recargar pool', false),
    });
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  runSync() {
    this.syncing.set(true);
    this.suiService.sincronizar().subscribe({
      next: resp => {
        this.syncResult.set(resp.data ?? []);
        this.syncing.set(false);
        const total = (resp.data ?? []).reduce((acc, s) => acc + s.total, 0);
        this.showToast(`Sync completado — ${total} huérfano(s) detectado(s)`, true);
        this.openModal('sync_result');
      },
      error: err => {
        this.syncing.set(false);
        this.showToast(err.error?.message ?? 'Error en sincronización', false);
      },
    });
  }

  // ── Server CRUD ───────────────────────────────────────────────────────────

  onAddSubmit() {
    if (this.serverForm.invalid) return;
    this.saving.set(true);
    const val     = this.serverForm.value;
    const country = this.countries().find(c => c.id === val.country) ?? new CountryEntity();
    const ent     = new serversEntity();
    ent.set({ ...val, country });
    this.serverService.register(ent.get()).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadServers();
        this.closeModal('add_server');
        this.serverForm.reset({ protocol: 's-ui', active: true, visible: true, port: 22, userName: 'root', sui_inbound_id: 1 });
        this.showToast('Servidor registrado', true);
        this.refreshPool();
      },
      error: err => { this.saving.set(false); this.showToast(err.error?.message ?? 'Error al registrar', false); },
    });
  }

  openEdit(srv: serversEntity) {
    this.selectedServer.set(srv);
    this.editForm.patchValue({
      ...srv,
      country:      (srv.country as any)?.id ?? '',
      sui_password: '',   // never pre-fill the password
    });
    this.openModal('edit_server');
  }

  onEditSubmit() {
    if (this.editForm.invalid) return;
    this.saving.set(true);
    const val     = this.editForm.value;
    const country = val.country
      ? (this.countries().find(c => c.id === val.country) ?? this.selectedServer()?.country)
      : this.selectedServer()?.country;
    // Strip empty password so the backend keeps the current encrypted value
    const payload: any = { ...val, country };
    if (!payload.sui_password) delete payload.sui_password;
    this.serverService.update(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadServers();
        this.closeModal('edit_server');
        this.showToast('Servidor actualizado', true);
        this.refreshPool();
      },
      error: err => { this.saving.set(false); this.showToast(err.error?.message ?? 'Error al actualizar', false); },
    });
  }

  confirmDelete(srv: serversEntity) {
    this.selectedServer.set(srv);
    this.openModal('delete_server');
  }

  doDelete() {
    const srv = this.selectedServer();
    if (!srv?.id) return;
    this.serverService.delete(srv.id).subscribe({
      next: () => {
        this.loadServers();
        this.closeModal('delete_server');
        this.showToast('Servidor desactivado', true);
        this.refreshPool();
      },
      error: err => this.showToast(err.error?.message ?? 'Error al eliminar', false),
    });
  }

  // ── S-UI Clients ──────────────────────────────────────────────────────────

  openSuiClients(srv: serversEntity) {
    this.selectedServer.set(srv);
    this.suiClientes.set([]);
    this.loadingClientes.set(true);
    this.openModal('sui_clients');
    this.suiService.listarClientes(srv.id).subscribe({
      next:  resp => { this.suiClientes.set(resp.data ?? []); this.loadingClientes.set(false); },
      error: ()   => this.loadingClientes.set(false),
    });
  }

  suspenderCliente(c: SuiClientRaw) {
    const srv = this.selectedServer();
    if (!srv) return;
    this.suiService.suspenderCliente({ serverId: srv.id, clientId: c.id, xuiConfig: c }).subscribe({
      next:  () => { this.showToast(`${c.email} suspendido`, true); this.openSuiClients(srv); },
      error: err => this.showToast(err.error?.message ?? 'Error', false),
    });
  }

  reactivarCliente(c: SuiClientRaw) {
    const srv = this.selectedServer();
    if (!srv) return;
    this.suiService.reactivarCliente({ serverId: srv.id, clientId: c.id, xuiConfig: c }).subscribe({
      next:  () => { this.showToast(`${c.email} reactivado`, true); this.openSuiClients(srv); },
      error: err => this.showToast(err.error?.message ?? 'Error', false),
    });
  }

  eliminarCliente(c: SuiClientRaw) {
    const srv = this.selectedServer();
    if (!srv) return;
    this.suiService.eliminarCliente({ serverId: srv.id, clientId: c.id, xuiConfig: c }).subscribe({
      next:  () => { this.showToast(`${c.email} eliminado`, true); this.openSuiClients(srv); },
      error: err => this.showToast(err.error?.message ?? 'Error', false),
    });
  }

  openRenew(c: SuiClientRaw) {
    this.clienteTarget.set(c);
    this.renewForm.reset({ gbLimite: 50, dias: 30 });
    this.openModal('renew_client');
  }

  doRenew() {
    if (this.renewForm.invalid) return;
    const srv = this.selectedServer();
    const c   = this.clienteTarget();
    if (!srv || !c) return;
    const { gbLimite, dias } = this.renewForm.value as { gbLimite: number; dias: number };
    this.suiService.renovarCliente({ serverId: srv.id, clientId: c.id, gbLimite, dias, xuiConfig: c }).subscribe({
      next: () => {
        this.showToast(`${c.email} renovado por ${dias} días / ${gbLimite} GB`, true);
        this.closeModal('renew_client');
        this.openSuiClients(srv);
      },
      error: err => this.showToast(err.error?.message ?? 'Error al renovar', false),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  formatGB(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 GB';
    const gb = bytes / (1024 ** 3);
    return gb >= 1 ? gb.toFixed(2) + ' GB' : (bytes / (1024 ** 2)).toFixed(1) + ' MB';
  }

  formatExpiry(ms: number): string {
    if (!ms || ms <= 0) return '∞';
    const d = new Date(ms);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  isExpired(ms: number): boolean {
    return ms > 0 && ms < Date.now();
  }

  isInPool(serverId: string): boolean {
    return this.poolServers().some(p => p.id === serverId);
  }

  isSuiProtocol(form: 'add' | 'edit' = 'add'): boolean {
    const p = form === 'add' ? this.serverForm.value.protocol : this.editForm.value.protocol;
    return p === 's-ui' || p === 'both';
  }

  isOpenvpnProtocol(form: 'add' | 'edit' = 'add'): boolean {
    const p = form === 'add' ? this.serverForm.value.protocol : this.editForm.value.protocol;
    return p === 'openvpn' || p === 'both';
  }

  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }

  openModal(id: string) {
    (document.getElementById(id) as HTMLDialogElement | null)?.showModal();
  }

  closeModal(id: string) {
    (document.getElementById(id) as HTMLDialogElement | null)?.close();
  }
}
