import { ContinentEntity } from "./continent.interface";

export class CountryEntity {
  id = "";
  countryName = "";
  countryCode = "";
  languageName = "";
  languageCode = "";
  currencyName = "";
  currencyCode = "";
  currencySymbol = "";
  currencyFormat = "";
  flag = "";
  phoneCode = "";
  isActive = false;
  visible = false;
  continent = new ContinentEntity();
  createdAt = new Date();
  updatedAt = new Date(1);


  constructor() {}
  set({
    id,
    countryName,
    countryCode,
    languageName,
    languageCode,
    currencyName,
    currencyCode,
    currencySymbol,
    currencyFormat,
    flag,
    phoneCode,
    isActive,
    visible,
    continent,
    createdAt,
    updatedAt,
  }: CountryEntity | any) {
    this.id = id ?? this.id;
    this.countryName = countryName ?? this.countryName;
    this.countryCode = countryCode ?? this.countryCode;
    this.languageName = languageName ?? this.languageName;
    this.languageCode = languageCode ?? this.languageCode;
    this.currencyName = currencyName ?? this.currencyName;
    this.currencyCode = currencyCode ?? this.currencyCode;
    this.currencySymbol = currencySymbol ?? this.currencySymbol;
    this.currencyFormat = currencyFormat ?? this.currencyFormat;
    this.flag = flag ?? this.flag;
    this.phoneCode = phoneCode ?? this.phoneCode;
    this.isActive = isActive ?? this.isActive;
    this.visible = visible ?? this.visible;
    this.continent = continent ?? this.continent;
    this.createdAt = createdAt ?? this.createdAt;
    this.updatedAt = updatedAt ?? this.updatedAt;
  }
  get() {
    if(!this.countryName) throw new Error('The countryName field is required!.');
    if(!this.countryCode) throw new Error('The countryCode field is required!.');
    if(!this.languageName) throw new Error('The languageName field is required!.');
    if(!this.languageCode) throw new Error('The languageCode field is required!.');
    if(!this.currencyName) throw new Error('The currencyName field is required!.');
    if(!this.currencyCode) throw new Error('The currencyCode field is required!.');
    if(!this.currencySymbol) throw new Error('The currencySymbol field is required!.');
    if(!this.currencyFormat) throw new Error('The currencyFormat field is required!.');
    if(!this.flag) throw new Error('The flag field is required!.');
    if(!this.phoneCode) throw new Error('The phoneCode field is required!.');
    if(!this.continent) throw new Error('The continent field is required!.');
    return this;
  }
}
