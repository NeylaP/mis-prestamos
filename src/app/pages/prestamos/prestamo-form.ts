import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { aNumero, PesosPipe } from '../../core/formato';
import { Prestamo } from '../../core/modelos';
import { PrestamosService } from '../../core/prestamos.service';
import { Frecuencia, hoyIso } from '../../domain/prestamos-calculo';

/** Modal para crear o editar un préstamo. */
@Component({
  selector: 'app-prestamo-form',
  imports: [FormsModule, PesosPipe],
  template: `
    <div class="modal-fondo" (click)="cerrar.emit()">
      <form class="modal" role="dialog" [attr.aria-label]="titulo()" (click)="$event.stopPropagation()" (ngSubmit)="guardar()">
        <div class="modal__cab"><strong>{{ titulo() }}</strong><button type="button" aria-label="Cerrar" (click)="cerrar.emit()">×</button></div>
        <div class="modal__cuerpo">
          <div class="form-grid">
            <label class="campo">Deudor *<input name="deudor" [(ngModel)]="deudor" required></label>
            <label class="campo">Teléfono<input name="telefono" [(ngModel)]="telefono" inputmode="tel"></label>
            <label class="campo">Fecha del préstamo *<input type="date" name="fecha" [(ngModel)]="fecha" [max]="hoy" required></label>
            <label class="campo">Capital prestado *<input name="capital" [ngModel]="capital()" (ngModelChange)="capital.set(miles($event))" inputmode="numeric" required></label>
            <label class="campo">Tasa por periodo (%) *<input name="tasa" [ngModel]="tasa()" (ngModelChange)="tasa.set($event)" inputmode="decimal" required></label>
            <label class="campo">Frecuencia de cobro
              <select name="frecuencia" [ngModel]="frecuencia()" (ngModelChange)="frecuencia.set($event)">
                <option>Mensual</option><option>Quincenal</option><option>Semanal</option><option>Diario</option>
              </select>
            </label>
            <label class="campo">Abono a capital pactado<input name="abono" [ngModel]="abono()" (ngModelChange)="abono.set(miles($event))" inputmode="numeric" placeholder="0 = solo réditos"></label>
            <label class="campo">Días de gracia<input name="gracia" type="number" min="0" max="60" [(ngModel)]="gracia"></label>
            <label class="campo ancho-total">Notas<textarea name="notas" rows="2" [(ngModel)]="notas"></textarea></label>
          </div>
          <div class="resumen"><div><span>Cuota del primer periodo</span><strong>{{ cuota() | pesos }}</strong></div></div>
          @if (error()) { <span class="error">{{ error() }}</span> }
          <div class="modal__pie">
            <button class="btn" type="button" (click)="cerrar.emit()">Cancelar</button>
            <button class="btn btn--primario" type="submit" [disabled]="guardando()">{{ prestamo() ? 'Guardar cambios' : 'Crear préstamo' }}</button>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class PrestamoForm implements OnInit {
  private readonly datos = inject(PrestamosService);
  readonly prestamo = input<Prestamo | null>(null);
  readonly cerrar = output<void>();
  readonly guardado = output<void>();

  protected readonly hoy = hoyIso();
  deudor = '';
  telefono = '';
  fecha = this.hoy;
  gracia = 3;
  notas = '';
  readonly capital = signal('');
  readonly tasa = signal('5');
  readonly frecuencia = signal<Frecuencia>('Mensual');
  readonly abono = signal('');
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);

  readonly titulo = computed(() => (this.prestamo() ? 'Editar préstamo ' + this.prestamo()!.codigo : 'Nuevo préstamo'));
  readonly cuota = computed(() => {
    const c = aNumero(this.capital());
    return c * this.tasaNum() + Math.min(aNumero(this.abono()), c);
  });

  ngOnInit(): void {
    const p = this.prestamo();
    if (!p) return;
    this.deudor = p.deudor;
    this.telefono = p.telefono ?? '';
    this.fecha = p.fecha;
    this.gracia = p.dias_gracia;
    this.notas = p.notas ?? '';
    this.capital.set(this.miles(String(p.capital)));
    this.tasa.set(String(+(p.tasa * 100).toFixed(4)).replace('.', ','));
    this.frecuencia.set(p.frecuencia);
    this.abono.set(+p.abono_pactado ? this.miles(String(p.abono_pactado)) : '');
  }

  protected miles(v: string): string {
    const n = aNumero(String(v).split(/[.,]00$/)[0]);
    return n ? n.toLocaleString('es-CO') : '';
  }

  private tasaNum(): number {
    return (parseFloat(String(this.tasa()).replace(',', '.')) || 0) / 100;
  }

  async guardar(): Promise<void> {
    const capital = aNumero(this.capital());
    const tasa = this.tasaNum();
    if (!this.deudor.trim() || capital <= 0 || !this.fecha) return this.error.set('Deudor, fecha y capital son obligatorios.');
    if (this.fecha > this.hoy) return this.error.set('La fecha no puede ser futura.');
    if (tasa < 0 || tasa >= 1) return this.error.set('Revisa la tasa: escribe por ejemplo 5 para 5 %.');
    const datos = {
      deudor: this.deudor.trim(), telefono: this.telefono.trim() || null, fecha: this.fecha, capital, tasa,
      frecuencia: this.frecuencia(), abono_pactado: aNumero(this.abono()), dias_gracia: Math.max(0, +this.gracia || 0), notas: this.notas.trim() || null,
    };
    this.guardando.set(true);
    const p = this.prestamo();
    const err = p ? await this.datos.editar(p.id, datos) : await this.datos.crear(datos);
    this.guardando.set(false);
    if (err) return this.error.set(err);
    this.guardado.emit();
  }
}
