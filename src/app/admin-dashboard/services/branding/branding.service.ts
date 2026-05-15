import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface BrandingConfig {
  singleton?: string;
  // Identidad
  name:        string;
  shortName:   string;
  tagline:     string;
  legalName:   string;
  // Logos
  logo:        string | null;
  logo_dark:   string | null;
  favicon:     string | null;
  // Tipografía
  fontPrimary:   string;
  fontSecondary: string;
  // Colores (HSL sin unidades, ej. "262 80% 50%")
  colorPrimary:   string;
  colorSecondary: string;
  colorAccent:    string;
  // Social / contacto
  website:   string;
  email:     string;
  phone:     string;
  instagram: string;
  twitter:   string;
  facebook:  string;
  youtube:   string;
  // SEO
  metaTitle:       string;
  metaDescription: string;
  // Sistema
  updatedAt?: string;
}

const base = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class BrandingService {
  private http = inject(HttpClient);

  get(): Observable<{ code: string; data: BrandingConfig }> {
    return this.http.get<any>(`${base}/branding`);
  }

  /** Save text fields + optional logo files via multipart/form-data */
  save(config: Partial<BrandingConfig>, files?: { logo?: File; logo_dark?: File; favicon?: File }): Observable<any> {
    const form = new FormData();
    const textFields: (keyof BrandingConfig)[] = [
      'name','shortName','tagline','legalName',
      'fontPrimary','fontSecondary',
      'colorPrimary','colorSecondary','colorAccent',
      'website','email','phone',
      'instagram','twitter','facebook','youtube',
      'metaTitle','metaDescription',
    ];
    for (const f of textFields) {
      if (config[f] !== undefined && config[f] !== null) {
        form.append(f, String(config[f]));
      }
    }
    if (files?.logo)      form.append('logo',      files.logo);
    if (files?.logo_dark) form.append('logo_dark', files.logo_dark);
    if (files?.favicon)   form.append('favicon',   files.favicon);
    return this.http.put<any>(`${base}/branding`, form);
  }

  deleteLogo(field: 'logo' | 'logo_dark' | 'favicon'): Observable<any> {
    return this.http.delete<any>(`${base}/branding/logo/${field}`);
  }
}
