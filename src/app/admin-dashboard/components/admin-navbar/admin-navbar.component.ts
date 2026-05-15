import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { NgClass } from '@angular/common';
import { AuthService } from '../../../auth/services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { SocketService } from '../../../shared/services/socket.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-admin-navbar',
  imports: [NgClass, RouterLink],
  templateUrl: './admin-navbar.component.html',
  styleUrl: './admin-navbar.component.css'
})
export class AdminNavbarComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  router      = inject(Router);
  socketSvc   = inject(SocketService);

  checked    = signal(true);
  wsOnline   = signal(false);

  private sub = new Subscription();

  ngOnInit(): void {
    // Sondeo del estado WS cada 3 segundos
    this.sub.add(
      interval(3000).subscribe(() => this.wsOnline.set(this.socketSvc.isConnected))
    );
    // Estado inicial
    this.wsOnline.set(this.socketSvc.isConnected);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  async logout() {
    await this.authService.logout();
    this.router.navigateByUrl('/');
  }

  changeTheme() {
    this.checked.set(!this.checked());
    document.documentElement.dataset['theme'] = !this.checked() ? 'dark' : 'light';
  }
}
