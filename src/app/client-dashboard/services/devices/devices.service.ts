import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import DeviceEntity from '../../interfaces/device.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import UserEntity from '../../interfaces/user.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class DeviceService {
  private _user = signal<DeviceEntity|null>(null);

  private http = inject(HttpClient);

  user = computed(() => this._user())

  getDevices(user_id: string): Observable<any> {
    return this.http.post<ResponseEntity<DeviceEntity>>(baseUrl+'/devices/'+user_id+'/get', {});
  }

  register(user_id: string, data: DeviceEntity): Observable<any> {
    return this.http.post<ResponseEntity<DeviceEntity>>(baseUrl+'/devices/'+user_id+'/create', data);
  }

  private handlerSuccess(resp: any) {
    return resp;
  }

  private handlerError(error: any) {
    return error;
  }

}
