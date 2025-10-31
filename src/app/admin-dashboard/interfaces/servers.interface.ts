import { CountryEntity } from "./country.interface";

class serversEntity {
  id = "";
  name = "";
  host = ""
  port = 22;
  country = new CountryEntity();
  userName = "root";
  password = "";
  privateKeyPath = "";
  active = false;
  createdAt = new Date();
  updatedAt = new Date();
  constructor() {}
  set({id, name, host, port, country, userName, password, privateKeyPath, active, createdAt, updatedAt}: serversEntity) {
    this.id = id ?? this.id;
    this.name = name ?? this.name;
    this.host = host ?? this.host;
    this.port = port ?? this.port;
    this.country = country ?? this.country;
    this.userName = userName ?? this.userName;
    this.password = password ?? this.password;
    this.privateKeyPath = privateKeyPath ?? this.privateKeyPath;
    this.active = active ?? this.active;
    this.createdAt = createdAt ?? this.createdAt;
    this.updatedAt = updatedAt ?? this.updatedAt;
  }
  get() {
    if(!this.name) throw new Error('The name field is required!.');
    if(!this.host) throw new Error('The host field is required!.');
    if(!this.port) throw new Error('The port field is required!.');
    if(!this.country) throw new Error('The country field is required!.');
    if(!this.userName) throw new Error('The userName field is required!.');
    if(!this.privateKeyPath) throw new Error('The privateKeyPath field is required!.');
    return this;
  }
}
export default serversEntity;
