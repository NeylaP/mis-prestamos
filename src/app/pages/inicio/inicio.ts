import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CLASE_ESTADO, FechaPipe, PesosPipe } from '../../core/formato';
import { PrestamosService } from '../../core/prestamos.service';

@Component({
  selector: 'app-inicio',
  imports: [RouterLink, PesosPipe, FechaPipe],
  templateUrl: './inicio.html',
})
export class Inicio {
  private readonly datos = inject(PrestamosService);
  protected readonly clase = CLASE_ESTADO;
  protected readonly cargando = this.datos.cargando;
  protected readonly error = this.datos.error;

  private readonly activos = computed(() => this.datos.conResumen().filter((p) => p.resumen.estado !== 'Pagado' && p.resumen.estado !== 'Inactivo'));

  protected readonly kpis = computed(() => {
    const act = this.activos();
    return {
      enLaCalle: act.reduce((a, p) => a + p.resumen.saldo, 0),
      nActivos: act.length,
      pendiente: act.reduce((a, p) => a + p.resumen.totalParaPonerseAlDia, 0),
      reditosCobrados: this.datos.pagos().filter((g) => g.tipo === 'Réditos').reduce((a, g) => a + +g.monto, 0),
      enMora: act.filter((p) => p.resumen.estado === 'En mora').length,
    };
  });

  /** Ya ordenados por urgencia desde el servicio. */
  protected readonly porCobrar = computed(() => this.activos().slice(0, 10));
}
