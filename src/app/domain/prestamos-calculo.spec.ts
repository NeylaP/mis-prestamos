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
    expect(vencimientoPeriodo('2026-01-10', 'Mensual', 1, 31)).toBe('2026-02-28');
  });

  it('usa el día de cobro pactado, no el día del préstamo', () => {
    // Neyla: prestado el 08/10/2026, cobro el día 1 → próximo = 01/11/2026
    expect(vencimientoPeriodo('2026-10-08', 'Mensual', 1, 1)).toBe('2026-11-01');
    expect(periodosVencidos('2026-10-08', 'Mensual', '2026-11-02', 1)).toBe(1);
    expect(periodosVencidos('2026-10-08', 'Mensual', '2026-10-31', 1)).toBe(0);
  });
});

describe('P001 · solo réditos, en mora', () => {
  const r = calcularResumen(
    { fecha: '2026-06-01', capital: 2_000_000, tasa: 0.05, frecuencia: 'Mensual', abonoPactado: 0, diasGracia: 3, activo: true, diaCobro: 1 },
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
    { fecha: '2026-09-20', capital: 1_000_000, tasa: 0.03, frecuencia: 'Quincenal', abonoPactado: 100_000, diasGracia: 2, activo: true, diaCobro: 20 },
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
  const base = { fecha: '2026-01-10', capital: 500_000, tasa: 0.05, frecuencia: 'Mensual' as const, abonoPactado: 0, diasGracia: 3, activo: true, diaCobro: 10 };

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

  it('próximo cobro sigue el día pactado aunque la fecha del préstamo sea otra', () => {
    const r = calcularResumen(
      { ...base, fecha: '2026-10-08', diaCobro: 1 },
      [],
      '2026-10-14',
    );
    expect(r.proximaFecha).toBe('2026-11-01');
    expect(r.periodosVencidos).toBe(0);
  });

  it('en el día de corte ya se causan réditos; sin pago entra en gracia/mora', () => {
    const p = { ...base, fecha: '2026-10-08', diaCobro: 1, diasGracia: 3 };
    const enCorte = calcularResumen(p, [], '2026-11-01');
    expect(enCorte.periodosVencidos).toBe(1);
    expect(enCorte.reditosPendientes).toBe(25_000);
    expect(enCorte.estado).toBe('En gracia'); // día 0 de mora, dentro de gracia
    const enMora = calcularResumen(p, [], '2026-11-05');
    expect(enMora.diasMora).toBe(4);
    expect(enMora.estado).toBe('En mora');
  });
});

describe('repartirPago', () => {
  it('cubre primero réditos y luego capital', () => {
    expect(repartirPago(150_000, 75_000, 1_500_000)).toEqual({ aReditos: 75_000, aCapital: 75_000, sobrante: 0 });
    expect(repartirPago(2_000_000, 75_000, 1_500_000).sobrante).toBe(425_000);
  });
});
