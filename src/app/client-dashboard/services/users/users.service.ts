import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import UserEntity from '../../interfaces/user.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import PlanClientDto from '../../interfaces/planClient.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class UsersService {

  private http = inject(HttpClient);

  private loadingSubject = new BehaviorSubject<UserEntity | null>(new UserEntity());

  profile(): Observable<any> {
    return this.loadingSubject.asObservable()
  }
  getMe(): Observable<any> {
    return this.http.post<ResponseEntity<UserEntity>>(baseUrl+'/auth/profile/me', {}).pipe(
      tap((resp: any) => {
        this.loadingSubject.next(resp?.data);
      }),
    );
  }
  getUsers(): Observable<any> {
    return this.http.post<ResponseEntity<UserEntity>>(baseUrl+'/admin/consulta', {});
  }

  register(data: UserEntity): Observable<any> {
    return this.http.post<ResponseEntity<UserEntity>>(baseUrl+'/admin/registrar', data);
  }

  updateClientPlan(user_id: string, dataPlan: PlanClientDto): Observable<any> {
    return this.http.post<ResponseEntity<UserEntity>>(baseUrl+'/admin/'+user_id+'/updateplan', dataPlan);
  }

  private handlerSuccess(resp: any) {
    return resp;
  }

  private handlerError(error: any) {
    return error;
  }

}
