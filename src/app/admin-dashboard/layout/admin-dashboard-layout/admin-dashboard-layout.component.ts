import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterModule, RouterOutlet } from '@angular/router';
import { AdminNavbarComponent } from "../../components/admin-navbar/admin-navbar.component";
import { AuthService } from '../../../auth/services/auth.service';
import { User } from '../../../auth/interfaces/auth-reponse.interface';

@Component({
  selector: 'app-admin-dashboard-layout',
  imports: [RouterOutlet, RouterLink, AdminNavbarComponent, RouterModule],
  templateUrl: './admin-dashboard-layout.component.html',
  styleUrl: './admin-dashboard-layout.component.css'
})
export class AdminDashboardLayoutComponent implements OnInit {

  authService = inject(AuthService)
  router = inject(Router);
  checked = signal(true)
  user = signal<User | null>(null);



  ngOnInit(): void {
    const user = this.authService.user();
    this.user.set(user)
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
}
