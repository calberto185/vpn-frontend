import { CountryEntity } from "./country.interface";

class ServicesEntity {
  id = "";

  // ── i18n text fields ───────────────────────────────────────────────────────
  sortName:         string = "";
  sortName_i18n:    Record<string, string> = {};
  longName:         string = "";
  longName_i18n:    Record<string, string> = {};
  Description:      string = "";
  Description_i18n: Record<string, string> = {};

  // ── operational fields ─────────────────────────────────────────────────────
  picture   = "";
  country   = new CountryEntity();
  city:     any[] = [];
  details:  any[] = [];
  state     = false;
  visible   = false;
  createdAt = new Date();
  updateAt  = new Date();

  constructor() {}

  set({
    id,
    sortName,    sortName_i18n,
    longName,    longName_i18n,
    Description, Description_i18n,
    picture, country, city, details,
    state, visible, createdAt, updateAt,
  }: Partial<ServicesEntity>) {
    this.id               = id               ?? this.id;
    this.sortName         = sortName         ?? this.sortName;
    this.sortName_i18n    = sortName_i18n    ?? this.sortName_i18n;
    this.longName         = longName         ?? this.longName;
    this.longName_i18n    = longName_i18n    ?? this.longName_i18n;
    this.Description      = Description      ?? this.Description;
    this.Description_i18n = Description_i18n ?? this.Description_i18n;
    this.picture          = picture          ?? this.picture;
    this.country          = country          ?? this.country;
    this.city             = city             ?? this.city;
    this.details          = details          ?? this.details;
    this.state            = state            ?? this.state;
    this.visible          = visible          ?? this.visible;
    this.createdAt        = createdAt        ?? this.createdAt;
    this.updateAt         = updateAt         ?? this.updateAt;
  }

  get() {
    const hasSortName = this.sortName || Object.values(this.sortName_i18n ?? {}).some(v => !!v);
    if (!hasSortName) throw new Error('The sortName field is required!.');
    if (!this.longName && !Object.values(this.longName_i18n ?? {}).some(v => !!v)) {
      throw new Error('The longName field is required!.');
    }
    if (!this.country) throw new Error('The country field is required!.');
    return this;
  }
}

export default ServicesEntity;
