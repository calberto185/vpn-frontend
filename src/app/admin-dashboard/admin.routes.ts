import { Routes } from "@angular/router";
import { AdminDashboardLayoutComponent } from "./layout/admin-dashboard-layout/admin-dashboard-layout.component";
import { ServersComponent } from "./pages/servers/servers.component";
import { UsersComponent } from "./pages/users/users.component";
import { PaymentsComponent } from "./pages/payments/payments.component";
import { SystemsComponent } from "./pages/systems/systems.component";
import { DashboardComponent } from "./pages/dashboard/dashboard.component";
import { DevicesComponent } from "./pages/devices/devices.component";
import { ActivityComponent } from "./pages/activity/activity.component";
import { CertificatesComponent } from "./pages/certificates/certificates.component";
import { SettingsComponent } from "./pages/settings/settings.component";
import { PlansComponent } from "./pages/plans/plans.component";
import { CountriesComponent } from "./pages/countries/countries.component";
import { BankAccountComponent } from "./pages/bank-account/bank-account.component";
import { ServicesComponent } from "./pages/services/services.component";
import { TermsComponent } from "./pages/terms/terms.component";
import { AppsComponent } from "./pages/apps/apps.component";

export const authRoutes:Routes = [
  {
    path: '',
    component: AdminDashboardLayoutComponent,
    children: [
      {
        path: 'dashboard',
        component: DashboardComponent,
      },
      {
        path: 'devices',
        component: DevicesComponent
      },
      {
        path: 'certificates',
        component: CertificatesComponent
      },
      {
        path: 'users',
        component: UsersComponent
      },
      {
        path: 'payments',
        component: PaymentsComponent
      },
      {
        path: 'systems',
        component: SystemsComponent
      },
      {
        path: 'activity',
        component: ActivityComponent
      },
      {
        path: 'settings',
        component: SettingsComponent,
        children: [
          {
            path: 'servers',
            component: ServersComponent
          },
          {
            path: 'plans',
            component: PlansComponent
          },
          {
            path: 'countries',
            component: CountriesComponent
          },
          {
            path: 'bank-account',
            component: BankAccountComponent
          },
          {
            path: 'services',
            component: ServicesComponent
          },
          {
            path: 'terms',
            component: TermsComponent
          },
          {
            path: 'apps',
            component: AppsComponent
          },
        ]
      },
      {
        path: '**',
        redirectTo: '/panel/dashboard'
      }
    ]
  }
]

export default authRoutes;
