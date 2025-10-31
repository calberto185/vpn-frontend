import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import DeviceEntity from '../../interfaces/device.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class DeviceService {
  private _user = signal<DeviceEntity|null>(null);

  private http = inject(HttpClient);

  user = computed(() => this._user())

  getDevices(): Observable<any> {
    return this.http.post<ResponseEntity<DeviceEntity>>(baseUrl+'/devices/get', {});
  }

  register(data: DeviceEntity): Observable<any> {
    return this.http.post<ResponseEntity<DeviceEntity>>(baseUrl+'/devices/create', data);
  }

  private handlerSuccess(resp: any) {
    return resp;
  }

  private handlerError(error: any) {
    return error;
  }

}
