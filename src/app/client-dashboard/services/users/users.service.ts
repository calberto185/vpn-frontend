import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import UserEntity from '../../interfaces/user.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import PlanClientDto from '../../interfaces/planClient.interface';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);
  private _profile = signal<UserEntity>(new UserEntity());

  /** Observable del perfil cacheado. Llama getMe() si está vacío. */
  profile(): Observable<UserEntity> {
    return this._profile.asReadonly() as any;
  }

  /** Carga el perfil completo del cliente (con servicios y datos CRM) y actualiza el signal. */
  getMe(): Observable<ResponseEntity<UserEntity>> {
    return this.http.get<ResponseEntity<UserEntity>>(baseUrl + '/client/me').pipe(
      tap((resp) => {
        if (resp?.data) {
          const u = new UserEntity();
          u.set(resp.data);
          this._profile.set(u);
        }
      }),
    );
  }

  updateClientPlan(user_id: string, dataPlan: PlanClientDto): Observable<any> {
    return this.http.post<ResponseEntity<UserEntity>>(baseUrl + '/admin/' + user_id + '/updateplan', dataPlan);
  }
}
