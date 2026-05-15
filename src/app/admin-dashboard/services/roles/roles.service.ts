import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { RoleEntity } from '../../interfaces/role.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';

const baseUrl = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class RolesService {
  private http = inject(HttpClient);

  getAll(): Observable<ResponseEntity<RoleEntity[]>> {
    return this.http.get<ResponseEntity<RoleEntity[]>>(`${baseUrl}/roles`);
  }

  getByName(name: string): Observable<ResponseEntity<RoleEntity>> {
    return this.http.get<ResponseEntity<RoleEntity>>(`${baseUrl}/roles/${name}`).pipe(
      catchError(() => of({ status: 404, data: null } as any))
    );
  }

  create(data: Partial<RoleEntity>): Observable<ResponseEntity<RoleEntity>> {
    return this.http.post<ResponseEntity<RoleEntity>>(`${baseUrl}/roles`, data);
  }

  update(id: string, data: Partial<RoleEntity>): Observable<ResponseEntity<RoleEntity>> {
    return this.http.put<ResponseEntity<RoleEntity>>(`${baseUrl}/roles/${id}`, data);
  }

  delete(id: string): Observable<any> {
    return this.http.delete<any>(`${baseUrl}/roles/${id}`);
  }

  syncRoutes(): Observable<any> {
    return this.http.post<any>(`${baseUrl}/roles/sync-routes`, {});
  }
}
