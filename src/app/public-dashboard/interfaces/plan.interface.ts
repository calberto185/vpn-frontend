import { CountryEntity } from "./country.interface";
import ServicesEntity from "./services.interface";

class PlanEntity {
  id = "";

  // ── i18n text fields ───────────────────────────────────────────────────────
  title_prefix      = "";
  title_prefix_i18n: Record<string, string> = {};
  title_name        = "";
  title_name_i18n:   Record<string, string> = {};
  title_suffix      = "";
  title_suffix_i18n: Record<string, string> = {};
  description       = "";
  description_i18n:  Record<string, string> = {};
  button_name       = "";
  button_name_i18n:  Record<string, string> = {};

  // ── features ───────────────────────────────────────────────────────────────
  features:      string[] = [];
  features_i18n: Record<string, string[]> | null | undefined = {};

  // ── operational fields ─────────────────────────────────────────────────────
  price         = 0;
  kind          = "";
  language      = "";
  active        = false;
  visible       = false;
  global        = false;
  main          = false;
  country       = new CountryEntity();
  service       = new ServicesEntity();
  currencyName  = "";
  currencyCode  = "";
  currencySymbol = "";
  currencyFormat = "";
  limitDevices  = 0;

  // ── VPN mode ───────────────────────────────────────────────────────────────
  vpnMode: 'by_device' | 'by_data' | null = null;
  dataLimitGB    = 0;
  dataLimitPeriod = "";

  // ── service credentials ────────────────────────────────────────────────────
  userNameService = "";
  passwordService = "";
  codeService     = "";

  details    = [];
  createdAt  = new Date();
  updatedAt  = new Date();

  constructor() {}

  set({
    id,
    title_prefix, title_prefix_i18n,
    title_name,   title_name_i18n,
    title_suffix, title_suffix_i18n,
    description,  description_i18n,
    button_name,  button_name_i18n,
    features,     features_i18n,
    price, kind, language,
    active, visible, global, main,
    country, service,
    currencyName, currencyCode, currencySymbol, currencyFormat,
    limitDevices,
    vpnMode, dataLimitGB, dataLimitPeriod,
    userNameService, passwordService, codeService,
    details, createdAt, updatedAt,
  }: PlanEntity) {
    this.id                = id                ?? this.id;
    this.title_prefix      = title_prefix      ?? this.title_prefix;
    this.title_prefix_i18n = title_prefix_i18n ?? this.title_prefix_i18n;
    this.title_name        = title_name        ?? this.title_name;
    this.title_name_i18n   = title_name_i18n   ?? this.title_name_i18n;
    this.title_suffix      = title_suffix      ?? this.title_suffix;
    this.title_suffix_i18n = title_suffix_i18n ?? this.title_suffix_i18n;
    this.description       = description       ?? this.description;
    this.description_i18n  = description_i18n  ?? this.description_i18n;
    this.button_name       = button_name       ?? this.button_name;
    this.button_name_i18n  = button_name_i18n  ?? this.button_name_i18n;
    this.features          = features          ?? this.features;
    this.features_i18n     = features_i18n     ?? this.features_i18n;
    this.price             = price             ?? this.price;
    this.kind              = kind              ?? this.kind;
    this.language          = language          ?? this.language;
    this.active            = active            ?? this.active;
    this.visible           = visible           ?? this.visible;
    this.global            = global            ?? this.global;
    this.main              = main              ?? this.main;
    this.country           = country           ?? this.country;
    this.service           = service           ?? this.service;
    this.currencyName      = currencyName      ?? this.currencyName;
    this.currencyCode      = currencyCode      ?? this.currencyCode;
    this.currencySymbol    = currencySymbol    ?? this.currencySymbol;
    this.currencyFormat    = currencyFormat    ?? this.currencyFormat;
    this.limitDevices      = limitDevices      ?? this.limitDevices;
    this.vpnMode           = vpnMode !== undefined ? vpnMode : this.vpnMode;
    this.dataLimitGB       = dataLimitGB       ?? this.dataLimitGB;
    this.dataLimitPeriod   = dataLimitPeriod   ?? this.dataLimitPeriod;
    this.userNameService   = userNameService   ?? this.userNameService;
    this.passwordService   = passwordService   ?? this.passwordService;
    this.codeService       = codeService       ?? this.codeService;
    this.details           = details           ?? this.details;
    this.createdAt         = createdAt         ?? this.createdAt;
    this.updatedAt         = updatedAt         ?? this.updatedAt;
  }

  get() {
    const hasTitle = this.title_name || Object.values(this.title_name_i18n ?? {}).some(v => !!v);
    if (!hasTitle) throw new Error('title_name o title_name_i18n es requerido.');
    if (this.price == null) throw new Error('price es requerido.');
    if (!this.limitDevices) throw new Error('limitDevices es requerido.');
    if (!this.service) throw new Error('service es requerido.');
    return this;
  }
}

export default PlanEntity;
