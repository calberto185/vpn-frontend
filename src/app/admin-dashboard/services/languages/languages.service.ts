import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import { SystemLanguage } from '../../../shared/services/locale/locale.service';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class LanguagesService {
  private http = inject(HttpClient);

  /** GET /languages?all=true — includes inactive (admin use) */
  getAll(): Observable<ResponseEntity<SystemLanguage[]>> {
    return this.http.get<ResponseEntity<SystemLanguage[]>>(`${baseUrl}/languages?all=true`);
  }

  /** POST /languages */
  create(data: Partial<SystemLanguage>): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(`${baseUrl}/languages`, data);
  }

  /** PUT /languages */
  update(data: Partial<SystemLanguage> & { id: string }): Observable<ResponseEntity<any>> {
    return this.http.put<ResponseEntity<any>>(`${baseUrl}/languages`, data);
  }

  /** DELETE /languages/:id */
  remove(id: string): Observable<ResponseEntity<any>> {
    return this.http.delete<ResponseEntity<any>>(`${baseUrl}/languages/${id}`);
  }
}
