import { HttpClient, HttpResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { rxResource } from '@angular/core/rxjs-interop';
import ActivitiesDevicesDashboardEntity from '../../interfaces/activitiesDevicesDashboard.interface';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
type AuthStatus = 'checking' | 'authenticated' | 'not-authenticated';
import { environment } from '../../../../environments/environment'
const baseUrl = environment.apiUrl

@Injectable({providedIn: 'root'})
export class ActivitiesDevicesDashboardService {

  private http = inject(HttpClient);


  getCertificates(): Observable<ResponseEntity<ActivitiesDevicesDashboardEntity[]>> {
    return this.http.post<ResponseEntity<ActivitiesDevicesDashboardEntity[]>>(baseUrl+'/vpn/certificates/device/state', {});
  }

}
