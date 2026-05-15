import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ResponseEntity } from '../../../shared/interfaces/reponse.interface';
import { PublicHomeContent } from '../../interfaces/home-content.interface';

const baseUrl = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class PublicContentService {
  private http = inject(HttpClient);

  getHomeContent(): Observable<ResponseEntity<PublicHomeContent>> {
    return this.http.get<ResponseEntity<PublicHomeContent>>(baseUrl + '/public/home-content');
  }
}
