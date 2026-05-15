import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LoginPageComponent } from "../../../auth/pages/login-page/login-page.component";
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LanguageCoinComponent } from "../../../shared/components/language-coin/language-coin.component";
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { PlansService } from '../../services/plans/plans.service'
import PlanEntity from '../../interfaces/plan.interface';
import { PublicContentService } from '../../services/content/public-content.service';
import { PublicHomeContent, I18nStr } from '../../interfaces/home-content.interface';
import { LocaleService } from '../../../shared/services/locale/locale.service';
import { BrandingStateService } from '../../../shared/services/branding/branding-state.service';

@Component({
  selector: 'app-public-dashboard-layout',
  imports: [CommonModule, RouterLink, ReactiveFormsModule, FormsModule, LoginPageComponent, LanguageCoinComponent, TranslatePipe],
  templateUrl: './public-dashboard-layout.component.html',
  styleUrl: './public-dashboard-layout.component.css'
})
export class PublicDashboardLayoutComponent implements OnInit{
  checked = signal(true)
  selectedLanguage = signal("es");
  selectedCurrency = signal("PEN");
  ListPlans = signal<PlanEntity[]>([])
  homeContent = signal<PublicHomeContent | null>(null);
  readonly year = new Date().getFullYear();

  plansService = inject(PlansService);
  publicContentService = inject(PublicContentService);
  localeService = inject(LocaleService);
  brandingState = inject(BrandingStateService);

  router = inject(Router);

  async ngOnInit() {
    this.localeService.loadLanguages();
    this.localeService.loadTranslations();
    this.localeService.loadCountries();
    await this.fillListPlans();
    await this.fillHomeContent();
  }

  /** Render an i18n field: if plain string returns as-is, if object resolves for active lang */
  display(val: I18nStr | null | undefined, fallback = ''): string {
    if (val == null) return fallback;
    if (typeof val === 'string') return val;
    return this.localeService.display(val, fallback);
  }
  async fillListPlans() {
    this.plansService.getPlans().subscribe((resp:any) => {
      this.ListPlans.set(resp?.data  ?? [])
    });
  }
  async fillHomeContent() {
    this.publicContentService.getHomeContent().subscribe((resp) => {
      this.homeContent.set(resp?.data ?? null);
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
