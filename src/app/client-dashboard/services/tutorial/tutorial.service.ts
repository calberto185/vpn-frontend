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
}

@Injectable({ providedIn: 'root' })
export class ClientTutorialService {
  private http = inject(HttpClient);

  getPublic(): Observable<ResponseEntity<TutorialNode[]>> {
    return this.http.post<ResponseEntity<TutorialNode[]>>(environment.apiUrl + '/tutorial/public', {});
  }
}
