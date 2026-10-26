/**
 * Confere os mocks do modo demonstração: (1) nenhum código fora do caminho do demo importa os mocks, e o carregador
 * (src/config/demo.ts) só os exige dentro da condição de build que o Metro remove do bundle de produção; (2) os números
 * fecham entre painel, histórico e PDF e seguem a regra da janela (aviso + 30 min).
 * Uso: npm run check:mocks (sai com erro se algo falhar)
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { services } from '../src/services';
import { summarize } from '../src/lib/doseRules';

const SRC = join(__dirname, '..', 'src');
const DEMO_PATHS = ['adapters/mock/', 'mocks/'];
const IMPORTA_MOCK = /(?:from\s+|require\(\s*)['"][^'"]*(?:adapters\/mock|\/mocks\/|\.\/mocks)[^'"]*['"]/;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : /\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

function conferirIsolamento() {
  const proibidos: string[] = [];
  for (const arquivo of arquivos(SRC)) {
    const rel = relative(SRC, arquivo).split(sep).join('/');
    if (DEMO_PATHS.some((d) => rel.startsWith(d)) || rel === 'config/demo.ts') continue;
    readFileSync(arquivo, 'utf8').split(/\r?\n/).forEach((linha, i) => {
      if (!/^\s*(\/\/|\*)/.test(linha) && IMPORTA_MOCK.test(linha)) proibidos.push(`${rel}:${i + 1}: ${linha.trim()}`);
    });
  }
  assert.deepEqual(proibidos, [], 'mocks importados fora do caminho do demo (use getDemo() de src/config/demo.ts)');
  const carregador = readFileSync(join(SRC, 'config', 'demo.ts'), 'utf8');
  assert.match(
    carregador,
    /if \(process\.env\.EXPO_PUBLIC_DEMO === 'true'\) \{[\s\S]*?require\('\.\.\/adapters\/mock\/demo'\)[\s\S]*?\n {2}\}/,
    'o require dos mocks precisa ficar dentro de if (process.env.EXPO_PUBLIC_DEMO === \'true\'), para sair do bundle de produção',
  );
  assert.equal((carregador.match(/require\(/g) ?? []).length, 1, 'só um require dos mocks, o da condição de build');
  console.log('Isolamento : mocks só no caminho do demo; carregador com a condição de build');
}

async function main() {
  conferirIsolamento();
  const day = '2026-06-05';
  const all = await services.doses.listForDay('ALL', day);
  const jose = await services.doses.listForDay('e-jose', day);
  const helena = await services.doses.listForDay('e-helena', day);
  console.log('Painel Todos :', summarize(all.map((d) => d.status)));
  console.log('Painel José  :', summarize(jose.map((d) => d.status)), jose.map((d) => `${d.medication.name} ${d.scheduledAt.slice(11)} ${d.status}`));
  console.log('Painel Helena:', summarize(helena.map((d) => d.status)));
  // Regra da janela no demo (tolerância 30): dose das 14:00 pode ser confirmada até 15:00; a das 12:00 já encerrou
  const omeprazol = jose.find((d) => d.medication.name === 'Omeprazol');
  assert.equal(omeprazol?.confirmUntil, `${day}T15:00`);
  assert.equal(omeprazol?.window.closesAt, `${day}T15:00`);
  assert.equal(jose.find((d) => d.medication.name === 'Atorvastatina')?.status, 'NAO_TOMADA');
  const alerts = await services.doses.listAlerts();
  console.log('Alertas      :', alerts.map((a) => `${a.patientName} • ${a.medicationName} ${a.scheduledAt.slice(11)} ${a.status}`));
  for (const patient of ['e-jose', 'e-helena']) {
    const r = await services.reports.getAdherence(patient, '2026-05-07', day);
    console.log(`PDF ${r.patient.name} (geral ${r.overallRate}%):`, r.items.map((i) => `${i.medication.name} ${i.rate}% (${i.confirmed}/${i.confirmed + i.missed}, abertas ${i.open})`));
    const hist = await services.doses.listHistory({ patient: patient, from: '2026-05-07', to: day, status: 'NAO_TOMADA' });
    console.log('  histórico não tomadas:', hist.totalElements);
  }
  const atrasoHelena = await services.doses.listHistory({ patient: 'e-helena', from: '2026-05-07', to: day, status: 'CONFIRMADA_COM_ATRASO' });
  console.log('Helena com atraso:', atrasoHelena.totalElements);
  const info = await services.medicationInfo.lookup('omeprazol');
  console.log('Lookup omeprazol:', info?.type, info?.primaryColor);
  try { await services.patients.validateLinkCode('111111'); } catch (e) { console.log('Código expirado →', (e as Error).message); }
  const ok = await services.patients.validateLinkCode('482913');
  console.log('Código válido →', ok.patientName);
  try { await services.patients.validateLinkCode('482913'); } catch (e) { console.log('Reuso →', (e as Error).message); }
  process.exit(0);
}
main();
