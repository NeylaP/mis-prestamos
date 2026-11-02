/**
 * Cálculos de préstamos con réditos sobre saldo.
 * Funciones puras, sin Angular ni Supabase: se pueden probar solas
 * y traducir casi línea por línea a C# cuando pasemos a .NET.
 *
 * Modelo (el mismo del Excel y del mockup):
 * - Los réditos se causan al final de cada periodo sobre el saldo de capital vigente.
 * - Un abono a capital deja de causar réditos en los periodos siguientes.
 * - El "abono pactado" es capital que debe abonar cada periodo (0 = solo réditos).
 * - El día de cobro mensual es la fecha de corte (como en una tarjeta de crédito):
 *   pactado e independiente del día del préstamo. A partir de ese día se causa el
 *   periodo (réditos) y, si no se paga, empieza a contar la mora tras los días de gracia.
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
  /** Día del mes de corte/cobro (1–31). Solo afecta frecuencia Mensual. */
  diaCobro: number;
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

/** Día efectivo de cobro en un mes (si piden 31 en febrero → último día). */
export function diaCobroEfectivo(anio: number, mes0: number, diaCobro: number): number {
  const ultimo = new Date(anio, mes0 + 1, 0).getDate();
  return Math.min(Math.max(1, diaCobro || 1), ultimo);
}

/** Meses completos hasta el día de cobro pactado (como DATEDIF, pero con día de cobro). */
function mesesCompletosHastaCobro(inicio: string, diaCobro: number, hasta: string): number {
  const a = aFecha(inicio);
  const b = aFecha(hasta);
  let meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  const dia = diaCobroEfectivo(b.getFullYear(), b.getMonth(), diaCobro);
  if (b.getDate() < dia) meses--;
  return Math.max(0, meses);
}

/** Cuántos periodos se han vencido entre el inicio del préstamo y una fecha. */
export function periodosVencidos(inicio: string, frecuencia: Frecuencia, fecha: string, diaCobro?: number): number {
  if (fecha < inicio) return 0;
  if (frecuencia === 'Mensual') {
    return mesesCompletosHastaCobro(inicio, diaCobro ?? aFecha(inicio).getDate(), fecha);
  }
  return Math.floor(diasEntre(inicio, fecha) / DIAS_PERIODO[frecuencia]);
}

/** Fecha de vencimiento del periodo n (n = 1 es el primer cobro). */
export function vencimientoPeriodo(inicio: string, frecuencia: Frecuencia, n: number, diaCobro?: number): string {
  const f = aFecha(inicio);
  if (frecuencia === 'Mensual') {
    const dia = diaCobro ?? f.getDate();
    const destino = new Date(f.getFullYear(), f.getMonth() + n, 1);
    destino.setDate(diaCobroEfectivo(destino.getFullYear(), destino.getMonth(), dia));
    return aIso(destino);
  }
  f.setDate(f.getDate() + n * DIAS_PERIODO[frecuencia]);
  return aIso(f);
}

/** Redondea a pesos para evitar residuos de punto flotante en los resultados. */
const pesos = (n: number) => Math.round(n);

export function calcularResumen(p: DatosPrestamo, pagos: DatosPago[], hoy: string, diasAviso = 3): ResumenPrestamo {
  const dia = p.diaCobro || 1;
  const pv = periodosVencidos(p.fecha, p.frecuencia, hoy, dia);
  const abonosCapital = pagos.filter((g) => g.tipo === 'Capital').reduce((a, g) => a + g.monto, 0);
  const reditosPagados = pagos.filter((g) => g.tipo === 'Réditos').reduce((a, g) => a + g.monto, 0);
  const saldo = Math.max(0, p.capital - abonosCapital);

  // Réditos que dejó de causar cada abono a capital desde el periodo en que se hizo.
  const ahorro = pagos
    .filter((g) => g.tipo === 'Capital')
    .reduce((a, g) => a + g.monto * p.tasa * Math.max(0, pv - periodosVencidos(p.fecha, p.frecuencia, g.fecha, dia)), 0);
  const reditosCausados = Math.max(0, p.capital * p.tasa * pv - ahorro);
  const reditosPendientes = Math.max(0, reditosCausados - reditosPagados);
  const capitalAtrasado = Math.max(0, Math.min(p.capital, p.abonoPactado * pv) - abonosCapital);
  const total = reditosPendientes + capitalAtrasado;
  const cuota = saldo <= 0 ? 0 : saldo * p.tasa + Math.min(p.abonoPactado, saldo);
  const proximaFecha = saldo <= 0 ? null : vencimientoPeriodo(p.fecha, p.frecuencia, pv + 1, dia);

  let atrasados = 0;
  if (total > 0) {
    const divisor = cuota > 0 ? cuota : Math.max(1, p.capital * p.tasa);
    atrasados = Math.min(pv, Math.ceil(total / divisor));
  }
  const cuotaMasAntigua = atrasados > 0 ? vencimientoPeriodo(p.fecha, p.frecuencia, pv - atrasados + 1, dia) : null;
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
