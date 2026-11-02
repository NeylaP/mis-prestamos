import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CLASE_ESTADO, FechaPipe, PesosPipe } from '../../core/formato';
import { Evento, Pago, Prestamo } from '../../core/modelos';
import { PrestamosService } from '../../core/prestamos.service';
import { aFecha } from '../../domain/prestamos-calculo';
import { PrestamoForm } from '../prestamos/prestamo-form';
import { PagoForm } from './pago-form';

const CAMPOS: Record<string, string> = {
  deudor: 'Deudor', telefono: 'Teléfono', fecha: 'Fecha', capital: 'Capital', tasa: 'Tasa', frecuencia: 'Frecuencia',
  dia_cobro: 'Día de cobro', abono_pactado: 'Abono pactado', dias_gracia: 'Días de gracia', activo: 'Activo',
  motivo_inactivo: 'Motivo', notas: 'Notas', inactivo_desde: 'Inactivo desde',
};
const TITULO_EVENTO: Record<string, string> = { creado: 'Creación', editado: 'Edición', activado: 'Activación', desactivado: 'Desactivación', pago: 'Pago' };

@Component({
  selector: 'app-prestamo-detalle',
  imports: [FormsModule, RouterLink, PesosPipe, FechaPipe, PrestamoForm, PagoForm],
  templateUrl: './prestamo-detalle.html',
})
export class PrestamoDetalle {
  protected readonly datos = inject(PrestamosService);
  readonly id = input.required<string>();
  protected readonly clase = CLASE_ESTADO;

  readonly p = computed(() => this.datos.conResumen().find((x) => x.id === this.id()) ?? null);
  readonly tab = signal<'mov' | 'hist'>('mov');
  readonly modal = signal<'pago' | 'editar' | 'desactivar' | null>(null);
  readonly motivo = signal('');
  readonly aviso = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  readonly cargandoHist = signal(false);
  readonly eventos = signal<Evento[]>([]);

  /** Extracto: entrega del préstamo + pagos en orden, con saldo y réditos acumulados. */
  readonly movimientos = computed(() => {
    const p = this.p();
    if (!p) return [];
    const pagos = this.datos.pagos().filter((g) => g.prestamo_id === p.id).slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || a.created_at.localeCompare(b.created_at));
    let cap = 0, red = 0;
    return [{ fecha: p.fecha, tipo: 'Préstamo entregado', medio: '—', monto: +p.capital, red: 0, saldo: +p.capital, pago: null as Pago | null }].concat(
      pagos.map((g) => {
        if (g.tipo === 'Capital') cap += +g.monto; else red += +g.monto;
        return { fecha: g.fecha, tipo: g.tipo === 'Capital' ? 'Abono a capital' : 'Pago de réditos', medio: g.medio, monto: +g.monto, red, saldo: Math.max(0, +p.capital - cap), pago: g };
      }),
    );
  });

  /** Historial en grilla: una fila por campo cambiado. */
  readonly historial = computed(() =>
    this.eventos().flatMap((e) => {
      const base = { fecha: e.created_at, evento: TITULO_EVENTO[e.tipo] ?? e.tipo };
      if (e.tipo === 'editado' || e.tipo === 'activado' || e.tipo === 'desactivado') {
        return Object.keys(e.despues ?? {}).filter((k) => CAMPOS[k]).map((k, i) => ({
          ...base, primera: i === 0, campo: CAMPOS[k], antes: this.valor(k, e.antes?.[k]), despues: this.valor(k, e.despues?.[k]),
        }));
      }
      if (e.tipo === 'pago') {
        const d = e.despues ?? {};
        return [{ ...base, primera: true, campo: String(d['tipo']), antes: '—', despues: (+String(d['monto'])).toLocaleString('es-CO') + ' · ' + String(d['medio']) }];
      }
      return [{ ...base, primera: true, campo: 'Préstamo', antes: '—', despues: 'Capital ' + this.valor('capital', e.despues?.['capital']) }];
    }),
  );

  constructor() {
    effect(() => {
      if (this.tab() === 'hist' && this.p()) {
        this.cargandoHist.set(true);
        this.datos.eventos(this.id()).then((ev) => {
          this.eventos.set(ev);
          this.cargandoHist.set(false);
        });
      }
    });
  }

  protected diaCobro(p: Prestamo): number {
    return p.dia_cobro ?? aFecha(p.fecha).getDate();
  }

  private valor(campo: string, v: unknown): string {
    if (v === null || v === undefined || v === '') return '—';
    if (campo === 'tasa') return (+String(v) * 100).toLocaleString('es-CO') + '%';
    if (campo === 'capital' || campo === 'abono_pactado') return '$ ' + (+String(v)).toLocaleString('es-CO');
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    return String(v);
  }

  async verComprobante(ruta: string): Promise<void> {
    this.guardando.set(true);
    const url = await this.datos.urlComprobante(ruta);
    this.guardando.set(false);
    if (url) window.open(url, '_blank', 'noopener');
    else this.mostrar('No se pudo abrir el comprobante.');
  }

  async cambiarEstado(): Promise<void> {
    const p = this.p();
    if (!p) return;
    this.guardando.set(true);
    this.error.set(null);
    const err = p.activo ? await this.datos.desactivar(p.id, this.motivo().trim()) : await this.datos.activar(p.id);
    this.guardando.set(false);
    if (err) return this.error.set(err);
    this.modal.set(null);
    this.mostrar(p.activo ? 'Préstamo desactivado' : 'Préstamo activado');
  }

  mostrar(msg: string): void {
    this.modal.set(null);
    this.aviso.set(msg);
    setTimeout(() => this.aviso.set(null), 3000);
    if (this.tab() === 'hist') {
      this.cargandoHist.set(true);
      this.datos.eventos(this.id()).then((ev) => {
        this.eventos.set(ev);
        this.cargandoHist.set(false);
      });
    }
  }
}
