/**
 * SocketService — WebSocket nativo (sin librerías externas)
 *
 * Conecta a /ws?token=<jwt> en el mismo servidor del backend.
 * Protocolo: JSON  { event: string, data: any }
 * Reconexión automática con backoff exponencial.
 */

import { Injectable, inject, NgZone, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { AuthService } from '../../auth/services/auth.service';
import { environment } from '../../../environments/environment';

// Derivar URL WS desde apiUrl: https://host/api → wss://host/ws
function buildWsUrl(token: string): string {
  const base = environment.apiUrl
    .replace(/\/api$/, '')         // quitar /api
    .replace(/^https/, 'wss')      // https → wss  (primero el más específico)
    .replace(/^http(?!s)/, 'ws');  // http  → ws   (solo si no es https)
  return `${base}/ws?token=${encodeURIComponent(token)}`;
}

interface WsMessage {
  event: string;
  data:  any;
}

@Injectable({ providedIn: 'root' })
export class SocketService implements OnDestroy {

  private auth   = inject(AuthService);
  private zone   = inject(NgZone);

  private ws:        WebSocket | null = null;
  private messages$  = new Subject<WsMessage>();
  private reconnectTimer: any = null;
  private retryCount  = 0;
  private maxRetries  = 10;
  private destroyed   = false;

  // ── Conexión ────────────────────────────────────────────────────────────────

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN ||
                    this.ws.readyState === WebSocket.CONNECTING)) return;

    const token = this.auth.token();
    if (!token) {
      console.warn('[WS] connect() llamado sin token — esperando autenticación');
      return;
    }

    // Resetear destroyed para que la reconexión automática funcione
    this.destroyed = false;

    // Ejecutar fuera de la zona de Angular para no disparar CD en cada frame
    this.zone.runOutsideAngular(() => {
      const wsUrl = buildWsUrl(token);
      console.log('[WS] Conectando a', wsUrl.replace(/token=.+$/, 'token=***'));
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.retryCount = 0;
        console.log('[WS] Conectado ✓');
        this.startPing();
      };

      this.ws.onmessage = (evt) => {
        try {
          const msg: WsMessage = JSON.parse(evt.data);
          // Volver a la zona para que Angular detecte cambios en señales/observables
          this.zone.run(() => this.messages$.next(msg));
        } catch (e) {
          console.warn('[WS] Mensaje no válido:', evt.data);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WS] Error de conexión:', err);
      };

      this.ws.onclose = (evt) => {
        console.log(`[WS] Desconectado — code=${evt.code} reason="${evt.reason}"`);
        this.stopPing();
        if (!this.destroyed) this.scheduleReconnect();
      };
    });
  }

  disconnect(): void {
    this.destroyed = true;
    this.stopPing();
    clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.retryCount = 0;
  }

  /** True si el socket está actualmente abierto */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ── Reconexión con backoff exponencial ────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.retryCount >= this.maxRetries) {
      console.warn('[WS] Máximo de reintentos alcanzado');
      return;
    }
    const delay = Math.min(1000 * 2 ** this.retryCount, 30000);
    this.retryCount++;
    console.log(`[WS] Reconectando en ${delay / 1000}s (intento ${this.retryCount}/${this.maxRetries})`);
    this.reconnectTimer = setTimeout(() => {
      this.ws = null;
      this.connect();
    }, delay);
  }

  // ── Ping / Pong ────────────────────────────────────────────────────────────

  private pingInterval: any = null;

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'ping' }));
      }
    }, 25000);
  }

  private stopPing(): void {
    clearInterval(this.pingInterval);
    this.pingInterval = null;
  }

  // ── Suscripción genérica ──────────────────────────────────────────────────

  on<T = any>(event: string): Observable<T> {
    return this.messages$.pipe(
      filter(msg => msg.event === event),
      map(msg => msg.data as T)
    );
  }

  // ── Envío de mensajes ─────────────────────────────────────────────────────

  /**
   * Sends a raw WS frame. Returns true if the socket was open, false otherwise.
   * Callers should handle the false case (e.g. fall back to HTTP or show error).
   */
  sendRaw(event: string, data: any): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ event, data }));
    return true;
  }

  /** ACK emitted by the server after processing a messages:send frame. */
  onSendAck() {
    return this.on<{
      correlationId: string | null;
      ok:            boolean;
      message_id?:   string;
      message?:      any;
      error?:        string;
    }>('messages:send:ack');
  }

  // ── Eventos tipados ───────────────────────────────────────────────────────

  onNewMessageForAdmin() {
    return this.on<{
      message_id:  string;
      thread_id:   string | null;
      reply_to_id: string | null;
      from_id:     string;
      from_name:   string;
      subject:     string;
      preview:     string;
      createdAt:   string;
    }>('messages:new-for-admin');
  }

  onNewMessageForUser() {
    return this.on<{
      message_id:  string;
      thread_id:   string | null;
      reply_to_id: string | null;
      from_name:   string;
      subject:     string;
      preview:     string;
      createdAt:   string;
    }>('messages:new-for-user');
  }

  onPaymentUpdated() {
    return this.on<{ payment_id: string; state: string; user_id: string; amount?: number; updatedAt: string }>('payment:updated');
  }

  onUserUpdated() {
    return this.on<{ user_id: string; state: string; verified?: boolean; suspend?: boolean; updatedAt: string }>('user:updated');
  }

  onUserOnline() {
    return this.on<{ user_id: string; connectedAt: string }>('user:online');
  }

  onUserOffline() {
    return this.on<{ user_id: string; disconnectedAt: string }>('user:offline');
  }

  onWithdrawalNew() {
    return this.on<{
      id: string; type: string; recipient: string;
      amount: number; currency: string; state: string; createdAt: string;
    }>('withdrawal:new');
  }

  onActivityNew() {
    return this.on<{
      id: string; action: string; actorId: string; actorEmail: string;
      targetId: string; targetType: string; result: 'success' | 'error'; createdAt: string;
    }>('activity:new');
  }

  onSessionKicked() {
    return this.on<{ reason: string }>('session:kicked');
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.messages$.complete();
  }
}
