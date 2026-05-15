import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import UserEntity from '../../interfaces/user.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import { environment } from '../../../../environments/environment';
import PlanClientDto from '../../interfaces/planClient.interface';

const baseUrl = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);

  // ── List / Read ───────────────────────────────────────────────────────────

  getUsers(aggregate?: any[]): Observable<ResponseEntity<UserEntity[]>> {
    return this.http.post<ResponseEntity<UserEntity[]>>(baseUrl + '/admin/clients', { aggregate });
  }

  getUser(id: string): Observable<ResponseEntity<UserEntity>> {
    return this.http.get<ResponseEntity<UserEntity>>(baseUrl + `/admin/clients/${id}`);
  }

  // ── Create ────────────────────────────────────────────────────────────────

  register(data: UserEntity): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/admin/clients/register', data);
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  edit(id: string, data: Partial<UserEntity>): Observable<ResponseEntity<any>> {
    return this.http.put<ResponseEntity<any>>(baseUrl + `/admin/clients/${id}`, data);
  }

  // ── State actions ─────────────────────────────────────────────────────────

  verify(id: string): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + `/admin/clients/${id}/verify`, {});
  }

  suspend(id: string, reason?: string): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + `/admin/clients/${id}/suspend`, { reason });
  }

  reactivate(id: string): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + `/admin/clients/${id}/reactivate`, {});
  }

  delete(id: string): Observable<ResponseEntity<any>> {
    return this.http.delete<ResponseEntity<any>>(baseUrl + `/admin/clients/${id}`);
  }

  // ── Services assignment ───────────────────────────────────────────────────

  updateServices(data: { user_id: string; services: PlanClientDto[] }): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + `/admin/clients/${data.user_id}/services`, { services: data.services });
  }

  kickSession(id: string): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + `/admin/clients/${id}/kick-session`, {});
  }

  /** Consumo de tráfico S-UI por usuario: Record<userId, { gb_usado, gb_total }> */
  getVpnUsage(): Observable<ResponseEntity<Record<string, { gb_usado: number; gb_total: number }>>> {
    return this.http.get<ResponseEntity<Record<string, { gb_usado: number; gb_total: number }>>>(
      baseUrl + '/admin/clients/vpn-usage'
    );
  }
}
