import { Injectable, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export type AppErrorType =
  | 'error'          // genérico / inesperado
  | 'server'         // 500, 502, 503
  | 'network'        // sin conexión / timeout
  | 'forbidden'      // 403
  | 'notfound'       // 404
  | 'session_expired'; // 401 tras refresh fallido

export interface AppError {
  type: AppErrorType;
  title: string;
  message: string;
  actionLabel?: string;
  action?: () => void;
}

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface AppToast {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number; // ms, default 4000
}

// ── Servicio ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LoadingService {

  // ── Loading spinner ────────────────────────────────────────────────────────
  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

  // ── Error overlay (pantalla completa) ──────────────────────────────────────
  readonly appError = signal<AppError | null>(null);

  // ── Backward-compat: legacy error$ observable used by AppComponent ─────────
  private errorSubject = new BehaviorSubject<{ title?: string; message?: string; call?: Function } | null>(null);
  error$ = this.errorSubject.asObservable();

  // ── Toast stack (bottom-right) ─────────────────────────────────────────────
  readonly toasts = signal<AppToast[]>([]);

  // ── Loading ────────────────────────────────────────────────────────────────
  show()  { this.loadingSubject.next(true);  }
  hide()  { this.loadingSubject.next(false); }

  // ── Error overlay ──────────────────────────────────────────────────────────

  /** Nuevo: muestra overlay de pantalla completa con tipo semántico */
  showTypedError(err: AppError): void {
    this.appError.set(err);
    // Sync con legacy para AppComponent
    this.errorSubject.next({
      title:   err.title,
      message: err.message,
      call:    err.action,
    });
  }

  /** Legacy: mantiene compatibilidad con AuthService y código existente */
  showError(title: string, message: string, call?: Function): void {
    this.showTypedError({
      type:        'error',
      title,
      message,
      actionLabel: 'Reintentar',
      action:      call as (() => void) | undefined,
    });
  }

  clearError(): void {
    this.appError.set(null);
    this.errorSubject.next(null);
  }

  /** Muestra la pantalla de sesión expirada */
  showSessionExpired(onLogin: () => void): void {
    this.showTypedError({
      type:        'session_expired',
      title:       'Sesión expirada',
      message:     'Tu sesión ha caducado. Por favor, inicia sesión de nuevo para continuar.',
      actionLabel: 'Iniciar sesión',
      action:      onLogin,
    });
  }

  // ── Toast ──────────────────────────────────────────────────────────────────

  showToast(toast: Omit<AppToast, 'id'>): void {
    const id   = crypto.randomUUID();
    const item: AppToast = { id, duration: 4000, ...toast };
    this.toasts.update(list => [...list, item]);
    setTimeout(() => this.dismissToast(id), item.duration);
  }

  dismissToast(id: string): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  /** Atajos para los tipos más comunes */
  success(title: string, message = ''): void {
    this.showToast({ type: 'success', title, message });
  }

  warn(title: string, message = ''): void {
    this.showToast({ type: 'warning', title, message });
  }

  info(title: string, message = ''): void {
    this.showToast({ type: 'info', title, message });
  }
}
