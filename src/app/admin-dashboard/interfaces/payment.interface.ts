import PaymentMethodPayDto from './PaymentMethodPay.interface';
import PaymentStateDto from './PaymentState.interface';
import PlanClientDto from './planClient.interface';
class PaymentEntity {
  id = "";
  user_id = "";
  user_name = "";
  user_email = "";
  plan: PlanClientDto = new PlanClientDto();
  kind = ""; // minuto / hora / dia / semana / mes / trimestre / semestre / año
  picture = ""; // evidencia del pago foto
  isPrePay = false;
  state = "Varificando"; // [ "Prepagado", "Pagado", "Aceptado", "Varificando", "Devuelto", "Pendiente"]
  states: PaymentStateDto[] = []; // new PaymentStateDto();
  amount = 0;
  currencyCode = "USD";   // ISO currency code of the payment
  amountInBase = 0;       // amount converted to USD base
  method = ""; // ["efectivo", "tranferencia bancaria", "crypto", "modeneroLocal" "unknow"]
  methodPay = new PaymentMethodPayDto();
  note = "";
  period = "";
  createdAt = new Date();

  constructor() {}
  set({
    id,
    user_id,
    user_name,
    user_email,
    plan,
    kind,
    picture,
    isPrePay,
    state,
    states,
    amount,
    currencyCode,
    amountInBase,
    method,
    methodPay,
    note,
    period,
    createdAt
  }: PaymentEntity) {
    this.id = id ?? this.id;
    this.user_id = user_id ?? this.user_id;
    this.user_name = user_name ?? this.user_name;
    this.user_email = user_email ?? this.user_email;
    this.plan = plan ?? this.plan;
    this.kind = kind ?? this.kind;
    this.picture = picture ?? this.picture;
    this.isPrePay = isPrePay ?? this.isPrePay;
    this.state = state ?? this.state;
    this.states = states ?? this.states;
    this.amount       = amount       ?? this.amount;
    this.currencyCode = currencyCode ?? this.currencyCode;
    this.amountInBase = amountInBase ?? this.amountInBase;
    this.method = method ?? this.method;
    this.methodPay = methodPay ?? this.methodPay;
    this.note = note ?? this.note;
    this.period = period ?? this.period;
    this.createdAt = createdAt ? new Date(createdAt) : this.createdAt
  }
  get() {
    if(!this.user_id) throw new Error('The user_id field is required!.');
    if(!this.plan) throw new Error('The plan field is required!.');
    if(!this.kind) throw new Error('The kind field is required!.');
    if(!this.amount) throw new Error('The amount field is required!.');
    if(!this.method) throw new Error('The method field is required!.');
    if(!this.methodPay) throw new Error('The methodPay field is required!.');
    if(!this.period) throw new Error('The period field is required!.');
    return this;
  }
}

export default PaymentEntity;
