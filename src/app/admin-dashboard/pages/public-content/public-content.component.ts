import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminPublicContentService } from '../../services/public-content/public-content.service';
import { PublicHomeContent, I18nStr } from '../../../public-dashboard/interfaces/home-content.interface';
import { PermissionsService } from '../../services/permissions/permissions.service';
import { LocaleService } from '../../../shared/services/locale/locale.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract plain string from an i18n field for a given language code */
function getStr(val: I18nStr | undefined | null, lang: string, fallback = ''): string {
  if (val == null) return fallback;
  if (typeof val === 'string') return val;
  return val[lang] ?? val['es'] ?? Object.values(val).find(v => !!v) ?? fallback;
}

/** Extract array-of-strings highlights for a given language */
function getHighlights(arr: I18nStr[] | undefined, lang: string): string {
  return (arr ?? []).map(h => getStr(h, lang)).join('\n');
}

@Component({
  selector: 'app-public-content',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './public-content.component.html',
  styleUrl: './public-content.component.css',
})
export class PublicContentComponent implements OnInit {
  // ── Permissions ────────────────────────────────────────────────────────────
  private permissions = inject(PermissionsService);
  canCreate = computed(() => this.permissions.canDo('settings/public-content', 'create'));
  canUpdate = computed(() => this.permissions.canDo('settings/public-content', 'update'));
  canDelete = computed(() => this.permissions.canDo('settings/public-content', 'delete'));

  private fb = inject(FormBuilder);
  private publicContentService = inject(AdminPublicContentService);
  localeService = inject(LocaleService);

  loading = signal(false);
  saving = signal(false);
  hasError = signal('');
  toast = signal<{ msg: string; ok: boolean } | null>(null);
  currentContent = signal<PublicHomeContent | null>(null);

  // ── Language tabs ─────────────────────────────────────────────────────────
  activeTab = signal<string>('es');

  /** Available language codes from the system languages list */
  availableTabs = computed(() => {
    const langs = this.localeService.systemLanguages();
    return langs.length > 0 ? langs.map(l => ({ code: l.code, label: `${l.flag} ${l.name}` })) : [{ code: 'es', label: '🇪🇸 Spanish' }];
  });

  /** Cache: maps lang code → flat form values for that language */
  private langCache: Record<string, any> = {};

  // ── Form ──────────────────────────────────────────────────────────────────
  form = this.fb.group({
    brandName: ['', Validators.required],
    brandAccent: [''],
    heroBadge: ['', Validators.required],
    heroTitle: ['', Validators.required],
    heroAccentText: [''],
    heroDescription: ['', Validators.required],
    heroPrimaryCtaLabel: ['', Validators.required],
    heroPrimaryCtaRoute: ['/auth/register', Validators.required],
    heroSecondaryCtaLabel: ['', Validators.required],
    heroSecondaryCtaHref: ['#planes', Validators.required],
    heroPanelLabel: ['', Validators.required],
    heroPanelStatus: ['', Validators.required],
    heroHighlightsText: ['', Validators.required],
    heroMetricsJson: ['[]', Validators.required],
    statsJson: ['[]', Validators.required],
    mediaTitle: ['', Validators.required],
    mediaDescription: ['', Validators.required],
    mediaItemsJson: ['[]', Validators.required],
    advantagesEyebrow: ['', Validators.required],
    advantagesTitle: ['', Validators.required],
    advantagesDescription: ['', Validators.required],
    advantagesItemsJson: ['[]', Validators.required],
    howEyebrow: ['', Validators.required],
    howTitle: ['', Validators.required],
    howDescription: ['', Validators.required],
    howStepsJson: ['[]', Validators.required],
    ctaTitle: ['', Validators.required],
    ctaDescription: ['', Validators.required],
    ctaPrimaryLabel: ['', Validators.required],
    ctaPrimaryRoute: ['/auth/register', Validators.required],
    ctaSecondaryLabel: ['', Validators.required],
    ctaSecondaryHref: ['#planes', Validators.required],
    ctaNote: [''],
    footerBrandName: ['', Validators.required],
    footerBrandSuffix: [''],
    footerDescription: ['', Validators.required],
    footerBottomText: ['', Validators.required],
  });

  ngOnInit(): void {
    this.localeService.loadLanguages();
    this.loadContent();
  }

  loadContent(): void {
    this.loading.set(true);
    this.publicContentService.getHomeContent().subscribe({
      next: (resp) => {
        const content = resp?.data ?? null;
        this.currentContent.set(content);
        if (content) {
          this._buildCache(content);
          this._patchFormFromCache(this.activeTab());
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.showToast(err?.error?.message ?? 'No se pudo cargar el contenido público', false);
      },
    });
  }

  // ── Language tab switching ────────────────────────────────────────────────

  switchTab(lang: string): void {
    this._saveCurrentToCache(this.activeTab());
    this.activeTab.set(lang);
    this._patchFormFromCache(lang);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  save(): void {
    this.hasError.set('');
    if (this.form.invalid) {
      this.hasError.set('Completa los campos requeridos');
      return;
    }

    // Save currently active tab to cache first
    this._saveCurrentToCache(this.activeTab());

    let payload: Partial<PublicHomeContent>;
    try {
      payload = this._buildPayload();
    } catch (err: any) {
      this.hasError.set(err.message);
      return;
    }

    this.saving.set(true);
    this.publicContentService.updateHomeContent(payload).subscribe({
      next: (resp) => {
        this.saving.set(false);
        this.currentContent.set(resp?.data ?? this.currentContent());
        this.showToast('Contenido público actualizado correctamente', true);
      },
      error: (err) => {
        this.saving.set(false);
        this.showToast(err?.error?.message ?? 'No se pudo guardar el contenido público', false);
      },
    });
  }

  reset(): void {
    const current = this.currentContent();
    if (current) {
      this._buildCache(current);
      this._patchFormFromCache(this.activeTab());
    }
    this.hasError.set('');
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Build the langCache from full i18n content */
  private _buildCache(content: PublicHomeContent): void {
    const tabs = this.availableTabs().map(t => t.code);
    const allLangs = new Set([...tabs, 'es', 'en', 'ru']);
    allLangs.forEach(lang => {
      this.langCache[lang] = {
        brandName:            getStr(content.navbar.brandName, lang),
        brandAccent:          getStr(content.navbar.brandAccent, lang),
        heroBadge:            getStr(content.hero.badge, lang),
        heroTitle:            getStr(content.hero.title, lang),
        heroAccentText:       getStr(content.hero.accentText, lang),
        heroDescription:      getStr(content.hero.description, lang),
        heroPrimaryCtaLabel:  getStr(content.hero.primaryCtaLabel, lang),
        heroPrimaryCtaRoute:  content.hero.primaryCtaRoute,
        heroSecondaryCtaLabel:getStr(content.hero.secondaryCtaLabel, lang),
        heroSecondaryCtaHref: content.hero.secondaryCtaHref,
        heroPanelLabel:       getStr(content.hero.panelLabel, lang),
        heroPanelStatus:      getStr(content.hero.panelStatus, lang),
        heroHighlightsText:   getHighlights(content.hero.highlights, lang),
        heroMetricsJson:      this.prettyJson(
          (content.hero.metrics || []).map(m => ({
            label:   getStr(m.label, lang),
            value:   m.value,
            caption: getStr(m.caption, lang),
          }))
        ),
        statsJson: this.prettyJson(
          (content.stats || []).map(s => ({ value: s.value, label: getStr(s.label, lang) }))
        ),
        mediaTitle:       getStr(content.mediaShowcase.title, lang),
        mediaDescription: getStr(content.mediaShowcase.description, lang),
        mediaItemsJson:   this.prettyJson(
          (content.mediaShowcase.items || []).map(i => ({
            ...i,
            title:       getStr(i.title, lang),
            description: getStr(i.description, lang),
            ctaLabel:    getStr(i.ctaLabel, lang),
          }))
        ),
        advantagesEyebrow:    getStr(content.advantages.eyebrow, lang),
        advantagesTitle:      getStr(content.advantages.title, lang),
        advantagesDescription:getStr(content.advantages.description, lang),
        advantagesItemsJson:  this.prettyJson(
          (content.advantages.items || []).map(i => ({
            id: i.id,
            title:       getStr(i.title, lang),
            description: getStr(i.description, lang),
          }))
        ),
        howEyebrow:    getStr(content.howItWorks.eyebrow, lang),
        howTitle:      getStr(content.howItWorks.title, lang),
        howDescription:getStr(content.howItWorks.description, lang),
        howStepsJson:  this.prettyJson(
          (content.howItWorks.steps || []).map(s => ({
            id: s.id,
            title:       getStr(s.title, lang),
            description: getStr(s.description, lang),
          }))
        ),
        ctaTitle:            getStr(content.cta.title, lang),
        ctaDescription:      getStr(content.cta.description, lang),
        ctaPrimaryLabel:     getStr(content.cta.primaryLabel, lang),
        ctaPrimaryRoute:     content.cta.primaryRoute,
        ctaSecondaryLabel:   getStr(content.cta.secondaryLabel, lang),
        ctaSecondaryHref:    content.cta.secondaryHref,
        ctaNote:             getStr(content.cta.note, lang),
        footerBrandName:     getStr(content.footer.brandName, lang),
        footerBrandSuffix:   getStr(content.footer.brandSuffix, lang),
        footerDescription:   getStr(content.footer.description, lang),
        footerBottomText:    getStr(content.footer.bottomText, lang),
      };
    });
  }

  private _patchFormFromCache(lang: string): void {
    const c = this.langCache[lang];
    if (!c) return;
    this.form.patchValue(c);
  }

  private _saveCurrentToCache(lang: string): void {
    const v = this.form.getRawValue();
    this.langCache[lang] = { ...v };
  }

  /** Build the full i18n payload from the per-language cache */
  private _buildPayload(): Partial<PublicHomeContent> {
    const langs = Object.keys(this.langCache);

    const i18n = (field: string): Record<string, string> =>
      Object.fromEntries(langs.map(l => [l, this.langCache[l]?.[field] ?? '']));

    const jsonField = (field: string, lang: string): any[] => {
      try { return JSON.parse(this.langCache[lang]?.[field] ?? '[]') || []; }
      catch { return []; }
    };

    // Merge per-language JSON arrays back into i18n objects
    const mergeMetrics = (): any[] => {
      const base = jsonField('heroMetricsJson', 'es');
      return base.map((item: any, idx: number) => ({
        label:   Object.fromEntries(langs.map(l => [l, jsonField('heroMetricsJson', l)[idx]?.label ?? ''])),
        value:   item.value,
        caption: Object.fromEntries(langs.map(l => [l, jsonField('heroMetricsJson', l)[idx]?.caption ?? ''])),
      }));
    };

    const mergeStats = (): any[] => {
      const base = jsonField('statsJson', 'es');
      return base.map((item: any, idx: number) => ({
        value: item.value,
        label: Object.fromEntries(langs.map(l => [l, jsonField('statsJson', l)[idx]?.label ?? ''])),
      }));
    };

    const mergeItems = (field: string): any[] => {
      const base = jsonField(field, 'es');
      return base.map((item: any, idx: number) => ({
        ...item,
        title:       Object.fromEntries(langs.map(l => [l, jsonField(field, l)[idx]?.title ?? ''])),
        description: Object.fromEntries(langs.map(l => [l, jsonField(field, l)[idx]?.description ?? ''])),
        ...(item.ctaLabel !== undefined ? {
          ctaLabel: Object.fromEntries(langs.map(l => [l, jsonField(field, l)[idx]?.ctaLabel ?? ''])),
        } : {}),
      }));
    };

    const mergeHighlights = (): any[] =>
      (this.langCache['es']?.heroHighlightsText ?? '').split('\n').filter(Boolean).map((_: string, idx: number) =>
        Object.fromEntries(langs.map(l => [l, (this.langCache[l]?.heroHighlightsText ?? '').split('\n').filter(Boolean)[idx] ?? '']))
      );

    const esRoute = this.langCache['es'];

    return {
      navbar: {
        brandName:   i18n('brandName'),
        brandAccent: i18n('brandAccent'),
      },
      hero: {
        badge:              i18n('heroBadge'),
        title:              i18n('heroTitle'),
        accentText:         i18n('heroAccentText'),
        description:        i18n('heroDescription'),
        primaryCtaLabel:    i18n('heroPrimaryCtaLabel'),
        primaryCtaRoute:    esRoute?.heroPrimaryCtaRoute ?? '/auth/register',
        secondaryCtaLabel:  i18n('heroSecondaryCtaLabel'),
        secondaryCtaHref:   esRoute?.heroSecondaryCtaHref ?? '#planes',
        highlights:         mergeHighlights(),
        panelLabel:         i18n('heroPanelLabel'),
        panelStatus:        i18n('heroPanelStatus'),
        metrics:            mergeMetrics(),
      },
      stats:         mergeStats(),
      mediaShowcase: {
        title:       i18n('mediaTitle'),
        description: i18n('mediaDescription'),
        items:       mergeItems('mediaItemsJson'),
      },
      advantages: {
        eyebrow:     i18n('advantagesEyebrow'),
        title:       i18n('advantagesTitle'),
        description: i18n('advantagesDescription'),
        items:       mergeItems('advantagesItemsJson'),
      },
      howItWorks: {
        eyebrow:     i18n('howEyebrow'),
        title:       i18n('howTitle'),
        description: i18n('howDescription'),
        steps:       mergeItems('howStepsJson'),
      },
      cta: {
        title:           i18n('ctaTitle'),
        description:     i18n('ctaDescription'),
        primaryLabel:    i18n('ctaPrimaryLabel'),
        primaryRoute:    esRoute?.ctaPrimaryRoute ?? '/auth/register',
        secondaryLabel:  i18n('ctaSecondaryLabel'),
        secondaryHref:   esRoute?.ctaSecondaryHref ?? '#planes',
        note:            i18n('ctaNote'),
      },
      footer: {
        brandName:   i18n('footerBrandName'),
        brandSuffix: i18n('footerBrandSuffix'),
        description: i18n('footerDescription'),
        bottomText:  i18n('footerBottomText'),
      },
    };
  }

  private prettyJson(value: unknown): string {
    return JSON.stringify(value, null, 2);
  }

  showToast(msg: string, ok: boolean): void {
    this.toast.set({ msg, ok });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
