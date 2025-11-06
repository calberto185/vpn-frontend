import { CountryEntity } from "./country.interface";
import PlanClientDto from "./planClient.interface";

class ServiceClientDto {
  id = "";
  sortName = "";
  longName = "";
  Description = "";
  picture = "";
  country = new CountryEntity();
  city = [];
  details = [];
  amount = 0;
  coinSymbol = "";
  plan = new PlanClientDto();
  plans = [];
  state = false;
  createdAt = new Date();
  updateAt = new Date(1);

  constructor() {}
  set({
    id,
    sortName,
    longName,
    Description,
    picture,
    country,
    city,
    details,
    amount,
    coinSymbol,
    plan,
    plans,
    state,
    createdAt,
    updateAt,
  }: ServiceClientDto) {
    this.id = id ?? this.id;
    this.sortName = sortName ?? this.sortName;
    this.longName = longName ?? this.longName;
    this.Description = Description ?? this.Description;
    this.picture = picture ?? this.picture;
    this.country = country ?? this.country;
    this.city = city ?? this.city;
    this.details = details ?? this.details;
    this.amount = amount ?? this.amount;
    this.coinSymbol = coinSymbol ?? this.coinSymbol;
    this.plan = plan ?? this.plan;
    this.plans = plans ?? this.plans;
    this.state = state ?? this.state;
    this.createdAt = createdAt ?? this.createdAt;
    this.updateAt = updateAt ?? this.updateAt;
  }
  get() {
    if(!this.sortName) throw new Error('The sortName field is required!.');
    if(!this.longName) throw new Error('The longName field is required!.');
    if(!this.country) throw new Error('The country field is required!.');
    return this;
  }
}

export default ServiceClientDto;
