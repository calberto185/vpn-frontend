import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientService, ClientDevice, ClientServiceStats } from '../../services/client/client.service';
import { DeviceService } from '../../services/devices/devices.service';
import UserEntity from '../../interfaces/user.interface';
import PlanClientDto from '../../interfaces/planClient.interface';
import * as QRCode from 'qrcode';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-devices',
  imports: [DatePipe, ReactiveFormsModule, CommonModule],
  templateUrl: './devices.component.html',
  styleUrl: './devices.component.css',
})
export class DevicesComponent implements OnInit, OnDestroy {

  private clientService = inject(ClientService);
  private deviceService = inject(DeviceService);
  private sanitizer     = inject(DomSanitizer);
  private fb            = inject(FormBuilder);

  // ── State ──────────────────────────────────────────────────────────────────
  profile  = signal<UserEntity>(new UserEntity());
  devices  = signal<ClientDevice[]>([]);
  saving   = signal(false);
  toast    = signal<{ msg: string; ok: boolean } | null>(null);

  /** Stats from S-UI keyed by service_id */
  serviceStats  = signal<Record<string, ClientServiceStats>>({});
  statsLoading  = signal<string[]>([]);

  // ── Computed counters ──────────────────────────────────────────────────────
  activeCount   = computed(() => this.devices().filter(d => d.active && !d.suspend).length);
  suspendCount  = computed(() => this.devices().filter(d => d.suspend).length);

  // ── Filter / search / pagination ───────────────────────────────────────────
  searchQuery    = signal('');
  filterStatus   = signal<'all' | 'active' | 'suspended'>('all');
  filterService  = signal('');
  filterPeriod   = signal<'today' | 'week' | 'month' | 'all'>('all');
  pageSize       = signal<number>(10);
  currentPage    = signal(1);

  filteredDevices = computed(() => {
    const q   = this.searchQuery().toLowerCase();
    const fs  = this.filterStatus();
    const svc = this.filterService();
    const fp  = this.filterPeriod();
    const now = new Date(); now.setHours(23, 59, 59, 999);

    return this.devices().filter(d => {
      // text search
      if (q && !d.device.toLowerCase().includes(q) &&
               !d.typeDevice.toLowerCase().includes(q) &&
               !d.id.toLowerCase().includes(q) &&
               !this.serviceNameFor(d.service_id).toLowerCase().includes(q)) return false;
      // status
      if (fs === 'active'    && (d.suspend || !d.active)) return false;
      if (fs === 'suspended' && !d.suspend) return false;
      // service
      if (svc && d.service_id !== svc) return false;
      // period
      if (fp !== 'all') {
        const created = new Date(d.createdAt);
        let from: Date | null = null;
        if (fp === 'today') { from = new Date(); from.setHours(0, 0, 0, 0); }
        else if (fp === 'week')  { from = new Date(); from.setDate(from.getDate() - 7); from.setHours(0,0,0,0); }
        else if (fp === 'month') { from = new Date(); from.setDate(from.getDate() - 30); from.setHours(0,0,0,0); }
        if (from && created < from) return false;
      }
      return true;
    });
  });

  totalPages = computed(() => {
    const ps = this.pageSize();
    if (ps === 0) return 1;
    return Math.max(1, Math.ceil(this.filteredDevices().length / ps));
  });

  paginatedDevices = computed(() => {
    const ps   = this.pageSize();
    const list = this.filteredDevices();
    if (ps === 0) return list;
    const start = (this.currentPage() - 1) * ps;
    return list.slice(start, start + ps);
  });

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const cur   = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '…')[] = [1];
    if (cur > 3)       pages.push('…');
    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) pages.push(p);
    if (cur < total - 2) pages.push('…');
    pages.push(total);
    return pages;
  });

  setPage(p: number) {
    this.currentPage.set(Math.max(1, Math.min(p, this.totalPages())));
  }

  setFilter(period: 'today' | 'week' | 'month' | 'all') {
    this.filterPeriod.set(period);
    this.currentPage.set(1);
  }

  setPageSize(n: number) {
    this.pageSize.set(n);
    this.currentPage.set(1);
  }

  // ── Unique services list (for filter selector) ────────────────────────────
  serviceOptions = computed(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    for (const d of this.devices()) {
      if (!seen.has(d.service_id)) {
        seen.add(d.service_id);
        out.push({ id: d.service_id, name: this.serviceNameFor(d.service_id) });
      }
    }
    return out;
  });

  // ── Contracted services (for add-device modal) ────────────────────────────
  contractedServices = computed(() =>
    (this.profile().services as PlanClientDto[]).filter(s => s.active)
  );

  // ── Add device form ────────────────────────────────────────────────────────
  deviceForm = this.fb.group({
    service:    ['', Validators.required],
    typeDevice: ['', Validators.required],
    device:     ['', [Validators.required, Validators.minLength(2)]],
  });

  // ── Detail modal state ─────────────────────────────────────────────────────
  selectedDevice  = signal<ClientDevice | null>(null);
  showPassword    = signal(false);
  qrDataUrl       = signal<string | null>(null);
  codeHtml        = signal<SafeHtml | null>(null);
  codeLoading     = signal(false);
  codeError       = signal('');

  // ── Sub URL modal (first S-UI device) ─────────────────────────────────────
  newSubUrl = signal<string | null>(null);

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit() {
    this.loadProfile();
    this.loadDevices();
  }

  ngOnDestroy() {}

  loadProfile() {
    this.clientService.getMe().subscribe({
      next: resp => {
        if (resp?.data) {
          const u = new UserEntity();
          u.set(resp.data as any);
          this.profile.set(u);
        }
      },
    });
  }

  loadDevices() {
    this.clientService.getMyDevices().subscribe({
      next: resp => {
        const devs = resp.data ?? [];
        this.devices.set(devs);

        // Fetch S-UI stats for each unique S-UI service
        const suiSvcIds = [...new Set(
          devs.filter(d => d.protocol === 's-ui').map(d => d.service_id)
        )];
        if (suiSvcIds.length) {
          this.statsLoading.set(suiSvcIds);
          for (const sid of suiSvcIds) {
            this.clientService.getServiceStats(sid).subscribe({
              next: r => {
                if (r?.data) this.serviceStats.update(p => ({ ...p, [sid]: r.data! }));
                this.statsLoading.update(ids => ids.filter(i => i !== sid));
              },
              error: () => this.statsLoading.update(ids => ids.filter(i => i !== sid)),
            });
          }
        }
      },
    });
  }

  // ── Detail modal ───────────────────────────────────────────────────────────
  async openDetail(dev: ClientDevice) {
    this.selectedDevice.set(dev);
    this.showPassword.set(false);
    this.qrDataUrl.set(null);
    this.codeHtml.set(null);
    this.codeError.set('');

    // Generate QR for VPN sub_url
    if (dev.sub_url) {
      try {
        const url = await QRCode.toDataURL(dev.sub_url, { width: 220, margin: 1 });
        this.qrDataUrl.set(url);
      } catch { /* ignore QR errors */ }
    }

    (document.getElementById('device_detail') as HTMLDialogElement | null)?.showModal();
  }

  closeDetail() {
    this.selectedDevice.set(null);
    (document.getElementById('device_detail') as HTMLDialogElement | null)?.close();
  }

  fetchCode() {
    const dev = this.selectedDevice();
    if (!dev) return;
    const plan = this.planFor(dev);
    if (!plan) return;

    this.codeLoading.set(true);
    this.codeHtml.set(null);
    this.codeError.set('');

    this.clientService.fetchServiceCode(plan.plan_id).subscribe({
      next: resp => {
        this.codeLoading.set(false);
        const html = (resp as any)?.data?.html ?? '';
        this.codeHtml.set(this.sanitizer.bypassSecurityTrustHtml(html));
      },
      error: err => {
        this.codeLoading.set(false);
        this.codeError.set(err?.error?.message ?? 'Error al obtener el código');
      },
    });
  }

  // ── Add device ─────────────────────────────────────────────────────────────
  onSubmit() {
    if (this.deviceForm.invalid || this.saving()) return;

    const { service, typeDevice, device } = this.deviceForm.value as {
      service: string; typeDevice: string; device: string;
    };

    this.saving.set(true);
    this.deviceService.register('', { service, typeDevice, device }).subscribe({
      next: (resp: any) => {
        this.saving.set(false);
        const isAdditional = resp?.data?.is_additional;
        const msg = isAdditional
          ? 'Dispositivo registrado. Usa la misma URL de suscripción VPN.'
          : (resp?.message ?? 'Dispositivo agregado correctamente.');
        this.showToast(msg, true);
        this.deviceForm.reset();
        (document.getElementById('add_device') as HTMLDialogElement | null)?.close();
        this.loadDevices();

        if (!isAdditional && resp?.data?.sub_url) {
          this.newSubUrl.set(resp.data.sub_url);
          (document.getElementById('sub_url_modal') as HTMLDialogElement | null)?.showModal();
        }
      },
      error: (err: any) => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'Error al agregar el dispositivo', false);
      },
    });
  }

  onCancel() {
    this.deviceForm.reset();
    (document.getElementById('add_device') as HTMLDialogElement | null)?.close();
  }

  // ── XLSX export ────────────────────────────────────────────────────────────
  exportXLSX() {
    const list = this.filteredDevices();
    if (!list.length) return;

    const rows = list.map(d => ({
      'ID':          d.id,
      'Dispositivo': d.device,
      'Tipo':        d.typeDevice,
      'Servicio':    this.serviceNameFor(d.service_id),
      'Protocolo':   d.protocol,
      'Estado':      d.suspend ? 'Suspendido' : d.active ? 'Activo' : 'Inactivo',
      'Registrado':  d.createdAt ? new Date(d.createdAt).toLocaleDateString('es') : '',
      'Sub URL':     d.sub_url ?? '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [30, 24, 14, 20, 14, 14, 14, 50].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dispositivos');

    const meta = XLSX.utils.aoa_to_sheet([
      ['Reporte de Dispositivos'],
      ['Generado:', new Date().toLocaleString('es')],
      ['Total:', list.length],
      ['Usuario:', this.profile().email ?? ''],
    ]);
    XLSX.utils.book_append_sheet(wb, meta, 'Info');

    XLSX.writeFile(wb, `dispositivos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  planFor(dev: ClientDevice): PlanClientDto | null {
    const services = this.profile().services as PlanClientDto[];
    // Match by plan_id first (if available), then by service_id
    if (dev.plan_id) {
      const byPlan = services.find(s => s.plan_id === dev.plan_id);
      if (byPlan) return byPlan;
    }
    return services.find(s => s.service_id === dev.service_id) ?? null;
  }

  isVpnPlan(dev: ClientDevice): boolean {
    const plan = this.planFor(dev);
    if (!plan) return dev.protocol === 's-ui' || dev.protocol === 'openvpn';
    return plan.service_sortName?.toUpperCase().includes('VPN') ||
           plan.vpnMode != null ||
           dev.protocol === 's-ui';
  }

  serviceNameFor(serviceId: string): string {
    const plan = (this.profile().services as PlanClientDto[])
      .find(s => s.service_id === serviceId);
    return plan?.service_sortName ?? serviceId;
  }

  gbPercent(stats: ClientServiceStats): number {
    if (!stats?.gb_total) return 0;
    return Math.min(100, Math.round((stats.gb_usado / stats.gb_total) * 100));
  }

  gbBarClass(stats: ClientServiceStats): string {
    const p = this.gbPercent(stats);
    if (p >= 90) return 'progress-error';
    if (p >= 70) return 'progress-warning';
    return 'progress-success';
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() =>
      this.showToast('Copiado al portapapeles', true)
    );
  }

  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 5000);
  }

  pageEnd(): number {
    const ps = this.pageSize();
    if (ps === 0) return this.filteredDevices().length;
    return Math.min(this.currentPage() * ps, this.filteredDevices().length);
  }

  trackByDev(_: number, d: ClientDevice) { return d.id; }
}
