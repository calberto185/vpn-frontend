import { CountryEntity } from "./country.interface";

class SessionsEntity {
  id: string = "";
  user_id: string = "";
  token: string = "";
  createdAt: Date = new Date(1);
  expiresAt: Date = new Date(1);
  ip: string = "";
  userAgent: string = ""


  constructor() {}
  set({
    id,
    user_id,
    token,
    createdAt,
    expiresAt,
    ip,
    userAgent
  }: SessionsEntity) {
    this.id = id ?? this.id;
    this.user_id = user_id ?? this.user_id;
    this.token = token ?? this.token;
    this.createdAt = !!createdAt ? new Date(createdAt) : this.createdAt;
    this.expiresAt = !!expiresAt ? new Date(expiresAt) : this.expiresAt;
    this.ip = ip ?? this.ip;
    this.userAgent = userAgent ?? this.userAgent;
  }
  get() {
    return this;
  }
}

export default SessionsEntity;
