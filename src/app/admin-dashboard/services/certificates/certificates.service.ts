import { HttpClient, HttpResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import CertificateEntity from '../../interfaces/certificate.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class CertificatesService {
  private _user = signal<CertificateEntity|null>(null);

  private http = inject(HttpClient);

  user = computed(() => this._user())

  getCertificates(): Observable<ResponseEntity<CertificateEntity[]>> {
    return this.http.post<ResponseEntity<CertificateEntity[]>>(baseUrl+'/vpn/certificates/get', {});
  }
  register(data: CertificateEntity): Observable<any> {
    return this.http.post<ResponseEntity<CertificateEntity>>(baseUrl+'/vpn/certificates/create', data);
  }

  suspender(data: Partial<CertificateEntity>): Observable<any> {
    return this.http.post<ResponseEntity<CertificateEntity>>(baseUrl+'/vpn/certificates/suspender', data);
  }

  reactivar(data: Partial<CertificateEntity>): Observable<any> {
    return this.http.post<ResponseEntity<CertificateEntity>>(baseUrl+'/vpn/certificates/reactivar', data);
  }

  revocar(data: Partial<CertificateEntity>): Observable<any> {
    return this.http.post<ResponseEntity<CertificateEntity>>(baseUrl+'/vpn/certificates/revocar', data);
  }

  eliminar(data: Pick<CertificateEntity, 'user_id' | 'device_id' | 'server_id'>): Observable<any> {
    return this.http.post<ResponseEntity<void>>(baseUrl+'/vpn/certificates/eliminar', data);
  }

  downloadCertificate(data: Partial<CertificateEntity>): Observable<HttpResponse<Blob>> {
    return this.http.post(baseUrl+'/vpn/certificates/descargar', data, {

      observe: 'response',
      responseType: 'blob',   // <- literal 'blob'
      withCredentials: true,          // si usas cookies/sesión
    });
  }

  private handlerSuccess(resp: any) {
    return resp;
  }

  private handlerError(error: any) {
    return error;
  }

}
