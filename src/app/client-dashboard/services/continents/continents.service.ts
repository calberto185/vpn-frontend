import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import UserEntity from '../../interfaces/user.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import { ContinentEntity } from '../../interfaces/continent.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class ContinentsService {
  private _user = signal<UserEntity|null>(null);

  private http = inject(HttpClient);

  user = computed(() => this._user())

  get(): Observable<ResponseEntity<ContinentEntity[]>> {
    return this.http.get<ResponseEntity<ContinentEntity[]>>(baseUrl+'/continents');
  }
  register(data: UserEntity): Observable<any> {
    return this.http.post<ResponseEntity<UserEntity>>(baseUrl+'/continents', data);
  }

  private handlerSuccess(resp: any) {
    return resp;
  }

  private handlerError(error: any) {
    return error;
  }

}
