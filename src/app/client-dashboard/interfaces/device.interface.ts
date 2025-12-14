class DeviceEntity {
  id = "";
  user_id = "";
  plan_id = "";
  service_id = "";
  server_id = "";
  device = "";
  typeDevice = "";
  active = false;
  certificate = "";
  revoked = false;
  revokedAt = new Date(1);
  suspend = false;
  suspendAt = new Date(1);
  createdAt = new Date();
  updatedAt = new Date(1);

  constructor() {}
  set({
    id,
    user_id,
    plan_id,
    service_id,
    server_id,
    device,
    typeDevice,
    active,
    certificate,
    revoked,
    revokedAt,
    suspend,
    suspendAt,
    createdAt,
    updatedAt,
  }: DeviceEntity) {
    this.id = id ?? this.id;
    this.user_id = user_id ?? this.user_id;
    this.plan_id = plan_id ?? this.plan_id;
    this.service_id = service_id ?? this.service_id;
    this.server_id = server_id ?? this.server_id;
    this.device = device ?? this.device;
    this.typeDevice = typeDevice ?? this.typeDevice;
    this.active = active ?? this.active;
    this.certificate = certificate ?? this.certificate;
    this.revoked = revoked ?? this.revoked;
    this.revokedAt = revokedAt ?? this.revokedAt;
    this.suspend = suspend ?? this.suspend;
    this.suspendAt = suspendAt ?? this.suspendAt;
    this.createdAt = createdAt ?? this.createdAt;
    this.updatedAt = updatedAt ?? this.updatedAt;
  }
  get() {
    if(!this.user_id) throw new Error('The user_id field is required!.');
    if(!this.plan_id) throw new Error('The plan_id field is required!.');
    if(!this.device) throw new Error('The device field is required!.');
    if(!this.typeDevice) throw new Error('The typeDevice field is required!.');
    if(!this.active) throw new Error('The active field is required!.');
    return this;
  }
}

export default DeviceEntity;
