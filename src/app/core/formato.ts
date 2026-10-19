import { Pipe, PipeTransform } from '@angular/core';

const pesosFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/** 1500000 → "$ 1.500.000" */
@Pipe({ name: 'pesos' })
export class PesosPipe implements PipeTransform {
  transform(v: number | string | null | undefined): string {
    return v == null || v === '' ? '—' : pesosFmt.format(+v);
  }
}

/** "2026-10-14" → "14/10/2026" */
@Pipe({ name: 'fecha' })
export class FechaPipe implements PipeTransform {
  transform(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
}

export const CLASE_ESTADO: Record<string, string> = {
  'En mora': 'chip chip--mora',
  'En gracia': 'chip chip--gracia',
  'Cobrar pronto': 'chip chip--pronto',
  'Al día': 'chip chip--ok',
  Pagado: 'chip chip--gris',
  Inactivo: 'chip chip--gris',
};

/** Convierte lo escrito en un campo de dinero ("1.500.000") a número. */
export function aNumero(texto: string): number {
  return parseInt(String(texto).replace(/\D/g, ''), 10) || 0;
}
