import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import AppsEntity from '../../interfaces/apps.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class AppsService {
  private _user = signal<AppsEntity|null>(null);

  private http = inject(HttpClient);

  user = computed(() => this._user())

  get(): Observable<ResponseEntity<AppsEntity[]>> {
    return this.http.post<ResponseEntity<AppsEntity[]>>(baseUrl+'/apps/get', {});
  }

  register(data: AppsEntity): Observable<ResponseEntity<AppsEntity>> {
    return this.http.post<ResponseEntity<AppsEntity>>(baseUrl+'/apps/create', data);
  }

  private handlerSuccess(resp: any) {
    return resp;
  }

  private handlerError(error: any) {
    return error;
  }

}
