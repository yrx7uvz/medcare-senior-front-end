/// <reference types="node" />
/**
 * Verificações do núcleo do app (sem React): decodificador de JWT, parse do ErroResponse da API,
 * endereço da API, mapeamento de erros por campo, datas da API no fuso de São Paulo, mensagens de
 * erro por código e adapters HTTP de idosos e medicamentos (com fetch falso, sem rede).
 * Uso: npm run check:core — termina com código != 0 na primeira asserção que falhar.
 */
import './check-core-env';
import assert from 'node:assert/strict';
import { parseApiError, parseJsonBody } from '../src/adapters/http/apiError';
import { forgetLinkCodes, httpElderService, toElder, toLinkCode } from '../src/adapters/http/HttpElderService';
import {
  httpMedicationService,
  toMedicamentoRequest,
  toMedication,
  toTratamentoEdicaoRequest,
  toTratamentoRequest,
  toTreatment,
} from '../src/adapters/http/HttpMedicationService';
import { fromApiId, toApiId } from '../src/adapters/http/ids';
import { normalizeApiBaseUrl } from '../src/config/env';
import { mapFieldErrors } from '../src/lib/formErrors';
import { decodeJwtPayload, getJwtExp, isJwtExpired } from '../src/lib/jwt';
import { apiDateTimeToEpochMs, apiTimeToHHmm, apiWeekdayToIndex, indexToApiWeekday, saoPauloDateKey } from '../src/lib/apiTime';
import { isTreatmentActive, pickCurrentTreatment } from '../src/lib/medicationMeta';
import { formatWait, messageForApiError } from '../src/services/errorMessages';
import { AppError, TreatmentNotSavedError } from '../src/services/errors';

const toBase64Url = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (payload: object) => `${toBase64Url('{"alg":"HS256"}')}.${toBase64Url(JSON.stringify(payload))}.assinatura`;

const NOW_MS = Date.UTC(2026, 9, 17, 12, 0, 0);
const nowSec = NOW_MS / 1000;
let checks = 0;
function check(name: string, fn: () => void) {
  fn();
  checks += 1;
  console.log(`ok - ${name}`);
}

/** Verificações assíncronas: rodam em sequência, depois das síncronas. */
const asyncChecks: { name: string; fn: () => Promise<void> }[] = [];
function checkAsync(name: string, fn: () => Promise<void>) {
  asyncChecks.push({ name, fn });
}

// --- JWT válido -------------------------------------------------------------------------------------------------
check('JWT válido: lê o payload, inclusive com acentos (UTF-8)', () => {
  const token = jwt({ sub: '7', role: 'CUIDADOR', exp: nowSec + 3600, nome: 'José Ângelo' });
  assert.deepEqual(decodeJwtPayload(token), { sub: '7', role: 'CUIDADOR', exp: nowSec + 3600, nome: 'José Ângelo' });
  assert.equal(getJwtExp(token), nowSec + 3600);
  assert.equal(isJwtExpired(token, NOW_MS), false);
});

check('JWT válido com caracteres base64url (- e _) no payload', () => {
  const token = jwt({ sub: '1', exp: nowSec + 60, x: '>>>???' });
  assert.equal(isJwtExpired(token, NOW_MS), false);
});

// --- JWT expirado -----------------------------------------------------------------------------------------------
check('JWT expirado: exp no passado', () => {
  assert.equal(isJwtExpired(jwt({ sub: '7', exp: nowSec - 1 }), NOW_MS), true);
});

check('JWT que expira exatamente agora conta como expirado', () => {
  assert.equal(isJwtExpired(jwt({ sub: '7', exp: nowSec }), NOW_MS), true);
});

check('JWT sem exp conta como inválido', () => {
  const token = jwt({ sub: '7' });
  assert.equal(getJwtExp(token), null);
  assert.equal(isJwtExpired(token, NOW_MS), true);
});

// --- JWT malformado ---------------------------------------------------------------------------------------------
check('Malformado: não é JWT (token do mock, vazio, partes faltando)', () => {
  for (const token of ['mock.jwt.c-maria', '', 'abc', 'a.b', 'a..c']) {
    assert.equal(decodeJwtPayload(token), null, token);
    assert.equal(isJwtExpired(token, NOW_MS), true, token);
  }
});

check('Malformado: payload não é base64url / não é JSON / não é objeto', () => {
  assert.equal(decodeJwtPayload('x.@@@.y'), null);
  assert.equal(decodeJwtPayload(`x.${toBase64Url('não é json')}.y`), null);
  assert.equal(decodeJwtPayload(`x.${toBase64Url('[1,2]')}.y`), null);
  assert.equal(decodeJwtPayload(`x.${toBase64Url('null')}.y`), null);
});

check('Malformado: exp que não é número conta como inválido', () => {
  assert.equal(isJwtExpired(jwt({ exp: '9999999999' }), NOW_MS), true);
});

// --- Parse do ErroResponse ---------------------------------------------------------------------------------------
check('ErroResponse de validação: status, código, mensagem e erros por campo', () => {
  const body = {
    timestamp: '2026-10-17T12:00:00',
    status: 400,
    erro: 'Bad Request',
    codigo: 'VALIDACAO',
    mensagem: 'Um ou mais campos são inválidos',
    campos: [
      { campo: 'email', mensagem: 'O e-mail informado é inválido' },
      { campo: 'senha', mensagem: 'A senha é obrigatória' },
      { campo: 'email', mensagem: 'segunda mensagem do mesmo campo' },
    ],
  };
  const e = parseApiError(400, body, null);
  assert.ok(e instanceof AppError);
  assert.equal(e.kind, 'HTTP');
  assert.equal(e.status, 400);
  assert.equal(e.code, 'VALIDACAO');
  assert.equal(e.message, 'Um ou mais campos são inválidos');
  assert.deepEqual(e.fieldErrors, { email: 'O e-mail informado é inválido', senha: 'A senha é obrigatória' });
});

check('ErroResponse sem campos: código de negócio e Retry-After', () => {
  const e = parseApiError(429, { status: 429, codigo: 'LIMITE_TENTATIVAS', mensagem: 'Muitas tentativas.', campos: [] }, '120');
  assert.equal(e.code, 'LIMITE_TENTATIVAS');
  assert.equal(e.retryAfterSec, 120);
  assert.equal(e.fieldErrors, undefined);
});

check('Corpo vazio, não JSON ou fora do formato vira erro genérico com o status', () => {
  for (const body of [null, 'texto', 42, [], { mensagem: '   ' }]) {
    const e = parseApiError(503, body, 'abc');
    assert.equal(e.status, 503);
    assert.equal(e.code, undefined);
    assert.equal(e.message, 'Não foi possível concluir a operação.');
    assert.equal(e.retryAfterSec, undefined);
  }
  assert.equal(parseApiError(500, { campos: [{ campo: 1 }, null, 'x'] }).fieldErrors, undefined);
});

check('parseJsonBody tolera corpo vazio e não JSON', () => {
  assert.equal(parseJsonBody(''), null);
  assert.equal(parseJsonBody('   '), null);
  assert.equal(parseJsonBody('<html>erro</html>'), null);
  assert.deepEqual(parseJsonBody('{"a":1}'), { a: 1 });
});

// --- Endereço da API ------------------------------------------------------------------------------------------------
check('normalizeApiBaseUrl apara espaços e barras finais e exige http(s)://', () => {
  assert.equal(normalizeApiBaseUrl('  http://192.168.0.10:8080/  '), 'http://192.168.0.10:8080');
  assert.equal(normalizeApiBaseUrl('https://api.exemplo.com.br///'), 'https://api.exemplo.com.br');
  assert.equal(normalizeApiBaseUrl('http://10.0.2.2:8080'), 'http://10.0.2.2:8080');
  for (const ruim of ['', '   ', '192.168.0.10:8080', 'ftp://x', 'http://', 'localhost']) {
    assert.equal(normalizeApiBaseUrl(ruim), null, ruim);
  }
});

// --- Erros por campo para o formulário ------------------------------------------------------------------------------
check('mapFieldErrors traduz nomes da API e ignora campos que o formulário não tem', () => {
  const e = new AppError('HTTP', 400, 'x', 'VALIDACAO', undefined, {
    nome: 'n',
    senha: 's',
    telefone: 't',
    consentimentoLgpd: 'c',
    dataNascimento: 'd',
    email: 'e',
    campoDesconhecido: '?',
  });
  type Form = { name: string; email: string; password: string; phone: string; lgpdConsent: boolean; birthDate: string };
  assert.deepEqual(
    Object.fromEntries(mapFieldErrors<Form>(e, ['name', 'email', 'password', 'phone', 'lgpdConsent', 'birthDate'])),
    { name: 'n', password: 's', phone: 't', lgpdConsent: 'c', birthDate: 'd', email: 'e' },
  );
  assert.deepEqual(mapFieldErrors<Form>(e, ['email']), [['email', 'e']]);
  assert.deepEqual(mapFieldErrors<Form>(undefined, ['email']), []);
});

// --- IDs opacos <-> IDs numéricos da API ---------------------------------------------------------------------------
check('toApiId converte string numérica e recusa NaN, negativo, fracionário e enorme', () => {
  assert.equal(toApiId('42'), 42);
  assert.equal(toApiId(' 7 '), 7);
  for (const ruim of ['', 'abc', 'e-jose', '-1', '1.5', '1e3', 'NaN', '99999999999999999999']) {
    assert.throws(() => toApiId(ruim), (e: unknown) => e instanceof AppError && e.code === 'ID_INVALIDO', ruim);
  }
});

check('fromApiId devolve string e recusa número inválido', () => {
  assert.equal(fromApiId(42), '42');
  assert.equal(toApiId(fromApiId(123456)), 123456);
  for (const ruim of [NaN, -1, 1.5, Number.MAX_SAFE_INTEGER + 2]) {
    assert.throws(() => fromApiId(ruim), AppError, String(ruim));
  }
});

// --- Datas da API no fuso de São Paulo (independente do fuso do aparelho) -------------------------------------------
check('LocalDateTime da API é interpretado em São Paulo (UTC-3), com ou sem segundos e fração', () => {
  const esperado = Date.UTC(2026, 9, 18, 15, 0, 0);
  assert.equal(apiDateTimeToEpochMs('2026-10-18T12:00:00'), esperado);
  assert.equal(apiDateTimeToEpochMs('2026-10-18T12:00'), esperado);
  assert.equal(apiDateTimeToEpochMs('2026-10-18T12:00:00.123456'), esperado + 123);
  // Virada de dia: 22:30 em São Paulo já é o dia seguinte em UTC
  assert.equal(apiDateTimeToEpochMs('2026-10-18T22:30:00'), Date.UTC(2026, 9, 19, 1, 30, 0));
  // Com fuso explícito, o fuso informado vale
  assert.equal(apiDateTimeToEpochMs('2026-10-18T12:00:00Z'), Date.UTC(2026, 9, 18, 12, 0, 0));
  assert.equal(apiDateTimeToEpochMs('2026-10-18T12:00:00-03:00'), esperado);
  for (const ruim of ['', 'amanhã', '2026-02-31T10:00:00', '2026-10-18T25:00:00', '2026-10-18', '18/10/2026 12:00']) {
    assert.equal(apiDateTimeToEpochMs(ruim), null, ruim);
  }
});

check('Data de hoje em São Paulo não depende do fuso do aparelho', () => {
  assert.equal(saoPauloDateKey(Date.UTC(2026, 9, 18, 2, 59)), '2026-10-17');
  assert.equal(saoPauloDateKey(Date.UTC(2026, 9, 18, 3, 0)), '2026-10-18');
  assert.equal(saoPauloDateKey(Date.UTC(2026, 0, 1, 2, 0)), '2025-12-31');
});

check('LocalTime da API vira HH:mm e DayOfWeek vira o índice do app (0 = domingo)', () => {
  assert.equal(apiTimeToHHmm('08:00:00'), '08:00');
  assert.equal(apiTimeToHHmm('21:30'), '21:30');
  assert.equal(apiTimeToHHmm('07:05:00.5'), '07:05');
  for (const ruim of ['8:00', '24:00', '12:60', 'x']) assert.equal(apiTimeToHHmm(ruim), null, ruim);
  assert.equal(apiWeekdayToIndex('SUNDAY'), 0);
  assert.equal(apiWeekdayToIndex('SATURDAY'), 6);
  assert.equal(apiWeekdayToIndex('domingo'), null);
  for (let i = 0; i < 7; i += 1) assert.equal(apiWeekdayToIndex(indexToApiWeekday(i)), i);
  assert.throws(() => indexToApiWeekday(7), RangeError);
});

// --- Mensagens de erro (mapeamento central) -------------------------------------------------------------------------
check('Códigos de erro da API viram mensagens claras; os demais mantêm a mensagem da API', () => {
  const de = (codigo: string, mensagem = 'mensagem técnica da API', retry?: string) =>
    parseApiError(400, { codigo, mensagem, campos: [] }, retry).message;
  assert.match(de('CODIGO_INVALIDO'), /Código inválido, expirado ou já usado/);
  assert.match(de('IDOSO_DUPLICADO'), /já cadastrou um paciente/);
  assert.match(de('ACESSO_NEGADO'), /não tem permissão/);
  assert.match(de('RECURSO_NAO_ENCONTRADO'), /Não encontramos/);
  assert.match(de('TRATAMENTO_ATIVO'), /tratamento ativo/);
  assert.doesNotMatch(de('CORPO_INVALIDO'), /técnica/);
  assert.equal(de('TRATAMENTO_INVALIDO', 'Há horários repetidos'), 'Há horários repetidos');
  assert.equal(de('EMAIL_DUPLICADO', 'E-mail já cadastrado'), 'E-mail já cadastrado');
  const limite = parseApiError(429, { codigo: 'LIMITE_TENTATIVAS', mensagem: 'x', campos: [] }, '120');
  assert.equal(limite.retryAfterSec, 120);
  assert.equal(limite.message, 'Muitas tentativas erradas. Aguarde 2 minutos para tentar de novo.');
  assert.match(messageForApiError('LIMITE_TENTATIVAS', 'x'), /Aguarde alguns minutos/);
  assert.equal(formatWait(1), '1 segundo');
  assert.equal(formatWait(45), '45 segundos');
  assert.equal(formatWait(61), '2 minutos');
});

// --- Mapeamento de idosos, códigos, medicamentos e tratamentos ------------------------------------------------------
check('IdosoResponse e CodigoVinculoResponse viram Elder e LinkCode (validade em São Paulo)', () => {
  const elder = toElder({ id: 12, nome: 'José', dataNascimento: '1945-03-12', telefone: null, cuidadorId: 3 });
  assert.deepEqual(elder, {
    id: '12', caregiverId: '3', name: 'José', birthDate: '1945-03-12', phone: undefined, avatarColor: elder.avatarColor,
  });
  assert.equal(toElder({ id: 12, nome: 'x', dataNascimento: '1945-03-12', telefone: null, cuidadorId: 3 }).avatarColor, elder.avatarColor);
  const link = toLinkCode({ codigo: '123456', idosoId: 12, expiraEm: '2026-10-19T12:00:00.654321' });
  assert.deepEqual(link, { code: '123456', elderId: '12', expiresAt: Date.UTC(2026, 9, 19, 15, 0, 0, 654), used: false });
  assert.throws(() => toLinkCode({ codigo: '1', idosoId: 1, expiraEm: 'nunca' }), AppError);
});

check('MedicamentoResponse vira Medication; tipo legado, formato e cor fora do padrão são tolerados', () => {
  const dto = {
    id: 7, nome: 'Losartana', dosagem: '50mg', tipo: 'COMPRIMIDO', formato: 'oval', cor: '#F4D35E',
    quantidadeEstoque: 30, bulaUrl: null, idosoId: 12,
  };
  const m = toMedication(dto);
  assert.equal(m.id, '7');
  assert.equal(m.elderId, '12');
  assert.equal(m.shape, 'OVAL');
  assert.equal(m.primaryColor, '#F4D35E');
  assert.equal(m.stock, 30);
  const legado = toMedication({ ...dto, tipo: 'Comprimido revestido', formato: 'Redondinho', cor: 'Branco', quantidadeEstoque: null });
  assert.equal(legado.type, 'COMPRIMIDO');
  assert.equal(legado.shape, undefined);
  assert.equal(legado.primaryColor, undefined);
  assert.equal(legado.stock, undefined);
});

check('Pedido de medicamento leva só os campos da API, idosoId numérico e bula só se for URL', () => {
  const base = {
    elderId: '12', name: ' Losartana ', dosage: ' 50mg ', type: 'CAPSULA' as const, shape: 'OVAL' as const,
    primaryColor: '#3D7DCA', secondaryColor: '#FFFFFF', lengthMm: 10, imprint: 'AB', hasScore: true, stock: 0,
    leaflet: 'Tomar após o almoço', appearanceSource: 'MANUAL' as const,
    treatment: { startDate: '2026-10-18', weekdays: [1], times: [{ time: '08:00' }] },
  };
  assert.deepEqual(toMedicamentoRequest(base), {
    nome: 'Losartana', dosagem: '50mg', tipo: 'CAPSULA', formato: undefined, cor: '#3D7DCA', quantidadeEstoque: 0,
    bulaUrl: undefined, idosoId: 12,
  });
  const comprimido = toMedicamentoRequest({ ...base, type: 'COMPRIMIDO', leaflet: 'https://bula.exemplo/x.pdf' });
  assert.equal(comprimido.formato, 'OVAL');
  assert.equal(comprimido.bulaUrl, 'https://bula.exemplo/x.pdf');
  assert.throws(() => toMedicamentoRequest({ ...base, elderId: 'e-jose' }), AppError);
});

check('Tratamento: pedido com horários únicos e ordenados e dias em inglês; resposta vira HH:mm', () => {
  const input = { startDate: '2026-10-18', weekdays: [5, 0, 1], times: [{ time: '20:00' }, { time: '08:00' }, { time: '08:00' }] };
  assert.deepEqual(toTratamentoRequest(input), {
    dataInicio: '2026-10-18', dataFim: undefined, horarios: ['08:00', '20:00'], diasSemana: ['SUNDAY', 'MONDAY', 'FRIDAY'],
  });
  // Edição: sem dataInicio (a API não muda o início) e dataFim nulo explícito para "contínuo"
  assert.deepEqual(toTratamentoEdicaoRequest(input), { dataFim: null, horarios: ['08:00', '20:00'], diasSemana: ['SUNDAY', 'MONDAY', 'FRIDAY'] });
  const t = toTreatment({
    id: 9, medicamentoId: 7, dataInicio: '2026-10-01', dataFim: null, horarios: ['20:00:00', '08:00:00'], diasSemana: ['FRIDAY', 'MONDAY'],
  });
  assert.deepEqual(t, { id: '9', medicationId: '7', startDate: '2026-10-01', endDate: undefined, weekdays: [1, 5], times: [{ time: '08:00' }, { time: '20:00' }] });
});

check('Tratamento vigente: o mais recente ativo; sem ativo, o mais recente', () => {
  const t = (id: string, endDate?: string) => ({ id, medicationId: '7', startDate: '2026-01-01', endDate, weekdays: [1], times: [] });
  assert.equal(pickCurrentTreatment([t('1'), t('2', '2026-02-01'), t('3')], '2026-10-18')?.id, '3');
  assert.equal(pickCurrentTreatment([t('1'), t('2', '2026-02-01')], '2026-10-18')?.id, '1');
  assert.equal(pickCurrentTreatment([t('1', '2026-01-10'), t('2', '2026-02-01')], '2026-10-18')?.id, '2');
  assert.equal(pickCurrentTreatment([t('1', '2026-10-18')], '2026-10-18')?.id, '1');
  assert.equal(isTreatmentActive(t('1', '2026-10-17'), '2026-10-18'), false);
  assert.equal(pickCurrentTreatment([], '2026-10-18'), undefined);
});

// --- Adapters HTTP com fetch falso (sem rede) -------------------------------------------------------------------------
interface Chamada {
  method: string;
  path: string;
  body: unknown;
}
type Resposta = { status: number; body?: unknown; headers?: Record<string, string> };

/** Troca o fetch global: cada chamada consome a próxima resposta da fila e fica registrada. */
function fakeFetch(respostas: Resposta[]): Chamada[] {
  const chamadas: Chamada[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = new URL(String(url));
    chamadas.push({ method: init?.method ?? 'GET', path: u.pathname + u.search, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const r = respostas.shift();
    if (!r) throw new Error(`Chamada inesperada: ${init?.method} ${u.pathname}${u.search}`);
    const texto = r.body === undefined ? '' : JSON.stringify(r.body);
    return new Response(r.status === 204 ? null : texto, { status: r.status, headers: r.headers });
  }) as typeof fetch;
  return chamadas;
}

const MED_DTO = {
  id: 501, nome: 'Losartana', dosagem: '50mg', tipo: 'COMPRIMIDO', formato: null, cor: null, quantidadeEstoque: null, bulaUrl: null, idosoId: 12,
};
const TRAT_DTO = { id: 900, medicamentoId: 501, dataInicio: '2026-10-18', dataFim: null, horarios: ['08:00:00'], diasSemana: ['MONDAY'] };
const MED_INPUT = {
  elderId: '12', name: 'Losartana', dosage: '50mg', type: 'COMPRIMIDO' as const, appearanceSource: 'MANUAL' as const,
  treatment: { startDate: '2026-10-18', weekdays: [1], times: [{ time: '08:00' }] },
};

checkAsync('Cadastro em duas chamadas: falha no tratamento avisa com o id e não repete o medicamento', async () => {
  const chamadas = fakeFetch([
    { status: 201, body: MED_DTO },
    { status: 400, body: { codigo: 'TRATAMENTO_INVALIDO', mensagem: 'Há horários repetidos', campos: [] } },
  ]);
  const erro = await httpMedicationService.create(MED_INPUT).then(
    () => assert.fail('deveria falhar'),
    (e: unknown) => e,
  );
  assert.ok(erro instanceof TreatmentNotSavedError);
  assert.ok(erro instanceof AppError);
  assert.equal(erro.medicationId, '501');
  assert.equal(erro.code, 'TRATAMENTO_NAO_SALVO');
  assert.match(erro.message, /O remédio foi salvo, mas os horários não\. Há horários repetidos/);
  assert.deepEqual(chamadas.map((c) => `${c.method} ${c.path}`), ['POST /api/medicamentos', 'POST /api/medicamentos/501/tratamentos']);
  assert.equal((chamadas[0].body as { idosoId: number }).idosoId, 12);

  // Nova tentativa: SÓ o tratamento (nenhum POST /api/medicamentos)
  const retry = fakeFetch([{ status: 200, body: MED_DTO }, { status: 201, body: TRAT_DTO }]);
  const view = await httpMedicationService.createTreatment('501', MED_INPUT.treatment);
  assert.deepEqual(retry.map((c) => `${c.method} ${c.path}`), ['GET /api/medicamentos/501', 'POST /api/medicamentos/501/tratamentos']);
  assert.equal(view.treatment?.id, '900');
  assert.equal(view.scheduleSummary, '08:00 • Seg');
});

checkAsync('Filtro "Todos": busca os idosos e os remédios de cada um, ordenados por paciente e nome', async () => {
  const chamadas = fakeFetch([
    { status: 200, body: [{ id: 2, nome: 'Zélia', dataNascimento: '1940-01-01', telefone: null, cuidadorId: 1 }, { id: 1, nome: 'Ana', dataNascimento: '1941-01-01', telefone: null, cuidadorId: 1 }] },
    { status: 200, body: [{ ...MED_DTO, id: 20, nome: 'B', idosoId: 2 }] },
    { status: 200, body: [{ ...MED_DTO, id: 10, nome: 'C', idosoId: 1 }, { ...MED_DTO, id: 11, nome: 'A', idosoId: 1 }] },
    { status: 200, body: [] },
    { status: 200, body: [TRAT_DTO] },
    { status: 200, body: [] },
  ]);
  const lista = await httpMedicationService.list('ALL');
  assert.deepEqual(lista.map((v) => `${v.elderName}/${v.medication.name}`), ['Ana/A', 'Ana/C', 'Zélia/B']);
  assert.equal(chamadas[0].path, '/api/idosos');
  assert.ok(chamadas.some((c) => c.path === '/api/medicamentos?idosoId=1'));
  assert.ok(chamadas.some((c) => c.path === '/api/medicamentos?idosoId=2'));
  assert.equal(chamadas.length, 6);
});

checkAsync('Remoção (RN06): sem forçar primeiro; 409 TRATAMENTO_ATIVO chega com o código; forçar manda forcarRemocao=true', async () => {
  const chamadas = fakeFetch([
    { status: 409, body: { codigo: 'TRATAMENTO_ATIVO', mensagem: 'Medicamento possui tratamento ativo', campos: [] } },
    { status: 204 },
  ]);
  const erro = await httpMedicationService.remove('501', { confirmed: false }).then(() => null, (e: unknown) => e);
  assert.ok(erro instanceof AppError && erro.code === 'TRATAMENTO_ATIVO' && erro.status === 409);
  await httpMedicationService.remove('501', { confirmed: true });
  assert.deepEqual(chamadas.map((c) => `${c.method} ${c.path}`), [
    'DELETE /api/medicamentos/501?forcarRemocao=false',
    'DELETE /api/medicamentos/501?forcarRemocao=true',
  ]);
});

checkAsync('Edição: PUT do medicamento e do tratamento vigente, sem dataInicio', async () => {
  const chamadas = fakeFetch([
    { status: 200, body: MED_DTO },
    { status: 200, body: [TRAT_DTO] },
    { status: 200, body: TRAT_DTO },
  ]);
  await httpMedicationService.update('501', MED_INPUT);
  assert.deepEqual(chamadas.map((c) => `${c.method} ${c.path}`), [
    'PUT /api/medicamentos/501',
    'GET /api/medicamentos/501/tratamentos',
    'PUT /api/tratamentos/900',
  ]);
  assert.equal('dataInicio' in (chamadas[2].body as object), false);
});

checkAsync('Vínculo: 429 traz Retry-After; código gerado fica disponível até expirar e some no logout', async () => {
  fakeFetch([{ status: 429, body: { codigo: 'LIMITE_TENTATIVAS', mensagem: 'x', campos: [] }, headers: { 'Retry-After': '90' } }]);
  const erro = await httpElderService.validateLinkCode('000000').then(() => null, (e: unknown) => e);
  assert.ok(erro instanceof AppError && erro.status === 429 && erro.retryAfterSec === 90);
  assert.match((erro as AppError).message, /Aguarde 2 minutos/);

  const daquiAUmDia = new Date(Date.now() + 24 * 3_600_000 - 3 * 3_600_000).toISOString().slice(0, 19);
  const chamadas = fakeFetch([{ status: 201, body: { codigo: '654321', idosoId: 12, expiraEm: daquiAUmDia } }]);
  const link = await httpElderService.generateLinkCode('12');
  assert.equal(chamadas[0].path, '/api/idosos/12/gerar-codigo');
  assert.deepEqual(await httpElderService.getActiveLinkCode('12'), link);
  assert.equal(await httpElderService.getActiveLinkCode('13'), null);
  forgetLinkCodes();
  assert.equal(await httpElderService.getActiveLinkCode('12'), null);

  fakeFetch([{ status: 200, body: { token: 't', tipo: 'Bearer', id: 12, nome: 'José' } }]);
  assert.deepEqual(await httpElderService.validateLinkCode(' 123456 '), { elderId: '12', elderName: 'José', token: 't' });
});

void (async () => {
  for (const { name, fn } of asyncChecks) {
    await fn();
    checks += 1;
    console.log(`ok - ${name}`);
  }
  console.log(`\n${checks} verificações OK`);
})().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
