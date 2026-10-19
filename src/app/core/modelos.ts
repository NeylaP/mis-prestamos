import { Frecuencia, ResumenPrestamo, TipoPago } from '../domain/prestamos-calculo';

export type MedioPago = 'Efectivo' | 'Nequi' | 'Transferencia';

/** Fila de la tabla prestamos (nombres tal como están en la base de datos). */
export interface Prestamo {
  id: string;
  codigo: string;
  deudor: string;
  telefono: string | null;
  fecha: string;
  capital: number;
  tasa: number;
  frecuencia: Frecuencia;
  abono_pactado: number;
  dias_gracia: number;
  activo: boolean;
  inactivo_desde: string | null;
  motivo_inactivo: string | null;
  notas: string | null;
}

export interface Pago {
  id: string;
  prestamo_id: string;
  fecha: string;
  tipo: TipoPago;
  monto: number;
  medio: MedioPago;
  comprobante_path: string | null;
  nota: string | null;
  created_at: string;
}

export interface Evento {
  id: number;
  prestamo_id: string;
  tipo: string;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  created_at: string;
}

export interface PrestamoConResumen extends Prestamo {
  resumen: ResumenPrestamo;
}

export type NuevoPrestamo = Omit<Prestamo, 'id' | 'activo' | 'inactivo_desde' | 'motivo_inactivo'>;
