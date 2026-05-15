import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import AppsEntity from '../../interfaces/apps.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class AppsService {
  private http = inject(HttpClient);

  get(): Observable<ResponseEntity<AppsEntity[]>> {
    return this.http.post<ResponseEntity<AppsEntity[]>>(baseUrl + '/apps/get', {});
  }

  create(data: Partial<AppsEntity>): Observable<ResponseEntity<AppsEntity>> {
    return this.http.post<ResponseEntity<AppsEntity>>(baseUrl + '/apps/create', data);
  }

  update(data: Partial<AppsEntity> & { id: string }): Observable<ResponseEntity<AppsEntity>> {
    return this.http.post<ResponseEntity<AppsEntity>>(baseUrl + '/apps/update', data);
  }

  delete(id: string): Observable<ResponseEntity<void>> {
    return this.http.post<ResponseEntity<void>>(baseUrl + '/apps/delete', { id });
  }
}
