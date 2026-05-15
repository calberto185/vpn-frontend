import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LanguagesService } from '../../../services/languages/languages.service';
import { LocaleService, SystemLanguage } from '../../../../shared/services/locale/locale.service';

@Component({
  selector: 'app-settings-languages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './languages.component.html',
  styleUrl: './languages.component.css',
})
export class SettingsLanguagesComponent implements OnInit {
  private svc   = inject(LanguagesService);
  locale        = inject(LocaleService);

  loading  = signal(true);
  saving   = signal(false);
  toast    = signal<{ msg: string; ok: boolean } | null>(null);
  showForm = signal(false);

  languages = signal<SystemLanguage[]>([]);

  // ── Add form ─────────────────────────────────────────────────────────────────
  newLang = signal<Partial<SystemLanguage>>({
    code: '', name: '', nativeName: '', flag: '', order: 99, isActive: true, isDefault: false,
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next:  r => { this.languages.set(r.data ?? []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────────

  toggleActive(lang: SystemLanguage) {
    if (lang.isDefault && lang.isActive) {
      this.showToast('No se puede ocultar el idioma por defecto', false);
      return;
    }
    this.svc.update({ id: lang.id, isActive: !lang.isActive }).subscribe({
      next:  () => { this.reload(); this.showToast('Actualizado', true); },
      error: (e: any) => this.showToast(e?.error?.message ?? 'Error', false),
    });
  }

  setDefault(lang: SystemLanguage) {
    if (lang.isDefault) return;
    this.svc.update({ id: lang.id, isDefault: true, isActive: true }).subscribe({
      next:  () => { this.reload(); this.showToast('Idioma por defecto actualizado', true); },
      error: (e: any) => this.showToast(e?.error?.message ?? 'Error', false),
    });
  }

  remove(lang: SystemLanguage) {
    if (!confirm(this.locale.t('lang.confirm_delete'))) return;
    this.svc.remove(lang.id).subscribe({
      next:  () => { this.reload(); this.showToast('Idioma eliminado', true); },
      error: (e: any) => this.showToast(e?.error?.message ?? 'Error', false),
    });
  }

  submitNew() {
    const data = this.newLang();
    if (!data.code || !data.name) {
      this.showToast('Código y nombre son obligatorios', false);
      return;
    }
    this.saving.set(true);
    this.svc.create(data).subscribe({
      next:  () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.resetForm();
        this.reload();
        this.showToast('Idioma creado', true);
      },
      error: (e: any) => {
        this.saving.set(false);
        this.showToast(e?.error?.message ?? 'Error al crear', false);
      },
    });
  }

  updateField(field: keyof SystemLanguage, value: any) {
    this.newLang.update(v => ({ ...v, [field]: value }));
  }

  private resetForm() {
    this.newLang.set({ code: '', name: '', nativeName: '', flag: '', order: 99, isActive: true, isDefault: false });
  }

  private reload() {
    this.load();
    // Also refresh the global language list used by the selector
    this.locale.reloadLanguages();
  }

  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
