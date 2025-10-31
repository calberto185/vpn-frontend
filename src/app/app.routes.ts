import { Routes } from '@angular/router';
import { NotAuthenticatedGuard } from './auth/guards/not-authenticated.guard';
import { AuthenticatedGuard } from './admin-dashboard/guards/authenticated.guard';
import { PermitedGuard } from './public-dashboard/guards/permited.guard';
import { AuthorizatedGuard } from './client-dashboard/guards/authorizated.guard';
import { StandardGuard } from './admin-dashboard/guards/authorizated.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes'),
    canMatch: [NotAuthenticatedGuard]
  },
  {
    path: 'panel',
    loadChildren: () => import('./admin-dashboard/admin.routes'),
    canMatch: [AuthenticatedGuard, AuthorizatedGuard]
  },
  {
    path: 'client',
    loadChildren: () => import('./client-dashboard/client.routes'),
    canMatch: [AuthenticatedGuard, StandardGuard]
  },
  {
    path: '',
    loadChildren: () => import('./public-dashboard/public.routes'),
    canMatch: [NotAuthenticatedGuard]
  }
];
