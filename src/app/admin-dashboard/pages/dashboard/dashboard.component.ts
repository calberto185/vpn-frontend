import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe, CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription, debounceTime, Subject, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { SocketService } from '../../../shared/services/socket.service';
import { PermissionsService } from '../../services/permissions/permissions.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ActivityService, BinnacleEntry } from '../../services/activity/activity.service';
import { FinanceService } from '../../services/finance/finance.service';

interface AdminStats {
  clientes:   { total: number; activos: number; suspendidos: number; pendientes: number };
  pagos:      { pendientes: number };
  devices:    { activos: number };
  vencen_7d:  number;
  servidores: { activos: number };
  generado_en: string;
}

interface MonthlyRevenue { month: number; revenue: number; }
interface FinanceSummary { totalRevenue: number; totalExpenses: number; net: number; currency: string; }

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, DecimalPipe, CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private http        = inject(HttpClient);
  private socketSvc   = inject(SocketService);
  private authSvc     = inject(AuthService);
  private activitySvc = inject(ActivityService);
  private financeSvc  = inject(FinanceService);
  permissions         = inject(PermissionsService);

  // ── Permission gates ──────────────────────────────────────────────────────
  canView        = computed(() => this.permissions.canDo('dashboard', 'view'));
  canSeeUsers    = computed(() => this.permissions.canDo('users',    'view'));
  canSeePayments = computed(() => this.permissions.canDo('payments', 'view'));
  canSeeServers  = computed(() => this.permissions.canAccess('servers') || this.permissions.canAccess('settings/servers'));
  canSeeActivity = computed(() => this.permissions.canDo('activity', 'view'));
  canSeeFinance  = computed(() => this.permissions.canDo('payments', 'view'));

  // ── Data ──────────────────────────────────────────────────────────────────
  user            = computed(() => this.authSvc.user());
  stats           = signal<AdminStats | null>(null);
  recentActivity  = signal<BinnacleEntry[]>([]);
  monthlyRevenue  = signal<MonthlyRevenue[]>([]);
  financeSummary  = signal<FinanceSummary | null>(null);
  loading         = signal(true);
  loadingActivity = signal(false);
  loadingFinance  = signal(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  currentYear = new Date().getFullYear();
  greeting    = computed(() => {
    const h = new Date().getHours();
    const name = this.user()?.firstNames?.split(' ')[0] ?? 'Admin';
    if (h < 12) return `Buenos días, ${name}`;
    if (h < 18) return `Buenas tardes, ${name}`;
    return `Buenas noches, ${name}`;
  });

  private subs     = new Subscription();
  private refresh$ = new Subject<void>();

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    if (!this.canView()) { this.loading.set(false); return; }
    this.loadAll();

    this.subs.add(
      this.refresh$.pipe(debounceTime(800)).subscribe(() => this.loadStats())
    );
    this.subs.add(this.socketSvc.onPaymentUpdated().subscribe(() => this.refresh$.next()));
    this.subs.add(this.socketSvc.onUserUpdated().subscribe(() => this.refresh$.next()));
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.refresh$.complete();
  }

  // ── Data loaders ──────────────────────────────────────────────────────────
  private loadAll(): void {
    this.loadStats();
    if (this.canSeeActivity()) this.loadActivity();
    if (this.canSeeFinance())  this.loadFinance();
  }

  private loadStats(): void {
    this.http.get<{ data: AdminStats }>(`${environment.apiUrl}/admin/stats`)
      .subscribe({
        next:  (r) => { this.stats.set(r.data); this.loading.set(false); },
        error: ()  => this.loading.set(false),
      });
  }

  private loadActivity(): void {
    this.loadingActivity.set(true);
    this.activitySvc.getBinnacle(1, 6).pipe(catchError(() => of({ data: [] } as any)))
      .subscribe(r => {
        this.recentActivity.set(r.data ?? []);
        this.loadingActivity.set(false);
      });
  }

  private loadFinance(): void {
    this.loadingFinance.set(true);
    forkJoin({
      monthly: this.financeSvc.revenueMonthly(this.currentYear).pipe(catchError(() => of({ data: [] }))),
      summary: this.financeSvc.summary(this.currentYear).pipe(catchError(() => of({ data: null }))),
    }).subscribe(({ monthly, summary }) => {
      this.monthlyRevenue.set(monthly?.data ?? []);
      this.financeSummary.set(summary?.data ?? null);
      this.loadingFinance.set(false);
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  /** Returns a bar height % for a monthly revenue bar (0–100). */
  barHeight(month: MonthlyRevenue): number {
    const all = this.monthlyRevenue();
    if (!all.length) return 0;
    const max = Math.max(...all.map(m => m.revenue));
    return max > 0 ? Math.round((month.revenue / max) * 100) : 0;
  }

  monthLabel(m: number): string {
    return ['E','F','M','A','M','J','J','A','S','O','N','D'][m - 1] ?? '';
  }

  activityIcon(action: string): string {
    if (action.includes('login'))   return '🔑';
    if (action.includes('create'))  return '➕';
    if (action.includes('update'))  return '✏️';
    if (action.includes('delete'))  return '🗑️';
    if (action.includes('payment')) return '💳';
    if (action.includes('kick'))    return '🚪';
    return '📋';
  }

  activityResultClass(result: 'success' | 'error'): string {
    return result === 'success' ? 'badge-success' : 'badge-error';
  }

  /** Progress percentage for client states */
  pct(value: number, total: number): number {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }
}
