import PlanClientDto from "./planClient.interface";

export interface User {
  id: string;
  email: string;
  firstNames: string;
  role: string;
  picture: string;
  // services: PlanClientDto[];
  bloqued: string;
  suspend: string;
  verified: string;
}
export interface AuthResponse {
  user: User;
  access_token: string;
}

