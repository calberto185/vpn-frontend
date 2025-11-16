import PlanClientServerDto from "./planClientServer.interface";
import {CountryEntity} from "./country.interface";

class PlanClientDto {
  service_id = "";
  service_sortName = "";
  service_longName = "";
  plan_id = "";
  plan_title_prefix = "-";
  plan_title_name = "simple";
  plan_title_suffix = "-";
  limitDevices = 0;
  price = 0;
  currencyName = "";
  currencyCode = "";
  currencySymbol = "";
  currencyFormat = "";
  kind = "";
  active = true;
  visible = true;
  global = false;
  country = new CountryEntity();
  servers: PlanClientServerDto[] = []; // new planClientServer
  startedAt = new Date();
  endedAt = null;
  constructor() {}
  set({
    service_id,
    service_sortName,
    service_longName,
    plan_id,
    plan_title_prefix,
    plan_title_name,
    plan_title_suffix,
    limitDevices,
    price,
    currencyName,
    currencyCode,
    currencySymbol,
    currencyFormat,
    kind,
    active,
    visible,
    global,
    country,
    servers,
    startedAt,
    endedAt,
  }: PlanClientDto) {
    this.service_id = service_id ?? this.service_id;
    this.service_sortName = service_sortName ?? this.service_sortName;
    this.service_longName = service_longName ?? this.service_longName;
    this.plan_id = plan_id ?? this.plan_id;
    this.plan_title_prefix = plan_title_prefix ?? this.plan_title_prefix;
    this.plan_title_name = plan_title_name ?? this.plan_title_name;
    this.plan_title_suffix = plan_title_suffix ?? this.plan_title_suffix;
    this.limitDevices = limitDevices ?? this.limitDevices;
    this.price = price ?? this.price;
    this.currencyName = currencyName ?? this.currencyName;
    this.currencyCode = currencyCode ?? this.currencyCode;
    this.currencySymbol = currencySymbol ?? this.currencySymbol;
    this.currencyFormat = currencyFormat ?? this.currencyFormat;
    this.kind = kind ?? this.kind;
    this.active = active ?? this.active;
    this.visible = visible ?? this.visible;
    this.global = global ?? this.global;
    this.country = country ?? this.country;
    this.servers = servers ?? this.servers;
    this.startedAt = startedAt ?? this.startedAt;
    this.endedAt = endedAt ?? this.endedAt;
  }
  get() {
    if(!this.service_id) throw new Error('The service_id field is required!.');
    if(!this.plan_id) throw new Error('The plan_id field is required!.');
    if(!this.limitDevices) throw new Error('The limitDevices field is required!.');
    if(!this.kind) throw new Error('The kind field is required!.');
    if(!this.price) throw new Error('The price field is required!.');
    return this;
  }
}

export default PlanClientDto;
