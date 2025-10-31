
class PlanClientServerDto {
  server_id = "";
  plan_id = "";
  server_name = "";
  server_country = "";
  access_permmit = false;
  addAt = new Date();
  constructor() {}
  set({
    server_id,
    plan_id,
    server_name,
    server_country,
    access_permmit,
    addAt,
  }: PlanClientServerDto) {
    this.server_id = server_id ?? this.server_id;
    this.plan_id = plan_id ?? this.plan_id;
    this.server_name = server_name ?? this.server_name;
    this.server_country = server_country ?? this.server_country;
    this.access_permmit = access_permmit ?? this.access_permmit;
    this.addAt = addAt ?? this.addAt;
  }
  get() {
    if(!this.server_id) throw new Error('The server_id field is required!.');
    if(!this.plan_id) throw new Error('The plan_id field is required!.');
    if(!this.server_name) throw new Error('The server_name field is required!.');
    if(!this.server_country) throw new Error('The server_country field is required!.');
    return this;
  }
}

export default PlanClientServerDto;
