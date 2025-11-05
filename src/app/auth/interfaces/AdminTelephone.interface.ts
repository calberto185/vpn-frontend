class AdminTelephoneDto {
  phone = "";
  countryName = "";
  countryCode = "";
  flag = "";
  phoneCode = "";
  kind = ""; // enum ["whatsapp", "telegram"]
  whatsapp_id = "";
  telegram_id = "";
  isActive = false;

  constructor() {}
  set({
    phone,
    countryName,
    countryCode,
    flag,
    phoneCode,
    kind,
    whatsapp_id,
    telegram_id,
    isActive,
  }: AdminTelephoneDto) {
    this.phone = phone ?? this.phone;
    this.countryName = countryName ?? this.countryName;
    this.countryCode = countryCode ?? this.countryCode;
    this.flag = flag ?? this.flag;
    this.phoneCode = phoneCode ?? this.phoneCode;
    this.kind = kind ? kind : this.kind;
    this.whatsapp_id = whatsapp_id ?? this.whatsapp_id;
    this.telegram_id = telegram_id ?? this.telegram_id;
    this.isActive = isActive ?? this.isActive;
  }
  get() {
    if(!this.phone) throw new Error('The phone field is required!.');
    if(!this.countryName) throw new Error('The countryName field is required!.');
    if(!this.phoneCode) throw new Error('The phoneCode field is required!.');
    return this;
  }
}

export default AdminTelephoneDto;
