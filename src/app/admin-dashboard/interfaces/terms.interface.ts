import { CountryEntity } from "./country.interface";

class TermsEntity {
  id = "";
  country = new CountryEntity()
  details = [];
  title = "";
  description = "";
  active = true;
  createdAt = new Date();
  updatedAt = new Date(1);

  constructor() {}
  set({
    id,
    country,
    details,
    title,
    description,
    active,
    createdAt,
    updatedAt,
  }: TermsEntity) {
    this.id = id ?? this.id;
    this.country = country ?? this.country;
    this.details = details ?? this.details;
    this.title = title ?? this.title;
    this.description = description ?? this.description;
    this.active = active ?? this.active;
    this.createdAt = createdAt ?? this.createdAt;
    this.updatedAt = updatedAt ?? this.updatedAt;
  }
  get() {
    if(!this.country) throw new Error('The country field is required!.');
    if(!this.title) throw new Error('The title field is required!.');
    return this;
  }
}

export default TermsEntity;
