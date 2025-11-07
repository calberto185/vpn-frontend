import { CountryEntity } from "./country.interface";
import ServicesEntity from "./services.interface";

class PlanEntity {
  id = "";
  title_prefix = "";
  title_name = "";
  title_suffix = "";
  price = 0;
  description = "";
  features = [];
  button_name = "";
  kind = "";
  language = "";
  active = false;
  visible = false;
  global = false;
  country = new CountryEntity();
  service = new ServicesEntity();
  currencyName = "";
  currencyCode = "";
  currencySymbol = "";
  currencyFormat = "";
  limitDevices = 0;
  details = [];
  createdAt = new Date();
  updatedAt = new Date();


  constructor() {}
  set({
    id,
    title_prefix,
    title_name,
    title_suffix,
    price,
    description,
    features,
    button_name,
    kind,
    language,
    active,
    visible,
    global,
    country,
    service,
    currencyName,
    currencyCode,
    currencySymbol,
    currencyFormat,
    limitDevices,
    details,
    createdAt,
    updatedAt,
  }: PlanEntity) {
    this.id = id ?? this.id;
    this.title_prefix = title_prefix ?? this.title_prefix;
    this.title_name = title_name ?? this.title_name;
    this.title_suffix = title_suffix ?? this.title_suffix;
    this.price = price ?? this.price;
    this.description = description ?? this.description;
    this.features = features ?? this.features;
    this.button_name = button_name ?? this.button_name;
    this.kind = kind ?? this.kind;
    this.language = language ?? this.language;
    this.active = active ?? this.active;
    this.visible = visible ?? this.visible;
    this.global = global ?? this.global;
    this.country = country ?? this.country;
    this.service = service ?? this.service;
    this.currencyName = currencyName ?? this.currencyName;
    this.currencyCode = currencyCode ?? this.currencyCode;
    this.currencySymbol = currencySymbol ?? this.currencySymbol;
    this.currencyFormat = currencyFormat ?? this.currencyFormat;
    this.limitDevices = limitDevices ?? this.limitDevices;
    this.details = details ?? this.details;
    this.createdAt = createdAt ?? this.createdAt;
    this.updatedAt = updatedAt ?? this.updatedAt;
  }
  get() {
    if(!this.title_name) throw new Error('The title_name field is required!.');
    if(!this.price) throw new Error('The price field is required!.');
    if(!this.limitDevices) throw new Error('The limitDevices field is required!.');
    if(!this.service) throw new Error('The service field is required!.');
    return this;
  }
}

export default PlanEntity;
