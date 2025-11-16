class PaymentStateDto {
  state = "";
  createdAt = new Date();
  constructor() {}
  set({
    state,
    createdAt
  }: PaymentStateDto) {
    this.state = state ?? this.state;
    this.createdAt = createdAt ? new Date(createdAt) : this.createdAt
  }
  get() {
    return this;
  }
}

export default PaymentStateDto;
