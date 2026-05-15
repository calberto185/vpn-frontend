import {
  Component, inject, signal, HostListener, OnInit, OnDestroy
} from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, of } from 'rxjs';
import { UsersService } from '../../services/users/users.service';

export interface SearchResult {
  type: 'nav' | 'user';
  label: string;
  sublabel: string;
  route: string;
  queryParams?: Record<string, any>;
  initials?: string;
  extra?: string;
}

const NAV_ITEMS: Omit<SearchResult, 'type'>[] = [
  { label: 'Clientes',            sublabel: 'Sección · Clientes',            route: '/panel/users' },
  { label: 'Dispositivos',        sublabel: 'Sección · Clientes',            route: '/panel/devices' },
  { label: 'Certificados',        sublabel: 'Sección · Clientes',            route: '/panel/certificates' },
  { label: 'Pagos',               sublabel: 'Sección · Operaciones',         route: '/panel/payments' },
  { label: 'Actividad',           sublabel: 'Sección · Operaciones',         route: '/panel/activity' },
  { label: 'Servidores',          sublabel: 'Sección · Administración',      route: '/panel/servers' },
  { label: 'Roles y Permisos',    sublabel: 'Sección · Administración',      route: '/panel/roles' },
  { label: 'Mensajes',            sublabel: 'Sección · Comunicación',        route: '/panel/messages' },
  { label: 'Planes',              sublabel: 'Config. · Producto',            route: '/panel/settings/plans' },
  { label: 'Servicios',           sublabel: 'Config. · Producto',            route: '/panel/settings/services' },
  { label: 'Aplicaciones',        sublabel: 'Config. · Producto',            route: '/panel/settings/apps' },
  { label: 'Retiros de Dinero',    sublabel: 'Sección · Operaciones',         route: '/panel/withdrawals' },
  { label: 'Proveedores',         sublabel: 'Config. · Finanzas',            route: '/panel/settings/suppliers' },
  { label: 'Cuentas Bancarias',   sublabel: 'Config. · Finanzas',            route: '/panel/settings/bank-accounts' },
  { label: 'Monedas',             sublabel: 'Config. · Finanzas',            route: '/panel/settings/finance/currencies' },
  { label: 'Configuración General', sublabel: 'Config. · Sistema',           route: '/panel/settings/general' },
  { label: 'Notificaciones',      sublabel: 'Config. · Sistema',             route: '/panel/settings/notifications' },
  { label: 'Traducciones',        sublabel: 'Config. · Contenido',           route: '/panel/settings/translations' },
  { label: 'Branding y Marca',    sublabel: 'Config. · Marca',               route: '/panel/settings/branding' },
  { label: 'Mi Perfil',           sublabel: 'Cuenta',                        route: '/panel/profile' },
];

@Component({
  selector: 'app-admin-global-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-global-search.component.html',
})
export class AdminGlobalSearchComponent implements OnInit, OnDestroy {
  private router  = inject(Router);
  private usersSvc = inject(UsersService);

  isOpen      = signal(false);
  queryValue  = '';
  loading     = signal(false);
  activeIndex = signal(-1);

  navResults  = signal<SearchResult[]>([]);
  userResults = signal<SearchResult[]>([]);
  allResults  = signal<SearchResult[]>([]);

  private querySubject = new Subject<string>();
  private subs = new Subscription();

  ngOnInit(): void {
    this.subs.add(
      this.querySubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q => {
          if (!q.trim() || q.trim().length < 2) {
            this.userResults.set([]);
            this.loading.set(false);
            this.rebuildAllResults();
            return of(null);
          }
          this.loading.set(true);
          return this.usersSvc.getUsers([
            { $match: { $or: [
              { firstNames:  { $regex: q.trim(), $options: 'i' } },
              { lastNames:   { $regex: q.trim(), $options: 'i' } },
              { email:       { $regex: q.trim(), $options: 'i' } },
            ]}},
            { $limit: 5 },
          ]).pipe(catchError(() => of(null)));
        })
      ).subscribe(resp => {
        this.loading.set(false);
        if (resp?.data) {
          this.userResults.set(
            resp.data.map(u => ({
              type:       'user' as const,
              label:      `${u.firstNames} ${u.lastNames}`.trim() || u.email,
              sublabel:   u.email,
              route:      '/panel/users',
              queryParams: { id: u.id },
              initials:   ((u.firstNames?.[0] ?? '') + (u.lastNames?.[0] ?? '')).toUpperCase() || '?',
              extra:      u.state,
            }))
          );
        } else {
          this.userResults.set([]);
        }
        this.rebuildAllResults();
      })
    );
  }

  ngOnDestroy(): void { this.subs.unsubscribe(); }

  private filterNav(q: string): SearchResult[] {
    const term = q.toLowerCase().trim();
    if (!term) return NAV_ITEMS.slice(0, 8).map(r => ({ ...r, type: 'nav' as const }));
    return NAV_ITEMS
      .filter(r => r.label.toLowerCase().includes(term) || r.sublabel.toLowerCase().includes(term))
      .map(r => ({ ...r, type: 'nav' as const }));
  }

  private rebuildAllResults(): void {
    const nav = this.filterNav(this.queryValue);
    this.navResults.set(nav);
    this.allResults.set([...nav, ...this.userResults()]);
    this.activeIndex.set(-1);
  }

  open(): void {
    this.isOpen.set(true);
    this.queryValue = '';
    this.userResults.set([]);
    this.rebuildAllResults();
    setTimeout(() => (document.getElementById('gs-input') as HTMLInputElement)?.focus(), 50);
  }

  close(): void {
    this.isOpen.set(false);
    this.queryValue = '';
    this.navResults.set([]);
    this.userResults.set([]);
    this.allResults.set([]);
    this.activeIndex.set(-1);
  }

  onInput(): void {
    this.querySubject.next(this.queryValue);
    // Immediate nav filter
    const nav = this.filterNav(this.queryValue);
    this.navResults.set(nav);
    this.allResults.set([...nav, ...this.userResults()]);
    this.activeIndex.set(-1);
  }

  onKeydown(event: KeyboardEvent): void {
    const results = this.allResults();
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update(i => Math.min(i + 1, results.length - 1));
        this.scrollActiveIntoView();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update(i => Math.max(i - 1, 0));
        this.scrollActiveIntoView();
        break;
      case 'Enter':
        event.preventDefault();
        const idx = this.activeIndex();
        const target = idx >= 0 ? results[idx] : results[0];
        if (target) this.navigate(target);
        break;
      case 'Escape':
        this.close();
        break;
    }
  }

  private scrollActiveIntoView(): void {
    setTimeout(() => {
      document.querySelector('.gs-item-active')?.scrollIntoView({ block: 'nearest' });
    });
  }

  navigate(result: SearchResult): void {
    this.close();
    if (result.queryParams) {
      this.router.navigate([result.route], { queryParams: result.queryParams });
    } else {
      this.router.navigateByUrl(result.route);
    }
  }

  stateClass(state: string | undefined): string {
    const map: Record<string, string> = {
      Activo:     'badge-success',
      Pendiente:  'badge-warning',
      Suspendido: 'badge-error',
      Bloqueado:  'badge-error',
    };
    return map[state ?? ''] ?? 'badge-ghost';
  }

  @HostListener('window:keydown', ['$event'])
  onGlobalKey(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      this.isOpen() ? this.close() : this.open();
    }
  }
}
