import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslationsAdminService, TranslationEntry } from '../../../services/translations/translations.service';
import { LocaleService } from '../../../../shared/services/locale/locale.service';
import { TRANSLATIONS } from '../../../../shared/services/locale/locale.service';
import { PermissionsService } from '../../../services/permissions/permissions.service';

// ── Prefix groups for filter tabs ────────────────────────────────────────────
const PREFIX_GROUPS = [
  { label: 'Todos',      prefix: '' },
  { label: 'Auth',       prefix: 'auth.' },
  { label: 'Nav',        prefix: 'nav.' },
  { label: 'Público',    prefix: 'pub.' },
  { label: 'Dashboard',  prefix: 'dashboard.' },
  { label: 'Idiomas',    prefix: 'lang.' },
];

@Component({
  selector: 'app-translations',
  imports: [CommonModule, FormsModule],
  templateUrl: './translations.component.html',
  styleUrl: './translations.component.css',
})
export class TranslationsComponent implements OnInit {
  private svc        = inject(TranslationsAdminService);
  localeService      = inject(LocaleService);
  private perms      = inject(PermissionsService);

  canUpdate = computed(() => this.perms.canDo('settings/translations', 'update'));
  canDelete = computed(() => this.perms.canDo('settings/translations', 'delete'));

  // ── State ──────────────────────────────────────────────────────────────────
  loading   = signal(false);
  saving    = signal<string | null>(null); // key being saved
  importing = signal(false);
  toast     = signal<{ msg: string; ok: boolean } | null>(null);

  allEntries  = signal<TranslationEntry[]>([]);
  activePrefix = signal('');
  searchQuery  = signal('');

  /** New key form */
  showAddForm  = signal(false);
  newKey       = signal('');
  newValues    = signal<Record<string, string>>({});

  readonly prefixGroups = PREFIX_GROUPS;

  /** Languages from the system */
  langs = computed(() => {
    const sys = this.localeService.systemLanguages();
    return sys.length > 0 ? sys.map(l => l.code) : ['es', 'en', 'ru'];
  });

  langLabels = computed(() => {
    const sys = this.localeService.systemLanguages();
    const map: Record<string, string> = {};
    sys.forEach(l => (map[l.code] = `${l.flag} ${l.code.toUpperCase()}`));
    return map;
  });

  /** Filtered entries based on prefix tab + search */
  filtered = computed(() => {
    const prefix = this.activePrefix();
    const q      = this.searchQuery().toLowerCase().trim();
    return this.allEntries().filter(e => {
      const matchPrefix = !prefix || e.key.startsWith(prefix);
      const matchSearch = !q || e.key.includes(q) ||
        Object.values(e.values).some(v => v.toLowerCase().includes(q));
      return matchPrefix && matchSearch;
    });
  });

  ngOnInit(): void {
    this.localeService.loadLanguages();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc.getAll().subscribe({
      next: (resp) => {
        this.allEntries.set(resp?.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('No se pudo cargar las traducciones', false);
      },
    });
  }

  // ── Inline edit ───────────────────────────────────────────────────────────

  /** Called when user blurs/confirms an inline edit cell */
  saveCell(entry: TranslationEntry, lang: string, value: string): void {
    if (!this.canUpdate()) return;
    const updated: TranslationEntry = {
      key: entry.key,
      values: { ...entry.values, [lang]: value },
    };
    this.saving.set(entry.key);
    this.svc.upsertOne(updated).subscribe({
      next: () => {
        // Update local state
        this.allEntries.update(list =>
          list.map(e => e.key === entry.key ? { ...e, values: updated.values } : e)
        );
        this.saving.set(null);
        this.localeService.reloadTranslations();
      },
      error: () => {
        this.saving.set(null);
        this.showToast('Error al guardar', false);
      },
    });
  }

  // ── Add new key ───────────────────────────────────────────────────────────

  initNewValues(): void {
    const vals: Record<string, string> = {};
    this.langs().forEach(l => (vals[l] = ''));
    this.newValues.set(vals);
    this.showAddForm.set(true);
  }

  submitNew(): void {
    const key = this.newKey().trim();
    if (!key) return;
    const entry: TranslationEntry = { key, values: { ...this.newValues() } };
    this.saving.set('__new__');
    this.svc.upsertOne(entry).subscribe({
      next: () => {
        this.allEntries.update(list => {
          const exists = list.find(e => e.key === key);
          return exists
            ? list.map(e => e.key === key ? { ...e, values: entry.values } : e)
            : [...list, entry].sort((a, b) => a.key.localeCompare(b.key));
        });
        this.saving.set(null);
        this.newKey.set('');
        this.newValues.set({});
        this.showAddForm.set(false);
        this.localeService.reloadTranslations();
        this.showToast('Clave agregada', true);
      },
      error: () => {
        this.saving.set(null);
        this.showToast('Error al agregar clave', false);
      },
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  remove(key: string): void {
    if (!this.canDelete()) return;
    if (!confirm(`¿Eliminar la clave "${key}"?`)) return;
    this.svc.remove(key).subscribe({
      next: () => {
        this.allEntries.update(list => list.filter(e => e.key !== key));
        this.localeService.reloadTranslations();
        this.showToast('Clave eliminada', true);
      },
      error: () => this.showToast('Error al eliminar', false),
    });
  }

  // ── Import defaults ───────────────────────────────────────────────────────

  importDefaults(): void {
    if (!this.canUpdate()) return;
    if (!confirm('Esto importará todas las traducciones hardcodeadas como base. Las claves existentes en la DB se actualizarán. ¿Continuar?')) return;

    // Convert TRANSLATIONS { lang: { key: val } } → [{ key, values: { lang: val } }]
    const keySet = new Set<string>();
    Object.values(TRANSLATIONS).forEach(map => Object.keys(map).forEach(k => keySet.add(k)));

    const items: TranslationEntry[] = Array.from(keySet).map(key => {
      const values: Record<string, string> = {};
      for (const [lang, map] of Object.entries(TRANSLATIONS)) {
        if (map[key] !== undefined) values[lang] = map[key];
      }
      return { key, values };
    });

    this.importing.set(true);
    this.svc.upsertBulk(items).subscribe({
      next: (resp) => {
        this.importing.set(false);
        this.load();
        this.localeService.reloadTranslations();
        this.showToast(resp?.message ?? '✅ Importación completada', true);
      },
      error: () => {
        this.importing.set(false);
        this.showToast('Error en la importación', false);
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  setNewValue(lang: string, value: string): void {
    this.newValues.update(v => ({ ...v, [lang]: value }));
  }

  getValue(entry: TranslationEntry, lang: string): string {
    return entry.values?.[lang] ?? '';
  }

  trackByKey(_: number, e: TranslationEntry): string {
    return e.key;
  }

  showToast(msg: string, ok: boolean): void {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
