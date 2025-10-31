import { Component, inject, OnInit, signal } from '@angular/core';
import PlanEntity from '../../interfaces/plan.interface';
import { PlansService } from '../../services/plans/plans.service';
import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CountriesService } from '../../services/countries/countries.service';
import { CountryEntity } from '../../interfaces/country.interface';
import ServicesEntity from '../../interfaces/services.interface';
import { ServicesService } from '../../services/services/services.service';

@Component({
  selector: 'app-plans',
  imports: [NgClass, DatePipe, ReactiveFormsModule, CommonModule],
  templateUrl: './plans.component.html',
  styleUrl: './plans.component.css'
})
export class PlansComponent implements OnInit{


  ListCountries = signal<CountryEntity[]>([]);
  ListServices = signal<ServicesEntity[]>([]);
  ListPlans = signal<PlanEntity[]>([]);



  plansService = inject(PlansService);
  countryService = inject(CountriesService);
  ServicesService = inject(ServicesService);

  ngOnInit(): void {
    this.fillListPlans();
    this.fillListServices();
  }


  hasError = signal("");
  fb = inject(FormBuilder);
  planForm = this.fb.group({
      title_prefix: [''],
      title_name: ['', Validators.required],
      title_suffix: [''],
      price: ['', Validators.required],
      description: ['', Validators.required],
      button_name: ['', Validators.required],
      kind: ['', Validators.required],
      service: ['', Validators.required],
      limitDevices: ['', Validators.required],
      // features: ['', Validators.required],
      active: [false],
  })


  fillListCountries() {
    this.countryService.getAllCountries().subscribe((resp) => {
      console.log("countryService getAllCountries: ", resp)
      this.ListCountries.set(resp.data ?? [])
    })
  }
  fillListServices() {
    this.ServicesService.get().subscribe((resp) => {
      console.log("ServicesService get: ", resp)
      this.ListServices.set(resp.data ?? [])
    })
  }

  fillListPlans() {
    this.plansService.getPlans().subscribe((resp) => {
      console.log("plansService getPlans: ", resp)
      this.ListPlans.set(resp.data ?? []);
    })
  }


    onSubmit() {
    if(this.planForm.invalid) {
      this.hasError.set("Formulario invalido");
      setTimeout(() => {
        this.hasError.set("");
      }, 3000);
      return;
    }
    const data: PlanEntity | any = this.planForm.value;
    const exist_Service = this.ListServices().find(d => d.id == data.service);
    const service = new ServicesEntity();
    if(!exist_Service) { return }
    service.set(exist_Service)
    console.log("data: ", data)
    const dataToSave = new PlanEntity();
    dataToSave.set(data);
    dataToSave.service = service;
    dataToSave.currencyCode = service.country.countryCode;
    dataToSave.currencyFormat = service.country.currencyFormat;
    dataToSave.currencyName = service.country.currencyName;
    dataToSave.currencySymbol = service.country.currencySymbol;
    dataToSave.language = service.country.languageCode;
    this.plansService.register(dataToSave.get()).subscribe((resp) => {
      console.log("resp: ", resp)
        // if(resp?.error?.message) {
        //   this.hasError.set(resp?.error?.message)
        //   setTimeout(() => {
        //   this.hasError.set("")
        //   }, 4000);
        //   return;
        // }

    this.fillListPlans();
    this.fillListServices();
    });

    const dialogo: any = document.getElementById('add_plan');
    if (dialogo && dialogo.open) {
      dialogo.close();
    }
  }

async onCancel() {
  const dialogo: any = document.getElementById('add_plan');
  if (dialogo && dialogo.open) {
    dialogo.close();
  }
}

}
