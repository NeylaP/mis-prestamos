import { Component, input } from '@angular/core';

@Component({
  selector: 'app-proximamente',
  template: `
    <div class="card vacio">
      <h2>{{ nombre() }}</h2>
      <p>Este módulo está diseñado en el mockup y se construirá en las próximas etapas.</p>
    </div>
  `,
})
export class Proximamente {
  readonly modulo = input<string>('');
  nombre() {
    const m = this.modulo();
    const nombres: Record<string, string> = { arriendos: 'Arriendos', creditos: 'Créditos', ahorros: 'Ahorros', finanzas: 'Finanzas' };
    return nombres[m] ?? m;
  }
}
