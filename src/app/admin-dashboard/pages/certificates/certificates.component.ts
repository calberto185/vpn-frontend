import { Component, inject, OnInit, signal, HostListener } from '@angular/core';
import CertificateEntity from '../../interfaces/certificate.interface';
import { UsersService } from '../../services/users/users.service';
import { ServersService } from '../../services/servers/servers.service';
import { DeviceService } from '../../services/devices/devices.service';
import UserEntity from '../../interfaces/user.interface';
import serversEntity from '../../interfaces/servers.interface';
import DeviceEntity from '../../interfaces/device.interface';
import { CertificatesService } from '../../services/certificates/certificates.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule, DatePipe, NgClass } from '@angular/common';
import PlanEntity from '../../interfaces/plan.interface';
import { PlansService } from '../../services/plans/plans.service';
import { HttpResponse } from '@angular/common/http';

@Component({
  selector: 'app-certificates',
  imports: [NgClass, DatePipe, ReactiveFormsModule, CommonModule],
  templateUrl: './certificates.component.html',
  styleUrl: './certificates.component.css'
})
export class CertificatesComponent implements OnInit {
  ngOnInit(): void {
    this.fillCertificates();
    this.fillUsers();
    this.fillServers();
    this.fillDevices();
    this.fillPlans();
  }

  ListCertificates = signal<CertificateEntity[]>([]);
  ListUsers = signal<UserEntity[]>([]);
  ListServers = signal<serversEntity[]>([]);
  ListDevices = signal<DeviceEntity[]>([]);
  ListPlans = signal<PlanEntity[]>([]);

  certificateService = inject(CertificatesService);
  usersService = inject(UsersService);
  serversService = inject(ServersService);
  deviceService = inject(DeviceService);
  plansService = inject(PlansService);

  fileCert = signal<HttpResponse<Blob> | MediaSource | null>( null);
  fileCertText = signal<string>("");

  hasError = signal('');

  fillCertificates() {
    this.certificateService.getCertificates().subscribe((resp) => {
      this.ListCertificates.set(resp?.data ?? []);
    });
  }
  fillUsers() {
    this.usersService.getUsers().subscribe((resp) => {
      this.ListUsers.set(resp?.data ?? []);
    });
  }
  fillServers() {
    this.serversService.getServers().subscribe((resp) => {
      this.ListServers.set(resp?.data ?? []);
    });
  }
  fillDevices() {
    this.deviceService.getDevices().subscribe((resp) => {
      this.ListDevices.set(resp?.data ?? []);
    });
  }
  fillPlans() {
    this.plansService.getPlans().subscribe((resp) => {
      console.log("resp: ", resp)
      this.ListPlans.set(resp?.data ?? []);
    });
  }

  fb = inject(FormBuilder);
  certificateForm = this.fb.group({
    user_id: ['', Validators.required],
    device_id: ['', Validators.required],
    server_id: ['', Validators.required],
    plan_id: ['', Validators.required],
    note: ['']
  });

  /** Abre cualquier dialog por id y guarda el cert para usar en el modal */
  modalData: CertificateEntity | null = null;
  openDialog(id: string, cert?: CertificateEntity) {
    this.modalData = cert ?? null;
    if(id == "download_cert") {
      this.getOvpn(cert);
    }
    (document.getElementById(id) as HTMLDialogElement)?.showModal();
  }

  /** Reemplazo del script Ctrl/Cmd + K */
  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      (document.getElementById('search-certs') as HTMLInputElement)?.focus();
    }
  }

  /** Manejo seguro de flags que vienen como '', 'false', false, 0, etc */
  truthy(v: any): boolean {
    if (typeof v === 'string') {
      const t = v.trim().toLowerCase();
      if (t === '' || t === '0' || t === 'false' || t === 'null' || t === 'undefined') return false;
      if (t === 'true') return true;
      // si viene otra cosa no vacía, considérala "truthy" para tus casos
      return true;
    }
    return !!v;
  }

  /** Calcula expiración: createdAt + (valid_days || expires_at en días) */
  expireAt(c?: Partial<CertificateEntity> | null): Date | null {
    if (!c) return null;
    const created = new Date((c as any).createdAt || (c as any).created_at || '');
    const days = Number((c as any).valid_days ?? (c as any).expires_at ?? 0);
    if (isNaN(created.getTime()) || !days) return null;
    const d = new Date(created);
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  /** Stats */
  countActive(): number {
    return this.ListCertificates().filter(c => !this.truthy((c as any).revoked) && !this.truthy((c as any).suspended)).length;
  }
  countExpiringSoon(days = 7): number {
    const now = new Date();
    const soon = new Date(); soon.setDate(soon.getDate() + days);
    return this.ListCertificates()
      .map(c => this.expireAt(c))
      .filter((d): d is Date => d instanceof Date && !isNaN(d.getTime()))
      .filter(d => d >= now && d <= soon).length;
  }
  countRevoked(): number {
    // Si no guardas fecha de revocación, cuenta los actuales revocados
    return this.ListCertificates().filter(c => this.truthy((c as any).revoked)).length;
  }

  /** Crear */
  onSubmit() {
    if (this.certificateForm.invalid) {
      this.hasError.set('Formulario invalido');
      setTimeout(() => this.hasError.set(''), 3000);
      return;
    }
    const { user_id, device_id, server_id, plan_id, note } = this.certificateForm.value;
    const user = this.ListUsers().find((item) => item.id === user_id);
    const device = this.ListDevices().find((item) => item.id === device_id);
    const server = this.ListServers().find((item) => item.id === server_id);
    const plan = this.ListPlans().find((item) => item.id === plan_id);

    const dataToSave = new CertificateEntity();

    const fecha = new Date();
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const año = fecha.getFullYear();
    const hora = String(fecha.getHours()).padStart(2, '0');
    const minuto = String(fecha.getMinutes()).padStart(2, '0');
    const segundo = String(fecha.getSeconds()).padStart(2, '0');
    const fechaNum = Number(`${dia}${mes}${año}${hora}${minuto}${segundo}`);

    // const userName = (server?.country.countryName || '') + '-' + (device?.device || '') + '-' + (device?.typeDevice || '') + '-' + fechaNum;
    const userName = (server?.country.countryCode || '') + '-' + fechaNum + '-' + (device?.device || '') + '-' + (device?.typeDevice || '');
    const serverName = (server?.name || '') + '-' + (server?.country.countryCode || '') + '-' + (server?.country.currencyCode || '');

    dataToSave.user_id = user?.id ?? '';
    dataToSave.user = userName.replaceAll(' ', '-') ?? '';
    dataToSave.server_id = server?.id ?? '';
    dataToSave.server = serverName.replaceAll(' ', '-') ?? '';
    dataToSave.device_id = device?.id ?? '';
    dataToSave.device = device?.device ?? '';
    dataToSave.ip = server?.host ?? '';
    dataToSave.profile_type = user?.role ?? '';
    dataToSave.tags = device?.typeDevice ?? '';
    // En tu backend estas propiedades llegan como string, mantenemos string:
    (dataToSave as any).valid_days = '365';
    (dataToSave as any).expires_at = '365';
    dataToSave.note = note ?? '';
    (dataToSave as any).version = '2';

    this.certificateService.register(dataToSave.get()).subscribe((resp) => {
      if (resp?.error?.message) {
        this.hasError.set(resp.error.message);
        setTimeout(() => this.hasError.set(''), 4000);
        return;
      }
      // refresca lista tras crear
      this.fillCertificates();
      // cierra modal
      (document.getElementById('add_cert') as HTMLDialogElement)?.close();
      this.certificateForm.reset({ user_id: '', device_id: '', server_id: '', plan_id: '', note: '' });
    });
  }

  onCancel() {
    const dialogo = document.getElementById('add_cert') as HTMLDialogElement | null;
    if (dialogo?.open) dialogo.close();
  }

  // Acciones de modales (stub de ejemplo)
  copyOvpn(c?: CertificateEntity | null) { console.log('copy ovpn', c?.id); }
  getOvpn(c?: CertificateEntity | null) {
    console.log('download ovpn', c?.id);
    const data = c ?? new CertificateEntity();
    this.certificateService.downloadCertificate(data).subscribe(async (resp) => {
      // if (resp?.error?.message) {
      //   this.hasError.set(resp.error.message);
      //   setTimeout(() => this.hasError.set(''), 4000);
      //   return;
      // }
      this.fileCert.set(resp);
      this.fileCertText.set((await resp.body?.text() ?? "").toString())
    });
  }
  // downloadOvpn(c?: CertificateEntity | null) {
  //   console.log('download ovpn', c?.id);
  //   const data = c ?? new CertificateEntity();
  //   // this.certificateService.downloadCertificate(data).subscribe(async (resp) => {
  //   //   if (resp?.error?.message) {
  //   //     this.hasError.set(resp.error.message);
  //   //     setTimeout(() => this.hasError.set(''), 4000);
  //   //     return;
  //   //   }

  //   const blob = this.fileCert() // await resp.blob();
  //   const url = window.URL.createObjectURL(blob);

  //   const a = document.createElement("a");
  //   a.href = url;
  //   a.download = `${data.user}.ovpn`;
  //   document.body.appendChild(a);
  //   a.click();
  //   a.remove();
  //   window.URL.revokeObjectURL(url);
  //     // refresca lista tras crear
  //     // this.fillCertificates();
  //     // cierra modal
  //     // (document.getElementById('add_cert') as HTMLDialogElement)?.close();
  //     // this.certificateForm.reset({ user_id: '', device_id: '', server_id: '', plan_id: '', note: '' });
  //   // });
  // }

downloadOvpn(c?: CertificateEntity | null) {
  const data = c ?? new CertificateEntity();

  this.certificateService.downloadCertificate(data).subscribe({
    next: (resp: HttpResponse<Blob>) => {
      // si el backend devolviera un error en blob (JSON), intenta detectarlo
      if (!resp.body || resp.body.size === 0) {
        this.toast('No llegó contenido del servidor');
        return;
      }

      // nombre de archivo desde el header o fallback
      const filename =
        this.getFilename(resp) || `${data.user || 'perfil'}.ovpn`;

      // descargar
      const blob = resp.body;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    error: async (err) => {
      // si el backend envía JSON pero pedimos 'blob', leer el error
      try {
        const text = await err.error.text();
        this.toast(text || 'Error al descargar el .ovpn');
      } catch {
        this.toast('Error al descargar el .ovpn');
      }
    },
  });
}

/** Extrae filename de Content-Disposition */
private getFilename(resp: HttpResponse<Blob>): string | null {
  const dispo = resp.headers.get('content-disposition') || '';
  // soporta filename y filename* (RFC 5987)
  const mStar = dispo.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (mStar?.[1]) return decodeURIComponent(mStar[1]);
  const m = dispo.match(/filename\s*=\s*"?([^";]+)"?/i);
  return m?.[1] ?? null;
}

private toast(msg: string) {
  console.error(msg);
  // aquí tu notificación/UI
}



  confirmSuspend(c?: CertificateEntity | null) {
    console.log("c: ", c)
    const data = c ?? new CertificateEntity();
        data.suspended = new Date().toDateString();
    this.certificateService.suspender(data).subscribe((resp) => {
      if (resp?.error?.message) {
        this.hasError.set(resp.error.message);
        setTimeout(() => this.hasError.set(''), 4000);
        return;
      }
      // refresca lista tras crear
      this.fillCertificates();
      // cierra modal
      // (document.getElementById('add_cert') as HTMLDialogElement)?.close();
      // this.certificateForm.reset({ user_id: '', device_id: '', server_id: '', plan_id: '', note: '' });
    });
    console.log('suspend', c?.id);
  }
  confirmReactivar(c?: CertificateEntity | null) {
    console.log("c: ", c)
    const data = c ?? new CertificateEntity();
      data.suspended = "";
    this.certificateService.reactivar(data).subscribe((resp) => {
      if (resp?.error?.message) {
        this.hasError.set(resp.error.message);
        setTimeout(() => this.hasError.set(''), 4000);
        return;
      }
      // refresca lista tras crear
      this.fillCertificates();
      // cierra modal
      // (document.getElementById('add_cert') as HTMLDialogElement)?.close();
      // this.certificateForm.reset({ user_id: '', device_id: '', server_id: '', plan_id: '', note: '' });
    });
    console.log('suspend', c?.id);
  }
  confirmRevoke(c?: CertificateEntity | null) {
    console.log("c: ", c)
    const data = c ?? new CertificateEntity();
      data.revoked = new Date().toDateString();
    this.certificateService.revocar(data).subscribe((resp) => {
      if (resp?.error?.message) {
        this.hasError.set(resp.error.message);
        setTimeout(() => this.hasError.set(''), 4000);
        return;
      }
      // refresca lista tras crear
      this.fillCertificates();
      // cierra modal
      // (document.getElementById('add_cert') as HTMLDialogElement)?.close();
      // this.certificateForm.reset({ user_id: '', device_id: '', server_id: '', plan_id: '', note: '' });
    });
    console.log('revoke', c?.id);
  }
  confirmDelete(c?: CertificateEntity | null) { console.log('delete', c?.id); }
}
