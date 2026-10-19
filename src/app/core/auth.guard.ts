import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Deja pasar solo con sesión iniciada; si no, manda al login. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  await auth.listo;
  return auth.autenticado() ? true : inject(Router).createUrlTree(['/login']);
};

/** En el login: si ya hay sesión, va directo al inicio. */
export const invitadoGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  await auth.listo;
  return auth.autenticado() ? inject(Router).createUrlTree(['/']) : true;
};
