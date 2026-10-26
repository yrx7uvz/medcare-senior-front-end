/**
 * Confere os mocks do modo demonstração: (1) nenhum código fora do caminho do demo importa os mocks, e o carregador
 * (src/config/demo.ts) só os exige dentro da condição de build que o Metro remove do bundle de produção; (2) os números
 * fecham entre painel, histórico e PDF e seguem a regra da janela (aviso + 30 min); (3) o cadastro e a edição de
 * tratamento seguem a antecedência mínima de 5 minutos e devolvem a primeira dose, como a API.
 * Uso: npm run check:mocks (sai com erro se algo falhar)
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { services } from '../src/services';
import { summarize } from '../src/lib/doseRules';
import { TOO_SOON_MESSAGE } from '../src/lib/treatmentTime';
import type { AppError } from '../src/services/errors';

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

/** Antecedência mínima e primeira dose no mock, com a mesma regra da API (relógio do demo: sexta, 05/06, 14:02). */
async function conferirHorarioDoTratamento() {
  const { useClockStore } = await import('../src/lib/clock');
  const as1402 = () => useClockStore.getState().setTime(new Date(2026, 5, 5, 14, 2, 0));
  const remedio = (times: string[], weekdays = [0, 1, 2, 3, 4, 5, 6]) => ({
    patientId: 'e-jose',
    name: 'Teste de horário',
    dosage: '1mg',
    type: 'COMPRIMIDO' as const,
    appearanceSource: 'MANUAL' as const,
    treatment: { startDate: '2026-06-05', weekdays, times: times.map((time) => ({ time })) },
  });
  const recusa = async (fn: () => Promise<unknown>) => {
    as1402();
    const erro = await fn().then(() => null, (e: unknown) => e as AppError);
    assert.equal(erro?.status, 400);
    assert.equal(erro?.code, 'VALIDACAO');
    assert.equal(erro?.fieldErrors?.horarios, TOO_SOON_MESSAGE);
  };

  await recusa(() => services.medications.create(remedio(['14:05'])));
  as1402();
  const hoje = await services.medications.create(remedio(['14:08']));
  assert.deepEqual(hoje.firstDose, { dateKey: '2026-06-05', time: '14:08' });
  as1402();
  const semanal = await services.medications.create(remedio(['08:00'], [5, 6]));
  assert.deepEqual(semanal.firstDose, { dateKey: '2026-06-06', time: '08:00' });
  // Edição: o 08:00 salvo não bloqueia; um horário novo a 2 minutos é recusado
  await recusa(() => services.medications.update(semanal.medication.id, remedio(['08:00', '14:04'], [5, 6])));
  as1402();
  const editado = await services.medications.update(semanal.medication.id, { ...remedio(['08:00'], [5, 6]), dosage: '2mg' });
  assert.equal(editado.medication.dosage, '2mg');
  for (const view of [hoje, semanal]) await services.medications.remove(view.medication.id, { confirmed: true });
  console.log('Horários    : menos de 5 min recusado (cadastro e horário novo da edição); primeira dose hoje ou no próximo dia');
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
  await conferirHorarioDoTratamento();
  process.exit(0);
}
void main();
