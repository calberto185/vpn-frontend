import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap, throwError } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import PaymentEntity from '../../interfaces/payment.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import UserEntity from '../../interfaces/user.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
const baseUrl = environment.apiUrl

@Injectable({
  providedIn: 'root'
})
export class PaymentsService {
  private _user = signal<PaymentEntity|null>(null);

  private http = inject(HttpClient);

  user = computed(() => this._user())

  getPayments(user_id: string): Observable<any> {
    return this.http.post<ResponseEntity<PaymentEntity>>(baseUrl+'/payments/client/get', {});
  }

  doesPayments(user_id: string, data: PaymentEntity): Observable<any> {
    return this.http.post<ResponseEntity<PaymentEntity>>(baseUrl+'/payments/'+user_id+'/client/hacer-pago', data);
  }
  doesPaymentsInitial(user_id: string, data: {
    plan: any
    countries: any
    bank: any
    terms: any
    global: boolean,
    payTo: number
    total: number,
    PersonalData: any
}, file: File | null,): Observable<{ progress: number; response?: any }> {
    const formData = new FormData();
    if(file == null) throw("No hay file para cargar!.")
    formData.append('file', file);

    if (user_id) {
      // Object.entries(data).forEach(([key, value]) => {
      //   formData.append(key, value);
      // });
      formData.append("payment", JSON.stringify(data))
    }
    return this.http.post(baseUrl+'/payments/client/hacer-pago-inicial', formData, {
      reportProgress: true,
      observe: 'events',
    }).pipe(
      map((event: HttpEvent<any>) => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            const progress = Math.round((100 * event.loaded) / (event.total ?? 1));
            return { progress };

          case HttpEventType.Response:
            return { progress: 100, response: event.body };

          default:
            return { progress: 0 };
        }
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('❌ Error en upload:', error);
        return throwError(() => error);
      })
    );
    // return this.http.post<ResponseEntity<PaymentEntity>>(baseUrl+'/payments/'+user_id+'/client/hacer-pago-inicial', data);
  }

  private handlerSuccess(resp: any) {
    return resp;
  }

  private handlerError(error: any) {
    return error;
  }

}

