import PlanClientDto from "./planClient.interface";

export interface User {
  id: string;
  email: string;
  firstNames: string;
  role: string;
  picture: string;
  services: PlanClientDto[];
}
export interface AuthResponse {
  user: User;
  access_token: string;
}





// {
//     "code": "autenticado",
//     "status": 200,
//     "message": "Se ha autenticado exitosamente.",
//     "data": {
//         "user": {
//             "id": "b0bb530d-4d27-4dd0-96c2-dd8e6c604ae3",
//             "email": "carlosvm1829@gmail.com",
//             "firstNames": "admin",
//             "role": "admin",
//             "picture": ""
//         },
//         "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImIwYmI1MzBkLTRkMjctNGRkMC05NmMyLWRkOGU2YzYwNGFlMyIsImVtYWlsIjoiY2FybG9zdm0xODI5QGdtYWlsLmNvbSIsImZpcnN0TmFtZXMiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsInBpY3R1cmUiOiIiLCJpYXQiOjE3NTQ2NDUyNDAsImV4cCI6MTc1NDY0NjE0MH0.8vBYBDW9LVmyBc6K7DrKpHndNsW1P87Kj4wdXhz1dco"
//     }
// }
