/**
 * Cálculos de préstamos con réditos sobre saldo.
 * Funciones puras, sin Angular ni Supabase: se pueden probar solas
 * y traducir casi línea por línea a C# cuando pasemos a .NET.
 *
 * Modelo (el mismo del Excel y del mockup):
 * - Los réditos se causan al final de cada periodo sobre el saldo de capital vigente.
 * - Un abono a capital deja de causar réditos en los periodos siguientes.
 * - El "abono pactado" es capital que debe abonar cada periodo (0 = solo réditos).
 */

export type Frecuencia = 'Mensual' | 'Quincenal' | 'Semanal' | 'Diario';
export type TipoPago = 'Réditos' | 'Capital';

export interface DatosPrestamo {
  fecha: string; // yyyy-mm-dd
  capital: number;
  tasa: number; // por periodo, fracción (0.05 = 5 %)
  frecuencia: Frecuencia;
  abonoPactado: number;
  diasGracia: number;
  activo: boolean;
}

export interface DatosPago {
  fecha: string; // yyyy-mm-dd
  tipo: TipoPago;
  monto: number;
}

export type EstadoPrestamo = 'En mora' | 'En gracia' | 'Cobrar pronto' | 'Al día' | 'Pagado' | 'Inactivo';

export interface ResumenPrestamo {
  periodosVencidos: number;
  abonosCapital: number;
  saldo: number;
  reditosCausados: number;
  reditosPagados: number;
  reditosPendientes: number;
  capitalAtrasado: number;
  totalParaPonerseAlDia: number;
  cuotaProximoPeriodo: number;
  proximaFecha: string | null;
  cuotaMasAntiguaSinPagar: string | null;
  diasMora: number;
  estado: EstadoPrestamo;
}

const DIAS_PERIODO: Record<Exclude<Frecuencia, 'Mensual'>, number> = { Quincenal: 15, Semanal: 7, Diario: 1 };

/** Convierte yyyy-mm-dd a fecha local a medianoche (evita corrimientos por zona horaria). */
export function aFecha(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function aIso(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

export function hoyIso(): string {
  return aIso(new Date());
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86_400_000);
}

/** Meses completos entre dos fechas, como DATEDIF(…, "m") de Excel. */
function mesesCompletos(desde: string, hasta: string): number {
  const a = aFecha(desde);
  const b = aFecha(hasta);
  let meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) meses--;
  return Math.max(0, meses);
}

/** Cuántos periodos se han vencido entre el inicio del préstamo y una fecha. */
export function periodosVencidos(inicio: string, frecuencia: Frecuencia, fecha: string): number {
  if (fecha < inicio) return 0;
  if (frecuencia === 'Mensual') return mesesCompletos(inicio, fecha);
  return Math.floor(diasEntre(inicio, fecha) / DIAS_PERIODO[frecuencia]);
}

/** Fecha de vencimiento del periodo n (n = 1 es el primer cobro). */
export function vencimientoPeriodo(inicio: string, frecuencia: Frecuencia, n: number): string {
  const f = aFecha(inicio);
  if (frecuencia === 'Mensual') {
    const dia = f.getDate();
    const destino = new Date(f.getFullYear(), f.getMonth() + n, 1);
    const ultimoDia = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
    destino.setDate(Math.min(dia, ultimoDia));
    return aIso(destino);
  }
  f.setDate(f.getDate() + n * DIAS_PERIODO[frecuencia]);
  return aIso(f);
}

/** Redondea a pesos para evitar residuos de punto flotante en los resultados. */
const pesos = (n: number) => Math.round(n);

export function calcularResumen(p: DatosPrestamo, pagos: DatosPago[], hoy: string, diasAviso = 3): ResumenPrestamo {
  const pv = periodosVencidos(p.fecha, p.frecuencia, hoy);
  const abonosCapital = pagos.filter((g) => g.tipo === 'Capital').reduce((a, g) => a + g.monto, 0);
  const reditosPagados = pagos.filter((g) => g.tipo === 'Réditos').reduce((a, g) => a + g.monto, 0);
  const saldo = Math.max(0, p.capital - abonosCapital);

  // Réditos que dejó de causar cada abono a capital desde el periodo en que se hizo.
  const ahorro = pagos
    .filter((g) => g.tipo === 'Capital')
    .reduce((a, g) => a + g.monto * p.tasa * Math.max(0, pv - periodosVencidos(p.fecha, p.frecuencia, g.fecha)), 0);
  const reditosCausados = Math.max(0, p.capital * p.tasa * pv - ahorro);
  const reditosPendientes = Math.max(0, reditosCausados - reditosPagados);
  const capitalAtrasado = Math.max(0, Math.min(p.capital, p.abonoPactado * pv) - abonosCapital);
  const total = reditosPendientes + capitalAtrasado;
  const cuota = saldo <= 0 ? 0 : saldo * p.tasa + Math.min(p.abonoPactado, saldo);
  const proximaFecha = saldo <= 0 ? null : vencimientoPeriodo(p.fecha, p.frecuencia, pv + 1);

  let atrasados = 0;
  if (total > 0) {
    const divisor = cuota > 0 ? cuota : Math.max(1, p.capital * p.tasa);
    atrasados = Math.min(pv, Math.ceil(total / divisor));
  }
  const cuotaMasAntigua = atrasados > 0 ? vencimientoPeriodo(p.fecha, p.frecuencia, pv - atrasados + 1) : null;
  const diasMora = cuotaMasAntigua ? Math.max(0, diasEntre(cuotaMasAntigua, hoy)) : 0;

  let estado: EstadoPrestamo;
  if (!p.activo) estado = 'Inactivo';
  else if (saldo <= 0 && reditosPendientes <= 0) estado = 'Pagado';
  else if (total <= 0) estado = proximaFecha && diasEntre(hoy, proximaFecha) <= diasAviso ? 'Cobrar pronto' : 'Al día';
  else estado = diasMora > p.diasGracia ? 'En mora' : 'En gracia';

  return {
    periodosVencidos: pv,
    abonosCapital: pesos(abonosCapital),
    saldo: pesos(saldo),
    reditosCausados: pesos(reditosCausados),
    reditosPagados: pesos(reditosPagados),
    reditosPendientes: pesos(reditosPendientes),
    capitalAtrasado: pesos(capitalAtrasado),
    totalParaPonerseAlDia: pesos(total),
    cuotaProximoPeriodo: pesos(cuota),
    proximaFecha,
    cuotaMasAntiguaSinPagar: cuotaMasAntigua,
    diasMora,
    estado,
  };
}

/** Reparte un pago: primero a réditos pendientes y luego a capital. */
export function repartirPago(monto: number, reditosPendientes: number, saldo: number) {
  const aReditos = Math.min(monto, reditosPendientes);
  const aCapital = Math.min(monto - aReditos, saldo);
  return { aReditos, aCapital, sobrante: Math.max(0, monto - aReditos - aCapital) };
}
