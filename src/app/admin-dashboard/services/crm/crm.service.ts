import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

export interface CrmNote {
  id: string;
  text: string;
  createdAt: Date;
  createdByName: string;
}

export interface CrmClient {
  id: string;
  firstNames: string;
  lastNames: string;
  email: string;
  state: string;
  pipeline_stage: string;
  tags: string[];
  notes: CrmNote[];
  source: string;
  services: any[];
  createdAt: Date;
}

export interface PipelineBoard {
  board: Record<string, CrmClient[]>;
  stages: string[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class CrmService {
  private http = inject(HttpClient);

  getPipelineBoard(): Observable<{ code: string; data: PipelineBoard }> {
    return this.http.get<any>(`${baseUrl}/admin/crm/pipeline/board`);
  }

  getTagsList(): Observable<{ code: string; data: { tag: string; count: number }[] }> {
    return this.http.get<any>(`${baseUrl}/admin/crm/tags/list`);
  }

  getClientsByTag(tag: string): Observable<{ code: string; data: CrmClient[] }> {
    return this.http.get<any>(`${baseUrl}/admin/crm/tags/${tag}/clients`);
  }

  addNote(clientId: string, text: string): Observable<any> {
    return this.http.post(`${baseUrl}/admin/crm/${clientId}/notes`, { text });
  }

  deleteNote(clientId: string, noteId: string): Observable<any> {
    return this.http.delete(`${baseUrl}/admin/crm/${clientId}/notes/${noteId}`);
  }

  addTag(clientId: string, tag: string): Observable<any> {
    return this.http.post(`${baseUrl}/admin/crm/${clientId}/tags`, { tag });
  }

  removeTag(clientId: string, tag: string): Observable<any> {
    return this.http.delete(`${baseUrl}/admin/crm/${clientId}/tags/${tag}`);
  }

  setTags(clientId: string, tags: string[]): Observable<any> {
    return this.http.put(`${baseUrl}/admin/crm/${clientId}/tags`, { tags });
  }

  setPipelineStage(clientId: string, stage: string): Observable<any> {
    return this.http.put(`${baseUrl}/admin/crm/${clientId}/pipeline`, { stage });
  }
}
