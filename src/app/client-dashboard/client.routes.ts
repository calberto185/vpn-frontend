import { Routes } from "@angular/router";
import { ClientDashboardLayoutComponent } from "./layout/client-dashboard-layout/client-dashboard-layout.component";
import { PaymentsComponent } from "./pages/payments/payments.component";
import { DashboardComponent } from "./pages/dashboard/dashboard.component";
import { DevicesComponent } from "./pages/devices/devices.component";
import { ProfileComponent } from "./pages/profile/profile.component";
import { SupportComponent } from "./pages/support/support.component";
import { PlansComponent } from "./pages/plans/plans.component";
import { TutorialComponent } from "./pages/tutorial/tutorial.component";

export const clientRoutes:Routes = [
  {
    path: '',
    component: ClientDashboardLayoutComponent,
    children: [
      {
        path: 'dashboard',
        component: DashboardComponent,
      },
      {
        path: 'tutorial',
        component: TutorialComponent
      },
      {
        path: 'devices',
        component: DevicesComponent
      },
      {
        path: 'profile',
        component: ProfileComponent
      },
      {
        path: 'payments',
        component: PaymentsComponent
      },
      // {
      //   path: 'plans',
      //   component: PlansComponent
      // },
      // {
      //   path: 'support',
      //   component: SupportComponent
      // },
      {
        path: '**',
        redirectTo: '/client/dashboard'
      }
    ]
  }
]

export default clientRoutes;
