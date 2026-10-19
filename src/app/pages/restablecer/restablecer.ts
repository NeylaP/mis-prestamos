import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

/** Destino del enlace de "recuperar contraseña" que envía Supabase por correo. */
@Component({
  selector: 'app-restablecer',
  imports: [FormsModule],
  template: `
    <div class="centro">
      <form class="card caja" (ngSubmit)="guardar()">
        <h2>Nueva contraseña</h2>
        @if (!auth.autenticado()) {
          <p class="muted">El enlace no es válido o ya venció. Pide uno nuevo desde la pantalla de inicio de sesión.</p>
        } @else {
          <label class="campo">Nueva contraseña (mínimo 8 caracteres)
            <input type="password" name="c1" autocomplete="new-password" [(ngModel)]="clave1" required>
          </label>
          <label class="campo">Repítela
            <input type="password" name="c2" autocomplete="new-password" [(ngModel)]="clave2" required>
          </label>
          @if (error()) { <span class="error">{{ error() }}</span> }
          <button class="btn btn--primario" type="submit">Guardar contraseña</button>
        }
      </form>
    </div>
  `,
  styles: `.centro { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .caja { width: 100%; max-width: 380px; padding: 20px; display: flex; flex-direction: column; gap: 14px; }`,
})
export class Restablecer {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  clave1 = '';
  clave2 = '';
  readonly error = signal<string | null>(null);

  async guardar(): Promise<void> {
    if (this.clave1.length < 8) return this.error.set('Usa al menos 8 caracteres.');
    if (this.clave1 !== this.clave2) return this.error.set('Las contraseñas no coinciden.');
    const err = await this.auth.cambiarClave(this.clave1);
    if (err) return this.error.set(err);
    this.router.navigateByUrl('/');
  }
}
