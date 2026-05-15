import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import DeviceEntity from '../../interfaces/device.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private http = inject(HttpClient);

  getDevices(aggregate?: any[]): Observable<ResponseEntity<DeviceEntity[]>> {
    return this.http.post<ResponseEntity<DeviceEntity[]>>(baseUrl + '/devices/get', { aggregate });
  }

  register(data: any): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/devices/create', data);
  }

  update(data: Partial<DeviceEntity> & { id: string }): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/devices/update', data);
  }
}
