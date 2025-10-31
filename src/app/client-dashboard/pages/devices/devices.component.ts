import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DeviceService } from '../../services/devices/devices.service';
import DeviceEntity from '../../interfaces/device.interface'
import UsersEntity from '../../interfaces/user.interface'
import { UsersService } from '../../services/users/users.service';
import { AuthService } from '../../../auth/services/auth.service';

@Component({
  selector: 'app-devices',
  imports: [NgClass, DatePipe, ReactiveFormsModule, CommonModule],
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
  hasError = signal("");
  fb = inject(FormBuilder);
deviceForm = this.fb.group({
      // id: [''], // opcional
      // user_id: ['', Validators.required],
      device: ['', Validators.required],
      typeDevice: ['', Validators.required],
      // active: [false],
      // certificate: [''],
      // suspendedAt: [{ value: '', disabled: true }],
      // revokedAt: [{ value: '', disabled: true }]
  })

  ngOnInit(): void {
    // this.fillListCountries();
    this.fillListDevices();
    this. fillListUsers();
  }

  // fillListCountries() {
  //   this.countryService.getAllCountries().subscribe((resp) => {
  //     console.log("resp countries: ", resp)
  //     this.ListCountries.set(resp.data ?? [])
  //   })
  // }

  fillListUsers() {
      this.usersService.getUsers().subscribe((resp) => {
        console.log("resp users: ", resp)
        this.ListUsers.set(resp.data ?? [])
      })
    }
  async fillListDevices() {
    this.devicesService.getDevices(this.authService.user()?.id ?? "").subscribe((resp) => {
      console.log("resp: ", resp)
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
    const data: DeviceEntity | any = this.deviceForm.value;
    console.log("data: ", data)
    const dataToSave = new DeviceEntity();
    dataToSave.set(data);
    dataToSave.active = true;
    dataToSave.user_id = this.authService.user()?.id ?? "";
    this.devicesService.register(this.authService.user()?.id ?? "", dataToSave.get()).subscribe((resp) => {
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

}
