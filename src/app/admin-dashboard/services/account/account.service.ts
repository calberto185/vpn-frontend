import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import UserEntity from '../../../auth/interfaces/auth-user.interface';

const baseUrl = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class AdminAccountService {
  private http = inject(HttpClient);

  getMyProfile(): Observable<ResponseEntity<UserEntity>> {
    return this.http.post<ResponseEntity<UserEntity>>(baseUrl + '/auth/profile/me', {});
  }

  updateMyProfile(data: { firstNames?: string; lastNames?: string; picture?: string; telephone?: any[] }): Observable<ResponseEntity<void>> {
    return this.http.put<ResponseEntity<void>>(baseUrl + '/auth/profile/me', data);
  }

  changeMyPassword(currentPassword: string, newPassword: string): Observable<ResponseEntity<void>> {
    return this.http.put<ResponseEntity<void>>(baseUrl + '/auth/profile/me/password', { currentPassword, newPassword });
  }

  getMySessions(): Observable<ResponseEntity<any[]>> {
    return this.http.get<ResponseEntity<any[]>>(baseUrl + '/system/client/sessions');
  }

  revokeSession(sessionId: string): Observable<ResponseEntity<void>> {
    return this.http.delete<ResponseEntity<void>>(baseUrl + `/system/client/sessions/${sessionId}`);
  }

  revokeAllSessions(): Observable<ResponseEntity<{ count: number }>> {
    return this.http.delete<ResponseEntity<{ count: number }>>(baseUrl + '/system/client/sessions/all');
  }

  listAppTokens(): Observable<ResponseEntity<any[]>> {
    return this.http.get<ResponseEntity<any[]>>(baseUrl + '/system/app/tokens');
  }

  revokeAppToken(id: string): Observable<ResponseEntity<void>> {
    return this.http.delete<ResponseEntity<void>>(baseUrl + `/system/app/token/${id}`);
  }
}
