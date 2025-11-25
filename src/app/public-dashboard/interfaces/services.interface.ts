import { CountryEntity } from "./country.interface";

class ServicesEntity {
  id = "";
  sortName = "";
  longName = "";
  Description = "";
  picture = "";
  country = new CountryEntity()
  city = [];
  details = [];
  state = false;
  visible = false;
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
    state,
    visible,
    createdAt,
    updateAt,
  }: ServicesEntity) {
    this.id = id ?? this.id;
    this.sortName = sortName ?? this.sortName;
    this.longName = longName ?? this.longName;
    this.Description = Description ?? this.Description;
    this.picture = picture ?? this.picture;
    this.country = country ?? this.country;
    this.city = city ?? this.city;
    this.details = details ?? this.details;
    this.state = state ?? this.state;
    this.visible = visible ?? this.visible;
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

export default ServicesEntity;
