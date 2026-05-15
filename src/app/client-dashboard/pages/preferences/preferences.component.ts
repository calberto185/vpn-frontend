import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

type ClientPreferences = {
  theme: 'light' | 'dark';
  language: string;
  timezone: string;
  notifications: boolean;
  compactView: boolean;
};

const STORAGE_KEY = 'client_preferences_v1';

@Component({
  selector: 'app-client-preferences',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './preferences.component.html',
  styleUrl: './preferences.component.css',
})
export class ClientPreferencesComponent implements OnInit {
  private fb = new FormBuilder();

  toast = signal<{ msg: string; ok: boolean } | null>(null);

  form = this.fb.group({
    theme: ['light', Validators.required],
    language: ['es', Validators.required],
    timezone: [Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima', Validators.required],
    notifications: [true],
    compactView: [false],
  });

  ngOnInit(): void {
    this.loadPreferences();
    this.applyTheme(this.form.value.theme as 'light' | 'dark');
  }

  save(): void {
    const prefs: ClientPreferences = {
      theme: (this.form.value.theme as 'light' | 'dark') || 'light',
      language: this.form.value.language || 'es',
      timezone: this.form.value.timezone || 'America/Lima',
      notifications: !!this.form.value.notifications,
      compactView: !!this.form.value.compactView,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    this.applyTheme(prefs.theme);
    this.showToast('Preferencias guardadas.', true);
  }

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.form.reset({
      theme: 'light',
      language: 'es',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima',
      notifications: true,
      compactView: false,
    });
    this.applyTheme('light');
    this.showToast('Preferencias restauradas.', true);
  }

  private loadPreferences(): void {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<ClientPreferences>;
      this.form.patchValue({
        theme: parsed.theme || 'light',
        language: parsed.language || 'es',
        timezone: parsed.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Lima',
        notifications: parsed.notifications ?? true,
        compactView: !!parsed.compactView,
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
