/**
 * Confere se os números dos mocks fecham entre painel, histórico e PDF.
 * Uso: npm run check:mocks
 */
import { services } from '../src/services';
import { summarize } from '../src/lib/doseRules';

async function main() {
  const day = '2026-06-05';
  const all = await services.doses.listForDay('ALL', day);
  const jose = await services.doses.listForDay('e-jose', day);
  const helena = await services.doses.listForDay('e-helena', day);
  console.log('Painel Todos :', summarize(all.map((d) => d.status)));
  console.log('Painel José  :', summarize(jose.map((d) => d.status)), jose.map((d) => `${d.medication.name} ${d.scheduledAt.slice(11)} ${d.status}`));
  console.log('Painel Helena:', summarize(helena.map((d) => d.status)));
  const alerts = await services.doses.listAlerts();
  console.log('Alertas      :', alerts.map((a) => `${a.elderName} • ${a.medicationName} ${a.scheduledAt.slice(11)} ${a.status}`));
  for (const elder of ['e-jose', 'e-helena']) {
    const r = await services.reports.getAdherence(elder, '2026-05-07', day);
    console.log(`PDF ${r.elder.name} (geral ${r.overallRate}%):`, r.items.map((i) => `${i.medication.name} ${i.rate}% (${i.confirmed}/${i.confirmed + i.missed}, abertas ${i.open})`));
    const hist = await services.doses.listHistory({ elder: elder, from: '2026-05-07', to: day, status: 'MISSED' });
    console.log('  histórico não confirmadas:', hist.length);
  }
  const atrasoHelena = await services.doses.listHistory({ elder: 'e-helena', from: '2026-05-07', to: day, status: 'LATE' });
  console.log('Helena com atraso:', atrasoHelena.length);
  const info = await services.medicationInfo.lookup('omeprazol');
  console.log('Lookup omeprazol:', info?.type, info?.primaryColor);
  try { await services.elders.validateLinkCode('111111'); } catch (e) { console.log('Código expirado →', (e as Error).message); }
  const ok = await services.elders.validateLinkCode('482913');
  console.log('Código válido →', ok.elderName);
  try { await services.elders.validateLinkCode('482913'); } catch (e) { console.log('Reuso →', (e as Error).message); }
  process.exit(0);
}
main();
