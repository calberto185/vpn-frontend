import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import TermsEntity from '../../interfaces/terms.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class TermsService {
  private http = inject(HttpClient);

  get(): Observable<ResponseEntity<TermsEntity[]>> {
    return this.http.post<ResponseEntity<TermsEntity[]>>(baseUrl + '/terms/get', {});
  }

  register(data: TermsEntity): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/terms/create', data);
  }

  update(data: TermsEntity): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/terms/update', data);
  }
}
