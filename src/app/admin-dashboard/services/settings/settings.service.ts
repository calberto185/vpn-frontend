import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

export interface NotificationsConfig {
  telegram: {
    token:         string;
    hasToken:      boolean;
    admin_chat_id: string;
  };
  whatsapp: {
    provider:     string;
    account_sid:  string;
    auth_token:   string;
    hasAuthToken: boolean;
    from:         string;
  };
  email: {
    host:        string;
    port:        number;
    secure:      boolean;
    user:        string;
    pass:        string;
    hasPass:     boolean;
    from_name:   string;
    admin_email: string;
  };
}

@Injectable({ providedIn: 'root' })
export class AdminSettingsService {
  private http = inject(HttpClient);

  /** GET configuración de notificaciones (credenciales enmascaradas) */
  getNotificationsConfig(): Observable<{ code: string; data: NotificationsConfig | null }> {
    return this.http.get<any>(`${baseUrl}/settings/notifications`);
  }

  /** PUT guardar configuración (enviar '***' en campos no modificados) */
  saveNotificationsConfig(data: Partial<NotificationsConfig>): Observable<any> {
    return this.http.put(`${baseUrl}/settings/notifications`, data);
  }

  /** POST test de Telegram */
  testTelegram(): Observable<any> {
    return this.http.post(`${baseUrl}/settings/notifications/test/telegram`, {});
  }

  /** POST test de Email */
  testEmail(): Observable<any> {
    return this.http.post(`${baseUrl}/settings/notifications/test/email`, {});
  }

  /** POST test de WhatsApp — requiere número de prueba */
  testWhatsApp(to: string): Observable<any> {
    return this.http.post(`${baseUrl}/settings/notifications/test/whatsapp`, { to });
  }
}
