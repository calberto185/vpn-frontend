import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrandingService, BrandingConfig } from '../../../services/branding/branding.service';
import { BrandingStateService }            from '../../../../shared/services/branding/branding-state.service';
import { environment } from '../../../../../environments/environment';

type LogoField = 'logo' | 'logo_dark' | 'favicon';

const GOOGLE_FONTS = [
  'Inter','Roboto','Open Sans','Lato','Poppins','Nunito','Raleway',
  'Montserrat','Source Sans 3','Merriweather','Playfair Display',
  'DM Sans','Plus Jakarta Sans','Outfit','Figtree',
];

function emptyConfig(): BrandingConfig {
  return {
    name: '', shortName: '', tagline: '', legalName: '',
    logo: null, logo_dark: null, favicon: null,
    fontPrimary: 'Inter', fontSecondary: 'Inter',
    colorPrimary: '262 80% 50%', colorSecondary: '316 70% 50%', colorAccent: '175 60% 40%',
    website: '', email: '', phone: '',
    instagram: '', twitter: '', facebook: '', youtube: '',
    metaTitle: '', metaDescription: '',
  };
}

@Component({
  selector: 'app-branding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './branding.component.html',
})
export class BrandingComponent implements OnInit {
  private svc           = inject(BrandingService);
  private brandingState = inject(BrandingStateService);

  loading  = signal(true);
  saving   = signal(false);
  saved    = signal(false);
  errorMsg = signal('');

  config   = signal<BrandingConfig>(emptyConfig());

  // Logo previews (object-URL or server URL)
  previews = signal<Record<LogoField, string | null>>({ logo: null, logo_dark: null, favicon: null });
  // Pending file objects (not yet uploaded)
  pendingFiles: Partial<Record<LogoField, File>> = {};

  activeTab = signal<'identity' | 'typography' | 'colors' | 'social' | 'seo'>('identity');

  readonly fonts   = GOOGLE_FONTS;
  readonly apiBase = environment.apiUrl.replace('/api', '');

  ngOnInit(): void {
    this.svc.get().subscribe({
      next: r => {
        this.config.set(r.data ?? emptyConfig());
        this.previews.set({
          logo:      r.data?.logo      ? this.apiBase + r.data.logo      : null,
          logo_dark: r.data?.logo_dark ? this.apiBase + r.data.logo_dark : null,
          favicon:   r.data?.favicon   ? this.apiBase + r.data.favicon   : null,
        });
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // ── Tab ───────────────────────────────────────────────────────────────────
  setTab(t: typeof this.activeTab extends ReturnType<typeof signal<infer T>> ? T : never): void {
    this.activeTab.set(t as any);
  }

  // ── File pick ─────────────────────────────────────────────────────────────
  onFilePick(event: Event, field: LogoField): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    this.previews.update(p => ({ ...p, [field]: url }));
    this.pendingFiles[field] = file;
    input.value = '';
  }

  removeLogo(field: LogoField): void {
    // Clear local preview and pending file
    this.previews.update(p => ({ ...p, [field]: null }));
    delete this.pendingFiles[field];
    // If it was already saved on server, mark for deletion
    if (this.config()[field]) {
      this.config.update(c => ({ ...c, [field]: null }));
      this.svc.deleteLogo(field).subscribe();
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  save(): void {
    this.saving.set(true);
    this.errorMsg.set('');
    this.svc.save(this.config(), this.pendingFiles as any).subscribe({
      next: r => {
        this.saving.set(false);
        this.saved.set(true);
        this.pendingFiles = {};
        // Update server URLs for logos
        const d = r.data as BrandingConfig;
        this.previews.set({
          logo:      d.logo      ? this.apiBase + d.logo      : null,
          logo_dark: d.logo_dark ? this.apiBase + d.logo_dark : null,
          favicon:   d.favicon   ? this.apiBase + d.favicon   : null,
        });
        this.config.set(d);
        // Propagate changes to all layouts immediately
        this.brandingState.reload();
        setTimeout(() => this.saved.set(false), 3000);
      },
      error: err => {
        this.saving.set(false);
        this.errorMsg.set(err?.error?.message ?? 'Error al guardar');
      },
    });
  }

  // ── Color preview ────────────────────────────────────────────────────────
  hslPreview(hsl: string): string {
    return `hsl(${hsl})`;
  }

  // ── Patch helper (used by template) ──────────────────────────────────────
  patch(field: keyof BrandingConfig, value: string): void {
    this.config.update(c => ({ ...c, [field]: value }));
  }
}
