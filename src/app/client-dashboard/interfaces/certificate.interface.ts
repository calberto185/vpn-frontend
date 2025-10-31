class CertificateEntity {
  id = "";
  version = ""; // "": 1,
  user = ""; // "": "${USUARIO}",
  user_id = ""; // "": "${USER_ID}",
  device = ""; // "": "${DEVICE}",
  device_id = ""; // "": "${DEVICE_ID}",
  server = ""; // "": "${VPN_HOST}",
  server_id = ""; // "": "${SERVER_ID}",
  hostname = ""; // "": "${HOSTNAME}",
  ip = ""; // "": "${VPN_HOST}",
  created_at = ""; // "": "${NOW_UTC}",
  expires_at = ""; // "": "${EXPIRES_UTC}",
  valid_days = ""; // "": ${VALID_DAYS},
  revoked = ""; // "": false,
  suspended = ""; // "": true,
  tls_auth = ""; // "": true,
  cipher = ""; // "": "AES-256-CBC",
  auth = ""; // "": "SHA256",
  restrict_client = ""; // "": true,
  profile_type = ""; // "": "personal",
  tags = ""; // "": [${TAGS}],
  note = ""; // "": "$(echo "$NOTE" | sed 's/"/\\"/g')"
  createdAt = new Date();
  updatedAt = new Date();

  constructor() {}
  set({
    id,
    version,
    user,
    user_id,
    device,
    device_id,
    server,
    server_id,
    hostname,
    ip,
    created_at,
    expires_at,
    valid_days,
    revoked,
    suspended,
    tls_auth,
    cipher,
    auth,
    restrict_client,
    profile_type,
    tags,
    note,
    createdAt,
    updatedAt,
  }: CertificateEntity) {
    this.id = id ?? this.id;
    this.version = version ?? this.version;
    this.user = user ?? this.user;
    this.user_id = user_id ?? this.user_id;
    this.device = device ?? this.device;
    this.device_id = device_id ?? this.device_id;
    this.server = server ?? this.server;
    this.server_id = server_id ?? this.server_id;
    this.hostname = hostname ?? this.hostname;
    this.ip = ip ?? this.ip;
    this.created_at = created_at ?? this.created_at;
    this.expires_at = expires_at ?? this.expires_at;
    this.valid_days = valid_days ?? this.valid_days;
    this.revoked = revoked ?? this.revoked;
    this.suspended = suspended ?? this.suspended;
    this.tls_auth = tls_auth ?? this.tls_auth;
    this.cipher = cipher ?? this.cipher;
    this.auth = auth ?? this.auth;
    this.restrict_client = restrict_client ?? this.restrict_client;
    this.profile_type = profile_type ?? this.profile_type;
    this.tags = tags ?? this.tags;
    this.note = note ?? this.note;
    this.createdAt = createdAt ?? this.createdAt;
    this.updatedAt = updatedAt ?? this.updatedAt;
  }
  get() {
    if(!this.user) throw new Error('The user field is required!.');
    if(!this.user_id) throw new Error('The user_id field is required!.');
    if(!this.device) throw new Error('The device field is required!.');
    if(!this.device_id) throw new Error('The device_id field is required!.');
    if(!this.server) throw new Error('The server field is required!.');
    if(!this.server_id) throw new Error('The server_id field is required!.');
    if(!this.valid_days) throw new Error('The valid_days field is required!.');
    return this;
  }
}

export default CertificateEntity;
