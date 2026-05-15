import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

const baseUrl = environment.apiUrl;

export interface TranslationEntry {
  key: string;
  values: Record<string, string>;
  updatedAt?: string;
}

export interface TranslationsMap {
  [lang: string]: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class TranslationsAdminService {
  private http = inject(HttpClient);

  /** Admin: get all entries as [{ key, values }] for the editor table */
  getAll(): Observable<{ data: TranslationEntry[] }> {
    return this.http.get<{ data: TranslationEntry[] }>(`${baseUrl}/translations/all`);
  }

  /** Upsert one translation key */
  upsertOne(entry: TranslationEntry): Observable<any> {
    return this.http.put<any>(`${baseUrl}/translations`, entry);
  }

  /** Bulk upsert — used by "Import defaults" */
  upsertBulk(items: TranslationEntry[]): Observable<any> {
    return this.http.put<any>(`${baseUrl}/translations/bulk`, { items });
  }

  /** Delete a key */
  remove(key: string): Observable<any> {
    return this.http.delete<any>(`${baseUrl}/translations/${encodeURIComponent(key)}`);
  }
}
