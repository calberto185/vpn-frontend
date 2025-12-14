import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DeviceService } from '../../services/devices/devices.service';
import DeviceEntity from '../../interfaces/device.interface'
import UsersEntity from '../../interfaces/user.interface'
import { UsersService } from '../../services/users/users.service';
import { AuthService } from '../../../auth/services/auth.service';
import UserEntity from '../../interfaces/user.interface';
import { PrintStateDevicePipe } from '../../pipes/printStateDevice.pipe';
import { PrintServiceDevicePipe } from '../../pipes/printServiceDevice.pipe';
import { HttpResponse } from '@angular/common/http';

@Component({
  selector: 'app-devices',
  imports: [NgClass, DatePipe, ReactiveFormsModule, CommonModule, PrintStateDevicePipe, PrintServiceDevicePipe],
  templateUrl: './devices.component.html',
  styleUrl: './devices.component.css'
})
export class DevicesComponent implements OnInit{


  authService = inject(AuthService);
  usersService = inject(UsersService);
  devicesService = inject(DeviceService);
  ListDevices = signal<DeviceEntity[]>([]);
    // countryService = inject(CountriesService);

  // ListCountries = signal<CountryEntity[]>([]);
  ListUsers = signal<UsersEntity[]>([]);
  profile = signal<UserEntity>(new UserEntity());
  hasError = signal("");
  fb = inject(FormBuilder);
deviceForm = this.fb.group({
      // id: [''], // opcional
      service: ['', Validators.required],
      device: ['', [Validators.required, Validators.pattern(/^[A-Za-zÁÉÍÓÚÑáéíóúñ ]+$/)]],
      typeDevice: ['', Validators.required],
      // active: [false],
      // certificate: [''],
      // suspendedAt: [{ value: '', disabled: true }],
      // revokedAt: [{ value: '', disabled: true }]
  })

  ngOnInit(): void {
    // this.fillListCountries();
    this.fillListDevices();
    this.fillUser();
  }

  // fillListCountries() {
  //   this.countryService.getAllCountries().subscribe((resp) => {
  //     console.log("resp countries: ", resp)
  //     this.ListCountries.set(resp.data ?? [])
  //   })
  // }

  // fillListUsers() {
  //     this.usersService.getUsers().subscribe((resp) => {
  //       console.log("resp users: ", resp)
  //       this.ListUsers.set(resp.data ?? [])
  //     })
  //   }
  async fillUser() {
    this.usersService.profile().subscribe((resp) => {
      // console.log("resp: ", resp)
      this.profile.set(resp)
    });
  }
  async fillListDevices() {
    this.devicesService.getDevices(this.authService.user()?.id ?? "").subscribe((resp) => {
      console.log("devicesService resp: ", resp)
      this.ListDevices.set(resp.data  ?? [])
    });
  }

    onSubmit() {
    if(this.deviceForm.invalid) {
      this.hasError.set("Formulario invalido");
      setTimeout(() => {
        this.hasError.set("");
      }, 3000);
      return;
    }
    const {device, service, typeDevice} : {device: string, service: string, typeDevice: string} | any = this.deviceForm.value;
    if(!device && !service && !typeDevice) {
      this.hasError.set("Formulario invalido");
      setTimeout(() => {
        this.hasError.set("");
      }, 3000);
      return;
    }
    // console.log("data: ", data)
    // const dataToSave = new DeviceEntity();
    // dataToSave.set(data);
    // dataToSave.active = true;
    // dataToSave.user_id = this.authService.user()?.id ?? "";
    this.devicesService.register(this.authService.user()?.id ?? "", { device, service, typeDevice}).subscribe((resp) => {
        if(resp?.error?.message) {
          this.hasError.set(resp?.error?.message)
          setTimeout(() => {
          this.hasError.set("")
          }, 4000);
          return;
        }
    });

  }

onCancel() {
  const dialogo: any = document.getElementById('add_server');
  if (dialogo && dialogo.open) {
    dialogo.close();
  }
}

private usersIndex = new Map(this.ListUsers().map(u => [u.id, u]));
userNameById(id: string): string | null {
  const u = this.usersIndex.get(id);
  return u ? `${u.firstNames} ${u.lastNames} — DNI: ${u.dni}` : null;
}

isEpoch(iso: string | null | undefined | any): boolean {
  return !iso || iso.startsWith('1970-01-01');
}
private toast(msg: string) {
  console.error(msg);
  // aquí tu notificación/UI
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

  downloadAccessOvpn(c?: DeviceEntity | null) {
    console.log('download ovpn', c?.id);
    // this.devicesService.downloadCertificate({user_id: c?.user_id, device_id: c?.id, server_id: c?.server_id }).subscribe(async (resp) => {
    //   // if (resp?.error?.message) {
    //   //   this.hasError.set(resp.error.message);
    //   //   setTimeout(() => this.hasError.set(''), 4000);
    //   //   return;
    //   // }
    //   this.fileCert.set(resp);
    //   this.fileCertText.set((await resp.body?.text() ?? "").toString())
    // });

  this.devicesService.downloadCertificate({user_id: c?.user_id, device_id: c?.id, server_id: c?.server_id }).subscribe({
    next: (resp: HttpResponse<Blob>) => {
      // si el backend devolviera un error en blob (JSON), intenta detectarlo
      if (!resp.body || resp.body.size === 0) {
        this.toast('No llegó contenido del servidor');
        return;
      }

      // nombre de archivo desde el header o fallback
      const filename =
        // this.getFilename(resp) || `${data.user || 'perfil'}.ovpn`;
        this.getFilename(resp) || `${c?.user_id || 'perfil'}.ovpn`;

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

}
