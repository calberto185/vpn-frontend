import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import PaymentEntity from '../../interfaces/payment.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private http = inject(HttpClient);

  getPayments(): Observable<ResponseEntity<PaymentEntity[]>> {
    return this.http.post<ResponseEntity<PaymentEntity[]>>(baseUrl + '/payments/get', {});
  }

  /** Admin registra un pago manual con comprobante.
   *  El middleware espera el campo multipart llamado 'voucher'. */
  doesPayments(data: PaymentEntity, file: File): Observable<{ progress: number; response?: any }> {
    const formData = new FormData();
    formData.append('voucher', file);          // ← campo correcto
    formData.append('payment', JSON.stringify(data));
    return this.http.post(baseUrl + '/payments/hacer-pago', formData, {
      reportProgress: true,
      observe: 'events',
    }).pipe(
      map((event: HttpEvent<any>) => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            return { progress: Math.round((100 * event.loaded) / (event.total ?? 1)) };
          case HttpEventType.Response:
            return { progress: 100, response: event.body };
          default:
            return { progress: 0 };
        }
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err)),
    );
  }

  confirmPayment(payment_id: string): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/payments/confirm', { payment_id });
  }

  rejectPayment(payment_id: string, reason?: string): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(baseUrl + '/payments/reject', { payment_id, reason });
  }
}
