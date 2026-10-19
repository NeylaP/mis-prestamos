import { computed, inject, Injectable, signal } from '@angular/core';
import { calcularResumen, hoyIso } from '../domain/prestamos-calculo';
import { AuthService } from './auth.service';
import { Evento, MedioPago, NuevoPrestamo, Pago, Prestamo, PrestamoConResumen } from './modelos';
import { SupabaseService } from './supabase';

const ORDEN_ESTADO: Record<string, number> = { 'En mora': 0, 'En gracia': 1, 'Cobrar pronto': 2, 'Al día': 3, Pagado: 4, Inactivo: 5 };

/**
 * Acceso a préstamos y pagos. Las políticas RLS de Supabase garantizan que
 * cada usuario solo lea y escriba sus propios registros.
 */
@Injectable({ providedIn: 'root' })
export class PrestamosService {
  private readonly sb = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);

  readonly prestamos = signal<Prestamo[]>([]);
  readonly pagos = signal<Pago[]>([]);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);

  /** Préstamos con su estado calculado, ordenados por urgencia. */
  readonly conResumen = computed<PrestamoConResumen[]>(() => {
    const hoy = hoyIso();
    const pagos = this.pagos();
    return this.prestamos()
      .map((p) => ({
        ...p,
        resumen: calcularResumen(
          { fecha: p.fecha, capital: +p.capital, tasa: +p.tasa, frecuencia: p.frecuencia, abonoPactado: +p.abono_pactado, diasGracia: p.dias_gracia, activo: p.activo },
          pagos.filter((g) => g.prestamo_id === p.id).map((g) => ({ fecha: g.fecha, tipo: g.tipo, monto: +g.monto })),
          hoy,
        ),
      }))
      .sort((a, b) => ORDEN_ESTADO[a.resumen.estado] - ORDEN_ESTADO[b.resumen.estado] || a.deudor.localeCompare(b.deudor));
  });

  async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    const [p, g] = await Promise.all([
      this.sb.from('prestamos').select('*').order('created_at'),
      this.sb.from('pagos').select('*').order('fecha', { ascending: false }),
    ]);
    this.cargando.set(false);
    if (p.error || g.error) {
      this.error.set('No se pudieron cargar los datos. Revisa tu conexión.');
      return;
    }
    this.prestamos.set(p.data as Prestamo[]);
    this.pagos.set(g.data as Pago[]);
  }

  private siguienteCodigo(): string {
    const max = this.prestamos().reduce((m, p) => Math.max(m, parseInt(p.codigo.replace(/\D/g, ''), 10) || 0), 0);
    return 'P' + String(max + 1).padStart(3, '0');
  }

  async crear(datos: Omit<NuevoPrestamo, 'codigo'>): Promise<string | null> {
    const { error } = await this.sb.from('prestamos').insert({ ...datos, codigo: this.siguienteCodigo() });
    if (error) return 'No se pudo crear el préstamo: ' + error.message;
    await this.cargar();
    return null;
  }

  async editar(id: string, cambios: Partial<Prestamo>): Promise<string | null> {
    const { error } = await this.sb.from('prestamos').update(cambios).eq('id', id);
    if (error) return 'No se pudo guardar: ' + error.message;
    await this.cargar();
    return null;
  }

  desactivar(id: string, motivo: string) {
    return this.editar(id, { activo: false, inactivo_desde: hoyIso(), motivo_inactivo: motivo || null });
  }

  activar(id: string) {
    return this.editar(id, { activo: true, inactivo_desde: null, motivo_inactivo: null });
  }

  /**
   * Registra un pago repartido en réditos y capital (dos filas si aplica).
   * Si viene comprobante, primero lo sube a la carpeta privada del usuario.
   */
  async registrarPago(opc: {
    prestamoId: string; fecha: string; aReditos: number; aCapital: number; medio: MedioPago; archivo: File | null; nota: string;
  }): Promise<string | null> {
    let ruta: string | null = null;
    if (opc.archivo) {
      const uid = this.auth.usuario()?.id;
      const ext = opc.archivo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      ruta = `${uid}/${opc.prestamoId}/${Date.now()}.${ext}`;
      const subida = await this.sb.storage.from('comprobantes').upload(ruta, opc.archivo, { contentType: opc.archivo.type });
      if (subida.error) return 'No se pudo subir el comprobante: ' + subida.error.message;
    }
    const filas = [
      { tipo: 'Réditos', monto: opc.aReditos },
      { tipo: 'Capital', monto: opc.aCapital },
    ]
      .filter((f) => f.monto > 0)
      .map((f) => ({ ...f, prestamo_id: opc.prestamoId, fecha: opc.fecha, medio: opc.medio, comprobante_path: ruta, nota: opc.nota || null }));
    const { error } = await this.sb.from('pagos').insert(filas);
    if (error) return 'No se pudo registrar el pago: ' + error.message;
    await this.cargar();
    return null;
  }

  /** URL temporal (5 minutos) para ver un comprobante privado. */
  async urlComprobante(ruta: string): Promise<string | null> {
    const { data } = await this.sb.storage.from('comprobantes').createSignedUrl(ruta, 300);
    return data?.signedUrl ?? null;
  }

  async eventos(prestamoId: string): Promise<Evento[]> {
    const { data } = await this.sb.from('prestamo_eventos').select('*').eq('prestamo_id', prestamoId).order('created_at', { ascending: false });
    return (data as Evento[]) ?? [];
  }
}
