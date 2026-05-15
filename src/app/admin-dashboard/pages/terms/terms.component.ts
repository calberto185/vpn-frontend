import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TermsService } from '../../services/terms/terms.service';
import { CountriesService } from '../../services/countries/countries.service';
import TermsEntity from '../../interfaces/terms.interface';
import { CountryEntity } from '../../interfaces/country.interface';
import { PermissionsService } from '../../services/permissions/permissions.service';
import { LocaleService } from '../../../shared/services/locale/locale.service';

@Component({
  selector: 'app-terms',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.css',
})
export class TermsComponent implements OnInit {

  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions      = inject(PermissionsService);
  protected localeService  = inject(LocaleService);
  canCreate = computed(() => this.permissions.canDo('settings/terms', 'create'));
  canUpdate = computed(() => this.permissions.canDo('settings/terms', 'update'));
  canDelete = computed(() => this.permissions.canDo('settings/terms', 'delete'));

  private termsService   = inject(TermsService);
  private countryService = inject(CountriesService);
  private fb             = inject(FormBuilder);

  terms      = signal<TermsEntity[]>([]);
  countries  = signal<CountryEntity[]>([]);
  selected   = signal<TermsEntity | null>(null);
  saving     = signal(false);
  toast      = signal<{ msg: string; ok: boolean } | null>(null);

  // ── i18n ──────────────────────────────────────────────────────────────────
  activeLangs = computed(() => this.localeService.systemLanguages());

  i18nAdd  = signal<Record<string, Record<string, string>>>({});
  i18nEdit = signal<Record<string, Record<string, string>>>({});

  addTitleValid  = computed(() =>
    this.activeLangs().some(l => (this.i18nAdd()['title']?.[l.code] ?? '').trim() !== '')
  );
  editTitleValid = computed(() =>
    this.activeLangs().some(l => (this.i18nEdit()['title']?.[l.code] ?? '').trim() !== '')
  );

  setI18nAdd(field: string, lang: string, value: string): void {
    this.i18nAdd.update(v => ({ ...v, [field]: { ...(v[field] ?? {}), [lang]: value } }));
  }

  setI18nEdit(field: string, lang: string, value: string): void {
    this.i18nEdit.update(v => ({ ...v, [field]: { ...(v[field] ?? {}), [lang]: value } }));
  }

  /** Display title for the current locale */
  termDisplayTitle(term: TermsEntity): string {
    return this.localeService.displayI18n(term.title_i18n, term.title);
  }

  // ── Forms (operational fields only) ──────────────────────────────────────
  termForm = this.fb.group({
    country:       ['', Validators.required],
    effectiveDate: [null as string | null],
    active:        [true],
  });

  editForm = this.fb.group({
    id:            ['', Validators.required],
    country:       ['', Validators.required],
    effectiveDate: [null as string | null],
    active:        [true],
  });

  ngOnInit() {
    this.loadTerms();
    this.loadCountries();
  }

  loadTerms() {
    this.termsService.get().subscribe(resp => this.terms.set(resp.data ?? []));
  }

  loadCountries() {
    this.countryService.getAllCountries().subscribe(resp => this.countries.set(resp.data ?? []));
  }

  // ── Create ────────────────────────────────────────────────────────────────
  onSubmit() {
    if (this.termForm.invalid || !this.addTitleValid()) {
      this.showToast('Completa al menos el título en un idioma.', false);
      return;
    }
    this.saving.set(true);
    const val     = this.termForm.value;
    const country = this.countries().find(c => c.id === val.country) ?? new CountryEntity();
    const ent     = new TermsEntity();
    ent.set({ ...val, country, effectiveDate: val.effectiveDate || null } as any);
    ent.title_i18n       = this.i18nAdd()['title']       ?? {};
    ent.description_i18n = this.i18nAdd()['description'] ?? {};

    this.termsService.register(ent.get()).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadTerms();
        this.closeModal('add_term');
        this.termForm.reset({ active: true });
        this.i18nAdd.set({});
        this.showToast('Término registrado', true);
      },
      error: err => { this.saving.set(false); this.showToast(err?.error?.message ?? 'Error', false); },
    });
  }

  // ── Edit ──────────────────────────────────────────────────────────────────
  openEdit(term: TermsEntity) {
    this.selected.set(term);
    const langs = this.localeService.systemLanguages();
    const toSignal: Record<string, Record<string, string>> = {};

    for (const f of ['title', 'description'] as const) {
      const i18nKey = (f + '_i18n') as keyof TermsEntity;
      const existing = (term[i18nKey] ?? {}) as Record<string, string>;
      const hasI18n = Object.values(existing).some(v => !!v);
      if (hasI18n) {
        toSignal[f] = { ...existing };
      } else {
        const legacy = (term[f as keyof TermsEntity] as string) ?? '';
        toSignal[f] = Object.fromEntries(langs.map(l => [l.code, legacy]));
      }
    }
    this.i18nEdit.set(toSignal);

    this.editForm.patchValue({
      id:            term.id,
      country:       (term.country as any)?.id ?? '',
      effectiveDate: term.effectiveDate ?? null,
      active:        term.active,
    });
    this.openModal('edit_term');
  }

  onEditSubmit() {
    if (this.editForm.invalid || !this.editTitleValid()) return;
    this.saving.set(true);
    const val     = this.editForm.value;
    const country = this.countries().find(c => c.id === val.country)
                    ?? this.selected()?.country
                    ?? new CountryEntity();
    const ent = new TermsEntity();
    ent.set({ ...this.selected(), ...val, country, effectiveDate: val.effectiveDate || null } as any);
    ent.title_i18n       = this.i18nEdit()['title']       ?? {};
    ent.description_i18n = this.i18nEdit()['description'] ?? {};

    this.termsService.update(ent).subscribe({
      next: () => {
        this.saving.set(false);
        this.loadTerms();
        this.closeModal('edit_term');
        this.showToast('Término actualizado', true);
      },
      error: err => { this.saving.set(false); this.showToast(err?.error?.message ?? 'Error', false); },
    });
  }

  // ── Toggle active ─────────────────────────────────────────────────────────
  toggleActive(term: TermsEntity) {
    const ent = new TermsEntity();
    ent.set({ ...term, active: !term.active } as any);
    this.termsService.update(ent).subscribe({
      next: () => { this.loadTerms(); this.showToast(`Término ${ent.active ? 'activado' : 'desactivado'}`, true); },
      error: err => this.showToast(err?.error?.message ?? 'Error', false),
    });
  }

  // ── Markdown toolbar ──────────────────────────────────────────────────────
  insertMd(el: HTMLTextAreaElement, before: string, after: string, field: string, lang: string, isAdd: boolean) {
    const start    = el.selectionStart;
    const end      = el.selectionEnd;
    const newValue = el.value.slice(0, start) + before + el.value.slice(start, end) + after + el.value.slice(end);
    el.value = newValue;
    if (isAdd) this.setI18nAdd(field, lang, newValue);
    else       this.setI18nEdit(field, lang, newValue);
    el.focus();
    el.setSelectionRange(start + before.length, end + before.length + (end - start));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  showToast(msg: string, ok: boolean) {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }

  openModal(id: string) {
    (document.getElementById(id) as HTMLDialogElement | null)?.showModal();
  }

  closeModal(id: string) {
    (document.getElementById(id) as HTMLDialogElement | null)?.close();
  }
}
