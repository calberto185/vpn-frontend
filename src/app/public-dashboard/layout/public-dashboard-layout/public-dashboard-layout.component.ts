import { Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { LoginPageComponent } from "../../../auth/pages/login-page/login-page.component";
import { RegisterPageComponent } from "../../../auth/pages/register-page/register-page.component";
import { ShowClientPlansComponent } from "../../components/show-client-plans/show-client-plans.component";
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { LanguageCoinComponent } from "../../../shared/components/language-coin/language-coin.component";

@Component({
  selector: 'app-public-dashboard-layout',
  imports: [RouterOutlet, RouterLink, ReactiveFormsModule, FormsModule, LoginPageComponent, RegisterPageComponent, ShowClientPlansComponent, LanguageCoinComponent],
  templateUrl: './public-dashboard-layout.component.html',
  styleUrl: './public-dashboard-layout.component.css'
})
export class PublicDashboardLayoutComponent {
  checked = signal(true)
  selectedLanguage = signal("es");
  selectedCurrency = signal("PEN");
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
}
