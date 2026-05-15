import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WithdrawalEntity } from '../../interfaces/withdrawal.interface';

const base = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class WithdrawalsService {
  private http = inject(HttpClient);

  list(filters?: { type?: string; state?: string; period?: string; year?: string; recipientId?: string }): Observable<any> {
    return this.http.post<any>(`${base}/withdrawals/get`, filters ?? {});
  }

  getOne(id: string): Observable<any> {
    return this.http.get<any>(`${base}/withdrawals/${id}`);
  }

  create(data: Partial<WithdrawalEntity>): Observable<any> {
    return this.http.post<any>(`${base}/withdrawals`, data);
  }

  update(id: string, data: Partial<WithdrawalEntity>): Observable<any> {
    return this.http.put<any>(`${base}/withdrawals/${id}`, data);
  }

  remove(id: string): Observable<any> {
    return this.http.delete<any>(`${base}/withdrawals/${id}`);
  }

  nextReference(): Observable<any> {
    return this.http.get<any>(`${base}/withdrawals/next-reference`);
  }

  searchRecipients(q: string): Observable<any> {
    return this.http.get<any>(`${base}/withdrawals/recipients`, { params: { q } });
  }

  notifyEmail(id: string, data: { to: string; customMessage?: string }): Observable<any> {
    return this.http.post<any>(`${base}/withdrawals/${id}/notify/email`, data);
  }
}
