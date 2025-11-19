import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import UserEntity from '../../interfaces/user.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import { CountryEntity } from '../../interfaces/country.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
import SessionsEntity from '../../interfaces/sessions.interface';
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class SessionsService {
  private http = inject(HttpClient);
  get(): Observable<ResponseEntity<SessionsEntity[]>> {
    return this.http.get<ResponseEntity<SessionsEntity[]>>(baseUrl+'/system/client/sessions');
  }
}
