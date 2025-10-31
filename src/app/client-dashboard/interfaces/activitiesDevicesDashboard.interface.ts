class ActivitiesDevicesDashboardEntity {
    id = ""
    user_id = ""
    device_id = ""
    server_id = ""
    state = false
    createdAt = new Date(0)
    client_ip = ""
    country = ""
    region = ""
    city = ""
    lat = ""
    lon = ""
    user_name = ""
    device_name = ""
    device_type = ""
    device_state = false
    device_suspend = false
    device_revoked = false
    server_name = ""
    server_ip = ""


  constructor() {}
  set({
    id,
    user_id,
    device_id,
    server_id,
    state,
    createdAt,
    client_ip,
    country,
    region,
    city,
    lat,
    lon,
    user_name,
    device_name,
    device_type,
    device_state,
    device_suspend,
    device_revoked,
    server_name,
    server_ip
  }: ActivitiesDevicesDashboardEntity) {
    this.id = id ?? this.id;
    this.user_id = user_id ?? this.user_id;
    this.device_id = device_id ?? this.device_id;
    this.server_id = server_id ?? this.server_id;
    this.state = state ?? this.state;
    this.createdAt = createdAt ?? this.createdAt;
    this.client_ip = client_ip ?? this.client_ip;
    this.country = country ?? this.country;
    this.region = region ?? this.region;
    this.city = city ?? this.city;
    this.lat = lat ?? this.lat;
    this.lon = lon ?? this.lon;
    this.user_name = user_name ?? this.user_name;
    this.device_name = device_name ?? this.device_name;
    this.device_type = device_type ?? this.device_type;
    this.device_state = device_state ?? this.device_state;
    this.device_suspend = device_suspend ?? this.device_suspend;
    this.device_revoked = device_revoked ?? this.device_revoked;
    this.server_name = server_name ?? this.server_name;
    this.server_ip = server_ip ?? this.server_ip;
  }
  get() {
    return this;
  }
}

export default ActivitiesDevicesDashboardEntity;
