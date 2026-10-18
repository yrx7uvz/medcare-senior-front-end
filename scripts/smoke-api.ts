/// <reference types="node" />
/**
 * Teste ponta a ponta REAL contra a API (backend rodando). Cria um cuidador com e-mail aleatório, um idoso, um
 * remédio e um tratamento com dose daqui a ~20 min, pareia o idoso, confirma a dose e por fim exclui a conta (o que
 * apaga tudo o que foi criado). Além das chamadas diretas, faz o fluxo do app pelos ADAPTERS HTTP (idosos, remédio e
 * tratamento, doses do cuidador e do idoso, confirmação, edição e remoção com a RN06). Falha em qualquer passo =
 * código de saída != 0 com o passo.
 *
 * Uso: npm run smoke:api  (EXPO_PUBLIC_API_URL; padrão http://localhost:8080)
 */
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL ??= 'http://localhost:8080';
process.env.EXPO_PUBLIC_DEMO = 'false';

const FUSO = 'America/Sao_Paulo';
const DIAS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

/** Data, hora e dia da semana de um instante no fuso da API. */
function noFuso(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { dia: `${parts.year}-${parts.month}-${parts.day}`, hora: `${parts.hour}:${parts.minute}`, diaSemana: DIAS[weekday] };
}

interface DoseDTO {
  id: number;
  medicamentoId: number;
  horarioProgramado: string;
  status: string;
  statusExibicao: string;
  confirmabilidade: string;
}

async function main() {
  // Importados depois de definir o ambiente: env.ts lê EXPO_PUBLIC_* ao carregar
  const { request, setTokenProvider, setViewerProvider } = await import('../src/adapters/http/httpClient');
  const { httpAuthService } = await import('../src/adapters/http/HttpAuthService');
  const { httpElderService } = await import('../src/adapters/http/HttpElderService');
  const { httpMedicationService } = await import('../src/adapters/http/HttpMedicationService');
  const { httpDoseService } = await import('../src/adapters/http/HttpDoseService');
  const { fromApiId, toApiId } = await import('../src/adapters/http/ids');
  const { AppError } = await import('../src/services/errors');

  let token: string | null = null;
  setTokenProvider(() => token);
  let viewer: 'CAREGIVER' | 'ELDER' = 'CAREGIVER';
  setViewerProvider(() => viewer);

  let passo = '';
  let passos = 0;
  async function step<T>(nome: string, fn: () => Promise<T>): Promise<T> {
    passo = `${passos + 1}. ${nome}`;
    const r = await fn();
    passos += 1;
    console.log(`ok  ${passo}`);
    return r;
  }
  async function expectError(fn: () => Promise<unknown>, status: number, codigo: string) {
    try {
      await fn();
    } catch (e) {
      assert.ok(e instanceof AppError, `esperava AppError, veio ${String(e)}`);
      assert.equal(e.status, status, `status: ${e.status} ${e.code} ${e.message}`);
      assert.equal(e.code, codigo, `codigo: ${e.code} (${e.message})`);
      return `${e.status} ${e.code}`;
    }
    assert.fail(`esperava ${status} ${codigo}, mas a chamada deu certo`);
  }

  const agora = new Date();
  const alvo = noFuso(new Date(agora.getTime() + 20 * 60_000));
  // Segundo remédio (cadastrado pelo adapter do app): dose daqui a ~25 min, também dentro da janela de confirmação
  const alvo2 = noFuso(new Date(agora.getTime() + 25 * 60_000));
  const hoje = noFuso(agora);
  if (alvo.dia !== hoje.dia || alvo2.dia !== hoje.dia || alvo.hora === alvo2.hora) {
    throw new Error('Faltam menos de 30 minutos para a meia-noite em São Paulo: rode o smoke depois da virada do dia.');
  }

  const email = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.com`;
  const senha = 'SenhaForte1';
  let contaExcluida = false;

  try {
    const cadastro = await step('cadastro do cuidador (POST /api/cuidadores + login)', () =>
      httpAuthService.signUp({ name: 'Cuidador Smoke', email, phone: '11999990000', password: senha, lgpdConsent: true }),
    );
    assert.ok(cadastro.token && cadastro.caregiverId);

    const sessao = await step('login (POST /api/auth/login)', () => httpAuthService.login(email, senha));
    assert.equal(sessao.name, 'Cuidador Smoke');
    assert.equal(sessao.caregiverId, cadastro.caregiverId);
    token = sessao.token;

    const idoso = await step('cadastro do idoso (POST /api/idosos)', () =>
      request<{ id: number; nome: string }>('POST', '/api/idosos', { nome: 'Idoso Smoke', dataNascimento: '1945-03-12' }),
    );
    const idosoId = fromApiId(idoso.id);

    const medicamento = await step('cadastro do remédio (POST /api/medicamentos, COMPRIMIDO)', () =>
      request<{ id: number; tipo: string }>('POST', '/api/medicamentos', {
        nome: 'Losartana',
        dosagem: '50mg',
        tipo: 'COMPRIMIDO',
        idosoId: toApiId(idosoId),
      }),
    );
    assert.equal(medicamento.tipo, 'COMPRIMIDO');

    await step(`tratamento hoje às ${alvo.hora} (${alvo.diaSemana}) (POST /api/medicamentos/{id}/tratamentos)`, () =>
      request('POST', `/api/medicamentos/${medicamento.id}/tratamentos`, {
        dataInicio: hoje.dia,
        horarios: [alvo.hora],
        diasSemana: [alvo.diaSemana],
      }),
    );

    const codigo = await step('gerar código de vínculo (POST /api/idosos/{id}/gerar-codigo)', () =>
      request<{ codigo: string }>('POST', `/api/idosos/${toApiId(idosoId)}/gerar-codigo`),
    );
    assert.match(codigo.codigo, /^\d{6}$/);

    token = null;
    const pareamento = await step('pareamento do idoso (POST /api/vinculo/validar)', () =>
      request<{ token: string; id: number; nome: string }>('POST', '/api/vinculo/validar', { codigo: codigo.codigo }),
    );
    assert.equal(fromApiId(pareamento.id), idosoId);
    assert.equal(pareamento.nome, 'Idoso Smoke');
    const tokenIdoso = pareamento.token;
    token = tokenIdoso;

    const dose = await step('GET /api/idosos/me e /api/idosos/me/doses (dose na janela)', async () => {
      const me = await request<{ id: number; nome: string; cuidadorNome: string }>('GET', '/api/idosos/me');
      assert.equal(fromApiId(me.id), idosoId);
      assert.equal(me.cuidadorNome, 'Cuidador Smoke');
      const doses = await request<DoseDTO[]>('GET', '/api/idosos/me/doses');
      const encontrada = doses.find((d) => d.medicamentoId === medicamento.id && d.horarioProgramado.startsWith(`${hoje.dia}T${alvo.hora}`));
      assert.ok(encontrada, `dose de ${alvo.hora} não encontrada em ${JSON.stringify(doses)}`);
      assert.equal(encontrada.confirmabilidade, 'OK');
      return encontrada;
    });

    // ---- Fluxo do app pelos adapters HTTP (marco da semana 1) ----
    token = sessao.token;
    viewer = 'CAREGIVER';
    await step('app: idosos do cuidador (httpElderService.list/get)', async () => {
      const lista = await httpElderService.list();
      assert.ok(lista.some((e) => e.id === idosoId && e.name === 'Idoso Smoke'));
      const detalhe = await httpElderService.get(idosoId);
      assert.equal(detalhe.birthDate, '1945-03-12');
    });

    const outroIdoso = await step('app: cadastrar outro idoso e repetir -> 409 IDOSO_DUPLICADO', async () => {
      const novo = await httpElderService.create({ name: 'Outra Idosa Smoke', birthDate: '1950-07-01', phone: '(61) 98888-7777' });
      assert.equal(novo.phone, '61988887777');
      await expectError(() => httpElderService.create({ name: 'Outra Idosa Smoke', birthDate: '1950-07-01' }), 409, 'IDOSO_DUPLICADO');
      return novo;
    });

    const remedio2 = await step(`app: remédio + tratamento em duas chamadas, dose às ${alvo2.hora} (httpMedicationService.create)`, () =>
      httpMedicationService.create({
        elderId: idosoId,
        name: 'Metformina',
        dosage: '500mg',
        type: 'CAPSULA',
        primaryColor: '#3D7DCA',
        appearanceSource: 'MANUAL',
        treatment: { startDate: hoje.dia, weekdays: [DIAS.indexOf(alvo2.diaSemana)], times: [{ time: alvo2.hora }] },
      }),
    );
    assert.equal(remedio2.treatment?.times[0]?.time, alvo2.hora);

    await step('app: remédios do idoso e de "Todos" com o tratamento (httpMedicationService.list)', async () => {
      const doIdoso = await httpMedicationService.list(idosoId);
      assert.deepEqual(doIdoso.map((v) => v.medication.name), ['Losartana', 'Metformina']);
      const metformina = doIdoso.find((v) => v.medication.name === 'Metformina')!;
      assert.equal(metformina.activeTreatment, true);
      assert.equal(metformina.medication.primaryColor, '#3D7DCA');
      const todos = await httpMedicationService.list('ALL');
      assert.ok(todos.length >= 2 && todos.every((v) => v.elderName));
      assert.deepEqual(await httpMedicationService.list(outroIdoso.id), []);
    });

    await step('app: doses de hoje vistas pelo cuidador (httpDoseService.listForDay idoso e "Todos")', async () => {
      const doIdoso = await httpDoseService.listForDay(idosoId, hoje.dia);
      const daMetformina = doIdoso.find((d) => d.medication.id === remedio2.medication.id);
      assert.ok(daMetformina, 'dose do remédio cadastrado pelo app não apareceu');
      assert.equal(daMetformina.scheduledAt, `${hoje.dia}T${alvo2.hora}`);
      assert.equal(daMetformina.confirmability, 'OK');
      assert.equal(daMetformina.window.closesAt.slice(0, 10), hoje.dia);
      const todos = await httpDoseService.listForDay('ALL', hoje.dia);
      assert.ok(todos.some((d) => d.id === daMetformina.id));
    });

    token = tokenIdoso;
    viewer = 'ELDER';
    const doseApp = await step('app: idoso lista as doses de hoje (/me/doses) e confirma pelo adapter -> TOMADA', async () => {
      const minhas = await httpDoseService.listForDay(idosoId, hoje.dia);
      const alvoApp = minhas.find((d) => d.medication.id === remedio2.medication.id)!;
      const perfil = await httpElderService.getProfile(idosoId);
      assert.equal(perfil.caregiverFirstName, 'Cuidador');
      const confirmada = await httpDoseService.confirm(alvoApp.id);
      assert.equal(confirmada.storedStatus, 'TOMADA');
      assert.equal(confirmada.confirmability, 'JA_REGISTRADA');
      await expectError(() => httpDoseService.confirm(alvoApp.id), 409, 'DOSE_JA_REGISTRADA');
      const detalhe = await httpDoseService.get(alvoApp.id);
      assert.equal(detalhe.status, 'TOMADA');
      return confirmada;
    });

    token = sessao.token;
    viewer = 'CAREGIVER';
    await step('app: editar o tratamento (PUT) e remover com a RN06 (409 TRATAMENTO_ATIVO, depois forçado)', async () => {
      const atual = await httpMedicationService.get(remedio2.medication.id);
      assert.ok(atual.treatment);
      const editado = await httpMedicationService.update(remedio2.medication.id, {
        elderId: idosoId,
        name: 'Metformina',
        dosage: '850mg',
        type: 'CAPSULA',
        appearanceSource: 'MANUAL',
        treatment: { startDate: atual.treatment.startDate, weekdays: [0, 1, 2, 3, 4, 5, 6], times: [{ time: alvo2.hora }, { time: '22:00' }] },
      });
      assert.equal(editado.medication.dosage, '850mg');
      assert.equal(editado.treatment?.id, atual.treatment.id);
      assert.deepEqual(editado.treatment?.times.map((x) => x.time), [alvo2.hora, '22:00'].sort());
      await expectError(() => httpMedicationService.remove(remedio2.medication.id, { confirmed: false }), 409, 'TRATAMENTO_ATIVO');
      await httpMedicationService.remove(remedio2.medication.id, { confirmed: true });
      assert.ok(!(await httpMedicationService.list(idosoId)).some((v) => v.medication.id === remedio2.medication.id));
      // O remédio removido sai também do dia (a dose registrada fica no histórico, RN08)
      const doIdoso = await httpDoseService.listForDay(idosoId, hoje.dia);
      assert.ok(!doIdoso.some((d) => d.id === doseApp.id));
    });

    token = tokenIdoso;
    viewer = 'ELDER';
    await step('confirmar a dose (PUT /api/doses/{id}/confirmar) -> 200 TOMADA', async () => {
      const confirmada = await request<DoseDTO>('PUT', `/api/doses/${dose.id}/confirmar`);
      assert.equal(confirmada.status, 'TOMADA');
    });

    const segunda = await step('confirmar de novo -> 409 DOSE_JA_REGISTRADA', () =>
      expectError(() => request('PUT', `/api/doses/${dose.id}/confirmar`), 409, 'DOSE_JA_REGISTRADA'),
    );
    console.log(`    (${segunda})`);

    token = sessao.token;
    await step('cuidador vê a dose TOMADA (GET /api/idosos/{id}/doses)', async () => {
      const doses = await request<DoseDTO[]>('GET', `/api/idosos/${toApiId(idosoId)}/doses`);
      const vista = doses.find((d) => d.id === dose.id);
      assert.equal(vista?.status, 'TOMADA');
      assert.equal(vista?.statusExibicao, 'TOMADA');
    });

    await step('token do aparelho: PUT e DELETE /api/cuidadores/me/fcm-token -> 204 (DELETE idempotente)', async () => {
      await request('PUT', '/api/cuidadores/me/fcm-token', { token: `smoke-fcm-${Date.now()}` });
      await request('DELETE', '/api/cuidadores/me/fcm-token');
      await request('DELETE', '/api/cuidadores/me/fcm-token');
    });

    const tokenCuidador = sessao.token;
    await step('excluir a conta (DELETE /api/cuidadores/me) -> 204', async () => {
      const r = await httpAuthService.deleteAccount();
      assert.equal(r.removalDeadlineDays, 0);
      contaExcluida = true;
    });

    token = tokenIdoso;
    const sessaoInvalida = await step('token do idoso após a exclusão -> 401 SESSAO_INVALIDA', () =>
      expectError(() => request('GET', '/api/idosos/me'), 401, 'SESSAO_INVALIDA'),
    );
    console.log(`    (${sessaoInvalida})`);

    token = tokenCuidador;
    const cuidadorExcluido = await step('token do cuidador após a exclusão -> 401 SESSAO_INVALIDA (rotas do cuidador)', async () => {
      const r = await expectError(() => request('GET', '/api/idosos'), 401, 'SESSAO_INVALIDA');
      await expectError(() => request('GET', '/api/cuidadores/me'), 401, 'SESSAO_INVALIDA');
      return r;
    });
    console.log(`    (${cuidadorExcluido})`);

    token = null;
    const loginExcluido = await step('login com a conta excluída -> 401 CREDENCIAIS_INVALIDAS', () =>
      expectError(() => httpAuthService.login(email, senha), 401, 'CREDENCIAIS_INVALIDAS'),
    );
    console.log(`    (${loginExcluido})`);

    console.log(`\nSMOKE OK: ${passos}/${passos} passos`);
  } catch (e) {
    console.error(`\nFALHOU no passo: ${passo}`);
    console.error(e instanceof Error ? e.message : e);
    if (!contaExcluida) {
      // Limpeza best-effort: a exclusão da conta apaga tudo o que o smoke criou
      try {
        token = (await httpAuthService.login(email, senha)).token;
        await httpAuthService.deleteAccount();
        console.error('Conta de teste removida.');
      } catch {
        console.error(`Atenção: não foi possível remover a conta de teste (${email}).`);
      }
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
