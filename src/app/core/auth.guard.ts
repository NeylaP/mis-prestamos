import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Deja pasar solo con sesión iniciada; si no, manda al login. */
export const authGuard: CanActivateFn = async () => {
  // inject() solo es válido antes del primer await (contexto de inyección).
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.listo;
  return auth.autenticado() ? true : router.createUrlTree(['/login']);
};

/** En el login: si ya hay sesión, va directo al inicio. */
export const invitadoGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.listo;
  return auth.autenticado() ? router.createUrlTree(['/']) : true;
};
