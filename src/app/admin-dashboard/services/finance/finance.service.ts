import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

const base = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private http = inject(HttpClient);

  private params(year?: number, currency?: string, extra?: Record<string, string>): HttpParams {
    let p = new HttpParams();
    if (year)     p = p.set('year', String(year));
    if (currency) p = p.set('currency', currency);
    if (extra) for (const k of Object.keys(extra)) p = p.set(k, extra[k]);
    return p;
  }

  getExchangeRates(): Observable<any> {
    return this.http.get(`${base}/finance/exchange-rates`);
  }

  updateExchangeRates(rates: Record<string, number>): Observable<any> {
    return this.http.put(`${base}/finance/exchange-rates`, { rates });
  }

  summary(year?: number, currency = 'USD'): Observable<any> {
    return this.http.get(`${base}/finance/summary`, { params: this.params(year, currency) });
  }

  revenueMonthly(year?: number, currency = 'USD'): Observable<any> {
    return this.http.get(`${base}/finance/revenue/monthly`, { params: this.params(year, currency) });
  }

  expensesMonthly(year?: number, currency = 'USD'): Observable<any> {
    return this.http.get(`${base}/finance/expenses/monthly`, { params: this.params(year, currency) });
  }

  revenueByService(year?: number, currency = 'USD'): Observable<any> {
    return this.http.get(`${base}/finance/revenue/by-service`, { params: this.params(year, currency) });
  }

  revenueByMethod(year?: number, currency = 'USD'): Observable<any> {
    return this.http.get(`${base}/finance/revenue/by-method`, { params: this.params(year, currency) });
  }

  expensesBySupplier(year?: number, currency = 'USD'): Observable<any> {
    return this.http.get(`${base}/finance/expenses/by-supplier`, { params: this.params(year, currency) });
  }

  expensesByCategory(year?: number, currency = 'USD'): Observable<any> {
    return this.http.get(`${base}/finance/expenses/by-category`, { params: this.params(year, currency) });
  }

  topClients(year?: number, limit = 10, currency = 'USD'): Observable<any> {
    return this.http.get(`${base}/finance/top-clients`, { params: this.params(year, currency, { limit: String(limit) }) });
  }

  cashflow(months = 12, currency = 'USD'): Observable<any> {
    return this.http.get(`${base}/finance/cashflow`, { params: this.params(undefined, currency, { months: String(months) }) });
  }

  withdrawalsByRecipient(year?: number, currency = 'USD'): Observable<any> {
    return this.http.get(`${base}/finance/withdrawals/by-recipient`, { params: this.params(year, currency) });
  }
}
