import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { authGuard, invitadoGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('auth guards (inject after await)', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            listo: Promise.resolve(),
            autenticado: () => false,
          },
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('authGuard redirige a /login sin llamar inject() tras el await', async () => {
    const result = await TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toEqual(router.createUrlTree(['/login']));
  });

  it('invitadoGuard deja pasar al login sin sesión', async () => {
    const result = await TestBed.runInInjectionContext(() => invitadoGuard({} as never, {} as never));
    expect(result).toBe(true);
  });
});
