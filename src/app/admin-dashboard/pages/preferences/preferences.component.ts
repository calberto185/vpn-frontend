import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LocaleService } from '../../../shared/services/locale/locale.service';

type AdminPreferences = {
  theme: 'light' | 'dark';
  compactSidebar: boolean;
  animations: boolean;
  language: string;
  timezone: string;
};

const STORAGE_KEY = 'admin_preferences_v1';

@Component({
  selector: 'app-admin-preferences',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './preferences.component.html',
  styleUrl: './preferences.component.css',
})
export class AdminPreferencesComponent implements OnInit {
  private fb          = new FormBuilder();
  readonly locale     = inject(LocaleService);

  /** Active system languages for the selector */
  readonly langs = computed(() => this.locale.systemLanguages());

  toast = signal<{ msg: string; ok: boolean } | null>(null);

  form = this.fb.group({
    theme: ['light', Validators.required],
    compactSidebar: [false],
    animations: [true],
    language: ['es', Validators.required],
    timezone: [Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima', Validators.required],
  });

  ngOnInit(): void {
    this.loadPreferences();
    this.applyTheme(this.form.value.theme as 'light' | 'dark');
    // Sync UI language from LocaleService on init
    const currentLang = this.locale.currentLanguageCode();
    if (currentLang) {
      this.form.patchValue({ language: currentLang });
    }
  }

  save(): void {
    const prefs: AdminPreferences = {
      theme: (this.form.value.theme as 'light' | 'dark') || 'light',
      compactSidebar: !!this.form.value.compactSidebar,
      animations: !!this.form.value.animations,
      language: this.form.value.language || 'es',
      timezone: this.form.value.timezone || 'America/Lima',
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    this.applyTheme(prefs.theme);
    // Propagate language change to the global locale service
    this.locale.setCountryByLanguage(prefs.language);
    this.showToast('Preferencias guardadas en este navegador', true);
  }

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.form.reset({
      theme: 'light',
      compactSidebar: false,
      animations: true,
      language: 'es',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima',
    });
    this.applyTheme('light');
    this.showToast('Preferencias restauradas', true);
  }

  private loadPreferences(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<AdminPreferences>;
      this.form.patchValue({
        theme: parsed.theme || 'light',
        compactSidebar: !!parsed.compactSidebar,
        animations: parsed.animations ?? true,
        language: parsed.language || 'es',
        timezone: parsed.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima',
      });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    document.documentElement.dataset['theme'] = theme;
  }

  private showToast(msg: string, ok: boolean): void {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 3500);
  }
}
