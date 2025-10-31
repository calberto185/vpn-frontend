
class PlanClientDto {
  plan_id = "";
  devicesLimit = 0;
  name = "simple";
  symbol = "-";
  period = "";
  startedAt = new Date();
  endedAt = null;
  state = true;
  constructor() {}
  set({
    plan_id,
    devicesLimit,
    name,
    symbol,
    period,
    startedAt,
    endedAt,
    state,
  }: PlanClientDto) {
    this.plan_id = plan_id ?? this.plan_id;
    this.devicesLimit = devicesLimit ?? this.devicesLimit;
    this.name = name ?? this.name;
    this.symbol = symbol ?? this.symbol;
    this.period = period ?? this.period;
    this.startedAt = startedAt ?? this.startedAt;
    this.endedAt = endedAt ?? this.endedAt;
    this.state = state ?? this.state;
  }
  get() {
    if(!this.plan_id) throw new Error('The plan_id field is required!.');
    if(!this.devicesLimit) throw new Error('The devicesLimit field is required!.');
    if(!this.period) throw new Error('The period field is required!.');
    return this;
  }
}

export default PlanClientDto;
