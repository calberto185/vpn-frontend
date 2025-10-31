import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CountryEntity } from '../../interfaces/country.interface';
import { CountriesService } from '../../services/countries/countries.service';
import { ContinentEntity } from '../../interfaces/continent.interface';
import { ContinentsService } from '../../../client-dashboard/services/continents/continents.service';

@Component({
  selector: 'app-countries',
  imports: [NgClass, DatePipe, ReactiveFormsModule, CommonModule],
  templateUrl: './countries.component.html',
  styleUrl: './countries.component.css'
})
export class CountriesComponent  implements OnInit{

  ListCountries = signal<CountryEntity[]>([]);
  ListContinents = signal<ContinentEntity[]>([]);

  countryService = inject(CountriesService);
  continentsService = inject(ContinentsService);


  hasError = signal("");

  fb = inject(FormBuilder);
  userForm = this.fb.group({
    countryName: ['', [Validators.required]],
    countryCode: ['', [Validators.required]],
    languageName: ['', [Validators.required]],
    languageCode: ['', [Validators.required]],
    currencyName: ['', [Validators.required]],
    currencyCode: ['', [Validators.required]],
    currencySymbol: ['', [Validators.required]],
    currencyFormat: ['', [Validators.required]],
    flag: ['', [Validators.required]],
    phoneCode: ['', [Validators.required]],
    continent: ['', [Validators.required]],
    isActive: [false, [Validators.required]],
  })

  ngOnInit(): void {
    this.fillListCountries();
    this.fillListContinents();
  }


  fillListCountries() {
    this.countryService.getAllCountries().subscribe((resp) => {
      console.log("countryService getAllCountries: ", resp)
      this.ListCountries.set(resp.data ?? [])
    })
  }

  fillListContinents() {
    this.continentsService.get().subscribe((resp) => {
      console.log("continentsService get: ", resp)
      this.ListContinents.set(resp.data ?? [])
    })
  }
    onSubmit() {
    // if(this.userForm.invalid) {
    //   this.hasError.set("Formulario invalido");
    //   setTimeout(() => {
    //     this.hasError.set("");
    //   }, 3000);
    //   return;
    // }
    // const data = this.userForm.value;
    // console.log("data: ", data)
    // const dataToSave = new UserEntity();
    // dataToSave.set(data);

    // this.userService.register(dataToSave.get()).subscribe((resp) => {
    //     if(resp?.error?.message) {
    //       this.hasError.set(resp?.error?.message)
    //       setTimeout(() => {
    //       this.hasError.set("")
    //       }, 4000);
    //       return;
    //     }
    // });

  }
onCancel() {
  const dialogo: any = document.getElementById('add_country');
  if (dialogo && dialogo.open) {
    dialogo.close();
  }
}
}
