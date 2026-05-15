import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import UserEntity from '../../interfaces/user.interface';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

export interface ClientServiceSnapshot {
  service_id:        string;
  service_sortName:  string;
  service_longName?: string;
  service_picture?:  string;
  plan_id:           string;
  startedAt:         string;
  endedAt:           string | null;
  dias_restantes:    number | null;
  [key: string]: any;
}

export interface ClientServiceStats {
  gb_usado:    number;
  gb_total:    number;
  gb_restante: number;
  expiry_date: string;
  sub_url:     string;
}

export interface ClientDevice {
  id:          string;
  plan_id?:    string;
  service_id:  string;
  protocol:    string;
  device:      string;
  typeDevice:  string;
  active:      boolean;
  suspend:     boolean;
  suspendAt:   string | null;
  createdAt:   string;
  sui_sub_id?: string;
  sui_email?:  string;
  sub_url?:    string | null;
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  private http = inject(HttpClient);

  /** GET /api/client/me — Perfil completo del cliente (sin password) */
  getMe(): Observable<ResponseEntity<UserEntity>> {
    return this.http.get<ResponseEntity<UserEntity>>(baseUrl + '/client/me');
  }

  /** PUT /api/client/me — Actualizar nombre, foto, teléfono */
  updateMe(data: { firstNames?: string; lastNames?: string; picture?: string; telephone?: any[] }): Observable<ResponseEntity<void>> {
    return this.http.put<ResponseEntity<void>>(baseUrl + '/client/me', data);
  }

  /** PUT /api/client/me/password — Cambiar contraseña */
  changePassword(currentPassword: string, newPassword: string): Observable<ResponseEntity<void>> {
    return this.http.put<ResponseEntity<void>>(baseUrl + '/client/me/password', { currentPassword, newPassword });
  }

  /** GET /api/client/me/services — Servicios contratados con dias_restantes */
  getMyServices(): Observable<ResponseEntity<ClientServiceSnapshot[]>> {
    return this.http.get<ResponseEntity<ClientServiceSnapshot[]>>(baseUrl + '/client/me/services');
  }

  /** GET /api/client/me/services/:service_id/stats — Consumo en tiempo real (S-UI) */
  getServiceStats(service_id: string): Observable<ResponseEntity<ClientServiceStats>> {
    return this.http.get<ResponseEntity<ClientServiceStats>>(baseUrl + `/client/me/services/${service_id}/stats`);
  }

  /** GET /api/client/me/payments — Últimos 50 pagos del cliente */
  getMyPayments(): Observable<ResponseEntity<any[]>> {
    return this.http.get<ResponseEntity<any[]>>(baseUrl + '/client/me/payments');
  }

  /** GET /api/client/me/devices — Dispositivos activos (con sub_url para S-UI) */
  getMyDevices(): Observable<ResponseEntity<ClientDevice[]>> {
    return this.http.get<ResponseEntity<ClientDevice[]>>(baseUrl + '/client/me/devices');
  }

  /** POST /api/client/me/services/:id/suspend — Suspender propio acceso S-UI */
  suspendService(service_id: string): Observable<ResponseEntity<void>> {
    return this.http.post<ResponseEntity<void>>(baseUrl + `/client/me/services/${service_id}/suspend`, {});
  }

  /** POST /api/client/me/services/:id/reactivate — Reactivar servicio suspendido */
  reactivateService(service_id: string): Observable<ResponseEntity<void>> {
    return this.http.post<ResponseEntity<void>>(baseUrl + `/client/me/services/${service_id}/reactivate`, {});
  }

  /** POST /api/client/me/services/:id/cancel-request — Solicitar cancelación */
  requestCancelService(service_id: string, reason: string): Observable<ResponseEntity<void>> {
    return this.http.post<ResponseEntity<void>>(baseUrl + `/client/me/services/${service_id}/cancel-request`, { reason });
  }

  /** GET /api/devices/client/service-code/:plan_id — Obtener código dinámico del servicio */
  fetchServiceCode(plan_id: string): Observable<ResponseEntity<{ html: string }>> {
    return this.http.get<ResponseEntity<{ html: string }>>(baseUrl + `/devices/client/service-code/${plan_id}`);
  }

  /** POST /api/devices/client/vpn-inquiry — Enviar consulta de precio VPN por país (notifica a admins por todos los canales) */
  sendVpnInquiry(countries: { flag: string; countryName: string }[], allCountries: boolean): Observable<ResponseEntity<void>> {
    return this.http.post<ResponseEntity<void>>(baseUrl + `/devices/client/vpn-inquiry`, { countries, allCountries });
  }
}
