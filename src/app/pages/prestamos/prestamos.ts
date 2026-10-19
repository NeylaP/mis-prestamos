import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CLASE_ESTADO, FechaPipe, PesosPipe } from '../../core/formato';
import { PrestamosService } from '../../core/prestamos.service';
import { PrestamoForm } from './prestamo-form';

type Filtro = 'Todos' | 'Atrasados' | 'Cobrar pronto' | 'Al día' | 'Pagado';

@Component({
  selector: 'app-prestamos',
  imports: [FormsModule, RouterLink, PesosPipe, FechaPipe, PrestamoForm],
  templateUrl: './prestamos.html',
})
export class Prestamos {
  private readonly datos = inject(PrestamosService);
  protected readonly clase = CLASE_ESTADO;
  protected readonly filtros: Filtro[] = ['Todos', 'Atrasados', 'Cobrar pronto', 'Al día', 'Pagado'];

  readonly busqueda = signal('');
  readonly filtro = signal<Filtro>('Todos');
  readonly verInactivos = signal(false);
  readonly nuevo = signal(false);

  protected readonly cargando = this.datos.cargando;
  protected readonly total = computed(() => this.datos.prestamos().length);

  protected readonly filas = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const f = this.filtro();
    return this.datos.conResumen().filter((p) => {
      const e = p.resumen.estado;
      if (e === 'Inactivo' && !this.verInactivos()) return false;
      if (f === 'Todos' && e === 'Pagado') return false;
      if (f === 'Atrasados' && e !== 'En mora' && e !== 'En gracia') return false;
      if (f !== 'Todos' && f !== 'Atrasados' && e !== f && e !== 'Inactivo') return false;
      return !q || p.deudor.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q) || (p.telefono ?? '').includes(q);
    });
  });
}
