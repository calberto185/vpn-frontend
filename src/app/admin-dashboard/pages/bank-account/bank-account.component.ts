import { CommonModule, DatePipe, NgClass } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CountryEntity } from '../../interfaces/country.interface';
import bankAccountEntity from '../../interfaces/bankAccount.interface';
import { CountriesService } from '../../services/countries/countries.service';
import { BankAccountService } from '../../services/bankAccount/bankAccount.service';

@Component({
  selector: 'app-bank-account',
  imports: [NgClass, DatePipe, ReactiveFormsModule, CommonModule],
  templateUrl: './bank-account.component.html',
  styleUrl: './bank-account.component.css'
})
export class BankAccountComponent implements OnInit {

  countryService = inject(CountriesService);
  bankAccountService = inject(BankAccountService);

  ListBankAccount = signal<bankAccountEntity[]>([]);
  ListCountry = signal<CountryEntity[]>([]);

  hasError = signal('');

  ngOnInit(): void {
    this.fillBankAccount();
    this.fillCountry();
  }


  fillBankAccount() {
    this.bankAccountService.getBankAccount().subscribe((resp) => {
      this.ListBankAccount.set(resp?.data ?? []);
    });
  }
  fillCountry() {
    this.countryService.getAllCountries().subscribe((resp) => {
      this.ListCountry.set(resp?.data ?? []);
    });
  }

  fb = inject(FormBuilder);
  bankAccountForm = this.fb.group({
    name: ['', Validators.required],
    number: ['', Validators.required],
    cardAccount: ['', Validators.required],
    typeAccount: ['', Validators.required],
    country_id: ['', Validators.required],
    active: ['', Validators.required],
    note: ['']
  });

  /** Abre cualquier dialog por id y guarda el cert para usar en el modal */
  modalData: CountryEntity | null = null;
  openDialog(id: string, cert?: CountryEntity) {
    this.modalData = cert ?? null;
    (document.getElementById(id) as HTMLDialogElement)?.showModal();
  }



  /** Crear */
  onSubmit() {
    try {
      if (this.bankAccountForm.invalid) {
        this.hasError.set('Formulario invalido');
        setTimeout(() => this.hasError.set(''), 3000);
        return;
      }
      const data = this.bankAccountForm.value;
      console.log("data: ", data)

      const dataToSave = new bankAccountEntity();
      dataToSave.set(data)
      const dataCountry = new CountryEntity();
      const findCountry = this.ListCountry().find((p: CountryEntity) => p.id == this.bankAccountForm.get('country_id')?.value);
      console.log("findCountry: ", findCountry)
      dataCountry.set(findCountry)
      dataToSave.country = dataCountry.get();
      console.log("dataToSave: ", dataToSave)
      this.bankAccountService.register(dataToSave.get()).subscribe((resp) => {
        if (resp?.error?.message) {
          this.hasError.set(resp.error.message);
          setTimeout(() => this.hasError.set(''), 4000);
          return;
        }
        // refresca lista tras crear
      this.fillBankAccount();
        // cierra modal
        (document.getElementById('add_account') as HTMLDialogElement)?.close();
        // this.bankAccountForm.reset({ user_id: '', device_id: '', server_id: '', plan_id: '', note: '' });
      });
    } catch (error) {
      console.log("error: ", error)
    }
  }

  onCancel() {
    const dialogo = document.getElementById('add_cert') as HTMLDialogElement | null;
    if (dialogo?.open) dialogo.close();
  }
  openEditModal($event: any) {}
  openDeleteModal($event: any) {}
}
