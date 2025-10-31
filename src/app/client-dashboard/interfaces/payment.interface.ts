class PaymentEntity {
  id = "";
  user_id = "";
  device_id = "";
  plan_id = "";
  plan = "";
  service = "";
  kind = "";
  device = "";
  picture = ""; // evidencia del pago
  state = "Pendiente"; // ["Pendiente"; "Aceptado", "Varificando", "Devuelto"]
  amount = 0;
  clientAccount = "";
  clientCoin = "";
  adminAccount = "";
  adminCoin = "";
  note = "";
  period = "";
  createdAt = new Date();

  constructor() {}
  set({
    id,
    user_id,
    device_id,
    plan_id,
    plan,
    service,
    kind,
    device,
    picture,
    state,
    amount,
    clientAccount,
    clientCoin,
    adminAccount,
    adminCoin,
    note,
    period,
    createdAt,
  }: PaymentEntity) {
    this.id = id ?? this.id;
    this.user_id = user_id ?? this.user_id;
    this.device_id = device_id ?? this.device_id;
    this.plan_id = plan_id ?? this.plan_id;
    this.plan = plan ?? this.plan;
    this.service = service ?? this.service;
    this.kind = kind ?? this.kind;
    this.device = device ?? this.device;
    this.picture = picture ?? this.picture;
    this.state = state ?? this.state;
    this.amount = amount ?? this.amount;
    this.clientAccount = clientAccount ?? this.clientAccount;
    this.clientCoin = clientCoin ?? this.clientCoin;
    this.adminAccount = adminAccount ?? this.adminAccount;
    this.adminCoin = adminCoin ?? this.adminCoin;
    this.note = note ?? this.note;
    this.period = period ?? this.period;
    this.createdAt = createdAt ?? this.createdAt;
  }
  get() {
    if(!this.user_id) throw new Error('The user_id field is required!.');
    if(!this.device_id) throw new Error('The device_id field is required!.');
    if(!this.plan_id) throw new Error('The plan_id field is required!.');
    if(!this.device) throw new Error('The device field is required!.');
    if(!this.picture) throw new Error('The picture field is required!.');
    if(!this.amount) throw new Error('The amount field is required!.');
    if(!this.clientAccount) throw new Error('The clientAccount field is required!.');
    if(!this.clientCoin) throw new Error('The clientCoin field is required!.');
    if(!this.adminAccount) throw new Error('The adminAccount field is required!.');
    if(!this.adminCoin) throw new Error('The adminCoin field is required!.');
    if(!this.period) throw new Error('The period field is required!.');
    return this;
  }
}

export default PaymentEntity;
