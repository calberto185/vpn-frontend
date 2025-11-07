import { Component, inject, OnInit, signal } from '@angular/core';
import PlanEntity from '../../interfaces/plan.interface';
import { PlansService } from '../../services/plans/plans.service';

import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { UsersService } from '../../services/users/users.service';
import { AuthService } from '../../../auth/services/auth.service';
import PlanClientDto from '../../interfaces/planClient.interface';
import { CountryEntity } from '../../interfaces/country.interface';
import { CountriesService } from '../../services/countries/countries.service';
import { FormsModule } from '@angular/forms';
import { BankAccountService } from '../../services/bankAccount/bankAccount.service';
import bankAccountEntity from '../../interfaces/bankAccount.interface';
import { DatePipe, DecimalPipe } from '@angular/common';
import { PaymentSummaryComponent } from "../../../shared/components/payment-summary/payment-summary.component";
import { PaymentsService } from '../../services/payments/payments.service';
import PaymentEntity from '../../interfaces/payment.interface';
import { TermsService } from '../../services/terms/terms.service';
import TermsEntity from '../../interfaces/terms.interface';
import { ContinentsService } from '../../services/continents/continents.service';
import { ContinentEntity } from '../../interfaces/continent.interface';
@Component({
  selector: 'app-show-client-plans',
  imports: [FormsModule, DecimalPipe, DatePipe, PaymentSummaryComponent],
  templateUrl: './show-client-plans.component.html',
  styleUrl: './show-client-plans.component.css'
})
export class ShowClientPlansComponent implements OnInit {

  sanitizer = inject(DomSanitizer);

  /** BARA DE PROCESO */
  currentStep: number = 1;
  totalSteps: number = 4;

  /** SERVICES */
  bankAccountService = inject(BankAccountService);
  authService = inject(AuthService);
  plansService = inject(PlansService);
  userService = inject(UsersService);
  countryService = inject(CountriesService);
  paymentService = inject(PaymentsService);
  termsService = inject(TermsService);
  continentsService = inject(ContinentsService);

  /** Var Datas */
  ListPlans = signal<PlanEntity[] | any[]>([]);
  ShowListPlans = signal<PlanEntity[] | any[]>([]);
  ListBankAccount = signal<bankAccountEntity[]>([]);
  ListCountries = signal<CountryEntity[]>([]);
  ListTerms = signal<TermsEntity[]>([]);
  Terms = signal<TermsEntity>(new TermsEntity());
  ListContinents = signal<ContinentEntity[]>([]);
  SelectedContinent = signal<ContinentEntity>(new ContinentEntity());

  /** Var General */
  hasError = signal("");
  acceptedTerms: any = "";
  showTerms = false;
  showVoucher = signal(false);
  selectedFile: File | null = null;
  monthsToPay = signal(1);
  totalToPay = signal(0);

  // Seleccion Continente o Pais
  showCountries = signal(false);

  /** Var PLAN */
  selectedPlan: PlanEntity = new PlanEntity();
  plan_RadioGroupName = 'plan-radio';

  /** Var BankAccount */
  selectedBank: bankAccountEntity = new bankAccountEntity();
  bankAccount_RadioGroupName = 'bank-account-radio';
  selectedCountries = signal<CountryEntity[]>([]);

  /** HOOKs */
  ngOnInit(): void {
    this.fillListContinents();
    this.fillListPlans();
    this.fillListCountries();
    this.fillBankAccount();
    this.fillListTerms();
  }
  ngOnChanges() {
    if (this.selectedPlan) {
      this.SelectPlan(this.selectedPlan.id);
    }
  }

  /** LOAD Services Datas */
  fillBankAccount() {
    this.bankAccountService.getBankAccount().subscribe((resp) => {
      // console.log('bankAccountService getBankAccount: ', resp)
      this.ListBankAccount.set(resp?.data ?? []);
    });
  }
  fillListCountries() {
    this.countryService.getAllCountries().subscribe((resp) => {
      // console.log("countryService getAllCountries: ", resp)
      this.ListCountries.set(resp.data ?? [])
      this.selectedCountries.set(this.ListCountries().filter((p) => !!p.isActive))
    })
  }
  fillListPlans() {
    this.plansService.getPlans().subscribe((resp) => {
      // console.log("fillListPlans getPlans: ", resp)
      this.ListPlans.set(resp.data ?? []);
    })
  }
  fillListTerms() {
    this.termsService.get().subscribe((resp) => {
      const data = resp.data ?? []
      if(data.length > 0) {
        const terms = new TermsEntity();
        terms.set(data[0])
        this.Terms.set(terms);
      }
    })
  }
  fillListContinents() {
    this.continentsService.get().subscribe((resp) => {
      const continets = (resp.data ?? []).filter(c => !!c.visible);
      this.ListContinents.set(continets);
    })
  }

  /** Functions BARA DE PROCESO */
  nextStep() {
    if (this.currentStep < this.totalSteps) this.currentStep++;
  }
  prevStep() {
    if (this.currentStep > 1) this.currentStep--;
  }

  onSubmit() {
    const dataToSave = new PlanEntity();
    // dataToSave.set();
    this.plansService.register(dataToSave.get()).subscribe((resp) => {
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
    const dialogo: any = document.getElementById('add_server');
    if (dialogo && dialogo.open) {
      dialogo.close();
    }
  }
  onContainerClick(ev: MouseEvent) {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-select-plan]');
    if (el) {
      ev.preventDefault();
      const id = el.getAttribute('data-select-plan')!;
      const plan = this.ListPlans().find(x => x.id === id);
      if (plan) this.SelectPlan(plan);
    }
  }

  // PASOS

  updateTotal() {
    this.totalToPay.set(this.monthsToPay() * this.selectedPlan.price)
  }
  increaseMonths() {
    if (this.monthsToPay() < 12) {
      this.monthsToPay.set(this.monthsToPay() + 1);
      this.updateTotal();
    }
  }

  decreaseMonths() {
    if (this.monthsToPay() > 1) {
      this.monthsToPay.set(this.monthsToPay() - 1);
      this.updateTotal();
    }
  }
  SelectPlan(planId: string) {
    console.log('Plan seleccionado:', planId);
    // Tu lógica aquí con el ID
    const plan = this.ListPlans().find(p => p.id === planId);
    // ... resto de tu lógica
  }


  onSelectPlan() {
    this.totalToPay.set(this.monthsToPay() * this.selectedPlan.price)
  }
  // SELECCIÓN DE PAÍSES
  toggleSelection(country: CountryEntity) {
    const isActive = !country.isActive;
    country.isActive = isActive;
    const selected = this.selectedCountries();
    const exists = selected.some(p => p.id === country.id);
    if (isActive && !exists) {
      // Activar país → agregar a la lista
      this.selectedCountries.set([...selected, country]);
    } else if (!isActive && exists) {
      // Desactivar país → quitar de la lista
      this.selectedCountries.set(selected.filter(p => p.id !== country.id));
    }
  }


  // RESUMEN
  confirmSelection() {
    // const plan = this.plans.find(p => p.id === this.selectedPlanId);
    // console.log('Plan seleccionado:', plan);
    // console.log('Países seleccionados:', this.selectedCountries);
    alert('¡Selección confirmada! Ver consola.');
  }


  confirmarPago() {
    console.log("selectedPlan: ", this.selectedPlan)
    console.log("selectedCountries: ", this.selectedCountries())
    console.log("selectedBank: ", this.selectedBank)
    console.log("acceptedTerms: ", this.acceptedTerms, this.Terms())
    console.log("selectedFile: ", this.selectedFile)
    console.log("this.monthsToPay: ", this.monthsToPay())
    console.log("this.totalToPay: ", this.totalToPay())
    const user_id = this.authService.user()?.id ?? "";
    const countries_ids = this.selectedCountries().map(p => p.id.toString());
    console.log("countries_ids: ", countries_ids)
    this.paymentService.doesPaymentsInitial(user_id, {
      plan: this.selectedPlan.id,
      countries: JSON.stringify(countries_ids),
      bank: this.selectedBank.id,
      terms: this.Terms().id,
      payTo: this.monthsToPay(),
      total: this.totalToPay()
    }, this.selectedFile).subscribe({
      next: ({ progress, response }) => {
        console.log("progress: ", progress)
        // this.progress = progress;
        if (response) {
          console.log("response: ", response)
        }
        // if (response) this.response = response;
      },
      error: (err) => console.error('Error:', err),
    });
    //  const dialog = document.getElementById('view_select_plans') as HTMLDialogElement;
    //   console.log("dialog: ", dialog)
    //   // dialog?.close();
    //   this.showVoucher.set(true);
  }
  onUploadProof(event: Event) {
    console.log("event: ", event)
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    } else {
      this.selectedFile = null;
    }
  }



  seleccionarContinente(continente: ContinentEntity) {
    console.log("continente: ", continente)
    this.SelectedContinent().set(continente);
    const data = this.ListContinents().map(c => {
      if (continente.id !== c.id) {
        c.isActive = false
      } else {
        c.isActive = true
      }
      return c;
    });
    this.ListContinents.set(data);

    const PlanAccording = this.ListPlans().filter((p: PlanEntity) => p.service.country.continent.id == continente.id && p.service.country.countryCode.toLocaleLowerCase() == "pe" && continente.name.toLocaleLowerCase() == "america");
    console.log("PlanAccording: ", PlanAccording)
    this.ShowListPlans.set(PlanAccording);
  }

  verPaises() {
    this.ListContinents().forEach(c => (c.isActive = false))
    this.ListCountries().forEach(c => (c.isActive = false))
    this.SelectedContinent().set(new ContinentEntity())
    this.showCountries.set(!this.showCountries())
  }
}
