import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { LoginPageComponent } from "../../../auth/pages/login-page/login-page.component";
import { RegisterPageComponent } from "../../../auth/pages/register-page/register-page.component";
import { ShowClientPlansComponent } from "../../components/show-client-plans/show-client-plans.component";
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LanguageCoinComponent } from "../../../shared/components/language-coin/language-coin.component";
import { PlansService } from '../../services/plans/plans.service'
import PlanEntity from '../../interfaces/plan.interface';

@Component({
  selector: 'app-public-dashboard-layout',
  imports: [RouterOutlet, RouterLink, ReactiveFormsModule, FormsModule, LoginPageComponent, RegisterPageComponent, ShowClientPlansComponent, LanguageCoinComponent],
  templateUrl: './public-dashboard-layout.component.html',
  styleUrl: './public-dashboard-layout.component.css'
})
export class PublicDashboardLayoutComponent implements OnInit{
  checked = signal(true)
  selectedLanguage = signal("es");
  selectedCurrency = signal("PEN");
  ListPlans = signal<PlanEntity[]>([])

  plansService = inject(PlansService);

  router = inject(Router);

  async ngOnInit() {
     await this.fillListPlans();
  }
    async fillListPlans() {
    this.plansService.getPlans().subscribe((resp:any) => {
      console.log("plansService getPlans: ", resp)
      this.ListPlans.set(resp?.data  ?? [])
    });
  }
  changeTheme() {
    this.checked.set(!this.checked())
    document.documentElement.dataset['theme'] = !this.checked() ? 'dark' : 'light';
  }
  onLanguageChange($event: any) {
  this.selectedLanguage.set($event);
  }
  onCurrencyChange($event: any) {
  this.selectedCurrency.set($event);
  }
  SelectPlan(d: PlanEntity) {
    // const user = this.authService.user();
    // const dataPlanClientDto = new PlanClientDto();
    // dataPlanClientDto.name = d.name;
    // dataPlanClientDto.devicesLimit = d.limitDevices;
    // dataPlanClientDto.plan_id = d.id;
    // dataPlanClientDto.amount = d.amount;
    // dataPlanClientDto.coinSymbol = d.coinSymbol;
    // dataPlanClientDto.period = "-";
    // this.userService.updateClientPlan(user?.id ?? "", dataPlanClientDto.get()).subscribe((resp) => {
    //   console.log("resp: ", resp)
    //     // if(resp?.error?.message) {
    //     //   this.hasError.set(resp?.error?.message)
    //     //   setTimeout(() => {
    //     //   this.hasError.set("")
    //     //   }, 4000);
    //     //   return;
    //     // }
    // });

    this.router.navigateByUrl('/auth/register');
}
}
