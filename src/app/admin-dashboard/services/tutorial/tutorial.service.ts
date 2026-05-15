import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import { environment } from '../../../../environments/environment';

export type ContentBlockType = 'text' | 'image' | 'video' | 'link' | 'button' | 'tabs' | 'steps';

export interface ContentBlock {
  type: ContentBlockType;
  data: Record<string, any>;
}

export interface TutorialNode {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  iconType: 'fa' | 'image';
  description: string;
  order: number;
  isVisible: boolean;
  content: ContentBlock[];
  createdAt: string;
  updatedAt: string;
}

const base = environment.apiUrl + '/tutorial';

@Injectable({ providedIn: 'root' })
export class AdminTutorialService {
  private http = inject(HttpClient);

  getAll(): Observable<ResponseEntity<TutorialNode[]>> {
    return this.http.post<ResponseEntity<TutorialNode[]>>(base + '/get', {});
  }

  create(data: Partial<TutorialNode>): Observable<ResponseEntity<TutorialNode>> {
    return this.http.post<ResponseEntity<TutorialNode>>(base + '/create', data);
  }

  update(data: Partial<TutorialNode> & { id: string }): Observable<ResponseEntity<TutorialNode>> {
    return this.http.post<ResponseEntity<TutorialNode>>(base + '/update', data);
  }

  delete(id: string): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(base + '/delete', { id });
  }

  reorder(items: { id: string; order: number }[]): Observable<ResponseEntity<any>> {
    return this.http.post<ResponseEntity<any>>(base + '/reorder', { items });
  }
}
