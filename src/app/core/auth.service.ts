import { computed, inject, Injectable, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sb = inject(SupabaseService).client;

  readonly session = signal<Session | null>(null);
  readonly usuario = computed(() => this.session()?.user ?? null);
  readonly autenticado = computed(() => !!this.session());
  /** Se resuelve cuando ya sabemos si hay sesión guardada (evita parpadeos en el guard). */
  readonly listo: Promise<void>;
  /** true cuando el usuario llegó desde el enlace de "recuperar contraseña". */
  readonly recuperando = signal(false);

  constructor() {
    this.listo = this.sb.auth.getSession().then(({ data }) => this.session.set(data.session));
    this.sb.auth.onAuthStateChange((evento, session) => {
      this.session.set(session);
      if (evento === 'PASSWORD_RECOVERY') this.recuperando.set(true);
    });
  }

  async entrar(correo: string, clave: string): Promise<string | null> {
    const { error } = await this.sb.auth.signInWithPassword({ email: correo.trim(), password: clave });
    if (!error) return null;
    // Mensaje genérico: no revela si el correo existe.
    if (error.status === 429) return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
    return 'Correo o contraseña incorrectos.';
  }

  async salir(): Promise<void> {
    await this.sb.auth.signOut();
  }

  async enviarRecuperacion(correo: string): Promise<void> {
    const destino = new URL('restablecer', document.baseURI).toString();
    await this.sb.auth.resetPasswordForEmail(correo.trim(), { redirectTo: destino });
  }

  async cambiarClave(nueva: string): Promise<string | null> {
    const { error } = await this.sb.auth.updateUser({ password: nueva });
    if (error) return error.message;
    this.recuperando.set(false);
    return null;
  }
}
