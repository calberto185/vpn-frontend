import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterModule, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { LanguageCoinComponent } from '../../../shared/components/language-coin/language-coin.component';
import { AuthService } from '../../../auth/services/auth.service';
import { User } from '../../../auth/interfaces/auth-reponse.interface';
import { AdminMessagesService } from '../../services/messages/messages.service';
import { SocketService } from '../../../shared/services/socket.service';
import { PermissionsService } from '../../services/permissions/permissions.service';
import { AdminAccountService } from '../../services/account/account.service';
import { MessagesStateService } from '../../../shared/services/messages-state.service';
import { SoundService }         from '../../../shared/services/sound.service';
import { LocaleService }        from '../../../shared/services/locale/locale.service';
import { TranslatePipe }        from '../../../shared/pipes/translate.pipe';
import { AdminGlobalSearchComponent } from '../../components/global-search/admin-global-search.component';
import { BrandingStateService }       from '../../../shared/services/branding/branding-state.service';

@Component({
  selector: 'app-admin-dashboard-layout',
  imports: [RouterOutlet, RouterLink, RouterModule, CommonModule, LanguageCoinComponent, TranslatePipe, AdminGlobalSearchComponent],
  templateUrl: './admin-dashboard-layout.component.html',
  styleUrl: './admin-dashboard-layout.component.css'
})
export class AdminDashboardLayoutComponent implements OnInit, OnDestroy {

  authService    = inject(AuthService);
  permissions    = inject(PermissionsService);
  brandingState  = inject(BrandingStateService);
  readonly currentYear = new Date().getFullYear();
  msgSvc         = inject(AdminMessagesService);
  socketSvc      = inject(SocketService);
  router         = inject(Router);
  accountService = inject(AdminAccountService);
  messagesState  = inject(MessagesStateService);
  private soundSvc    = inject(SoundService);
  private localeService = inject(LocaleService);
  checked           = signal(true);
  user              = signal<User | null>(null);
  sidebarCollapsed  = signal(false);

  toggleSidebar() { this.sidebarCollapsed.update(v => !v); }

  adminUnread   = signal(0);
  adminPreview  = signal<any[]>([]);
  bellOpen      = signal(false);

  private subs = new Subscription();

  ngOnInit(): void {
    this.localeService.loadTranslations();
    const user = this.authService.user();
    this.user.set(user);
    // Picture is not in the JWT — load it from the profile API
    this.accountService.getMyProfile().subscribe({
      next: (resp) => {
        const pic = resp?.data?.picture;
        if (pic !== undefined) {
          this.user.update(u => u ? { ...u, picture: pic } : u);
        }
      },
      error: () => {},
    });
    const role = this.authService.role();
    if (role && role !== 'client') {
      this.permissions.load(role);
    }
    // Cierra el drawer en móvil después de cada navegación
    this.subs.add(
      this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
        const el = document.getElementById('sidebar') as HTMLInputElement;
        if (el) el.checked = false;
      })
    );
    this.loadNotifications();
    // connect() es idempotente si ya está abierto; también reintenta si el token
    // se actualizó después del último intento (p.ej. tras un refresh silencioso)
    this.socketSvc.connect();
    this.listenSockets();
    // Reintento de seguridad: si el socket no quedó conectado (token tardío),
    // volvemos a intentar al cabo de 1 s cuando el token ya estará disponible
    setTimeout(() => {
      if (!this.socketSvc.isConnected) this.socketSvc.connect();
    }, 1000);
  }

  /** Returns true if any of the given routes matches the current URL (prefix match). */
  isGroupActive(routes: string[]): boolean {
    const url = this.router.url.split('?')[0];
    return routes.some(r => url === r || url.startsWith(r + '/'));
  }

  /** Returns true if the current role can see the given sidebar route segment. */
  canSee(route: string): boolean {
    if (this.authService.role() === 'admin') return true;
    return this.permissions.canAccess(route);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.socketSvc.disconnect();
  }

  loadNotifications() {
    this.msgSvc.getUnreadCount().subscribe({ next: r => this.adminUnread.set(r.data?.count ?? 0), error: () => {} });
    this.msgSvc.getPreview().subscribe({ next: r => this.adminPreview.set(r.data ?? []), error: () => {} });
  }

  private listenSockets(): void {
    // Rol cambiado → forzar logout para que el nuevo rol surta efecto
    this.subs.add(
      this.socketSvc.onSessionKicked().subscribe(() => {
        this.authService.logout();
        this.router.navigateByUrl('/');
      })
    );

    // Nuevo mensaje de cliente → actualiza campana en tiempo real
    this.subs.add(
      this.socketSvc.onNewMessageForAdmin().subscribe(msg => {
        this.soundSvc.playMessage();
        this.adminUnread.update(n => n + 1);
        this.adminPreview.update(list => [
          { id: msg.message_id, from_name: msg.from_name, subject: msg.subject, body: msg.preview, createdAt: msg.createdAt },
          ...list.slice(0, 4),
        ]);
      })
    );

    // Mensaje leído → eliminarlo de la lista de la campana
    this.subs.add(
      this.messagesState.messageRead$.subscribe(id => {
        this.adminPreview.update(list => list.filter(m => m.id !== id));
      })
    );

    // Mensaje leído → decrementar el contador del badge de la campana
    this.subs.add(
      this.messagesState.unreadDecrement$.subscribe(() => {
        this.adminUnread.update(n => Math.max(0, n - 1));
      })
    );
  }

  async logout() {
    await this.authService.logout();
    this.router.navigateByUrl('/');
  }

  changeTheme() {
    this.checked.set(!this.checked());
    document.documentElement.dataset['theme'] = !this.checked() ? 'dark' : 'light';
  }

  onNotificationClick(msg: any): void {
    // Update UI immediately
    this.adminPreview.update(list => list.filter(m => m.id !== msg.id));
    this.adminUnread.update(n => Math.max(0, n - 1));
    this.messagesState.markAsRead(msg.id);
    this.messagesState.decrementUnread();

    // Persist read state (fire and forget)
    this.msgSvc.markRead(msg.id).subscribe();

    // Close DaisyUI dropdown
    (document.activeElement as HTMLElement)?.blur();

    // Navigate and pass the message id to auto-open
    this.router.navigate(['/panel/messages'], { queryParams: { open: msg.id } });
  }

  timeAgo(date: string | Date): string {
    const diff = Date.now() - new Date(date).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'ahora';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  }
}
