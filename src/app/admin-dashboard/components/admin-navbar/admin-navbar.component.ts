import { Component, computed, inject, signal, OnInit, OnDestroy, HostListener, ElementRef } from '@angular/core';
import { NgClass, CommonModule } from '@angular/common';
import { AuthService } from '../../../auth/services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { SocketService } from '../../../shared/services/socket.service';
import { AdminMessagesService } from '../../services/messages/messages.service';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface SearchResults {
  users:        any[];
  payments:     any[];
  certificates: any[];
}

@Component({
  selector: 'app-admin-navbar',
  imports: [NgClass, RouterLink, CommonModule],
  templateUrl: './admin-navbar.component.html',
  styleUrl: './admin-navbar.component.css'
})
export class AdminNavbarComponent implements OnInit, OnDestroy {
  authService  = inject(AuthService);
  router       = inject(Router);
  socketSvc    = inject(SocketService);
  messagesSvc  = inject(AdminMessagesService);
  private http = inject(HttpClient);
  private el   = inject(ElementRef);

  checked      = signal(true);
  wsOnline     = signal(false);
  unreadCount  = signal(0);

  // ── Global search ──────────────────────────────────────────────────────────
  searchQuery    = signal('');
  searchResults  = signal<SearchResults | null>(null);
  searchLoading  = signal(false);
  searchOpen     = signal(false);
  private search$ = new Subject<string>();

  hasResults = computed(() => {
    const r = this.searchResults();
    if (!r) return false;
    return r.users.length + r.payments.length + r.certificates.length > 0;
  });

  private sub = new Subscription();

  ngOnInit(): void {
    // Sondeo del estado WS cada 3 segundos
    this.sub.add(
      interval(3000).subscribe(() => this.wsOnline.set(this.socketSvc.isConnected))
    );
    this.wsOnline.set(this.socketSvc.isConnected);

    // Carga inicial del contador de mensajes no leídos
    this._loadUnreadCount();

    // Actualizar badge cuando llega un mensaje nuevo vía WS
    this.sub.add(
      this.socketSvc.onNewMessageForAdmin().subscribe(() => {
        this.unreadCount.update(n => n + 1);
      })
    );

    // Re-sincronizar con backend cada 60 segundos (por si se leyeron en otra pestaña)
    this.sub.add(
      interval(60_000).subscribe(() => this._loadUnreadCount())
    );

    // Global search debounce pipeline
    this.sub.add(
      this.search$.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q => {
          if (q.length < 2) {
            this.searchResults.set(null);
            this.searchLoading.set(false);
            return of(null);
          }
          this.searchLoading.set(true);
          return this.http.get<any>(`${environment.apiUrl}/admin/search?q=${encodeURIComponent(q)}`).pipe(
            catchError(() => of(null))
          );
        })
      ).subscribe(resp => {
        this.searchLoading.set(false);
        this.searchResults.set(resp?.data ?? null);
        this.searchOpen.set(true);
      })
    );
  }

  private _loadUnreadCount(): void {
    this.messagesSvc.getUnreadCount().subscribe({
      next: r => this.unreadCount.set(r?.data ?? r?.count ?? 0),
      error: () => { /* silencioso — badge queda en 0 */ },
    });
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  onSearchInput(value: string) {
    this.searchQuery.set(value);
    this.search$.next(value);
    if (!value) this.searchOpen.set(false);
  }

  closeSearch() {
    this.searchOpen.set(false);
  }

  navigateToResult(type: 'user' | 'payment' | 'certificate', item: any) {
    this.closeSearch();
    this.searchQuery.set('');
    this.searchResults.set(null);
    if (type === 'user')        this.router.navigate(['/admin-dashboard/users'],        { queryParams: { id: item.id } });
    if (type === 'payment')     this.router.navigate(['/panel/messages'],              { queryParams: { payment_id: item.id } });
    if (type === 'certificate') this.router.navigate(['/admin-dashboard/certificates'], { queryParams: { id: item.id } });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent) {
    if (!this.el.nativeElement.contains(e.target)) {
      this.closeSearch();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      (document.getElementById('global-search') as HTMLInputElement)?.focus();
      this.searchOpen.set(!!this.searchResults());
    }
    if (e.key === 'Escape') {
      this.closeSearch();
    }
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
