import AdminTelephoneDto from './AdminTelephone.interface';
import { CountryEntity } from './country.interface';
import PlanClientDto from './planClient.interface';
class UserEntity {
  id: string = "";
  firstNames: string = "";
  lastNames: string = "";
  telephone: AdminTelephoneDto[] = [];
  picture: string = "";
  role: string = "standar";
  isAdmin: boolean = false;
  email: string = "";
  password: string = "";
  country: CountryEntity = new CountryEntity();
  dni: string = "";
  state: string = "Pendiente"; // ["Pendiente", "Suspendido", "Activo", "Bloqueado"]
  verified: boolean = false;
  verifiedAt: Date = new Date(1);
  bloqued: boolean = false;
  bloquedAt: Date = new Date(1);
  suspend: boolean = false;
  suspendAt: Date = new Date(1);
  onService: boolean = false;
  onServiceAt: Date = new Date(1);
  services: any = [];
  observations: string = "";
  // devices = [];
  // devicesLimit: number = 1;
  // plan: string = "simple";
  // planSymbol: string = "-";
  // amount = 0;
  // coinSymbol = "";
  // plan = new PlanClientDto();
  // plans = [];
  createdAt: Date = new Date();
  constructor() {}
  set({
    id,
    firstNames,
    lastNames,
    telephone,
    picture,
    role,
    isAdmin,
    email,
    password,
    country,
    dni,
    state,
    verified,
    verifiedAt,
    bloqued,
    bloquedAt,
    suspend,
    suspendAt,
    onService,
    onServiceAt,
    services,
    observations,
    // devices,
    // devicesLimit,
    // plan,
    // planSymbol,
    // amount,
    // coinSymbol,
    // plan,
    // plans,
    createdAt
  }: any) {
    this.id = id ?? this.id;
    this.firstNames = firstNames ?? this.firstNames;
    this.lastNames = lastNames ?? this.lastNames;
    this.telephone = telephone ?? this.telephone;
    this.picture = picture ?? this.picture;
    this.role = role ?? this.role;
    this.isAdmin = isAdmin ?? this.isAdmin;
    this.email = email ?? this.email;
    this.password = password ?? this.password;
    this.country = country ?? this.country;
    this.dni = dni ?? this.dni;
    this.state = state ?? this.state;
    this.verified = verified ?? this.verified;
    this.verifiedAt = verifiedAt ?? this.verifiedAt;
    this.bloqued = bloqued ?? this.bloqued;
    this.bloquedAt = bloquedAt ?? this.bloquedAt;
    this.suspend = suspend ?? this.suspend;
    this.suspendAt = suspendAt ?? this.suspendAt;
    this.onService = onService ?? this.onService;
    this.services = services ?? this.services;
    this.onServiceAt = onServiceAt ?? this.onServiceAt;
    this.observations = observations ?? this.observations;
    // this.devices = devices ?? this.devices;
    // this.devicesLimit = devicesLimit ?? this.devicesLimit;
    // this.plan = plan ?? this.plan;
    // this.planSymbol = planSymbol ?? this.planSymbol;
    // this.amount = amount ?? this.amount;
    // this.coinSymbol = coinSymbol ?? this.coinSymbol;
    // this.plan = plan ?? this.plan;
    // this.plans = plans ?? this.plans;
    this.createdAt = createdAt ?? this.createdAt;
  }
  get() {
    if(!this.firstNames) throw new Error('The firstNames field is required!.');
    if(!this.lastNames) throw new Error('The lastNames field is required!.');
    if(!this.telephone) throw new Error('The telephone field is required!.');
    if(!this.email) throw new Error('The email field is required!.');
    if(!this.password) throw new Error('The password field is required!.');
    // if(!this.dni) throw new Error('The dni field is required!.');
    if(!this.country) throw new Error('The dni field is required!.');
    return this;
  }
}

export default UserEntity;
