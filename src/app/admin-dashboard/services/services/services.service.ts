import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import ServicesEntity from '../../interfaces/services.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class ServicesService {
  private _user = signal<ServicesEntity|null>(null);

  private http = inject(HttpClient);

  user = computed(() => this._user())

  get(): Observable<ResponseEntity<ServicesEntity[]>> {
    return this.http.post<ResponseEntity<ServicesEntity[]>>(baseUrl+'/services/get', {});
  }

  register(data: ServicesEntity): Observable<ResponseEntity<ServicesEntity>> {
    return this.http.post<ResponseEntity<ServicesEntity>>(baseUrl+'/services/create', data);
  }

  update(data: ServicesEntity): Observable<ResponseEntity<ServicesEntity>> {
    return this.http.post<ResponseEntity<ServicesEntity>>(baseUrl+'/services/update', data);
  }

  delete(id: string): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl+'/services/delete', { id });
  }

  private handlerSuccess(resp: any) {
    return resp;
  }

  private handlerError(error: any) {
    return error;
  }

}
