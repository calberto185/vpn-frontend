import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

export interface SuiPoolServer {
  id:   string;
  name: string;
  host: string;
}

export interface SuiClientRaw {
  id:         number;
  email:      string;
  enable:     boolean;
  up:         number;
  down:       number;
  total:      number;
  expiryTime: number;
  remark?:    string;
  flow?:      string;
}

export interface SuiSyncResult {
  serverId:  string;
  total:     number;
  huerfanos: SuiClientRaw[];
}

@Injectable({ providedIn: 'root' })
export class SuiService {
  private http = inject(HttpClient);

  // ─── Pool ─────────────────────────────────────────────────────────────────

  poolStatus(): Observable<ResponseEntity<{ servers: SuiPoolServer[]; count: number }>> {
    return this.http.get<ResponseEntity<{ servers: SuiPoolServer[]; count: number }>>(baseUrl + '/sui/pool/status');
  }

  refreshPool(): Observable<ResponseEntity<{ ok: boolean; count: number }>> {
    return this.http.post<ResponseEntity<{ ok: boolean; count: number }>>(baseUrl + '/sui/pool/refresh', {});
  }

  // ─── Clients — read ───────────────────────────────────────────────────────

  listarClientes(serverId: string): Observable<ResponseEntity<SuiClientRaw[]>> {
    return this.http.post<ResponseEntity<SuiClientRaw[]>>(baseUrl + '/sui/clientes/listar', { serverId });
  }

  listarClientesTodos(): Observable<ResponseEntity<{ serverId: string; clientes: SuiClientRaw[] }[]>> {
    return this.http.post<ResponseEntity<{ serverId: string; clientes: SuiClientRaw[] }[]>>(baseUrl + '/sui/clientes/todos', {});
  }

  statsCliente(serverId: string, email: string): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/sui/clientes/stats', { serverId, email });
  }

  // ─── Clients — write ──────────────────────────────────────────────────────

  crearCliente(data: {
    serverId: string;
    email: string;
    gbLimite: number;
    dias: number;
    dispositivos?: number;
    desc?: string;
    userId?: string;
    serviceId?: string;
    planId?: string;
  }): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/sui/clientes/crear', data);
  }

  renovarCliente(data: {
    serverId: string;
    clientId: string | number;
    gbLimite: number;
    dias: number;
    xuiConfig?: any;
  }): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/sui/clientes/renovar', data);
  }

  suspenderCliente(data: {
    serverId: string;
    clientId: string | number;
    xuiConfig?: any;
  }): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/sui/clientes/suspender', data);
  }

  reactivarCliente(data: {
    serverId: string;
    clientId: string | number;
    xuiConfig?: any;
  }): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/sui/clientes/reactivar', data);
  }

  eliminarCliente(data: {
    serverId: string;
    clientId: string | number;
    xuiConfig?: any;
  }): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/sui/clientes/eliminar', data);
  }

  // ─── Sync ─────────────────────────────────────────────────────────────────

  sincronizar(): Observable<{ message: string; data: SuiSyncResult[] }> {
    return this.http.post<{ message: string; data: SuiSyncResult[] }>(baseUrl + '/sui/sincronizar', {});
  }
}
