import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  correo = '';
  clave = '';
  readonly verClave = signal(false);
  readonly modo = signal<'login' | 'recuperar'>('login');
  readonly error = signal<string | null>(null);
  readonly enviando = signal(false);
  readonly enviado = signal(false);

  async entrar(): Promise<void> {
    if (!this.correo.trim() || !this.clave) {
      this.error.set('Escribe tu correo y tu contraseña.');
      return;
    }
    this.enviando.set(true);
    this.error.set(await this.auth.entrar(this.correo, this.clave));
    this.enviando.set(false);
    if (!this.error()) this.router.navigateByUrl('/');
    else this.clave = '';
  }

  async recuperar(): Promise<void> {
    if (!this.correo.trim()) return;
    this.enviando.set(true);
    await this.auth.enviarRecuperacion(this.correo);
    this.enviando.set(false);
    // Siempre el mismo mensaje: no revela si el correo existe.
    this.enviado.set(true);
  }

  cambiarModo(m: 'login' | 'recuperar'): void {
    this.modo.set(m);
    this.error.set(null);
    this.enviado.set(false);
  }
}
