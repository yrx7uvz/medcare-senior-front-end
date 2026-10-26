/// <reference types="node" />
/**
 * Teste ponta a ponta REAL contra a API (backend rodando). Cria um cuidador com e-mail aleatório, um paciente, um
 * remédio e um tratamento com dose daqui a ~20 min, pareia o paciente, confirma a dose e por fim exclui a conta (o que
 * apaga tudo o que foi criado). Além das chamadas diretas, faz o fluxo do app pelos ADAPTERS HTTP (pacientes, remédio e
 * tratamento, doses do cuidador e do paciente, confirmação, edição e remoção com a RN06, histórico, mensagens nos dois
 * papéis). Falha em qualquer passo =
 * código de saída != 0 com o passo.
 *
 * Uso: npm run smoke:api  (EXPO_PUBLIC_API_URL; padrão http://localhost:8080)
 */
import assert from 'node:assert/strict';

process.env.EXPO_PUBLIC_API_URL ??= 'http://localhost:8080';
process.env.EXPO_PUBLIC_DEMO = 'false';
// Aceita http:// (desenvolvimento) e https:// (produção ou túnel), com ou sem barra final
if (!/^https?:\/\/[^/\s]+/i.test(process.env.EXPO_PUBLIC_API_URL.trim())) {
  console.error(`EXPO_PUBLIC_API_URL inválida: use http:// ou https:// (veio "${process.env.EXPO_PUBLIC_API_URL}")`);
  process.exit(1);
}

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
  confirmadoPor?: string | null;
  limiteConfirmacao?: string;
  janela?: { abreEm: string; avisoEm: string; encerraEm: string };
}

async function main() {
  // Importados depois de definir o ambiente: env.ts lê EXPO_PUBLIC_* ao carregar
  const { request, setTokenProvider, setViewerProvider } = await import('../src/adapters/http/httpClient');
  const { httpAuthService } = await import('../src/adapters/http/HttpAuthService');
  const { httpPatientService } = await import('../src/adapters/http/HttpPatientService');
  const { httpMedicationService } = await import('../src/adapters/http/HttpMedicationService');
  const { httpDoseService } = await import('../src/adapters/http/HttpDoseService');
  const { httpReportService } = await import('../src/adapters/http/HttpReportService');
  const { httpMessageService } = await import('../src/adapters/http/HttpMessageService');
  const { fromApiId, toApiId } = await import('../src/adapters/http/ids');
  const { AppError } = await import('../src/services/errors');
  const { getApiBaseUrl } = await import('../src/config/env');
  const { doseOpenFailure, resolveDoseOpen } = await import('../src/lib/doseOpen');
  console.log(`Alvo: ${getApiBaseUrl()}\n`);

  let token: string | null = null;
  setTokenProvider(() => token);
  let viewer: 'CAREGIVER' | 'PATIENT' = 'CAREGIVER';
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

  const email = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@teste.com`; // NOSONAR: só torna o e-mail de teste único
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

    const paciente = await step('cadastro do paciente (POST /api/pacientes)', () =>
      request<{ id: number; nome: string }>('POST', '/api/pacientes', { nome: 'Paciente Smoke', dataNascimento: '1945-03-12' }),
    );
    const pacienteId = fromApiId(paciente.id);

    const medicamento = await step('cadastro do remédio (POST /api/medicamentos, COMPRIMIDO)', () =>
      request<{ id: number; tipo: string }>('POST', '/api/medicamentos', {
        nome: 'Losartana',
        dosagem: '50mg',
        tipo: 'COMPRIMIDO',
        pacienteId: toApiId(pacienteId),
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

    const codigo = await step('gerar código de vínculo (POST /api/pacientes/{id}/gerar-codigo)', () =>
      request<{ codigo: string }>('POST', `/api/pacientes/${toApiId(pacienteId)}/gerar-codigo`),
    );
    assert.match(codigo.codigo, /^\d{6}$/);

    token = null;
    const pareamento = await step('pareamento do paciente (POST /api/vinculo/validar)', () =>
      request<{ token: string; id: number; nome: string }>('POST', '/api/vinculo/validar', { codigo: codigo.codigo }),
    );
    assert.equal(fromApiId(pareamento.id), pacienteId);
    assert.equal(pareamento.nome, 'Paciente Smoke');
    const tokenPaciente = pareamento.token;
    token = tokenPaciente;

    const dose = await step('GET /api/pacientes/me e /api/pacientes/me/doses (dose na janela)', async () => {
      const me = await request<{ id: number; nome: string; cuidadorNome: string }>('GET', '/api/pacientes/me');
      assert.equal(fromApiId(me.id), pacienteId);
      assert.equal(me.cuidadorNome, 'Cuidador Smoke');
      const doses = await request<DoseDTO[]>('GET', '/api/pacientes/me/doses');
      const encontrada = doses.find((d) => d.medicamentoId === medicamento.id && d.horarioProgramado.startsWith(`${hoje.dia}T${alvo.hora}`));
      assert.ok(encontrada, `dose de ${alvo.hora} não encontrada em ${JSON.stringify(doses)}`);
      assert.equal(encontrada.confirmabilidade, 'OK');
      // Limite = horário + tolerância (30) + 30 min, igual ao fim da janela; ainda não confirmada
      assert.equal(encontrada.limiteConfirmacao, encontrada.janela?.encerraEm);
      assert.equal(encontrada.confirmadoPor, null);
      return encontrada;
    });

    // ---- Fluxo do app pelos adapters HTTP ----
    token = sessao.token;
    viewer = 'CAREGIVER';
    await step('app: pacientes do cuidador (httpPatientService.list/get)', async () => {
      const lista = await httpPatientService.list();
      assert.ok(lista.some((e) => e.id === pacienteId && e.name === 'Paciente Smoke'));
      const detalhe = await httpPatientService.get(pacienteId);
      assert.equal(detalhe.birthDate, '1945-03-12');
    });

    const outroPaciente = await step('app: cadastrar outro paciente e repetir -> 409 PACIENTE_DUPLICADO', async () => {
      const novo = await httpPatientService.create({ name: 'Outra Paciente Smoke', birthDate: '1950-07-01', phone: '(61) 98888-7777' });
      assert.equal(novo.phone, '61988887777');
      await expectError(() => httpPatientService.create({ name: 'Outra Paciente Smoke', birthDate: '1950-07-01' }), 409, 'PACIENTE_DUPLICADO');
      return novo;
    });

    const remedio2 = await step(`app: remédio + tratamento em duas chamadas, dose às ${alvo2.hora} (httpMedicationService.create)`, () =>
      httpMedicationService.create({
        patientId: pacienteId,
        name: 'Metformina',
        dosage: '500mg',
        type: 'CAPSULA',
        primaryColor: '#3D7DCA',
        appearanceSource: 'MANUAL',
        treatment: { startDate: hoje.dia, weekdays: [DIAS.indexOf(alvo2.diaSemana)], times: [{ time: alvo2.hora }] },
      }),
    );
    assert.equal(remedio2.treatment?.times[0]?.time, alvo2.hora);

    await step('app: remédios do paciente e de "Todos" com o tratamento (httpMedicationService.list)', async () => {
      const doPaciente = await httpMedicationService.list(pacienteId);
      assert.deepEqual(doPaciente.map((v) => v.medication.name), ['Losartana', 'Metformina']);
      const metformina = doPaciente.find((v) => v.medication.name === 'Metformina')!;
      assert.equal(metformina.activeTreatment, true);
      assert.equal(metformina.medication.primaryColor, '#3D7DCA');
      const todos = await httpMedicationService.list('ALL');
      assert.ok(todos.length >= 2 && todos.every((v) => v.patientName));
      assert.deepEqual(await httpMedicationService.list(outroPaciente.id), []);
    });

    await step('app: doses de hoje vistas pelo cuidador (httpDoseService.listForDay paciente e "Todos")', async () => {
      const doPaciente = await httpDoseService.listForDay(pacienteId, hoje.dia);
      const daMetformina = doPaciente.find((d) => d.medication.id === remedio2.medication.id);
      assert.ok(daMetformina, 'dose do remédio cadastrado pelo app não apareceu');
      assert.equal(daMetformina.scheduledAt, `${hoje.dia}T${alvo2.hora}`);
      assert.equal(daMetformina.confirmability, 'OK');
      assert.equal(daMetformina.window.closesAt.slice(0, 10), hoje.dia);
      const todos = await httpDoseService.listForDay('ALL', hoje.dia);
      assert.ok(todos.some((d) => d.id === daMetformina.id));
    });

    await step('app: toque no aviso abre a dose (payload do push -> detalhe com remédio e paciente; paciente alheio -> 404 com aviso)', async () => {
      // Mesmo payload que o backend manda no push (PushNotificadorDeDoseNaoTomadaAdapter): tudo como texto
      const payload = { tipo: 'DOSE_NAO_CONFIRMADA', doseId: String(dose.id), pacienteId: String(toApiId(pacienteId)), data: hoje.dia };
      const conhecidos = (await httpPatientService.list()).map((e) => e.id);
      const decisao = resolveDoseOpen(payload, { viewAs: 'CAREGIVER', hasSession: true, knownPatientIds: conhecidos });
      assert.equal(decisao.action, 'abrir-dose');
      if (decisao.action !== 'abrir-dose') return;
      const aberta = await httpDoseService.get(decisao.target.doseId, { patientId: decisao.target.patientId, day: decisao.target.day });
      assert.deepEqual([aberta.id, aberta.medication.name, aberta.patientName], [String(dose.id), 'Losartana', 'Paciente Smoke']);
      // Sessão expirada: espera o login; payload estranho: ignorado
      assert.equal(resolveDoseOpen(payload, { viewAs: 'CAREGIVER', hasSession: false }).action, 'aguardar-login');
      assert.equal(resolveDoseOpen({ ...payload, tipo: 'OUTRO' }, { viewAs: 'CAREGIVER', hasSession: true }).action, 'ignorar');
      // Paciente que não é da conta: a API responde 404 e a tela mostra o aviso com o caminho do Painel
      const alheio = resolveDoseOpen({ ...payload, pacienteId: '999999999' }, { viewAs: 'CAREGIVER', hasSession: true });
      assert.equal(alheio.action, 'abrir-dose');
      if (alheio.action !== 'abrir-dose') return;
      try {
        await httpDoseService.get(alheio.target.doseId, { patientId: alheio.target.patientId, day: alheio.target.day });
        assert.fail('esperava 404 para paciente alheio');
      } catch (e) {
        assert.ok(doseOpenFailure(e as { status?: number; code?: string }), `esperava aviso de dose não encontrada: ${String(e)}`);
      }
    });

    await step('app: cor do remédio na dose (DoseResponseDTO.cor; sem cor = null)', async () => {
      const cruas = await request<(DoseDTO & { cor: string | null })[]>('GET', `/api/pacientes/${toApiId(pacienteId)}/doses`);
      assert.equal(cruas.find((d) => d.medicamentoId === toApiId(remedio2.medication.id))?.cor, '#3D7DCA');
      assert.equal(cruas.find((d) => d.medicamentoId === medicamento.id)?.cor, null);
      const doPaciente = await httpDoseService.listForDay(pacienteId, hoje.dia);
      assert.equal(doPaciente.find((d) => d.medication.id === remedio2.medication.id)?.medication.primaryColor, '#3D7DCA');
      assert.equal(doPaciente.find((d) => d.medication.id === fromApiId(medicamento.id))?.medication.primaryColor, undefined);
    });

    token = tokenPaciente;
    viewer = 'PATIENT';
    const doseApp = await step('app: paciente lista as doses de hoje (/me/doses) e confirma pelo adapter -> CONFIRMADA_NO_HORARIO', async () => {
      const minhas = await httpDoseService.listForDay(pacienteId, hoje.dia);
      const alvoApp = minhas.find((d) => d.medication.id === remedio2.medication.id)!;
      const perfil = await httpPatientService.getProfile(pacienteId);
      assert.equal(perfil.caregiverFirstName, 'Cuidador');
      assert.equal(alvoApp.confirmUntil, alvoApp.window.closesAt);
      const confirmada = await httpDoseService.confirm(alvoApp.id);
      assert.equal(confirmada.storedStatus, 'CONFIRMADA_NO_HORARIO');
      assert.equal(confirmada.confirmedBy, 'PACIENTE');
      assert.equal(confirmada.confirmability, 'JA_REGISTRADA');
      await expectError(() => httpDoseService.confirm(alvoApp.id), 409, 'DOSE_JA_REGISTRADA');
      const detalhe = await httpDoseService.get(alvoApp.id);
      assert.equal(detalhe.status, 'CONFIRMADA_NO_HORARIO');
      return confirmada;
    });

    token = sessao.token;
    viewer = 'CAREGIVER';
    await step('app: editar o tratamento (PUT) e remover com a RN06 (409 TRATAMENTO_ATIVO, depois forçado)', async () => {
      const atual = await httpMedicationService.get(remedio2.medication.id);
      assert.ok(atual.treatment);
      const editado = await httpMedicationService.update(remedio2.medication.id, {
        patientId: pacienteId,
        name: 'Metformina',
        dosage: '850mg',
        type: 'CAPSULA',
        // O formulário do app sempre manda a cor (o PUT substitui o cadastro inteiro)
        primaryColor: '#3D7DCA',
        appearanceSource: 'MANUAL',
        treatment: { startDate: atual.treatment.startDate, weekdays: [0, 1, 2, 3, 4, 5, 6], times: [{ time: alvo2.hora }, { time: '22:00' }] },
      });
      assert.equal(editado.medication.dosage, '850mg');
      assert.equal(editado.treatment?.id, atual.treatment.id);
      assert.deepEqual(editado.treatment?.times.map((x) => x.time), [alvo2.hora, '22:00'].sort((a, b) => a.localeCompare(b)));
      await expectError(() => httpMedicationService.remove(remedio2.medication.id, { confirmed: false }), 409, 'TRATAMENTO_ATIVO');
      await httpMedicationService.remove(remedio2.medication.id, { confirmed: true });
      assert.ok(!(await httpMedicationService.list(pacienteId)).some((v) => v.medication.id === remedio2.medication.id));
      // O remédio removido sai também do dia (a dose registrada fica no histórico, RN08)
      const doPaciente = await httpDoseService.listForDay(pacienteId, hoje.dia);
      assert.ok(!doPaciente.some((d) => d.id === doseApp.id));
    });

    await step('app: tolerância (GET padrão 30; PUT 4 e 121 -> 400 VALIDACAO; PUT 45 -> GET 45; doses com 45)', async () => {
      assert.equal(await httpDoseService.getTolerance(), 30);
      for (const fora of [4, 121]) {
        await expectError(() => httpDoseService.setTolerance(fora), 400, 'VALIDACAO');
      }
      assert.equal(await httpDoseService.setTolerance(5), 5);
      assert.equal(await httpDoseService.setTolerance(120), 120);
      assert.equal(await httpDoseService.setTolerance(45), 45);
      assert.equal(await httpDoseService.getTolerance(), 45);
      const doPaciente = await httpDoseService.listForDay(pacienteId, hoje.dia);
      assert.ok(doPaciente.length > 0 && doPaciente.every((d) => d.toleranceMinutes === 45));
    });

    await step('app: relatório diário de hoje (GET /api/relatorios/diario) com totais e doses', async () => {
      const r = await httpReportService.getDaily(pacienteId, hoje.dia);
      assert.equal(r.patient.id, pacienteId);
      assert.equal(r.patient.name, 'Paciente Smoke');
      assert.equal(r.day, hoje.dia);
      assert.equal(r.totals.total, r.doses.length);
      assert.equal(r.totals.onTime + r.totals.late + r.totals.missed + r.totals.pending, r.totals.total);
      assert.ok(r.doses.some((d) => d.id === String(dose.id)));
      await expectError(() => httpReportService.getDaily(outroPaciente.id, 'ontem'), 400, 'VALIDACAO');
    });

    token = sessao.token;
    viewer = 'CAREGIVER';
    await step('app: cuidador confirma a dose na tela da dose (PUT /api/doses/{id}/confirmar) -> confirmada por CUIDADOR', async () => {
      const antes = await httpDoseService.get(String(dose.id), { patientId: pacienteId, day: hoje.dia });
      assert.equal(antes.storedStatus, 'PENDENTE');
      const confirmada = await httpDoseService.confirm(String(dose.id));
      assert.equal(confirmada.storedStatus, 'CONFIRMADA_NO_HORARIO');
      assert.equal(confirmada.confirmedBy, 'CUIDADOR');
      assert.ok(confirmada.confirmedAt);
      // De novo, pelo cuidador: 409 com a mensagem da API
      await expectError(() => httpDoseService.confirm(String(dose.id)), 409, 'DOSE_JA_REGISTRADA');
    });

    token = tokenPaciente;
    viewer = 'PATIENT';
    const segunda = await step('paciente tenta confirmar a dose já confirmada pelo cuidador -> 409 DOSE_JA_REGISTRADA', () =>
      expectError(() => request('PUT', `/api/doses/${dose.id}/confirmar`), 409, 'DOSE_JA_REGISTRADA'),
    );
    console.log(`    (${segunda})`);

    token = sessao.token;
    await step('histórico (GET /api/historico): filtro por paciente e status, paginação, RN-011 e paciente alheio', async () => {
      type Pagina = { conteudo: DoseDTO[]; pagina: number; tamanho: number; totalElementos: number; totalPaginas: number };
      const tudo = await request<Pagina>('GET', `/api/historico?pacienteId=${toApiId(pacienteId)}&de=${hoje.dia}`);
      assert.ok(tudo.totalElementos >= 2, `esperava doses de hoje: ${tudo.totalElementos}`);
      const tomadas = await request<Pagina>('GET', `/api/historico?pacienteId=${toApiId(pacienteId)}&de=${hoje.dia}&status=CONFIRMADA_NO_HORARIO`);
      assert.ok(tomadas.conteudo.some((d) => d.id === dose.id) && tomadas.conteudo.every((d) => d.status === 'CONFIRMADA_NO_HORARIO'));
      const pagina = await request<Pagina>('GET', `/api/historico?de=${hoje.dia}&size=1&page=0`);
      assert.equal(pagina.conteudo.length, 1);
      assert.equal(pagina.tamanho, 1);
      assert.equal(pagina.totalPaginas, pagina.totalElementos);
      // Do mais recente para o mais antigo
      const horarios = tudo.conteudo.map((d) => d.horarioProgramado);
      assert.deepEqual(horarios, [...horarios].sort((a, b) => b.localeCompare(a)));
      await expectError(() => request('GET', `/api/historico?de=${hoje.dia}&ate=2000-01-01`), 400, 'VALIDACAO');
      await expectError(() => request('GET', '/api/historico?status=ATRASADA'), 400, 'VALIDACAO');
      await expectError(() => request('GET', '/api/historico?size=101'), 400, 'VALIDACAO');
      const vazio = await request<Pagina>('GET', '/api/historico?de=1990-01-01&ate=1990-01-31');
      assert.equal(vazio.totalElementos, 0);
      await expectError(() => request('GET', '/api/historico?pacienteId=999999999'), 404, 'RECURSO_NAO_ENCONTRADO');
    });

    viewer = 'CAREGIVER';
    await step('app: histórico pelo adapter (filtros, página, cor de remédio removido, 400 e período vazio)', async () => {
      const base = { patient: pacienteId, from: hoje.dia, to: hoje.dia };
      const tudo = await httpDoseService.listHistory({ ...base, status: 'ALL' });
      assert.ok(tudo.totalElements >= 2 && tudo.page === 0 && tudo.size === 20);
      // Remédio removido continua no histórico (RN08), com a cor do cadastro
      const daMetformina = tudo.items.find((d) => d.id === doseApp.id);
      assert.equal(daMetformina?.storedStatus, 'CONFIRMADA_NO_HORARIO');
      assert.equal(daMetformina?.medication.primaryColor, '#3D7DCA');
      const soLosartana = await httpDoseService.listHistory({ ...base, medicationId: fromApiId(medicamento.id), status: 'CONFIRMADA_NO_HORARIO' });
      assert.ok(soLosartana.items.length > 0 && soLosartana.items.every((d) => d.medication.name === 'Losartana' && d.storedStatus === 'CONFIRMADA_NO_HORARIO'));
      const pag0 = await httpDoseService.listHistory({ ...base, status: 'ALL', size: 1 });
      const pag1 = await httpDoseService.listHistory({ ...base, status: 'ALL', size: 1, page: 1 });
      assert.equal(pag0.totalPages, pag0.totalElements);
      assert.notEqual(pag0.items[0].id, pag1.items[0].id);
      // A dose vinda do histórico abre o detalhe
      assert.equal((await httpDoseService.get(pag1.items[0].id)).id, pag1.items[0].id);
      await expectError(() => httpDoseService.listHistory({ patient: 'ALL', from: hoje.dia, to: '2000-01-01', status: 'ALL' }), 400, 'VALIDACAO');
      const vazio = await httpDoseService.listHistory({ patient: 'ALL', from: '1990-01-01', to: '1990-01-31', status: 'ALL' });
      assert.deepEqual([vazio.items.length, vazio.totalElements, vazio.totalPages], [0, 0, 0]);
    });

    await step('PDF do histórico (GET /api/relatorios/pdf): arquivo com anexo e no-store; período vazio -> 422', async () => {
      const base = getApiBaseUrl();
      const pedir = (de: string, ate: string) =>
        fetch(`${base}/api/relatorios/pdf?pacienteId=${toApiId(pacienteId)}&de=${de}&ate=${ate}`, { headers: { Authorization: `Bearer ${sessao.token}` } });
      const res = await pedir(hoje.dia, hoje.dia);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'application/pdf');
      assert.match(res.headers.get('content-disposition') ?? '', /^attachment; filename="historico-adesao-\d+-.+\.pdf"$/);
      assert.match(res.headers.get('cache-control') ?? '', /no-store/);
      const bytes = new Uint8Array(await res.arrayBuffer());
      assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), '%PDF-');
      const vazio = await pedir('1990-01-01', '1990-01-31');
      assert.equal(vazio.status, 422);
      assert.equal(((await vazio.json()) as { codigo: string }).codigo, 'PERIODO_SEM_REGISTROS');
      // Período de no máximo 12 meses: exatamente 12 é aceito (422 por não ter doses), 12 meses + 1 dia é 400
      assert.equal((await pedir('1990-01-10', '1991-01-10')).status, 422);
      const longo = await pedir('1990-01-10', '1991-01-11');
      assert.equal(longo.status, 400);
      assert.equal(((await longo.json()) as { codigo: string }).codigo, 'VALIDACAO');
    });

    // ---- Mensagens (UC-010) pelos adapters, nos dois papéis ----
    token = sessao.token;
    viewer = 'CAREGIVER';
    await step('app: cuidador envia mensagem; vazia e com 501 caracteres -> 400 VALIDACAO; paciente inexistente -> 404', async () => {
      const enviada = await httpMessageService.send(pacienteId, 'CUIDADOR', '  Bom dia! Lembre do remédio.  ');
      assert.deepEqual([enviada.from, enviada.text, enviada.read, enviada.patientId], ['CUIDADOR', 'Bom dia! Lembre do remédio.', false, pacienteId]);
      await expectError(() => httpMessageService.send(pacienteId, 'CUIDADOR', '   '), 400, 'VALIDACAO');
      await expectError(() => httpMessageService.send(pacienteId, 'CUIDADOR', 'a'.repeat(501)), 400, 'VALIDACAO');
      await expectError(() => httpMessageService.send('999999999', 'CUIDADOR', 'Oi'), 404, 'RECURSO_NAO_ENCONTRADO');
    });

    token = tokenPaciente;
    viewer = 'PATIENT';
    await step('app: paciente vê 1 não lida, lê a conversa, marca como lida (idempotente) e responde; outro paciente -> 403', async () => {
      assert.equal(await httpMessageService.unreadCount(pacienteId, 'PACIENTE'), 1);
      const conversas = await httpMessageService.listConversations();
      assert.deepEqual(conversas.map((c) => [c.patient.id, c.unread, c.lastMessage?.from]), [[pacienteId, 1, 'CUIDADOR']]);
      const pagina = await httpMessageService.listThread(pacienteId);
      assert.deepEqual(pagina.items.map((m) => m.text), ['Bom dia! Lembre do remédio.']);
      assert.equal(await httpMessageService.markRead(pacienteId, 'PACIENTE'), 1);
      assert.equal(await httpMessageService.markRead(pacienteId, 'PACIENTE'), 0);
      assert.equal(await httpMessageService.unreadCount(pacienteId, 'PACIENTE'), 0);
      const resposta = await httpMessageService.send(pacienteId, 'PACIENTE', 'Já tomei, obrigado');
      assert.equal(resposta.from, 'PACIENTE');
      await expectError(() => httpMessageService.listThread(outroPaciente.id), 403, 'ACESSO_NEGADO');
    });

    token = sessao.token;
    viewer = 'CAREGIVER';
    await step('app: cuidador vê a resposta não lida, conversa paginada da mais recente, lê e o contador zera', async () => {
      assert.equal(await httpMessageService.unreadCount('ALL', 'CUIDADOR'), 1);
      const conversas = await httpMessageService.listConversations();
      const daMaria = conversas.find((c) => c.patient.id === pacienteId);
      assert.deepEqual([daMaria?.unread, daMaria?.lastMessage?.text], [1, 'Já tomei, obrigado']);
      const doOutro = conversas.find((c) => c.patient.id === outroPaciente.id);
      assert.deepEqual([doOutro?.unread, doOutro?.lastMessage], [0, undefined]);
      // Mais 20 mensagens: 22 no total, duas páginas de 20
      for (let i = 1; i <= 20; i += 1) await httpMessageService.send(pacienteId, 'CUIDADOR', `Mensagem ${i}`);
      const primeira = await httpMessageService.listThread(pacienteId, 0);
      const segunda = await httpMessageService.listThread(pacienteId, 1);
      assert.deepEqual([primeira.items.length, primeira.totalElements, primeira.totalPages], [20, 22, 2]);
      assert.equal(primeira.items[0].text, 'Mensagem 20');
      assert.deepEqual(segunda.items.map((m) => m.text), ['Já tomei, obrigado', 'Bom dia! Lembre do remédio.']);
      // A primeira mensagem do cuidador foi lida pelo paciente
      assert.equal(segunda.items[1].read, true);
      assert.equal(await httpMessageService.markRead(pacienteId, 'CUIDADOR'), 1);
      assert.equal(await httpMessageService.unreadCount('ALL', 'CUIDADOR'), 0);
    });

    await step('cuidador vê a dose CONFIRMADA_NO_HORARIO (GET /api/pacientes/{id}/doses)', async () => {
      const doses = await request<DoseDTO[]>('GET', `/api/pacientes/${toApiId(pacienteId)}/doses`);
      const vista = doses.find((d) => d.id === dose.id);
      assert.equal(vista?.status, 'CONFIRMADA_NO_HORARIO');
      assert.equal(vista?.statusExibicao, 'CONFIRMADA_NO_HORARIO');
      assert.equal(vista?.confirmadoPor, 'CUIDADOR');
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

    token = tokenPaciente;
    const sessaoInvalida = await step('token do paciente após a exclusão -> 401 SESSAO_INVALIDA', () =>
      expectError(() => request('GET', '/api/pacientes/me'), 401, 'SESSAO_INVALIDA'),
    );
    console.log(`    (${sessaoInvalida})`);

    token = tokenCuidador;
    const cuidadorExcluido = await step('token do cuidador após a exclusão -> 401 SESSAO_INVALIDA (rotas do cuidador)', async () => {
      const r = await expectError(() => request('GET', '/api/pacientes'), 401, 'SESSAO_INVALIDA');
      await expectError(() => request('GET', '/api/cuidadores/me'), 401, 'SESSAO_INVALIDA');
      return r;
    });
    console.log(`    (${cuidadorExcluido})`);

    await step('mensagens após a exclusão -> 401 SESSAO_INVALIDA nos dois papéis', async () => {
      token = tokenCuidador;
      await expectError(() => httpMessageService.unreadCount('ALL', 'CUIDADOR'), 401, 'SESSAO_INVALIDA');
      token = tokenPaciente;
      await expectError(() => httpMessageService.listConversations(), 401, 'SESSAO_INVALIDA');
    });

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
