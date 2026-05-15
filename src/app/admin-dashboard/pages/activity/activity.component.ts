import { Component, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivityService, BinnacleEntry, SessionEntry } from '../../services/activity/activity.service';
import { PermissionsService } from '../../services/permissions/permissions.service';
import { SocketService } from '../../../shared/services/socket.service';
import { Subscription } from 'rxjs';

type Tab = 'binnacle' | 'sessions';

@Component({
  selector: 'app-activity',
  imports: [CommonModule, DatePipe, ReactiveFormsModule],
  templateUrl: './activity.component.html',
  styleUrl: './activity.component.css',
})
export class ActivityComponent implements OnInit, OnDestroy {

  private permissions = inject(PermissionsService);
  canCreate = computed(() => this.permissions.canDo('activity', 'create'));
  canUpdate = computed(() => this.permissions.canDo('activity', 'update'));
  canDelete = computed(() => this.permissions.canDo('activity', 'delete'));

  private svc       = inject(ActivityService);
  private socketSvc = inject(SocketService);
  private fb        = inject(FormBuilder);
  private subs      = new Subscription();

  // Badge: entradas nuevas recibidas por WS mientras el admin está en otra pestaña
  newBinnacleCount = signal(0);

  activeTab = signal<Tab>('sessions');
  readonly LIMIT = 20;

  // ── Binnacle ───────────────────────────────────────────────────────────────
  binnacle        = signal<BinnacleEntry[]>([]);
  binnacleTotal   = signal(0);
  binnaclePage    = signal(1);
  loadingBinnacle = signal(false);

  binFilter = this.fb.group({
    action:  [''],
    actorId: [''],
    result:  [''],
    from:    [''],
    to:      [''],
  });

  binnaclePages = computed(() => Math.ceil(this.binnacleTotal() / this.LIMIT) || 1);

  binnaclePageNums = computed(() => {
    const total = this.binnaclePages();
    const cur   = this.binnaclePage();
    return this._pageNums(cur, total);
  });

  // ── Sessions ───────────────────────────────────────────────────────────────
  sessions        = signal<SessionEntry[]>([]);
  sessionsTotal   = signal(0);
  sessionsPage    = signal(1);
  loadingSessions = signal(false);

  sesFilter = this.fb.group({
    userId: [''],
    from:   [''],
    to:     [''],
  });

  sessionsPages = computed(() => Math.ceil(this.sessionsTotal() / this.LIMIT) || 1);

  sessionsPageNums = computed(() => {
    const total = this.sessionsPages();
    const cur   = this.sessionsPage();
    return this._pageNums(cur, total);
  });

  // ── Common ─────────────────────────────────────────────────────────────────
  toast = signal<{ msg: string; ok: boolean } | null>(null);

  ngOnInit() {
    this.loadSessions(1);
    this.loadBinnacle(1);

    // Tiempo real: prepend nuevas entradas de bitácora
    this.subs.add(
      this.socketSvc.onActivityNew().subscribe(entry => {
        // Solo en página 1 sin filtros activos
        if (this.binnaclePage() === 1 && !this.binFilter.value.action && !this.binFilter.value.actorId) {
          this.binnacle.update(list => {
            const newEntry = entry as unknown as BinnacleEntry;
            const updated  = [newEntry, ...list].slice(0, this.LIMIT);
            return updated;
          });
          this.binnacleTotal.update(t => t + 1);
        }
        // Si está en la pestaña de sesiones, incrementar badge
        if (this.activeTab() !== 'binnacle') {
          this.newBinnacleCount.update(n => n + 1);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  setTab(tab: Tab) {
    this.activeTab.set(tab);
    if (tab === 'binnacle') this.newBinnacleCount.set(0);
  }

  // ── Binnacle ───────────────────────────────────────────────────────────────
  loadBinnacle(page = 1) {
    this.loadingBinnacle.set(true);
    this.binnaclePage.set(page);
    const f = this.binFilter.value;
    this.svc.getBinnacle(page, this.LIMIT, {
      action:  f.action?.trim()  || undefined,
      actorId: f.actorId?.trim() || undefined,
      result:  f.result          || undefined,
      from:    f.from            || undefined,
      to:      f.to              || undefined,
    }).subscribe({
      next: r => {
        this.binnacle.set(r.data ?? []);
        this.binnacleTotal.set(r.total ?? 0);
        this.loadingBinnacle.set(false);
      },
      error: err => {
        this.loadingBinnacle.set(false);
        this.showToast(err?.error?.message ?? 'Error al cargar bitácora', false);
      },
    });
  }

  applyBinFilter()  { this.loadBinnacle(1); }
  clearBinFilter()  { this.binFilter.reset(); this.loadBinnacle(1); }

  // ── Sessions ───────────────────────────────────────────────────────────────
  loadSessions(page = 1) {
    this.loadingSessions.set(true);
    this.sessionsPage.set(page);
    const f = this.sesFilter.value;
    this.svc.getSessions(page, this.LIMIT, {
      userId: f.userId?.trim() || undefined,
      from:   f.from           || undefined,
      to:     f.to             || undefined,
    }).subscribe({
      next: r => {
        this.sessions.set(r.data ?? []);
        this.sessionsTotal.set(r.total ?? 0);
        this.loadingSessions.set(false);
      },
      error: err => {
        this.loadingSessions.set(false);
        this.showToast(err?.error?.message ?? 'Error al cargar sesiones', false);
      },
    });
  }

  applySesFilter() { this.loadSessions(1); }
  clearSesFilter() { this.sesFilter.reset(); this.loadSessions(1); }

  // ── Helpers ────────────────────────────────────────────────────────────────
  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }

  parseUserAgent(ua: string): { browser: string; os: string } {
    if (!ua) return { browser: '—', os: '—' };
    let browser = 'Otro';
    let os = 'Desconocido';
    if (/edg/i.test(ua))          browser = 'Edge';
    else if (/opr|opera/i.test(ua)) browser = 'Opera';
    else if (/chrome/i.test(ua))   browser = 'Chrome';
    else if (/firefox/i.test(ua))  browser = 'Firefox';
    else if (/safari/i.test(ua))   browser = 'Safari';
    if (/windows/i.test(ua))      os = 'Windows';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad/i.test(ua)) os = 'iOS';
    else if (/mac/i.test(ua))     os = 'macOS';
    else if (/linux/i.test(ua))   os = 'Linux';
    return { browser, os };
  }

  isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  activeSessions(): number {
    return this.sessions().filter(s => !this.isExpired(s.expiresAt)).length;
  }

  binnacleErrors(): number {
    return this.binnacle().filter(e => e.result === 'error').length;
  }

  roleClass(role: string): string {
    if (role === 'admin') return 'badge-warning';
    return 'badge-info';
  }

  /** Generates page number array with ellipsis: [1, '…', 4, 5, 6, '…', 10] */
  private _pageNums(cur: number, total: number): (number | '…')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '…')[] = [1];
    if (cur > 3) pages.push('…');
    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) pages.push(p);
    if (cur < total - 2) pages.push('…');
    pages.push(total);
    return pages;
  }
}
