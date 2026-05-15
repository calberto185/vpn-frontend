import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import serverEntity from '../../interfaces/servers.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ServersService {
  private http = inject(HttpClient);

  getServers(): Observable<ResponseEntity<serverEntity[]>> {
    return this.http.post<ResponseEntity<serverEntity[]>>(baseUrl + '/servers/get', {});
  }

  register(data: serverEntity): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/servers/create', data);
  }

  update(data: Partial<serverEntity> & { id: string }): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/servers/update', data);
  }

  delete(id: string): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/servers/delete', { id });
  }
}
