import { HttpClient, HttpResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import DeviceEntity from '../../interfaces/device.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import UserEntity from '../../interfaces/user.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
import CertificateEntity from '../../interfaces/certificate.interface';
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class DeviceService {
  private _user = signal<DeviceEntity|null>(null);

  private http = inject(HttpClient);

  user = computed(() => this._user())

  getDevices(user_id: string): Observable<any> {
    return this.http.post<ResponseEntity<DeviceEntity>>(baseUrl+'/devices/client/get', {});
  }

  register(user_id: string, data: {device: string, service: string, typeDevice: string}): Observable<any> {
    return this.http.post<ResponseEntity<DeviceEntity>>(baseUrl+'/devices/client/create', data);
  }
  downloadCertificate(data: Partial<{user_id: string, device_id: string, server_id: string }>): Observable<HttpResponse<Blob>> {
    return this.http.post(baseUrl+'/devices/client/certificate/get', data, {

      observe: 'response',
      responseType: 'blob',   // <- literal 'blob'
      withCredentials: true,          // si usas cookies/sesión
    });
  }
  private handlerSuccess(resp: any) {
    return resp;
  }

  private handlerError(error: any) {
    return error;
  }

}
