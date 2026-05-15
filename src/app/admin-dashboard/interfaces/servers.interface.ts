import { CountryEntity } from "./country.interface";

export interface SuiClient {
  id:         number;
  email:      string;
  enable:     boolean;
  up:         number;
  down:       number;
  total:      number;
  expiryTime: number;
  flow?:      string;
  remark?:    string;
}

class serversEntity {
  id             = "";
  name           = "";
  host           = "";
  port           = 22;
  country        = new CountryEntity();
  protocol       = "s-ui";    // "s-ui" | "openvpn" | "both"
  active         = false;
  visible        = false;
  note           = "";
  tags: string[] = [];

  // ── SSH / OpenVPN ─────────────────────────────────────────────────────────
  userName       = "root";
  password       = "";
  privateKeyPath = "";

  // ── S-UI (sing-box panel) ─────────────────────────────────────────────────
  sui_url        = "";
  sui_username   = "";
  sui_password   = "";
  sui_token      = "";
  sui_sub_url    = "";
  sui_inbound_id = 1;

  createdAt = new Date();
  updatedAt = new Date();

  constructor() {}

  set({
    id, name, host, port, country, protocol, active, visible, note, tags,
    userName, password, privateKeyPath,
    sui_url, sui_username, sui_password, sui_token, sui_sub_url, sui_inbound_id,
    createdAt, updatedAt,
  }: any) {
    this.id             = id             ?? this.id;
    this.name           = name           ?? this.name;
    this.host           = host           ?? this.host;
    this.port           = port           ?? this.port;
    this.country        = country        ?? this.country;
    this.protocol       = protocol       ?? this.protocol;
    this.active         = active         ?? this.active;
    this.visible        = visible        ?? this.visible;
    this.note           = note           ?? this.note;
    this.tags           = tags           ?? this.tags;
    this.userName       = userName       ?? this.userName;
    this.password       = password       ?? this.password;
    this.privateKeyPath = privateKeyPath ?? this.privateKeyPath;
    this.sui_url        = sui_url        ?? this.sui_url;
    this.sui_username   = sui_username   ?? this.sui_username;
    this.sui_password   = sui_password   ?? this.sui_password;
    this.sui_token      = sui_token      ?? this.sui_token;
    this.sui_sub_url    = sui_sub_url    ?? this.sui_sub_url;
    this.sui_inbound_id = sui_inbound_id ?? this.sui_inbound_id;
    this.createdAt      = createdAt      ?? this.createdAt;
    this.updatedAt      = updatedAt      ?? this.updatedAt;
  }

  get() {
    if (!this.name)     throw new Error('name es requerido');
    if (!this.host)     throw new Error('host es requerido');
    if (!this.protocol) throw new Error('protocol es requerido');
    return this;
  }
}

export default serversEntity;
