import { calcularResumen, periodosVencidos, repartirPago, vencimientoPeriodo } from './prestamos-calculo';

// Casos tomados del Excel y del mockup (fecha de corte: 14/10/2026).
const HOY = '2026-10-14';

describe('periodos y vencimientos', () => {
  it('cuenta meses completos como DATEDIF', () => {
    expect(periodosVencidos('2026-06-01', 'Mensual', HOY)).toBe(4);
    expect(periodosVencidos('2026-06-01', 'Mensual', '2026-08-01')).toBe(2);
    expect(periodosVencidos('2026-09-20', 'Quincenal', HOY)).toBe(1);
  });

  it('respeta el fin de mes', () => {
    expect(vencimientoPeriodo('2026-01-31', 'Mensual', 1)).toBe('2026-02-28');
  });
});

describe('P001 · solo réditos, en mora', () => {
  const r = calcularResumen(
    { fecha: '2026-06-01', capital: 2_000_000, tasa: 0.05, frecuencia: 'Mensual', abonoPactado: 0, diasGracia: 3, activo: true },
    [
      { fecha: '2026-07-01', tipo: 'Réditos', monto: 100_000 },
      { fecha: '2026-08-01', tipo: 'Réditos', monto: 100_000 },
      { fecha: '2026-08-01', tipo: 'Capital', monto: 500_000 },
      { fecha: '2026-09-01', tipo: 'Réditos', monto: 75_000 },
    ],
    HOY,
  );

  it('calcula saldo, réditos y mora', () => {
    expect(r.saldo).toBe(1_500_000);
    expect(r.reditosCausados).toBe(350_000);
    expect(r.reditosPendientes).toBe(75_000);
    expect(r.cuotaMasAntiguaSinPagar).toBe('2026-10-01');
    expect(r.diasMora).toBe(13);
    expect(r.estado).toBe('En mora');
    expect(r.proximaFecha).toBe('2026-11-01');
  });
});

describe('P002 · quincenal con abono pactado, al día', () => {
  const r = calcularResumen(
    { fecha: '2026-09-20', capital: 1_000_000, tasa: 0.03, frecuencia: 'Quincenal', abonoPactado: 100_000, diasGracia: 2, activo: true },
    [
      { fecha: '2026-10-05', tipo: 'Réditos', monto: 30_000 },
      { fecha: '2026-10-05', tipo: 'Capital', monto: 100_000 },
    ],
    HOY,
  );

  it('queda al día con la próxima cuota correcta', () => {
    expect(r.saldo).toBe(900_000);
    expect(r.totalParaPonerseAlDia).toBe(0);
    expect(r.cuotaProximoPeriodo).toBe(127_000);
    expect(r.proximaFecha).toBe('2026-10-20');
    expect(r.estado).toBe('Al día');
  });
});

describe('estados especiales', () => {
  const base = { fecha: '2026-01-10', capital: 500_000, tasa: 0.05, frecuencia: 'Mensual' as const, abonoPactado: 0, diasGracia: 3, activo: true };

  it('marca pagado cuando no queda saldo ni réditos', () => {
    const r = calcularResumen(base, [
      { fecha: '2026-02-10', tipo: 'Réditos', monto: 25_000 },
      { fecha: '2026-02-10', tipo: 'Capital', monto: 500_000 },
    ], '2026-06-01');
    expect(r.estado).toBe('Pagado');
  });

  it('respeta un préstamo inactivo', () => {
    expect(calcularResumen({ ...base, activo: false }, [], HOY).estado).toBe('Inactivo');
  });
});

describe('repartirPago', () => {
  it('cubre primero réditos y luego capital', () => {
    expect(repartirPago(150_000, 75_000, 1_500_000)).toEqual({ aReditos: 75_000, aCapital: 75_000, sobrante: 0 });
    expect(repartirPago(2_000_000, 75_000, 1_500_000).sobrante).toBe(425_000);
  });
});
