import { HttpClient, HttpResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import BankAccountEntity from '../../interfaces/bankAccount.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class BankAccountService {
  private _user = signal<BankAccountEntity|null>(null);

  private http = inject(HttpClient);

  user = computed(() => this._user())

  getBankAccount(): Observable<ResponseEntity<BankAccountEntity[]>> {
    return this.http.post<ResponseEntity<BankAccountEntity[]>>(baseUrl+'/system/client/bankaccount', {});
  }
  register(data: BankAccountEntity): Observable<any> {
    return this.http.post<ResponseEntity<BankAccountEntity>>(baseUrl+'/system/bankaccount/create', data);
  }

  private handlerSuccess(resp: any) {
    return resp;
  }

  private handlerError(error: any) {
    return error;
  }

}
