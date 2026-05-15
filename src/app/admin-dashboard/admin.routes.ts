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
import { CrmComponent } from "./pages/crm/crm.component";
import { PublicContentComponent } from "./pages/public-content/public-content.component";
import { NotificationsSettingsComponent } from "./pages/settings/notifications/notifications.component";
import { SettingsLanguagesComponent } from "./pages/settings/languages/languages.component";
import { TranslationsComponent } from "./pages/settings/translations/translations.component";
import { AdminProfileComponent } from "./pages/profile/profile.component";
import { AdminPreferencesComponent } from "./pages/preferences/preferences.component";
import { AdminMessagesComponent } from "./pages/messages/messages.component";
import { RolesComponent } from "./pages/roles/roles.component";
import { RoutesSettingsComponent } from "./pages/settings/routes/routes-settings.component";
import { BrandingComponent } from "./pages/settings/branding/branding.component";
import { SuppliersComponent } from "./pages/suppliers/suppliers.component";
import { SupplierPaymentsComponent } from "./pages/supplier-payments/supplier-payments.component";
import { WithdrawalsComponent }       from "./pages/withdrawals/withdrawals.component";
import { FinanceComponent } from "./pages/finance/finance.component";
import { AdminTutorialComponent } from "./pages/tutorial/tutorial.component";
import { RoutePermissionGuard } from "./guards/route-permission.guard";

export const authRoutes: Routes = [
  {
    path: '',
    component: AdminDashboardLayoutComponent,
    children: [
      // Dashboard — guarded like every other route
      { path: 'dashboard',    component: DashboardComponent,    canActivate: [RoutePermissionGuard] },

      // Protected routes — RoutePermissionGuard enforces allowedRoutes per role
      { path: 'devices',      component: DevicesComponent,      canActivate: [RoutePermissionGuard] },
      { path: 'certificates', component: CertificatesComponent, canActivate: [RoutePermissionGuard] },
      { path: 'users',        component: UsersComponent,        canActivate: [RoutePermissionGuard] },
      { path: 'payments',     component: PaymentsComponent,     canActivate: [RoutePermissionGuard] },
      { path: 'systems',      component: SystemsComponent,      canActivate: [RoutePermissionGuard] },
      { path: 'activity',     component: ActivityComponent,     canActivate: [RoutePermissionGuard] },
      { path: 'crm',          component: CrmComponent,          canActivate: [RoutePermissionGuard] },
      { path: 'messages',     component: AdminMessagesComponent, canActivate: [RoutePermissionGuard] },
      { path: 'roles',              component: RolesComponent,             canActivate: [RoutePermissionGuard] },
      { path: 'suppliers',          component: SuppliersComponent,         canActivate: [RoutePermissionGuard] },
      { path: 'supplier-payments',  component: SupplierPaymentsComponent,  canActivate: [RoutePermissionGuard] },
      { path: 'withdrawals',        component: WithdrawalsComponent,        canActivate: [RoutePermissionGuard] },
      { path: 'finance',            component: FinanceComponent,           canActivate: [RoutePermissionGuard] },
      { path: 'tutorial',           component: AdminTutorialComponent,     canActivate: [RoutePermissionGuard] },

      // Profile and preferences — always accessible (personal data)
      { path: 'profile',      component: AdminProfileComponent },
      { path: 'preferences',  component: AdminPreferencesComponent },

      // Settings — each sub-route is individually guarded
      {
        path: 'settings',
        component: SettingsComponent,
        children: [
          { path: 'servers',        component: ServersComponent,       canActivate: [RoutePermissionGuard] },
          { path: 'plans',          component: PlansComponent,         canActivate: [RoutePermissionGuard] },
          { path: 'countries',      component: CountriesComponent,     canActivate: [RoutePermissionGuard] },
          { path: 'bank-account',   component: BankAccountComponent,   canActivate: [RoutePermissionGuard] },
          { path: 'services',       component: ServicesComponent,      canActivate: [RoutePermissionGuard] },
          { path: 'terms',          component: TermsComponent,         canActivate: [RoutePermissionGuard] },
          { path: 'apps',           component: AppsComponent,          canActivate: [RoutePermissionGuard] },
          { path: 'public-content',  component: PublicContentComponent,        canActivate: [RoutePermissionGuard] },
          { path: 'notifications',   component: NotificationsSettingsComponent, canActivate: [RoutePermissionGuard] },
          { path: 'languages',       component: SettingsLanguagesComponent,     canActivate: [RoutePermissionGuard] },
          { path: 'translations',    component: TranslationsComponent,          canActivate: [RoutePermissionGuard] },
          { path: 'routes',          component: RoutesSettingsComponent,        canActivate: [RoutePermissionGuard] },
          { path: 'branding',        component: BrandingComponent,              canActivate: [RoutePermissionGuard] },
        ]
      },
      { path: '**', redirectTo: '/panel/dashboard' }
    ]
  }
];

export default authRoutes;
