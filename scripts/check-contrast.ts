/**
 * Contraste WCAG dos pares de cor do tema (claro, escuro, idoso e alto contraste do idoso): falha abaixo de 4,5:1
 * para texto e de 3:1 para texto grande, bordas de campo e indicadores de status.
 * Uso: npm run check:contrast   (também coberto pelo Jest em tests/contraste.test.ts)
 */
import { checkTheme } from '../src/lib/contrast';
import { darkColors, elderColors, elderHighContrastColors, lightColors } from '../src/theme/colors';

const temas = { claro: lightColors, escuro: darkColors, idoso: elderColors, 'idoso alto contraste': elderHighContrastColors };
let falhas = 0;
for (const [nome, cores] of Object.entries(temas)) {
  console.log(`\n== Tema ${nome}`);
  for (const r of checkTheme(cores)) {
    if (!r.ok) falhas += 1;
    console.log(`${r.ok ? 'ok  ' : 'FALHA'} ${r.ratio.toFixed(2).padStart(5)}:1 (mín. ${r.min}) ${r.name}  ${r.fg} sobre ${r.bg}`);
  }
}
console.log(falhas ? `\n${falhas} par(es) abaixo do mínimo` : '\nTodos os pares atingem o mínimo WCAG');
process.exit(falhas ? 1 : 0);
