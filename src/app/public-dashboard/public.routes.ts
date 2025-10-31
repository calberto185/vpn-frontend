import { Routes } from "@angular/router";
import { PublicDashboardLayoutComponent } from "./layout/public-dashboard-layout/public-dashboard-layout.component";

export const authRoutes:Routes = [
  {
    path: '',
    component: PublicDashboardLayoutComponent,
    // children: [
    //   {
    //     path: 'login',
    //     component: LoginPageComponent
    //   },
    //   {
    //     path: 'register',
    //     component: RegisterPageComponent
    //   },
    //   {
    //     path: 'resetear-password',
    //     component: ResetearpasswordPageComponent
    //   },
    //   {
    //     path: '**',
    //     redirectTo: 'login'
    //   }
    // ]
  }
]

export default authRoutes;
