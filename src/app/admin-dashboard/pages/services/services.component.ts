import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ServicesService } from '../../services/services/services.service';
import ServicesEntity from '../../interfaces/services.interface';
import { CountryEntity } from '../../interfaces/country.interface';
import { CountriesService } from '../../services/countries/countries.service';


@Component({
  selector: 'app-services',
  imports: [NgClass, DatePipe, ReactiveFormsModule, CommonModule],
  templateUrl: './services.component.html',
  styleUrl: './services.component.css'
})
export class ServicesComponent implements OnInit{

  ListServices = signal<ServicesEntity[]>([]);
  ListCountries = signal<CountryEntity[]>([]);

  servicesService = inject(ServicesService);
  countryService = inject(CountriesService);

  ngOnInit(): void {
    this.fillListCountries();
    this.fillListServices();
  }

  hasError = signal("");
  fb = inject(FormBuilder);
  serviceForm = this.fb.group({
      sortName: ['', Validators.required],
      longName: ['', Validators.required],
      Description: ['', Validators.required],
      picture: [''],
      country: ['', Validators.required],
      state: [false]
  })


  fillListServices() {
    this.servicesService.get().subscribe((resp) => {
      console.log("servicesService get: ", resp)
      this.ListServices.set(resp.data ?? [])
    })
  }

  fillListCountries() {
    this.countryService.getAllCountries().subscribe((resp) => {
      console.log("countryService getAllCountries: ", resp)
      this.ListCountries.set(resp.data ?? []);
    })
  }


    onSubmit() {
    if(this.serviceForm.invalid) {
      this.hasError.set("Formulario invalido");
      setTimeout(() => {
        this.hasError.set("");
      }, 3000);
      return;
    }
    const data: ServicesEntity | any = this.serviceForm.value;
    console.log("data: ", data)
    const dataToSave = new ServicesEntity();
    dataToSave.set(data);
    const exist_Country = this.ListCountries().find(g => g.id == data.country);
    const country = new CountryEntity();
    if(!!exist_Country) {
      country.set(exist_Country)
    }
    dataToSave.country = country
    this.servicesService.register(dataToSave.get()).subscribe((resp) => {
      console.log("resp: ", resp)
        // if(resp?.error?.message) {
        //   this.hasError.set(resp?.error?.message)
        //   setTimeout(() => {
        //   this.hasError.set("")
        //   }, 4000);
        //   return;
        // }
    });

  }

onCancel() {
  const dialogo: any = document.getElementById('add_service');
  if (dialogo && dialogo.open) {
    dialogo.close();
  }
}
openViewModal(p: any) {}
openEditModal(p: any) {}
toggleState(p: any) {}
openDeleteModal(p: any) {}
}
