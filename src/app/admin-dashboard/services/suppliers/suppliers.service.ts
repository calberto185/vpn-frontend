import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SupplierEntity } from '../../interfaces/supplier.interface';

const base = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private http = inject(HttpClient);

  list(params?: { active?: boolean; category?: string; search?: string }): Observable<any> {
    let p = new HttpParams();
    if (params?.active !== undefined) p = p.set('active', String(params.active));
    if (params?.category) p = p.set('category', params.category);
    if (params?.search)   p = p.set('search', params.search);
    return this.http.get(`${base}/suppliers`, { params: p });
  }

  getOne(id: string): Observable<any> {
    return this.http.get(`${base}/suppliers/${id}`);
  }

  create(data: Partial<SupplierEntity>): Observable<any> {
    return this.http.post(`${base}/suppliers`, data);
  }

  update(id: string, data: Partial<SupplierEntity>): Observable<any> {
    return this.http.put(`${base}/suppliers/${id}`, data);
  }

  remove(id: string): Observable<any> {
    return this.http.delete(`${base}/suppliers/${id}`);
  }

  paymentStatsBySupplier(): Observable<{ status: number; data: Record<string, { count: number; total: number; paid: number; pending: number }> }> {
    return this.http.get<any>(`${base}/supplier-payments/stats/by-supplier`);
  }
}
