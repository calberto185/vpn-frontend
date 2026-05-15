import { Component, inject, OnChanges, OnDestroy, OnInit, signal, SimpleChanges } from '@angular/core';
import { Router, RouterLink, RouterModule, RouterOutlet, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../auth/services/auth.service';
import { User } from '../../../auth/interfaces/auth-reponse.interface';
import Profile from "../../interfaces/user.interface";
import { ShowClientPlansComponent } from "../../components/show-client-plans/show-client-plans.component";
import { LanguageCoinComponent } from "../../../shared/components/language-coin/language-coin.component";
import { ServicesService } from '../../services/services/services.service';
import { UsersService } from '../../services/users/users.service';
import ServicesEntity from '../../interfaces/services.interface';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';
import { ClientMessagesService } from '../../services/messages/messages.service';
import { SocketService } from '../../../shared/services/socket.service';
import { MessagesStateService } from '../../../shared/services/messages-state.service';
import { SoundService }         from '../../../shared/services/sound.service';
import { LocaleService }        from '../../../shared/services/locale/locale.service';
import { BrandingStateService } from '../../../shared/services/branding/branding-state.service';

@Component({
  selector: 'app-admin-dashboard-layout',
  imports: [RouterOutlet, RouterLink, RouterModule, ShowClientPlansComponent, LanguageCoinComponent, TranslatePipe],
  templateUrl: './client-dashboard-layout.component.html',
  styleUrl: './client-dashboard-layout.component.css'
})
export class ClientDashboardLayoutComponent implements OnInit, OnChanges, OnDestroy {


  authService    = inject(AuthService);
  router         = inject(Router);
  brandingState  = inject(BrandingStateService);
  readonly currentYear = new Date().getFullYear();
  checked          = signal(true);
  user             = signal<User | null>(null);
  sidebarCollapsed = signal(false);

  toggleSidebar() { this.sidebarCollapsed.update(v => !v); }
  _profile = signal<Profile | null>(null);
  selectedLanguage = signal("es");
  selectedCurrency = signal("PEN");
  title_services = signal("Ninguno");

  _servicesService  = inject(ServicesService);
  _usersService     = inject(UsersService);
  _messagesService  = inject(ClientMessagesService);
  _socketSvc        = inject(SocketService);
  _messagesState    = inject(MessagesStateService);
  private soundSvc  = inject(SoundService);
  private localeService = inject(LocaleService);
  ListServices      = signal<ServicesEntity[]>([]);
  msgUnreadCount    = signal(0);
  msgPreview        = signal<any[]>([]);

  private subs = new Subscription();

  ngOnInit(): void {
    this.localeService.loadTranslations();
    // Cierra el drawer en móvil después de cada navegación
    this.subs.add(
      this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
        const el = document.getElementById('sidebar') as HTMLInputElement;
        if (el) el.checked = false;
      })
    );
    this.fillMyProfile();
    this._messagesService.getUnreadCount().subscribe({
      next: r => this.msgUnreadCount.set(r.data?.count ?? 0),
      error: () => {}
    });
    this._messagesService.getPreview().subscribe({
      next: r => this.msgPreview.set(r.data ?? []),
      error: () => {}
    });
    this._socketSvc.connect();
    this.listenSockets();
    // Reintento de seguridad: si el socket no quedó conectado (token tardío),
    // volvemos a intentar al cabo de 1 s cuando el token ya estará disponible
    setTimeout(() => {
      if (!this._socketSvc.isConnected) this._socketSvc.connect();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this._socketSvc.disconnect();
  }

  private listenSockets(): void {
    // Nuevo mensaje del admin → actualiza campana en tiempo real
    this.subs.add(
      this._socketSvc.onNewMessageForUser().subscribe(msg => {
        this.soundSvc.playMessage();
        this.msgUnreadCount.update(n => n + 1);
        this.msgPreview.update(list => [
          { id: msg.message_id, from_name: msg.from_name, subject: msg.subject, body: msg.preview, createdAt: msg.createdAt },
          ...list.slice(0, 4),
        ]);
      })
    );

    // Mensaje leído → eliminarlo de la lista de la campana
    this.subs.add(
      this._messagesState.messageRead$.subscribe(id => {
        this.msgPreview.update(list => list.filter(m => m.id !== id));
      })
    );

    // Mensaje leído → decrementar el contador del badge de la campana
    this.subs.add(
      this._messagesState.unreadDecrement$.subscribe(() => {
        this.msgUnreadCount.update(n => Math.max(0, n - 1));
      })
    );

    // El admin cerró la sesión → forzar logout inmediato
    this.subs.add(
      this._socketSvc.onSessionKicked().subscribe(() => {
        this.authService.logout();
        this.router.navigateByUrl('/');
      })
    );

    // El admin suspendió o bloqueó la cuenta → forzar logout
    this.subs.add(
      this._socketSvc.onUserUpdated().subscribe(evt => {
        if (evt.state === 'Suspendido' || evt.state === 'Bloqueado') {
          this.authService.logout();
          this.router.navigateByUrl('/');
        }
      })
    );
  }

  /** Returns true if any of the given routes matches the current URL (prefix match). */
  isGroupActive(routes: string[]): boolean {
    const url = this.router.url.split('?')[0];
    return routes.some(r => url === r || url.startsWith(r + '/'));
  }

  onNotificationClick(msg: any): void {
    // Update UI immediately — don't wait for the API response
    this.msgPreview.update(list => list.filter(m => m.id !== msg.id));
    this.msgUnreadCount.update(n => Math.max(0, n - 1));
    this._messagesState.markAsRead(msg.id);
    this._messagesState.decrementUnread();

    // Persist read state in the server (fire and forget)
    this._messagesService.markRead(msg.id).subscribe();

    // Close DaisyUI dropdown by removing focus
    (document.activeElement as HTMLElement)?.blur();

    // Navigate to the messages page and pass the id to auto-open
    this.router.navigate(['/client/messages'], { queryParams: { open: msg.id } });
  }

  overflowServiceNames(): string {
    return (this._profile()?.services ?? []).slice(3).map((s: any) => s.service_sortName).join(', ');
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
 ngOnChanges(changes: SimpleChanges): void {

    // const DoesntService = this.ListServices().filter(p => this.user()?.services.find(d => d.service_id == p.id))
    // console.log("DoesntService: ", DoesntService)

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

   fillMyProfile() {
      this._usersService.getMe().subscribe((resp) => {
        // console.log("_usersService getMe: ", resp)
        this._profile.set(resp.data ?? null)
        this.title_services.set(""+this._profile()?.services.map((p: any) => p?.service_sortName).join(" | "))
        if(this._profile()?.services?.length == 0) {
          const dialog = document.getElementById('view_select_plans') as HTMLDialogElement;
          console.log("dialog: ", dialog)
          dialog?.showModal();
        }
    //     const DoesntService = this.ListServices().filter(p => this._profile()?.services.find((d: any) => d.service_id == p.id))
    // console.log("DoesntService: ", DoesntService)

    // console.log("profile: ", this._usersService.profile())
      })
    }
  fillListUsers() {
      // this._servicesService.get().subscribe((resp) => {
      //   console.log("_servicesService get: ", resp)
      //   this.ListServices.set(resp.data ?? [])
      // })
    }
}
