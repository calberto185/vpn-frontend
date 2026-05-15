import { Component, computed, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppError, AppErrorType, LoadingService } from '../../services/loading.service';

@Component({
  selector: 'app-error-overlay',
  imports: [],
  templateUrl: './error-overlay.component.html',
  styleUrl:    './error-overlay.component.css',
})
export class ErrorOverlayComponent {

  private ui     = inject(LoadingService);
  private router = inject(Router);

  readonly error   = computed(() => this.ui.appError());
  readonly visible = computed(() => this.error() !== null);

  onAction(): void {
    const err = this.error();
    if (!err) return;
    if (err.action) {
      err.action();
    }
    this.ui.clearError();
  }

  onDismiss(): void {
    const err = this.error();
    if (!err) return;
    // Solo cierra si el error es dismissible (no session_expired ni network grave)
    if (err.type !== 'session_expired' && err.type !== 'network' && err.type !== 'server') {
      this.ui.clearError();
    }
  }

  iconConfig(type: AppErrorType): { color: string; bg: string; badge: string } {
    const map: Record<AppErrorType, { color: string; bg: string; badge: string }> = {
      error:           { color: '#ef4444', bg: '#fef2f2', badge: 'bg-red-50 text-red-600 border-red-200'    },
      server:          { color: '#dc2626', bg: '#fff1f2', badge: 'bg-red-50 text-red-700 border-red-200'    },
      network:         { color: '#6366f1', bg: '#eef2ff', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      forbidden:       { color: '#f59e0b', bg: '#fffbeb', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
      notfound:        { color: '#8b5cf6', bg: '#f5f3ff', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
      session_expired: { color: '#0ea5e9', bg: '#f0f9ff', badge: 'bg-sky-50 text-sky-700 border-sky-200'   },
    };
    return map[type] ?? map['error'];
  }
}
