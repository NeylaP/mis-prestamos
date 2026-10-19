import { Component, computed, inject, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { PrestamosService } from '../core/prestamos.service';

interface ItemMenu { ruta: string; texto: string; icono: string; exacto?: boolean }

/** Estructura general: encabezado + menú lateral + contenido. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly datos = inject(PrestamosService);

  readonly correo = computed(() => this.auth.usuario()?.email ?? '');

  // Los módulos que aún no existen llevan a "Próximamente" y se irán activando.
  readonly menu: ItemMenu[] = [
    { ruta: '/', texto: 'Inicio', icono: 'M3 10.5 12 4l9 6.5V20H3z', exacto: true },
    { ruta: '/prestamos', texto: 'Préstamos', icono: 'M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.8-4-5.6' },
    { ruta: '/proximamente/arriendos', texto: 'Arriendos', icono: 'M5 3h14v18H5zM9 7h2M13 7h2M9 11h2M13 11h2M11 21v-3h2v3' },
    { ruta: '/proximamente/creditos', texto: 'Créditos', icono: 'M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18' },
    { ruta: '/proximamente/ahorros', texto: 'Ahorros', icono: 'M12 3v18M7 8h7.5a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8' },
    { ruta: '/proximamente/finanzas', texto: 'Finanzas', icono: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  ];

  ngOnInit(): void {
    this.datos.cargar();
  }

  async salir(): Promise<void> {
    await this.auth.salir();
    this.router.navigateByUrl('/login');
  }
}
