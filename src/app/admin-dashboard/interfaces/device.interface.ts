class DeviceEntity {
  id          = "";
  user_id     = "";
  plan_id     = "";
  service_id  = "";
  server_id   = "";
  protocol    = "s-ui";   // "s-ui" | "openvpn"
  device      = "";
  typeDevice  = "";
  active      = false;
  certificate = "";
  // S-UI credentials (populated from certificates page)
  sui_uuid    = "";
  sui_email   = "";
  sui_sub_id  = "";
  revoked     = false;
  revokedAt   = new Date(1);
  suspend     = false;
  suspendAt   = new Date(1);
  createdAt   = new Date();
  updatedAt   = new Date(1);

  constructor() {}
  set({
    id, user_id, plan_id, service_id, server_id, protocol,
    device, typeDevice, active, certificate,
    sui_uuid, sui_email, sui_sub_id,
    revoked, revokedAt, suspend, suspendAt,
    createdAt, updatedAt,
  }: any) {
    this.id         = id         ?? this.id;
    this.user_id    = user_id    ?? this.user_id;
    this.plan_id    = plan_id    ?? this.plan_id;
    this.service_id = service_id ?? this.service_id;
    this.server_id  = server_id  ?? this.server_id;
    this.protocol   = protocol   ?? this.protocol;
    this.device     = device     ?? this.device;
    this.typeDevice = typeDevice ?? this.typeDevice;
    this.active     = active     ?? this.active;
    this.certificate = certificate ?? this.certificate;
    this.sui_uuid   = sui_uuid   ?? this.sui_uuid;
    this.sui_email  = sui_email  ?? this.sui_email;
    this.sui_sub_id = sui_sub_id ?? this.sui_sub_id;
    this.revoked    = revoked    ?? this.revoked;
    this.revokedAt  = revokedAt  ?? this.revokedAt;
    this.suspend    = suspend    ?? this.suspend;
    this.suspendAt  = suspendAt  ?? this.suspendAt;
    this.createdAt  = createdAt  ?? this.createdAt;
    this.updatedAt  = updatedAt  ?? this.updatedAt;
  }
  get() {
    if (!this.user_id)   throw new Error('user_id es requerido');
    if (!this.device)    throw new Error('device es requerido');
    if (!this.typeDevice) throw new Error('typeDevice es requerido');
    return this;
  }
}

export default DeviceEntity;
