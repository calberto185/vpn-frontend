import { Component, inject, OnInit, signal } from '@angular/core';
import serversEntity from '../../interfaces/servers.interface';
import { ServersService } from '../../services/servers/servers.service';
import { DatePipe, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CountryEntity } from '../../interfaces/country.interface';
import { CountriesService } from '../../services/countries/countries.service';

@Component({
  selector: 'app-servers',
  imports: [NgClass, DatePipe, ReactiveFormsModule],
  templateUrl: './servers.component.html',
  styleUrl: './servers.component.css'
})
export class ServersComponent implements OnInit{

  serverService = inject(ServersService);
  ListServers = signal<serversEntity[]>([]);
    countryService = inject(CountriesService);

  ListCountries = signal<CountryEntity[]>([]);
  hasError = signal("");
  fb = inject(FormBuilder);
serverForm = this.fb.group({
    name: ['', [Validators.required ]],
    host: ['', [Validators.required ]],
    port: ['', [Validators.required ]],
    userName: ['', [Validators.required ]],
    password: ['', [Validators.required ]],
    privateKeyPath: ['', [Validators.required ]],
    country: ['', [Validators.required ]],
    active: ['', [Validators.required ]],
  })

  ngOnInit(): void {
    this.fillListCountries();
    this.fillListServers()
  }

  fillListCountries() {
    this.countryService.getAllCountries().subscribe((resp) => {
      console.log("resp countries: ", resp)
      this.ListCountries.set(resp.data ?? [])
    })
  }

  async fillListServers() {
    this.serverService.getServers().subscribe((resp) => {
      console.log("resp: ", resp)
      this.ListServers.set(resp.data  ?? [])
    });
  }

    onSubmit() {
    if(this.serverForm.invalid) {
      this.hasError.set("Formulario invalido");
      setTimeout(() => {
        this.hasError.set("");
      }, 3000);
      return;
    }
    const data:  any = this.serverForm.value;
    const country = this.ListCountries().find((item) => item.id === data.country);
    if(!country) return;
    let dataToSave = new serversEntity();
    dataToSave.set(data);
    dataToSave.country = country;
    this.serverService.register(dataToSave.get()).subscribe((resp) => {
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
}
