import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import PlanEntity from '../../interfaces/plan.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class PlansService {
  private _user = signal<PlanEntity|null>(null);

  private http = inject(HttpClient);

  user = computed(() => this._user())

  getPlans(): Observable<ResponseEntity<PlanEntity[]>> {
    return this.http.post<ResponseEntity<PlanEntity[]>>(baseUrl+'/plans/get', {});
  }

  register(data: PlanEntity): Observable<ResponseEntity<PlanEntity>> {
    return this.http.post<ResponseEntity<PlanEntity>>(baseUrl+'/plans/create', data);
  }

  private handlerSuccess(resp: any) {
    return resp;
  }

  private handlerError(error: any) {
    return error;
  }

}
