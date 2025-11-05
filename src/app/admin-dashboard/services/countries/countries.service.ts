import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import UserEntity from '../../interfaces/user.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import { CountryEntity } from '../../interfaces/country.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class CountriesService {
  private _user = signal<UserEntity|null>(null);

  private http = inject(HttpClient);

  user = computed(() => this._user())

  getAllCountries(): Observable<ResponseEntity<CountryEntity[]>> {
    return this.http.get<ResponseEntity<CountryEntity[]>>(baseUrl+'/countries');
  }
  register(data: CountryEntity): Observable<any> {
    return this.http.post<ResponseEntity<CountryEntity>>(baseUrl+'/countries', data);
  }

  private handlerSuccess(resp: any) {
    return resp;
  }

  private handlerError(error: any) {
    return error;
  }

}
