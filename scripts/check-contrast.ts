/**
 * Contraste WCAG dos pares de cor dos cinco temas (claro, escuro, paciente claro, paciente escuro e alto contraste do paciente):
 * falha abaixo de 4,5:1 para texto (7:1 nos textos principais do alto contraste) e de 3:1 para texto grande, bordas de
 * campo, seletores liga/desliga e indicadores de status. Sai com erro se algum par ficar abaixo do mínimo.
 * Uso: npm run check:contrast   (também coberto pelo Jest em tests/contraste.test.ts)
 */
import { checkTheme } from '../src/lib/contrast';
import { darkColors, patientColors, patientDarkColors, patientHighContrastColors, lightColors } from '../src/theme/colors';

const temas = {
  claro: lightColors,
  escuro: darkColors,
  'paciente claro': patientColors,
  'paciente escuro': patientDarkColors,
  'paciente alto contraste': patientHighContrastColors,
};
let falhas = 0;
for (const [nome, cores] of Object.entries(temas)) {
  console.log(`\n== Tema ${nome}`);
  // Alto contraste: textos principais com 7:1 (os demais com o mínimo comum)
  for (const r of checkTheme(cores, cores === patientHighContrastColors)) {
    if (!r.ok) falhas += 1;
    console.log(`${r.ok ? 'ok  ' : 'FALHA'} ${r.ratio.toFixed(2).padStart(5)}:1 (mín. ${r.min}) ${r.name}  ${r.fg} sobre ${r.bg}`);
  }
}
console.log(falhas ? `\n${falhas} par(es) abaixo do mínimo` : '\nTodos os pares atingem o mínimo WCAG');
process.exit(falhas ? 1 : 0);
