import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import MessageEntity, { MessageAttachment } from '../../interfaces/message.interface';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class ClientMessagesService {
  private http = inject(HttpClient);

  /** Bandeja de entrada: mensajes del admin */
  getInbox(page = 1, limit = 20): Observable<any> {
    return this.http.get(`${baseUrl}/messages/client/inbox`, { params: { page, limit } });
  }

  /** Consultas enviadas al admin */
  getSent(page = 1, limit = 20): Observable<any> {
    return this.http.get(`${baseUrl}/messages/client/sent`, { params: { page, limit } });
  }

  /** Cantidad de mensajes no leídos */
  getUnreadCount(): Observable<ResponseEntity<{ count: number }>> {
    return this.http.get<ResponseEntity<{ count: number }>>(`${baseUrl}/messages/client/unread-count`);
  }

  /** Enviar consulta al admin (nueva o respuesta) */
  send(subject: string, body: string, replyToId?: string | null, attachments?: MessageAttachment[]): Observable<any> {
    return this.http.post(`${baseUrl}/messages/client/send`, {
      subject,
      body,
      reply_to_id: replyToId ?? null,
      attachments: attachments ?? [],
    });
  }

  /** Hilo de conversación completo para un mensaje */
  getThread(id: string): Observable<any> {
    return this.http.get(`${baseUrl}/messages/client/thread/${id}`);
  }

  /** Últimos 5 no leídos para la campana del navbar */
  getPreview(): Observable<any> {
    return this.http.get(`${baseUrl}/messages/client/preview`);
  }

  /** Marcar mensaje como leído */
  markRead(id: string): Observable<any> {
    return this.http.post(`${baseUrl}/messages/client/mark-read/${id}`, {});
  }
}
