import { CountryEntity } from "./country.interface";

class bankAccountEntity {
  id: string = "";
  name: string = "";
  number: string = "";
  cardAccount: string = "";
  typeAccount: string = "";
  country: CountryEntity = new CountryEntity();
  active: boolean = false;
  note: string = "";
  createdAt: Date = new Date();
  updatedAt: Date = new Date();

  constructor() {}
  set({
    id,
    name,
    number,
    cardAccount,
    typeAccount,
    country,
    active,
    note,
    createdAt,
    updatedAt
  }: bankAccountEntity | any) {
    this.id = id ?? this.id;
    this.name = name ?? this.name;
    this.number = number ?? this.number;
    this.cardAccount = cardAccount ?? this.cardAccount;
    this.typeAccount = typeAccount ?? this.typeAccount;
    this.country = country ?? this.country;
    this.active = active ?? this.active;
    this.note = note ?? this.note;
    this.createdAt = createdAt ?? this.createdAt;
    this.updatedAt = updatedAt ?? this.updatedAt;
  }
  get() {
    if(!this.name) throw new Error('The name field is required!.');
    if(!this.number) throw new Error('The number field is required!.');
    if(!this.cardAccount) throw new Error('The cardAccount field is required!.');
    if(!this.typeAccount) throw new Error('The typeAccount field is required!.');
    if(!this.country?.countryName) throw new Error('The country field is required!.');
    return this;
  }
}

export default bankAccountEntity;
