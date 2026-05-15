import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

export interface BinnacleEntry {
  id: string;
  action: string;
  actorId: string;
  actorEmail: string;
  targetId: string;
  targetType: string;
  result: 'success' | 'error';
  ip: string;
  error?: string;
  createdAt: string;
}

export interface SessionEntry {
  id: string;
  user_id: string;
  createdAt: string;
  expiresAt: string;
  ip: string;
  userAgent: string;
  user: { email: string; name: string; role: string } | null;
}

export interface PagedResponse<T> {
  code: string;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface BinnacleFilters {
  action?: string;
  actorId?: string;
  result?: string;
  from?: string;
  to?: string;
}

export interface SessionFilters {
  userId?: string;
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class ActivityService {
  private http = inject(HttpClient);

  getBinnacle(page = 1, limit = 20, filters: BinnacleFilters = {}): Observable<PagedResponse<BinnacleEntry>> {
    const params: any = { page, limit };
    if (filters.action)  params['action']  = filters.action;
    if (filters.actorId) params['actorId'] = filters.actorId;
    if (filters.result)  params['result']  = filters.result;
    if (filters.from)    params['from']    = filters.from;
    if (filters.to)      params['to']      = filters.to;
    return this.http.get<PagedResponse<BinnacleEntry>>(`${baseUrl}/admin/activity/binnacle`, { params });
  }

  logAction(action: string, targetId = '', targetType = '', data: Record<string, any> = {}): Observable<{ code: string; message: string }> {
    return this.http.post<{ code: string; message: string }>(`${baseUrl}/admin/activity/log`, { action, targetId, targetType, data });
  }

  getSessions(page = 1, limit = 20, filters: SessionFilters = {}): Observable<PagedResponse<SessionEntry>> {
    const params: any = { page, limit };
    if (filters.userId) params['userId'] = filters.userId;
    if (filters.from)   params['from']   = filters.from;
    if (filters.to)     params['to']     = filters.to;
    return this.http.get<PagedResponse<SessionEntry>>(`${baseUrl}/admin/activity/sessions`, { params });
  }
}
