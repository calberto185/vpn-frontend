import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import serverEntity from '../../interfaces/servers.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class ServersService {
  private _Server = signal<serverEntity|null>(null);

  private http = inject(HttpClient);

  server = computed(() => this._Server())

  getServers(): Observable<ResponseEntity<serverEntity[]>> {
    return this.http.post<ResponseEntity<serverEntity[]>>(baseUrl+'/servers/get', {});
  }

  register(data: serverEntity): Observable<any> {
    return this.http.post<ResponseEntity<serverEntity>>(baseUrl+'/servers/create', data);
  }

  private handlerSuccess(resp: any) {
    return resp;
  }

  private handlerError(error: any) {
    return error;
  }

}
