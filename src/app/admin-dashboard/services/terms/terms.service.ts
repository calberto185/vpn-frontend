import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import TermsEntity from '../../interfaces/terms.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class TermsService {
  private _user = signal<TermsEntity|null>(null);

  private http = inject(HttpClient);

  user = computed(() => this._user())

  get(): Observable<ResponseEntity<TermsEntity[]>> {
    return this.http.post<ResponseEntity<TermsEntity[]>>(baseUrl+'/terms/get', {});
  }

  register(data: TermsEntity): Observable<ResponseEntity<TermsEntity>> {
    return this.http.post<ResponseEntity<TermsEntity>>(baseUrl+'/terms/create', data);
  }

  private handlerSuccess(resp: any) {
    return resp;
  }

  private handlerError(error: any) {
    return error;
  }

}
