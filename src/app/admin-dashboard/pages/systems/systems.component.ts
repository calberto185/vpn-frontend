import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { PermissionsService } from '../../services/permissions/permissions.service';
import { AdminAccountService } from '../../services/account/account.service';
import { Subscription, interval } from 'rxjs';

const baseUrl = environment.apiUrl;

@Component({
  selector: 'app-systems',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './systems.component.html',
  styleUrl: './systems.component.css',
})
export class SystemsComponent implements OnInit, OnDestroy {

  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions  = inject(PermissionsService);
  private accountSvc   = inject(AdminAccountService);
  canView   = computed(() => this.permissions.canDo('systems', 'view'));
  canCreate = computed(() => this.permissions.canDo('systems', 'create'));
  canUpdate = computed(() => this.permissions.canDo('systems', 'update'));
  canDelete = computed(() => this.permissions.canDo('systems', 'delete'));

  private http = inject(HttpClient);
  private fb   = inject(FormBuilder);
  private subs = new Subscription();

  // ── State ─────────────────────────────────────────────────────────────────
  cronRunning   = signal<string | null>(null);
  lastResult    = signal<{ job: string; msg: string; ok: boolean } | null>(null);
  toast         = signal<{ msg: string; ok: boolean } | null>(null);
  appToken      = signal<string | null>(null);
  appTokenLabel = signal<string | null>(null);
  healthData    = signal<any | null>(null);
  healthLoading = signal(false);

  // ── App Tokens list ───────────────────────────────────────────────────────
  appTokensList   = signal<any[]>([]);
  tokensLoading   = signal(false);
  revokingTokenId = signal<string | null>(null);

  tokenForm = this.fb.group({
    host:        ['', Validators.required],
    port:        [443],
    countryName: [''],
    countryCode: [''],
    label:       [''],
  });

  ngOnInit() {
    if (this.canView()) {
      this.loadHealth();
      this.loadAppTokens();
      // Auto-refresh métricas cada 30s
      this.subs.add(
        interval(30_000).subscribe(() => {
          if (this.canView()) this.loadHealth();
        })
      );
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  // ── Health metrics ────────────────────────────────────────────────────────

  loadHealth() {
    this.healthLoading.set(true);
    this.http.get<{ status: number; data: any }>(baseUrl + '/system/health').subscribe({
      next:  r => { this.healthData.set(r.data ?? null); this.healthLoading.set(false); },
      error: () => { this.healthLoading.set(false); },
    });
  }

  memPct(used: number, total: number): number {
    if (!total) return 0;
    return Math.round((used / total) * 100);
  }

  // ── Cron triggers ─────────────────────────────────────────────────────────

  runCron(job: 'sync' | 'recordatorios' | 'suspender' | 'resumen') {
    this.cronRunning.set(job);
    this.http.post<{ code: string; message: string }>(baseUrl + `/workflows/cron/${job}`, {}).subscribe({
      next:  resp => {
        this.cronRunning.set(null);
        this.lastResult.set({ job, msg: resp.message, ok: true });
        this.showToast(resp.message, true);
      },
      error: err  => {
        this.cronRunning.set(null);
        const msg = err?.error?.message ?? `Error en ${job}`;
        this.lastResult.set({ job, msg, ok: false });
        this.showToast(msg, false);
      },
    });
  }

  // ── App token ─────────────────────────────────────────────────────────────

  generateToken() {
    if (this.tokenForm.invalid) return;
    this.http.post<{ data: { id: string; token: string; label: string } }>(
      baseUrl + '/system/app/token', this.tokenForm.value
    ).subscribe({
      next: resp => {
        this.appToken.set(resp.data?.token ?? null);
        this.appTokenLabel.set(resp.data?.label ?? null);
        this.showToast('Token generado', true);
        this.loadAppTokens();
        this.tokenForm.reset({ port: 443 });
      },
      error: err => this.showToast(err?.error?.message ?? 'Error al generar token', false),
    });
  }

  copyToken() {
    const t = this.appToken();
    if (!t) return;
    navigator.clipboard.writeText(t).then(() => this.showToast('Token copiado', true));
  }

  // ── App Tokens list ───────────────────────────────────────────────────────

  loadAppTokens() {
    this.tokensLoading.set(true);
    this.accountSvc.listAppTokens().subscribe({
      next:  r => { this.appTokensList.set(r.data ?? []); this.tokensLoading.set(false); },
      error: () => this.tokensLoading.set(false),
    });
  }

  revokeToken(id: string) {
    this.revokingTokenId.set(id);
    this.accountSvc.revokeAppToken(id).subscribe({
      next: () => {
        this.revokingTokenId.set(null);
        this.showToast('Token revocado', true);
        this.loadAppTokens();
        // Limpiar token mostrado si era el mismo
        this.appToken.set(null);
        this.appTokenLabel.set(null);
      },
      error: err => {
        this.revokingTokenId.set(null);
        this.showToast(err?.error?.message ?? 'Error al revocar token', false);
      },
    });
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
