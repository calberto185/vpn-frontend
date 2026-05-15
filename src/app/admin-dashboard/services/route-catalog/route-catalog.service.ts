import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RouteCatalogEntry } from '../../interfaces/route-catalog.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';

const baseUrl = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class RouteCatalogService {
  private http = inject(HttpClient);

  getAll(): Observable<ResponseEntity<RouteCatalogEntry[]>> {
    return this.http.get<ResponseEntity<RouteCatalogEntry[]>>(`${baseUrl}/routes`);
  }

  create(data: Partial<RouteCatalogEntry>): Observable<ResponseEntity<RouteCatalogEntry>> {
    return this.http.post<ResponseEntity<RouteCatalogEntry>>(`${baseUrl}/routes`, data);
  }

  update(id: string, data: Partial<RouteCatalogEntry>): Observable<ResponseEntity<RouteCatalogEntry>> {
    return this.http.put<ResponseEntity<RouteCatalogEntry>>(`${baseUrl}/routes/${id}`, data);
  }

  delete(id: string): Observable<any> {
    return this.http.delete<any>(`${baseUrl}/routes/${id}`);
  }
}
