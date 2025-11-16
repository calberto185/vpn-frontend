class PaymentMethodPayDto {
  id: string = "";
  name: string = "";
  number: string = "";
  cardAccount: string = "";
  typeAccount: string = "";
  constructor() {}
  set({
    id,
    name,
    number,
    cardAccount,
    typeAccount
  }: PaymentMethodPayDto) {
    this.id = id ?? this.id;
    this.name = name ?? this.name;
    this.number = number ?? this.number;
    this.cardAccount = cardAccount ?? this.cardAccount;
    this.typeAccount = typeAccount ?? this.typeAccount;
  }
  get() {
    if(!this.id) throw new Error('The id field is required!.');
    if(!this.name) throw new Error('The name field is required!.');
    if(!this.number) throw new Error('The number field is required!.');
    if(!this.cardAccount) throw new Error('The cardAccount field is required!.');
    if(!this.typeAccount) throw new Error('The typeAccount field is required!.');
    return this;
  }
}

export default PaymentMethodPayDto;
