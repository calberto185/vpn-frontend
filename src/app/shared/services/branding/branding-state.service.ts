import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { BrandingConfig } from '../../../admin-dashboard/services/branding/branding.service';

/** Base URL for /storage files served by the backend (strips /api suffix). */
const storageBase = environment.apiUrl.replace(/\/api$/, '');

@Injectable({ providedIn: 'root' })
export class BrandingStateService {
  private http = inject(HttpClient);

  private _branding = signal<BrandingConfig | null>(null);
  private _loaded   = signal(false);

  readonly branding  = this._branding.asReadonly();
  readonly loaded    = this._loaded.asReadonly();

  // ── Convenience computed values ────────────────────────────────────────────
  readonly name      = computed(() => this._branding()?.name      || 'CarlosVM');
  readonly shortName = computed(() => this._branding()?.shortName || 'CVM');
  readonly tagline   = computed(() => this._branding()?.tagline   || '');
  readonly legalName = computed(() => this._branding()?.legalName || '');

  readonly logoUrl     = computed(() => {
    const p = this._branding()?.logo;
    return p ? `${storageBase}${p}` : null;
  });
  readonly logoDarkUrl = computed(() => {
    const p = this._branding()?.logo_dark;
    return p ? `${storageBase}${p}` : null;
  });
  readonly faviconUrl  = computed(() => {
    const p = this._branding()?.favicon;
    return p ? `${storageBase}${p}` : null;
  });

  // Social links
  readonly website   = computed(() => this._branding()?.website   || '');
  readonly email     = computed(() => this._branding()?.email     || '');
  readonly instagram = computed(() => this._branding()?.instagram || '');
  readonly twitter   = computed(() => this._branding()?.twitter   || '');
  readonly facebook  = computed(() => this._branding()?.facebook  || '');
  readonly youtube   = computed(() => this._branding()?.youtube   || '');

  // ── Load (idempotent) ───────────────────────────────────────────────────────
  load(): void {
    if (this._loaded()) return;
    this.http
      .get<{ code: string; data: BrandingConfig }>(`${environment.apiUrl}/branding`)
      .subscribe({
        next: (r) => {
          if (r?.data) {
            this._branding.set(r.data);
            this._applyToDocument(r.data);
          }
          this._loaded.set(true);
        },
        error: () => this._loaded.set(true),
      });
  }

  /** Force a fresh reload (e.g. after saving branding settings). */
  reload(): void {
    this._loaded.set(false);
    this.load();
  }

  // ── Apply branding to the document ─────────────────────────────────────────
  private _applyToDocument(b: BrandingConfig): void {
    // Page title
    const title = b.metaTitle || b.name;
    if (title) document.title = title;

    // Meta description
    if (b.metaDescription) {
      let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = b.metaDescription;
    }

    // Favicon
    if (b.favicon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = `${storageBase}${b.favicon}`;
    }

    // Primary Google Font
    const font = b.fontPrimary;
    if (font && font !== 'Inter' && font !== 'System UI') {
      this._loadGoogleFont(font);
      document.documentElement.style.setProperty(
        '--font-primary', `"${font}", ui-sans-serif, system-ui, sans-serif`
      );
    }
  }

  private _loadGoogleFont(name: string): void {
    const id = `gfont-${name.replace(/\s+/g, '-')}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id   = id;
    link.rel  = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;600;700;900&display=swap`;
    document.head.appendChild(link);
  }
}
