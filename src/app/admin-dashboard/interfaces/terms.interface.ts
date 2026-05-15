import { CountryEntity } from "./country.interface";

class TermsEntity {
  id = "";
  country: CountryEntity | null = null;
  details = [];

  // ── i18n text fields ───────────────────────────────────────────────────────
  title            = "";          // legacy plain string
  title_i18n:       Record<string, string> = {};
  description      = "";
  description_i18n: Record<string, string> = {};

  // ── operational fields ─────────────────────────────────────────────────────
  effectiveDate: string | null = null;  // ISO date — when these terms take effect
  active    = true;
  createdAt = new Date();
  updatedAt = new Date(1);

  constructor() {}

  set({
    id, country, details,
    title,       title_i18n,
    description, description_i18n,
    effectiveDate,
    active, createdAt, updatedAt,
  }: TermsEntity) {
    this.id               = id               ?? this.id;
    this.country          = country          ?? this.country;
    this.details          = details          ?? this.details;
    this.title            = title            ?? this.title;
    this.title_i18n       = title_i18n       ?? this.title_i18n;
    this.description      = description      ?? this.description;
    this.description_i18n = description_i18n ?? this.description_i18n;
    if (effectiveDate !== undefined) this.effectiveDate = effectiveDate;
    this.active           = active           ?? this.active;
    this.createdAt        = createdAt        ?? this.createdAt;
    this.updatedAt        = updatedAt        ?? this.updatedAt;
  }

  get() {
    if (!this.country) throw new Error('country es requerido.');
    const hasTitle = this.title || Object.values(this.title_i18n ?? {}).some(v => !!v);
    if (!hasTitle) throw new Error('title o title_i18n es requerido.');
    return this;
  }
}

export default TermsEntity;
