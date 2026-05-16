import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

export interface CryptoMethod {
  id:          string;
  name:        string;
  typeAccount: string;
  network:     string;
  currency:    string;
  qr_code:     string;
  min_amount:  number;
  note:        string;
  number?:     string;
}

export interface BinanceBybitOrder {
  qr_code?:      string;
  universal_url?: string;
  pay_url?:      string;
  deeplink?:     string;
  expiry?:       number;
  payment_id?:   string;
}

@Injectable({ providedIn: 'root' })
export class CryptoPaymentService {
  private http = inject(HttpClient);

  getMethods(): Observable<{ data: CryptoMethod[] }> {
    return this.http.get<any>(`${baseUrl}/crypto/methods`);
  }

  registerPayment(data: {
    methodId: string;
    planId:   string;
    amount:   number;
    txHash:   string;
    payTo?:   number;
    network?: string;
  }): Observable<any> {
    return this.http.post<any>(`${baseUrl}/crypto/payment/register`, data);
  }

  createBinanceOrder(planId: string, payTo: number): Observable<{ data: BinanceBybitOrder }> {
    return this.http.post<any>(`${baseUrl}/crypto/binance/order`, { planId, payTo });
  }

  createBybitOrder(planId: string, payTo: number): Observable<{ data: BinanceBybitOrder }> {
    return this.http.post<any>(`${baseUrl}/crypto/bybit/order`, { planId, payTo });
  }
}
