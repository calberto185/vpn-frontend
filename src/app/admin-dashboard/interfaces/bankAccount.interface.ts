import { CountryEntity } from "./country.interface";

class bankAccountEntity {
  id: string = "";
  name: string = "";
  number: string = "";        // wallet address / IBAN / teléfono / etc.
  cardAccount: string = "";   // CCI/CBU/alias — opcional para cripto
  typeAccount: string = "";
  country: CountryEntity = new CountryEntity();
  active: boolean = false;
  visible: boolean = false;
  note: string = "";

  // Campos cripto
  network: string = "";       // "TRC-20" | "ERC-20" | "BEP-20" | "mainnet" | "TON"
  currency: string = "";      // "USDT" | "BTC" | "ETH" | "TON" | "USDC" | "BNB"
  qr_code: string = "";       // URL o base64 del QR
  min_amount: number = 0;
  confirmations: number = 1;

  createdAt: Date = new Date();
  updatedAt: Date = new Date();

  constructor() {}

  set({
    id, name, number, cardAccount, typeAccount, country,
    active, visible, note,
    network, currency, qr_code, min_amount, confirmations,
    createdAt, updatedAt,
  }: bankAccountEntity | any) {
    this.id           = id           ?? this.id;
    this.name         = name         ?? this.name;
    this.number       = number       ?? this.number;
    this.cardAccount  = cardAccount  ?? this.cardAccount;
    this.typeAccount  = typeAccount  ?? this.typeAccount;
    this.country      = country      ?? this.country;
    this.active       = active       ?? this.active;
    this.visible      = visible      ?? this.visible;
    this.note         = note         ?? this.note;
    this.network      = network      ?? this.network;
    this.currency     = currency     ?? this.currency;
    this.qr_code      = qr_code      ?? this.qr_code;
    this.min_amount   = min_amount   ?? this.min_amount;
    this.confirmations = confirmations ?? this.confirmations;
    this.createdAt    = createdAt    ?? this.createdAt;
    this.updatedAt    = updatedAt    ?? this.updatedAt;
  }

  get() {
    if (!this.name)        throw new Error('El campo name es requerido.');
    if (!this.number)      throw new Error('El campo number (dirección/cuenta) es requerido.');
    if (!this.typeAccount) throw new Error('El campo typeAccount es requerido.');
    return this;
  }

  isCrypto(): boolean {
    return this.typeAccount.startsWith('crypto_') ||
           ['binance_pay', 'bybit_pay'].includes(this.typeAccount);
  }
}

export default bankAccountEntity;
