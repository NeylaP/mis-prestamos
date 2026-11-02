import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { aNumero, PesosPipe } from '../../core/formato';
import { MedioPago, PrestamoConResumen } from '../../core/modelos';
import { PrestamosService } from '../../core/prestamos.service';
import { hoyIso, TipoPago } from '../../domain/prestamos-calculo';

const TIPOS_OK = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/** Modal para registrar un pago. Por defecto es pago de réditos; el abono a capital es explícito. */
@Component({
  selector: 'app-pago-form',
  imports: [FormsModule, PesosPipe],
  template: `
    <div class="modal-fondo" (click)="cerrar.emit()">
      <form class="modal" role="dialog" aria-label="Registrar pago" (click)="$event.stopPropagation()" (ngSubmit)="guardar()">
        <div class="modal__cab"><strong>Registrar pago · {{ p().deudor }}</strong><button type="button" aria-label="Cerrar" (click)="cerrar.emit()">×</button></div>
        <div class="modal__cuerpo">
          <span class="muted">Saldo {{ p().resumen.saldo | pesos }} · pendiente <strong style="color: var(--mora)">{{ p().resumen.reditosPendientes | pesos }}</strong> · cuota {{ p().resumen.cuotaProximoPeriodo | pesos }}</span>
          <label class="campo">Concepto del pago
            <select name="tipo" [ngModel]="tipo()" (ngModelChange)="tipo.set($event); error.set(null)">
              <option value="Réditos">Pago de réditos (intereses)</option>
              <option value="Capital">Abono a capital</option>
            </select>
          </label>
          <label class="campo">Monto recibido
            <input name="monto" inputmode="numeric" style="font-size: 20px; font-weight: 800; height: 46px" [ngModel]="montoTxt()" (ngModelChange)="setMonto($event)">
          </label>
          <div class="opciones">
            @if (tipo() === 'Réditos') {
              @if (p().resumen.reditosPendientes) {
                <button type="button" class="opcion" (click)="monto.set(p().resumen.reditosPendientes)">Solo lo pendiente · {{ p().resumen.reditosPendientes | pesos }}</button>
              }
              <button type="button" class="opcion" (click)="monto.set(p().resumen.cuotaProximoPeriodo)">Cuota del periodo · {{ p().resumen.cuotaProximoPeriodo | pesos }}</button>
            } @else {
              @if (p().abono_pactado > 0) {
                <button type="button" class="opcion" (click)="monto.set(+p().abono_pactado)">Abono pactado · {{ p().abono_pactado | pesos }}</button>
              }
              <button type="button" class="opcion" (click)="monto.set(p().resumen.saldo)">Cancelar capital · {{ p().resumen.saldo | pesos }}</button>
            }
          </div>
          <div class="resumen">
            @if (tipo() === 'Réditos') {
              <div><span>Se registra como pago de réditos</span><strong>{{ monto() | pesos }}</strong></div>
              <div><span>Réditos pendientes después</span><strong>{{ Math.max(0, p().resumen.reditosPendientes - monto()) | pesos }}</strong></div>
              <div style="border-top: 1px solid var(--linea); padding-top: 6px"><span>Saldo de capital (sin cambio)</span><strong>{{ p().resumen.saldo | pesos }}</strong></div>
            } @else {
              <div><span>Se registra como abono a capital</span><strong>{{ monto() | pesos }}</strong></div>
              @if (sobrante()) { <div style="color: var(--mora)"><span>Excede el saldo</span><strong>{{ sobrante() | pesos }}</strong></div> }
              <div style="border-top: 1px solid var(--linea); padding-top: 6px"><span>Nuevo saldo</span><strong>{{ Math.max(0, p().resumen.saldo - monto()) | pesos }}</strong></div>
            }
          </div>
          <div class="form-grid">
            <label class="campo">Fecha del pago<input type="date" name="fecha" [max]="hoy" [(ngModel)]="fecha" required></label>
            <label class="campo">Medio de pago
              <select name="medio" [ngModel]="medio()" (ngModelChange)="medio.set($event); errorArchivo.set(null)">
                <option>Efectivo</option><option>Nequi</option><option>Transferencia</option>
              </select>
            </label>
          </div>
          <label class="campo">Comprobante {{ medio() === 'Efectivo' ? '(opcional en efectivo)' : '(obligatorio para ' + medio() + ')' }}
            <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style="height: auto; padding: 8px" (change)="elegirArchivo($event)">
          </label>
          @if (errorArchivo()) { <span class="error">{{ errorArchivo() }}</span> }
          <label class="campo">Nota<input name="nota" [(ngModel)]="nota" placeholder="Opcional"></label>
          @if (error()) { <span class="error">{{ error() }}</span> }
          <div class="modal__pie">
            <button class="btn" type="button" (click)="cerrar.emit()" [disabled]="guardando()">Cancelar</button>
            <button class="btn btn--primario" type="submit" [disabled]="guardando() || !puedeGuardar()">{{ guardando() ? 'Guardando…' : 'Guardar pago' }}</button>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class PagoForm {
  private readonly datos = inject(PrestamosService);
  readonly p = input.required<PrestamoConResumen>();
  readonly cerrar = output<void>();
  readonly guardado = output<string>();

  protected readonly Math = Math;
  protected readonly hoy = hoyIso();
  fecha = this.hoy;
  nota = '';
  /** Por defecto siempre réditos; capital solo si la usuaria lo elige. */
  readonly tipo = signal<TipoPago>('Réditos');
  readonly monto = signal(0);
  readonly medio = signal<MedioPago>('Efectivo');
  readonly archivo = signal<File | null>(null);
  readonly errorArchivo = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);

  readonly montoTxt = computed(() => (this.monto() ? this.monto().toLocaleString('es-CO') : ''));
  readonly sobrante = computed(() =>
    this.tipo() === 'Capital' ? Math.max(0, this.monto() - this.p().resumen.saldo) : 0,
  );
  readonly puedeGuardar = computed(() =>
    this.monto() > 0 && this.sobrante() === 0 && (this.medio() === 'Efectivo' || !!this.archivo()),
  );

  setMonto(v: string): void {
    this.monto.set(aNumero(v));
  }

  elegirArchivo(ev: Event): void {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.errorArchivo.set(null);
    if (f && !TIPOS_OK.includes(f.type)) return this.rechazar('Solo se aceptan imágenes (JPG, PNG, WEBP) o PDF.');
    if (f && f.size > 5 * 1024 * 1024) return this.rechazar('El archivo pesa más de 5 MB.');
    this.archivo.set(f);
  }

  private rechazar(msg: string): void {
    this.archivo.set(null);
    this.errorArchivo.set(msg);
  }

  async guardar(): Promise<void> {
    if (this.medio() !== 'Efectivo' && !this.archivo()) return this.errorArchivo.set('Sube el comprobante para guardar un pago por ' + this.medio() + '.');
    if (!this.puedeGuardar()) return;
    this.guardando.set(true);
    this.error.set(null);
    const monto = this.monto();
    const aReditos = this.tipo() === 'Réditos' ? monto : 0;
    const aCapital = this.tipo() === 'Capital' ? monto : 0;
    const err = await this.datos.registrarPago({
      prestamoId: this.p().id, fecha: this.fecha, aReditos, aCapital, medio: this.medio(), archivo: this.archivo(), nota: this.nota.trim(),
    });
    this.guardando.set(false);
    if (err) return this.error.set(err);
    const etiqueta = this.tipo() === 'Réditos' ? 'Pago de réditos' : 'Abono a capital';
    this.guardado.emit(etiqueta + ' de ' + monto.toLocaleString('es-CO') + ' registrado');
  }
}
