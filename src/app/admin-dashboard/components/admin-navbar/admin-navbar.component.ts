import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../../../auth/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-admin-navbar',
  imports: [],
  templateUrl: './admin-navbar.component.html',
  styleUrl: './admin-navbar.component.css'
})
export class AdminNavbarComponent {
  authService = inject(AuthService)
  router = inject(Router);
  checked = signal(true)

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
