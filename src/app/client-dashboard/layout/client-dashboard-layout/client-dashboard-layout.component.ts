import { Component, inject, OnChanges, OnInit, signal, SimpleChanges } from '@angular/core';
import { Router, RouterLink, RouterModule, RouterOutlet } from '@angular/router';
import { AdminNavbarComponent } from "../../components/admin-navbar/admin-navbar.component";
import { AuthService } from '../../../auth/services/auth.service';
import { User } from '../../../auth/interfaces/auth-reponse.interface';
import { ShowClientPlansComponent } from "../../components/show-client-plans/show-client-plans.component";
import { LanguageCoinComponent } from "../../../shared/components/language-coin/language-coin.component";
import { ServicesService } from '../../services/services/services.service';
import ServicesEntity from '../../interfaces/services.interface';

@Component({
  selector: 'app-admin-dashboard-layout',
  imports: [RouterOutlet, RouterLink, AdminNavbarComponent, RouterModule, ShowClientPlansComponent, LanguageCoinComponent],
  templateUrl: './client-dashboard-layout.component.html',
  styleUrl: './client-dashboard-layout.component.css'
})
export class ClientDashboardLayoutComponent implements OnInit, OnChanges {


  authService = inject(AuthService)
  router = inject(Router);
  checked = signal(true)
  user = signal<User | null>(null);
  selectedLanguage = signal("es");
  selectedCurrency = signal("PEN");
  title_services = signal("Ninguno");

  _servicesService = inject(ServicesService);
  ListServices = signal<ServicesEntity[]>([]);


  ngOnInit(): void {
    this.fillListUsers();
    const user = this.authService.user();
    this.user.set(user)
    this.title_services.set(""+this.user()?.services.map((p: any) => p?.service_sortName).join(" | "))
    if(this.user()?.services?.length == 0) {
      const dialog = document.getElementById('view_select_plans') as HTMLDialogElement;
      console.log("dialog: ", dialog)
      dialog?.showModal();
    }
  }
 ngOnChanges(changes: SimpleChanges): void {
    const DoesntService = this.ListServices().filter(p => this.user()?.services.find(d => d.service_id == p.id))
    console.log("DoesntService: ", DoesntService)

  }
  async logout() {
    console.log("close")
    await this.authService.logout()
    this.router.navigateByUrl('/')
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

  fillListUsers() {
      this._servicesService.get().subscribe((resp) => {
        console.log("_servicesService get: ", resp)
        this.ListServices.set(resp.data ?? [])
      })
    }
}
