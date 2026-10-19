import { Routes } from '@angular/router';
import { authGuard, invitadoGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', canActivate: [invitadoGuard], loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  { path: 'restablecer', loadComponent: () => import('./pages/restablecer/restablecer').then((m) => m.Restablecer) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', title: 'Inicio', loadComponent: () => import('./pages/inicio/inicio').then((m) => m.Inicio) },
      { path: 'prestamos', title: 'Préstamos', loadComponent: () => import('./pages/prestamos/prestamos').then((m) => m.Prestamos) },
      { path: 'prestamos/:id', title: 'Préstamo', loadComponent: () => import('./pages/prestamo-detalle/prestamo-detalle').then((m) => m.PrestamoDetalle) },
      { path: 'proximamente/:modulo', title: 'Próximamente', loadComponent: () => import('./pages/proximamente/proximamente').then((m) => m.Proximamente) },
    ],
  },
  { path: '**', redirectTo: '' },
];
