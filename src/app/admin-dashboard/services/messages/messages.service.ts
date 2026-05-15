import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { MessageAttachment } from '../../../client-dashboard/interfaces/message.interface';

const baseUrl = environment.apiUrl;

export interface SendMessagePayload {
  to:           string[] | 'all';
  to_label?:    string;
  subject:      string;
  body:         string;
  channels:     string[];
  reply_to_id?: string | null;
  attachments?: MessageAttachment[];
}

@Injectable({ providedIn: 'root' })
export class AdminMessagesService {
  private http = inject(HttpClient);

  /** Bandeja de entrada: mensajes de clientes */
  getInbox(page = 1, limit = 20): Observable<any> {
    return this.http.get(`${baseUrl}/messages/admin/inbox`, { params: { page, limit } });
  }

  /** Mensajes enviados */
  getSent(page = 1, limit = 20): Observable<any> {
    return this.http.get(`${baseUrl}/messages/admin/sent`, { params: { page, limit } });
  }

  /** Conteo de no leídos en inbox */
  getUnreadCount(): Observable<any> {
    return this.http.get(`${baseUrl}/messages/admin/unread-count`);
  }

  /** Lista de clientes para el selector de destinatarios */
  getClients(): Observable<any> {
    return this.http.get(`${baseUrl}/messages/admin/clients`);
  }

  /** Enviar mensaje a clientes (nueva conversación o respuesta) */
  send(payload: SendMessagePayload): Observable<any> {
    return this.http.post(`${baseUrl}/messages/admin/send`, payload);
  }

  /** Hilo de conversación completo para un mensaje */
  getThread(id: string): Observable<any> {
    return this.http.get(`${baseUrl}/messages/admin/thread/${id}`);
  }

  /** Últimos 5 no leídos de clientes para la campana del navbar */
  getPreview(): Observable<any> {
    return this.http.get(`${baseUrl}/messages/admin/preview`);
  }

  /** Mensajes recibidos: enviados por el admin a este usuario de panel */
  getReceived(page = 1, limit = 20): Observable<any> {
    return this.http.get(`${baseUrl}/messages/admin/received`, { params: { page, limit } });
  }

  /** Conteo de no leídos en recibidos */
  getReceivedUnreadCount(): Observable<any> {
    return this.http.get(`${baseUrl}/messages/admin/received-unread-count`);
  }

  /** Marcar mensaje de cliente como leído */
  markRead(id: string): Observable<any> {
    return this.http.post(`${baseUrl}/messages/admin/mark-read/${id}`, {});
  }
}
