import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SupplierPaymentEntity } from '../../interfaces/supplier-payment.interface';

const base = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class SupplierPaymentsService {
  private http = inject(HttpClient);

  list(filters?: { supplierId?: string; state?: string; period?: string; year?: string }): Observable<any> {
    return this.http.post(`${base}/supplier-payments/get`, filters ?? {});
  }

  getOne(id: string): Observable<any> {
    return this.http.get(`${base}/supplier-payments/${id}`);
  }

  create(data: Partial<SupplierPaymentEntity>): Observable<any> {
    return this.http.post(`${base}/supplier-payments`, data);
  }

  update(id: string, data: Partial<SupplierPaymentEntity>): Observable<any> {
    return this.http.put(`${base}/supplier-payments/${id}`, data);
  }

  remove(id: string): Observable<any> {
    return this.http.delete(`${base}/supplier-payments/${id}`);
  }

  nextReference(): Observable<any> {
    return this.http.get(`${base}/supplier-payments/next-reference`);
  }

  searchRecipients(q: string): Observable<any> {
    return this.http.get(`${base}/supplier-payments/recipients`, { params: { q } });
  }

  notifyEmail(id: string, data: { to: string; customMessage?: string }): Observable<any> {
    return this.http.post(`${base}/supplier-payments/${id}/notify/email`, data);
  }
}
