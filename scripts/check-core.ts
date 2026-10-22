/// <reference types="node" />
/**
 * Verificações do núcleo do app (sem React): decodificador de JWT, parse do ErroResponse da API,
 * endereço da API, mapeamento de erros por campo, datas da API no fuso de São Paulo, mensagens de
 * erro por código, relógio do servidor, dose ao vivo, sessões no boot, cache do cliente HTTP e adapters HTTP de
 * idosos, medicamentos, doses e cadastro (com fetch falso, sem rede).
 * Uso: npm run check:core — termina com código != 0 na primeira asserção que falhar.
 */
import './check-core-env';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseApiError, parseJsonBody } from '../src/adapters/http/apiError';
import { httpAuthService } from '../src/adapters/http/HttpAuthService';
import { forgetDoseOrigins, httpDoseService, toDoseView } from '../src/adapters/http/HttpDoseService';
import { forgetLinkCodes, httpElderService, toElder, toLinkCode } from '../src/adapters/http/HttpElderService';
import { clearHttpCache, request, setViewerProvider } from '../src/adapters/http/httpClient';
import { httpReportService } from '../src/adapters/http/HttpReportService';
import appConfig, { ANDROID_BLOCKED_PERMISSIONS, ANDROID_PERMISSIONS, withCleartextPolicy } from '../app.config';
import { randomBytes } from 'node:crypto';
import { createPinGuard, createPinRecord, PIN_ITERATIONS } from '../src/lib/pinCore';
import {
  httpMedicationService,
  toMedicamentoRequest,
  toMedication,
  toTratamentoEdicaoRequest,
  toTratamentoRequest,
  toTreatment,
} from '../src/adapters/http/HttpMedicationService';
import { fromApiId, toApiId } from '../src/adapters/http/ids';
import { apiUrlProblem, normalizeApiBaseUrl } from '../src/config/env';
import { mapFieldErrors } from '../src/lib/formErrors';
import { decodeJwtPayload, getJwtExp, isJwtExpired } from '../src/lib/jwt';
import { apiDateTimeToEpochMs, apiTimeToHHmm, apiWeekdayToIndex, indexToApiWeekday, saoPauloDateKey } from '../src/lib/apiTime';
import { emptyMedicationValues, toMedicationInput } from '../src/features/medications/formValues';
import { ELDER_EXPIRED_MESSAGE, resolveStoredSessions, SESSION_EXPIRED_MESSAGE } from '../src/lib/bootRules';
import { dailyTotals } from '../src/lib/dailyReport';
import { liveDose } from '../src/lib/doseLive';
import { emptyHistoryNotice, hasMoreHistory, historyPath, historyRange, mergeHistory } from '../src/lib/history';
import { MESSAGE_POLL_MS, messageSendError } from '../src/lib/messages';
import { httpMessageService } from '../src/adapters/http/HttpMessageService';
import { toleranceError } from '../src/lib/doseRules';
import { isTreatmentActive, pickCurrentTreatment } from '../src/lib/medicationMeta';
import { createPushService, isPushSupported, type NotificationsModule } from '../src/lib/pushCore';
import { parseDosePayload } from '../src/lib/pushPayload';
import { createPushRegistration } from '../src/lib/pushRegistrationCore';
import { useQueryBus } from '../src/lib/queryBus';
import { medicationFormSchema } from '../src/lib/schemas';
import { appNowMs, appTodayKey, computeClockOffset, recordServerDate, resetServerClock, serverOffsetMs } from '../src/lib/serverClock';
import { formatWait, messageForApiError } from '../src/services/errorMessages';
import { AppError, httpError, networkError, TreatmentNotSavedError } from '../src/services/errors';

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

check('Pedido de medicamento leva só os campos da API, idosoId numérico e o link da bula', () => {
  const base = {
    elderId: '12', name: ' Losartana ', dosage: ' 50mg ', type: 'CAPSULA' as const, shape: 'OVAL' as const,
    primaryColor: '#3D7DCA', secondaryColor: '#FFFFFF', lengthMm: 10, imprint: 'AB', hasScore: true, stock: 0,
    bulaUrl: '  ', appearanceSource: 'MANUAL' as const,
    treatment: { startDate: '2026-10-18', weekdays: [1], times: [{ time: '08:00' }] },
  };
  assert.deepEqual(toMedicamentoRequest(base), {
    nome: 'Losartana', dosagem: '50mg', tipo: 'CAPSULA', formato: undefined, cor: '#3D7DCA', quantidadeEstoque: 0,
    bulaUrl: undefined, idosoId: 12,
  });
  const comprimido = toMedicamentoRequest({ ...base, type: 'COMPRIMIDO', bulaUrl: ' https://bula.exemplo/x.pdf ' });
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
  // Cada cenário começa sem leituras guardadas pelo cliente HTTP
  clearHttpCache();
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

// --- Relógio do servidor e janela da dose (FE-21) -------------------------------------------------------------------
check('Diferença de relógio pelo header Date: meio do segundo do servidor menos o meio da viagem', () => {
  const header = 'Sun, 18 Oct 2026 15:00:00 GMT';
  const servidor = Date.UTC(2026, 9, 18, 15, 0, 0);
  // Aparelho 2 minutos atrasado; viagem de 200 ms
  const envio = servidor - 120_000 - 100;
  assert.equal(computeClockOffset(header, envio, envio + 200), 120_000 + 500);
  assert.equal(computeClockOffset(null, 0, 0), null);
  assert.equal(computeClockOffset('ontem', 0, 0), null);
  recordServerDate(header, envio, envio + 200);
  assert.equal(serverOffsetMs(), 120_500);
  // Até 2 s é ruído: zera
  recordServerDate(header, servidor - 1_000, servidor - 800);
  assert.equal(serverOffsetMs(), 0);
  // Header ausente mantém a diferença anterior
  recordServerDate(header, envio, envio + 200);
  recordServerDate(undefined, 0, 0);
  assert.equal(serverOffsetMs(), 120_500);
  assert.equal(appNowMs(new Date(1_000_000)), 1_120_500);
  // O dia de hoje usa o relógio corrigido e o fuso de São Paulo: 02:59 UTC no aparelho + 2 min = 03:01 UTC
  assert.equal(appTodayKey(new Date(Date.UTC(2026, 9, 18, 2, 59) - 500)), '2026-10-18');
  resetServerClock();
  assert.equal(appTodayKey(new Date(Date.UTC(2026, 9, 18, 2, 59))), '2026-10-17');
});

const DOSE_DTO = {
  id: 5000, idosoId: 12, idosoNome: 'José', medicamentoId: 501, medicamentoNome: 'Losartana', dosagem: '50mg',
  tipo: 'COMPRIMIDO', tratamentoId: 900, horarioProgramado: '2026-10-18T08:00:00', horaConfirmacao: null,
  status: 'PENDENTE' as const, statusExibicao: 'PENDENTE' as const, toleranciaMinutos: 30,
  janela: { abreEm: '2026-10-18T07:00:00', avisoEm: '2026-10-18T08:30:00', encerraEm: '2026-10-18T09:00:00' },
  limiteConfirmacao: '2026-10-18T09:00:00',
  confirmadoPor: null,
  confirmabilidade: 'OK' as const,
};
const SP = (hh: number, mm: number, ss = 0) => Date.UTC(2026, 9, 18, hh + 3, mm, ss);

check('DoseResponseDTO vira DoseView com status, janela e confirmabilidade do servidor', () => {
  const v = toDoseView({ ...DOSE_DTO, horaConfirmacao: '2026-10-18T08:05:12.123456', status: 'CONFIRMADA_NO_HORARIO', statusExibicao: 'CONFIRMADA_NO_HORARIO', confirmabilidade: 'JA_REGISTRADA', confirmadoPor: 'CUIDADOR' });
  assert.equal(v.id, '5000');
  assert.equal(v.elderId, '12');
  assert.equal(v.medication.id, '501');
  assert.equal(v.treatmentId, '900');
  assert.equal(v.scheduledAt, '2026-10-18T08:00');
  assert.equal(v.confirmedAt, '2026-10-18T08:05');
  assert.equal(v.storedStatus, 'CONFIRMADA_NO_HORARIO');
  assert.equal(v.confirmability, 'JA_REGISTRADA');
  assert.deepEqual(v.window, { opensAt: '2026-10-18T07:00', alertAt: '2026-10-18T08:30', closesAt: '2026-10-18T09:00' });
  assert.equal(v.confirmUntil, '2026-10-18T09:00');
  assert.equal(v.confirmedBy, 'CUIDADOR');
  assert.equal(toDoseView(DOSE_DTO).confirmedBy, undefined);
  // Servidor sem limiteConfirmacao: o limite é o fim da janela
  const { limiteConfirmacao: _semLimite, ...semLimite } = DOSE_DTO;
  assert.equal(toDoseView(semLimite).confirmUntil, '2026-10-18T09:00');
  assert.equal(v.toleranceMinutes, 30);
  assert.equal(toDoseView({ ...DOSE_DTO, tratamentoId: null }).treatmentId, null);
});

check('Dose ao vivo: só compara agora com a janela do servidor, nos limites exatos, e nunca volta atrás', () => {
  const base = toDoseView({ ...DOSE_DTO, statusExibicao: 'PENDENTE', confirmabilidade: 'MUITO_CEDO' });
  const em = (ms: number) => liveDose(base, ms, apiDateTimeToEpochMs);
  assert.equal(em(SP(6, 59, 59)).confirmability, 'MUITO_CEDO');
  assert.equal(em(SP(7, 0)).confirmability, 'OK');
  assert.equal(em(SP(8, 30)).status, 'PENDENTE');
  assert.equal(em(SP(8, 30, 1)).status, 'ATRASADA');
  assert.equal(em(SP(9, 0)).confirmability, 'OK');
  assert.equal(em(SP(9, 0, 1)).status, 'NAO_TOMADA');
  assert.equal(em(SP(9, 0, 1)).confirmability, 'ENCERRADA');
  // O servidor já disse ATRASADA: um aparelho atrasado não faz a dose "voltar" a PENDENTE
  const atrasada = toDoseView({ ...DOSE_DTO, statusExibicao: 'ATRASADA', confirmabilidade: 'OK' });
  assert.equal(liveDose(atrasada, SP(8, 0), apiDateTimeToEpochMs).status, 'ATRASADA');
  // Registrada no servidor: não muda; janela ilegível: fica como veio
  const tomada = toDoseView({ ...DOSE_DTO, status: 'CONFIRMADA_NO_HORARIO', statusExibicao: 'CONFIRMADA_NO_HORARIO', confirmabilidade: 'JA_REGISTRADA' });
  assert.equal(liveDose(tomada, SP(12, 0), apiDateTimeToEpochMs), tomada);
  assert.equal(liveDose(base, SP(12, 0), () => null), base);
});

// --- Sessões guardadas no boot (FE-56) -----------------------------------------------------------------------------
check('Boot: token do idoso vencido apaga a conexão e avisa no perfil do idoso; no demo não confere', () => {
  const valido = { elderId: '12', token: jwt({ sub: '12', exp: nowSec + 3600 }) };
  const vencido = { elderId: '12', token: jwt({ sub: '12', exp: nowSec - 1 }) };
  const cuidador = { caregiverId: '1', name: 'A', email: 'a@a', token: jwt({ sub: '1', exp: nowSec + 60 }) };
  const ok = resolveStoredSessions({ profile: 'IDOSO', caregiver: null, elder: valido, isDemo: false, nowMs: NOW_MS });
  assert.deepEqual(ok, { caregiver: null, elder: valido, clearCaregiver: false, clearElder: false, flash: null });
  const venceu = resolveStoredSessions({ profile: 'IDOSO', caregiver: cuidador, elder: vencido, isDemo: false, nowMs: NOW_MS });
  assert.equal(venceu.elder, null);
  assert.equal(venceu.clearElder, true);
  assert.equal(venceu.caregiver, cuidador);
  assert.equal(venceu.flash, ELDER_EXPIRED_MESSAGE);
  // Aparelho no perfil do cuidador: apaga a conexão do idoso, sem aviso na tela do cuidador
  assert.equal(resolveStoredSessions({ profile: 'CUIDADOR', caregiver: cuidador, elder: vencido, isDemo: false, nowMs: NOW_MS }).flash, null);
  // Demo: token fictício do mock não é JWT e não pode derrubar a sessão
  const demo = { elderId: 'e-jose', token: 'mock.jwt.idoso.e-jose' };
  assert.equal(resolveStoredSessions({ profile: 'IDOSO', caregiver: null, elder: demo, isDemo: true, nowMs: NOW_MS }).elder, demo);
  // Cuidador vencido continua indo ao login
  const cuidadorVencido = { ...cuidador, token: jwt({ sub: '1', exp: nowSec - 1 }) };
  const r = resolveStoredSessions({ profile: 'CUIDADOR', caregiver: cuidadorVencido, elder: null, isDemo: false, nowMs: NOW_MS });
  assert.equal(r.caregiver, null);
  assert.equal(r.flash, SESSION_EXPIRED_MESSAGE);
});

// --- Cliente HTTP: dedupe, cache curto e invalidação (FE-18) -------------------------------------------------------
checkAsync('Leituras iguais em voo viram uma chamada; cache curto; escrita limpa o cache e avisa as telas', async () => {
  const chamadas = fakeFetch([{ status: 200, body: [] }, { status: 204 }, { status: 200, body: [] }]);
  const [a, b] = await Promise.all([request('GET', '/api/idosos'), request('GET', '/api/idosos')]);
  assert.deepEqual(a, []);
  assert.equal(a, b);
  await request('GET', '/api/idosos');
  assert.equal(chamadas.length, 1);
  const versao = useQueryBus.getState().version;
  await request('DELETE', '/api/cuidadores/me/fcm-token');
  assert.equal(useQueryBus.getState().version, versao + 1);
  await request('GET', '/api/idosos');
  assert.deepEqual(chamadas.map((c) => `${c.method} ${c.path}`), ['GET /api/idosos', 'DELETE /api/cuidadores/me/fcm-token', 'GET /api/idosos']);
});

checkAsync('Leitura que falha não fica guardada: a próxima tenta de novo', async () => {
  const chamadas = fakeFetch([{ status: 503 }, { status: 200, body: [] }]);
  await request('GET', '/api/idosos').then(() => assert.fail('deveria falhar'), () => undefined);
  assert.deepEqual(await request('GET', '/api/idosos'), []);
  assert.equal(chamadas.length, 2);
});

// --- Doses reais (FE-14 parte 1) -----------------------------------------------------------------------------------
checkAsync('Doses: o idoso usa /me/doses; o cuidador, a rota do idoso; "Todos" busca os idosos', async () => {
  setViewerProvider(() => 'ELDER');
  let chamadas = fakeFetch([{ status: 200, body: [DOSE_DTO] }]);
  const doIdoso = await httpDoseService.listForDay('12', '2026-10-18');
  assert.equal(chamadas[0].path, '/api/idosos/me/doses?data=2026-10-18');
  assert.equal(doIdoso[0].id, '5000');

  setViewerProvider(() => 'CAREGIVER');
  chamadas = fakeFetch([
    { status: 200, body: [{ id: 12, nome: 'José', dataNascimento: '1945-01-01', telefone: null, cuidadorId: 1 }, { id: 13, nome: 'Ana', dataNascimento: '1945-01-01', telefone: null, cuidadorId: 1 }] },
    { status: 200, body: [{ ...DOSE_DTO, horarioProgramado: '2026-10-18T09:00:00' }] },
    { status: 200, body: [{ ...DOSE_DTO, id: 6000, idosoId: 13, idosoNome: 'Ana' }] },
  ]);
  const todos = await httpDoseService.listForDay('ALL', '2026-10-18');
  assert.deepEqual(chamadas.map((c) => c.path), ['/api/idosos', '/api/idosos/12/doses?data=2026-10-18', '/api/idosos/13/doses?data=2026-10-18']);
  assert.deepEqual(todos.map((d) => d.id), ['6000', '5000']);
});

checkAsync('Detalhe da dose: busca de novo o dia de onde ela veio; sem origem conhecida, 404 claro', async () => {
  setViewerProvider(() => 'CAREGIVER');
  fakeFetch([{ status: 200, body: [DOSE_DTO] }]);
  await httpDoseService.listForDay('12', '2026-10-18');
  const chamadas = fakeFetch([{ status: 200, body: [{ ...DOSE_DTO, statusExibicao: 'ATRASADA' }] }]);
  const atual = await httpDoseService.get('5000');
  assert.equal(chamadas[0].path, '/api/idosos/12/doses?data=2026-10-18');
  assert.equal(atual.status, 'ATRASADA');
  // Com a dica (ex.: payload do push), não precisa ter visto a lista
  const comDica = fakeFetch([{ status: 200, body: [{ ...DOSE_DTO, id: 7000, horarioProgramado: '2026-10-17T08:00:00' }] }]);
  assert.equal((await httpDoseService.get('7000', { elderId: '12', day: '2026-10-17' })).id, '7000');
  assert.equal(comDica[0].path, '/api/idosos/12/doses?data=2026-10-17');
  forgetDoseOrigins();
  const erro = await httpDoseService.get('5000').then(() => null, (e: unknown) => e);
  assert.ok(erro instanceof AppError && erro.status === 404);
});

checkAsync('Confirmar: PUT /api/doses/{id}/confirmar; 409 DOSE_ENCERRADA chega com código e mensagem clara', async () => {
  setViewerProvider(() => 'ELDER');
  const chamadas = fakeFetch([
    { status: 200, body: { ...DOSE_DTO, status: 'CONFIRMADA_NO_HORARIO', statusExibicao: 'CONFIRMADA_NO_HORARIO', horaConfirmacao: '2026-10-18T08:01:00', confirmabilidade: 'JA_REGISTRADA' } },
    { status: 409, body: { codigo: 'DOSE_ENCERRADA', mensagem: 'x', campos: [] } },
    { status: 409, body: { codigo: 'DOSE_JA_REGISTRADA', mensagem: 'x', campos: [] } },
    { status: 409, body: { codigo: 'DOSE_MUITO_CEDO', mensagem: 'x', campos: [] } },
  ]);
  const confirmada = await httpDoseService.confirm('5000');
  assert.equal(confirmada.storedStatus, 'CONFIRMADA_NO_HORARIO');
  assert.equal(chamadas[0].method, 'PUT');
  assert.equal(chamadas[0].path, '/api/doses/5000/confirmar');
  for (const [codigo, texto] of [['DOSE_ENCERRADA', /prazo/], ['DOSE_JA_REGISTRADA', /já foi registrada/], ['DOSE_MUITO_CEDO', /cedo/]] as const) {
    const erro = await httpDoseService.confirm('5000').then(() => null, (e: unknown) => e);
    assert.ok(erro instanceof AppError && erro.code === codigo && erro.status === 409, codigo);
    assert.match((erro as AppError).message, texto);
  }
});

checkAsync('Alertas: doses do dia ainda PENDENTES que o servidor mostra como ATRASADA ou NAO_TOMADA', async () => {
  setViewerProvider(() => 'CAREGIVER');
  fakeFetch([
    { status: 200, body: [{ id: 12, nome: 'José', dataNascimento: '1945-01-01', telefone: null, cuidadorId: 1 }] },
    {
      status: 200,
      body: [
        { ...DOSE_DTO, id: 1, statusExibicao: 'ATRASADA' },
        { ...DOSE_DTO, id: 2, statusExibicao: 'PENDENTE' },
        { ...DOSE_DTO, id: 3, status: 'NAO_TOMADA', statusExibicao: 'NAO_TOMADA', confirmabilidade: 'JA_REGISTRADA' },
        { ...DOSE_DTO, id: 4, statusExibicao: 'NAO_TOMADA', confirmabilidade: 'ENCERRADA' },
      ],
    },
  ]);
  const alertas = await httpDoseService.listAlerts();
  assert.deepEqual(alertas.map((a) => `${a.doseId}:${a.status}`), ['1:ATRASADA', '4:NAO_TOMADA']);
});

// --- Cadastro em que só o POST deu certo (FE-55) -------------------------------------------------------------------
checkAsync('Cadastro criado e login falhou: não repete o POST e avisa para fazer login', async () => {
  const chamadas = fakeFetch([{ status: 201, body: { id: 1 } }, { status: 503 }]);
  const erro = await httpAuthService
    .signUp({ name: 'Ana', email: ' ana@teste.com ', password: 'Senha123', lgpdConsent: true })
    .then(() => null, (e: unknown) => e);
  assert.ok(erro instanceof AppError);
  assert.equal(erro.code, 'CONTA_CRIADA_SEM_LOGIN');
  assert.equal(erro.message, 'Conta criada, mas não foi possível entrar agora. Faça login.');
  assert.deepEqual(chamadas.map((c) => `${c.method} ${c.path}`), ['POST /api/cuidadores', 'POST /api/auth/login']);
});

// --- Relatório diário (FE-24) e formulário de remédio alinhado à API (FE-19) ---------------------------------------
check('Totais do relatório diário: aderência = (tomadas + com atraso) / (total - pendentes), 1 casa, null sem encerradas', () => {
  assert.deepEqual(dailyTotals([]), { total: 0, onTime: 0, late: 0, missed: 0, pending: 0, adherencePercent: null });
  assert.equal(dailyTotals(['PENDENTE', 'PENDENTE']).adherencePercent, null);
  const misto = dailyTotals(['CONFIRMADA_NO_HORARIO', 'CONFIRMADA_NO_HORARIO', 'CONFIRMADA_COM_ATRASO', 'NAO_TOMADA', 'PENDENTE', 'PENDENTE']);
  assert.deepEqual(misto, { total: 6, onTime: 2, late: 1, missed: 1, pending: 2, adherencePercent: 75 });
  assert.equal(dailyTotals(['CONFIRMADA_NO_HORARIO', 'NAO_TOMADA', 'NAO_TOMADA']).adherencePercent, 33.3);
  assert.equal(dailyTotals(['CONFIRMADA_COM_ATRASO', 'CONFIRMADA_NO_HORARIO', 'NAO_TOMADA']).adherencePercent, 66.7);
});

check('Formulário de remédio envia só os campos da API (sem quantidade nem observação por horário)', () => {
  const valores = {
    ...emptyMedicationValues('12', new Date(2026, 9, 18)),
    name: 'Losartana',
    dosage: '50mg',
    type: 'GOTAS' as const,
    shape: 'OVAL' as const,
    bulaUrl: '  https://bula.exemplo/x.pdf ',
    stock: '3',
    times: [{ time: '20:00' }, { time: '08:00' }],
  };
  assert.deepEqual(Object.keys(valores).sort(), [
    'bulaUrl', 'dosage', 'elderId', 'endDate', 'name', 'primaryColor', 'shape', 'startDate', 'stock', 'times', 'type', 'weekdays',
  ]);
  const input = toMedicationInput(valores);
  assert.equal(input.shape, undefined);
  assert.equal(input.bulaUrl, 'https://bula.exemplo/x.pdf');
  assert.equal(input.stock, 3);
  assert.deepEqual(input.treatment, { startDate: '2026-10-18', endDate: undefined, weekdays: [0, 1, 2, 3, 4, 5, 6], times: [{ time: '08:00' }, { time: '20:00' }] });
  assert.equal(toMedicationInput({ ...valores, bulaUrl: '' }).bulaUrl, undefined);
});

check('Validação do formulário de remédio: limites da API (255, 100, 2048) e link da bula', () => {
  const base = { ...emptyMedicationValues('12', new Date(2026, 9, 18)), name: 'Losartana', dosage: '50mg' };
  assert.equal(medicationFormSchema.safeParse(base).success, true);
  const erroEm = (v: object) => {
    const r = medicationFormSchema.safeParse({ ...base, ...v });
    return r.success ? [] : r.error.issues.map((i) => i.path[0]);
  };
  assert.deepEqual(erroEm({ name: 'x'.repeat(256) }), ['name']);
  assert.deepEqual(erroEm({ dosage: 'x'.repeat(101) }), ['dosage']);
  assert.deepEqual(erroEm({ bulaUrl: 'bula do remédio' }), ['bulaUrl']);
  assert.deepEqual(erroEm({ bulaUrl: `https://x.com/${'a'.repeat(2048)}` }), ['bulaUrl']);
  assert.deepEqual(erroEm({ stock: '-1' }), ['stock']);
  assert.deepEqual(erroEm({ times: [{ time: '08:00' }, { time: '08:00' }] }), ['times']);
});

check('"Esqueci a senha" removido do login e tela "Relatório diário" registrada com esse nome', () => {
  const ler = (p: string) => readFileSync(join(__dirname, '..', 'src', p), 'utf8');
  assert.doesNotMatch(ler('features/auth/LoginScreen.tsx'), /Esqueci a senha|forgot/i);
  assert.match(ler('app/navigation/RootNavigator.tsx'), /name="DailyReport" component=\{DailyReportScreen\}/);
  assert.match(ler('features/reports/DailyReportScreen.tsx'), /title="Relatório diário"/);
});

// --- Tolerância (FE-14 p2 / FE-20) e relatório diário real ---------------------------------------------------------
check('Tolerância: faixa local igual à da API (5 a 120, inteiro)', () => {
  for (const ok of [5, 30, 120]) assert.equal(toleranceError(ok), null, String(ok));
  for (const ruim of [4, 121, 0, 30.5, Number.NaN]) assert.equal(toleranceError(ruim), 'A tolerância deve ficar entre 5 e 120 minutos', String(ruim));
});

checkAsync('Tolerância real: GET e PUT /api/configuracoes/tolerancia; 400 VALIDACAO traz a mensagem do campo', async () => {
  const chamadas = fakeFetch([
    { status: 200, body: { toleranciaMinutos: 30 } },
    { status: 200, body: { toleranciaMinutos: 45 } },
    {
      status: 400,
      body: { codigo: 'VALIDACAO', mensagem: 'Um ou mais campos são inválidos', campos: [{ campo: 'toleranciaMinutos', mensagem: 'A tolerância deve ficar entre 5 e 120 minutos' }] },
    },
  ]);
  assert.equal(await httpDoseService.getTolerance(), 30);
  assert.equal(await httpDoseService.setTolerance(45), 45);
  const erro = await httpDoseService.setTolerance(121).then(() => null, (e: unknown) => e);
  assert.ok(erro instanceof AppError && erro.code === 'VALIDACAO');
  assert.equal((erro as AppError).fieldErrors?.toleranciaMinutos, 'A tolerância deve ficar entre 5 e 120 minutos');
  assert.deepEqual(chamadas.map((c) => `${c.method} ${c.path}`), [
    'GET /api/configuracoes/tolerancia',
    'PUT /api/configuracoes/tolerancia',
    'PUT /api/configuracoes/tolerancia',
  ]);
  assert.deepEqual(chamadas[1].body, { toleranciaMinutos: 45 });
});

checkAsync('Relatório diário real: GET /api/relatorios/diario com idoso e data; totais, aderência e doses abrem o detalhe', async () => {
  setViewerProvider(() => 'CAREGIVER');
  forgetDoseOrigins();
  const chamadas = fakeFetch([
    {
      status: 200,
      body: {
        idoso: { id: 12, nome: 'José' },
        data: '2026-10-17',
        totais: { total: 2, confirmadasNoHorario: 1, confirmadasComAtraso: 0, naoTomadas: 1, pendentes: 0, aderenciaPercentual: 50.0 },
        doses: [{ ...DOSE_DTO, horarioProgramado: '2026-10-17T08:00:00' }],
      },
    },
    { status: 200, body: [{ ...DOSE_DTO, horarioProgramado: '2026-10-17T08:00:00' }] },
  ]);
  const r = await httpReportService.getDaily('12', '2026-10-17');
  assert.equal(chamadas[0].path, '/api/relatorios/diario?idosoId=12&data=2026-10-17');
  assert.deepEqual(r.elder, { id: '12', name: 'José' });
  assert.deepEqual(r.totals, { total: 2, onTime: 1, late: 0, missed: 1, pending: 0, adherencePercent: 50 });
  assert.equal(r.doses[0].id, '5000');
  // O detalhe da dose do relatório é achado no dia dela (17), não no de hoje
  await httpDoseService.get('5000');
  assert.equal(chamadas[1].path, '/api/idosos/12/doses?data=2026-10-17');
});

// --- Push no app (FE-25) e build Android (FE-30) -------------------------------------------------------------------
check('Push só existe no Android fora do Expo Go e do demo; nos outros casos é inerte e nem carrega o módulo', () => {
  const casos = [
    { os: 'ios', isExpoGo: false, isDemo: false },
    { os: 'android', isExpoGo: true, isDemo: false },
    { os: 'android', isExpoGo: false, isDemo: true },
    { os: 'web', isExpoGo: false, isDemo: false },
  ];
  for (const env of casos) {
    let carregou = false;
    const servico = createPushService(env, () => {
      carregou = true;
      throw new Error('não deveria carregar');
    });
    assert.equal(servico.supported, false, JSON.stringify(env));
    assert.equal(isPushSupported(env), false);
    servico.onTokenChange(() => undefined)();
    servico.onOpen(() => undefined)();
    servico.showInForeground();
    assert.equal(carregou, false, JSON.stringify(env));
  }
  assert.equal(isPushSupported({ os: 'android', isExpoGo: false, isDemo: false }), true);
});

/** expo-notifications falso: registra as chamadas e permite disparar eventos. */
function notificacoesFalsas(opcoes: { token?: unknown; falhaToken?: boolean; permissao?: string } = {}) {
  const ouvintes: { token: ((t: { data: unknown }) => void)[]; abrir: ((r: unknown) => void)[] } = { token: [], abrir: [] };
  const canais: { id: string; canal: { importance: number; name: string } }[] = [];
  let handler: unknown = null;
  const ultima = { limpa: false };
  const mod = {
    AndroidImportance: { HIGH: 6, MAX: 7 },
    getDevicePushTokenAsync: async () => {
      if (opcoes.falhaToken) throw new Error('FCM indisponível');
      return { type: 'android', data: opcoes.token ?? 'fcm-bruto-123' };
    },
    addPushTokenListener: (cb: (t: { data: unknown }) => void) => {
      ouvintes.token.push(cb);
      return { remove: () => ouvintes.token.splice(ouvintes.token.indexOf(cb), 1) };
    },
    setNotificationChannelAsync: async (id: string, canal: { importance: number; name: string }) => {
      canais.push({ id, canal });
      return null;
    },
    getPermissionsAsync: async () => ({ status: opcoes.permissao ?? 'undetermined' }),
    requestPermissionsAsync: async () => ({ status: 'granted' }),
    addNotificationResponseReceivedListener: (cb: (r: unknown) => void) => {
      ouvintes.abrir.push(cb);
      return { remove: () => ouvintes.abrir.splice(ouvintes.abrir.indexOf(cb), 1) };
    },
    getLastNotificationResponseAsync: async () =>
      ultima.limpa ? null : { notification: { request: { content: { data: { tipo: 'DOSE_NAO_CONFIRMADA', doseId: '5' } } } } },
    clearLastNotificationResponse: () => {
      ultima.limpa = true;
    },
    setNotificationHandler: (h: unknown) => {
      handler = h;
    },
  };
  return { mod: mod as unknown as NotificationsModule, ouvintes, canais, handler: () => handler, ultima };
}

checkAsync('Push suportado: token FCM bruto, troca de token, canal "Alertas de dose", permissão e toque na notificação', async () => {
  const falso = notificacoesFalsas();
  const servico = createPushService({ os: 'android', isExpoGo: false, isDemo: false }, () => falso.mod);
  assert.equal(servico.supported, true);
  assert.equal(await servico.getDeviceToken(), 'fcm-bruto-123');

  const novos: string[] = [];
  const parar = servico.onTokenChange((t) => novos.push(t));
  falso.ouvintes.token.forEach((cb) => cb({ data: 'fcm-novo' }));
  falso.ouvintes.token.forEach((cb) => cb({ data: '' }));
  parar();
  assert.deepEqual(novos, ['fcm-novo']);
  assert.equal(falso.ouvintes.token.length, 0);

  await servico.ensureAlertChannel();
  assert.equal(falso.canais[0].id, 'alertas-dose');
  assert.equal(falso.canais[0].canal.name, 'Alertas de dose');
  assert.equal(falso.canais[0].canal.importance, 6);

  assert.equal(await servico.getPermission(), 'undetermined');
  assert.equal(await servico.requestPermission(), 'granted');

  const abertos: Record<string, unknown>[] = [];
  servico.onOpen((d) => abertos.push(d));
  falso.ouvintes.abrir.forEach((cb) => cb({ notification: { request: { content: { data: { doseId: '9' } } } } }));
  // Payload só em trigger.remoteMessage.data (Android, app em segundo plano em algumas versões)
  falso.ouvintes.abrir.forEach((cb) =>
    cb({ notification: { request: { content: { data: {} }, trigger: { remoteMessage: { data: { doseId: '10' } } } } } }));
  assert.deepEqual(abertos, [{ doseId: '9' }, { doseId: '10' }]);
  assert.deepEqual(await servico.getLaunchData(), { tipo: 'DOSE_NAO_CONFIRMADA', doseId: '5' });
  // A notificação que abriu o app é consumida: a próxima abertura não reabre a mesma dose
  assert.equal(falso.ultima.limpa, true);
  assert.equal(await servico.getLaunchData(), null);

  servico.showInForeground();
  assert.ok(falso.handler());
});

checkAsync('Push suportado mas com falha: módulo que não carrega ou FCM fora do ar nunca derrubam o app', async () => {
  const semModulo = createPushService({ os: 'android', isExpoGo: false, isDemo: false }, () => {
    throw new Error('módulo nativo ausente');
  });
  assert.equal(await semModulo.getDeviceToken(), null);
  assert.equal(await semModulo.requestPermission(), 'unavailable');
  semModulo.onTokenChange(() => undefined)();
  const fcmFora = createPushService({ os: 'android', isExpoGo: false, isDemo: false }, () => notificacoesFalsas({ falhaToken: true }).mod);
  assert.equal(await fcmFora.getDeviceToken(), null);
  const tokenEstranho = createPushService({ os: 'android', isExpoGo: false, isDemo: false }, () => notificacoesFalsas({ token: 42 }).mod);
  assert.equal(await tokenEstranho.getDeviceToken(), null);
});

check('Build Android: google-services.json só por variável de ambiente e nunca no repositório', () => {
  const raiz = join(__dirname, '..');
  const ignorados = readFileSync(join(raiz, '.gitignore'), 'utf8').split(/\r?\n/);
  for (const padrao of ['google-services.json', 'android/', 'ios/', '.env']) assert.ok(ignorados.includes(padrao), padrao);
  assert.equal(existsSync(join(raiz, 'google-services.json')), false);
  const base = JSON.parse(readFileSync(join(raiz, 'app.json'), 'utf8')).expo;
  const antes = process.env.GOOGLE_SERVICES_JSON;
  delete process.env.GOOGLE_SERVICES_JSON;
  const semArquivo = appConfig({ config: base } as never);
  process.env.GOOGLE_SERVICES_JSON = 'C:/segredos/google-services.json';
  const comArquivo = appConfig({ config: base } as never);
  if (antes === undefined) delete process.env.GOOGLE_SERVICES_JSON;
  else process.env.GOOGLE_SERVICES_JSON = antes;
  assert.equal(semArquivo.android?.package, 'br.ucb.medcaresenior');
  assert.equal(semArquivo.android?.googleServicesFile, undefined);
  assert.equal(comArquivo.android?.googleServicesFile, 'C:/segredos/google-services.json');
  const plugins = JSON.stringify(comArquivo.plugins);
  assert.match(plugins, /expo-dev-client/);
  assert.match(plugins, /"expo-notifications",\{[^}]*"defaultChannel":"alertas-dose"/);
  const eas = JSON.parse(readFileSync(join(raiz, 'eas.json'), 'utf8'));
  assert.equal(eas.build.development.developmentClient, true);
  assert.equal(eas.build.development.distribution, 'internal');
  assert.equal(eas.build.development.android.buildType, 'apk');
  assert.ok(eas.build.preview && eas.build.production);
});

// --- Push no app: payload, registro do token e alerta simulado (FE-26 a FE-29) -------------------------------------
check('Payload do push vira a dose a abrir; qualquer coisa fora do contrato é ignorada', () => {
  const ok = { tipo: 'DOSE_NAO_CONFIRMADA', doseId: '5000', idosoId: '12', data: '2026-10-18' };
  assert.deepEqual(parseDosePayload(ok), { doseId: '5000', elderId: '12', day: '2026-10-18' });
  assert.deepEqual(parseDosePayload({ ...ok, doseId: 5000, idosoId: 12 }), { doseId: '5000', elderId: '12', day: '2026-10-18' });
  for (const ruim of [
    null, undefined, 'texto', [], {},
    { ...ok, tipo: 'MENSAGEM' }, { ...ok, tipo: undefined }, { ...ok, doseId: 'abc' }, { ...ok, doseId: '' },
    { ...ok, idosoId: '-1' }, { ...ok, data: '18/10/2026' }, { ...ok, data: undefined },
  ]) {
    assert.equal(parseDosePayload(ruim), null, JSON.stringify(ruim));
  }
});

/** Push falso para o registro: token configurável e ouvintes de troca de token. */
function pushParaRegistro(opcoes: { supported?: boolean; token?: string | null } = {}) {
  const ouvintes: ((t: string) => void)[] = [];
  return {
    ouvintes,
    push: {
      supported: opcoes.supported ?? true,
      getDeviceToken: async () => (opcoes.token === undefined ? 'fcm-aparelho' : opcoes.token),
      onTokenChange: (cb: (t: string) => void) => {
        ouvintes.push(cb);
        return () => {
          ouvintes.splice(ouvintes.indexOf(cb), 1);
        };
      },
    },
  };
}

function pendencia() {
  let valor = false;
  return { get: async () => valor, set: async (p: boolean) => void (valor = p), valor: () => valor };
}

checkAsync('Token do aparelho: registra após entrar, reenvia na troca e remove na saída (204)', async () => {
  const { push, ouvintes } = pushParaRegistro();
  const pend = pendencia();
  const chamadas: string[] = [];
  const reg = createPushRegistration({
    push,
    putToken: async (t) => void chamadas.push(`PUT ${t}`),
    deleteToken: async () => void chamadas.push('DELETE'),
    pending: pend,
  });
  assert.equal(await reg.register(), 'REGISTERED');
  ouvintes.forEach((cb) => cb('fcm-novo'));
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(await reg.unregister(), 'REMOVED');
  // Depois da saída, a troca de token não é mais enviada
  assert.equal(ouvintes.length, 0);
  assert.deepEqual(chamadas, ['PUT fcm-aparelho', 'PUT fcm-novo', 'DELETE']);
  assert.equal(pend.valor(), false);
});

checkAsync('Saída sem rede ou demorada não trava: vira pendência, resolvida no próximo login', async () => {
  const pend = pendencia();
  const semRede = createPushRegistration({
    push: pushParaRegistro().push,
    putToken: async () => undefined,
    deleteToken: async () => {
      throw networkError();
    },
    pending: pend,
  });
  assert.equal(await semRede.unregister(), 'PENDING');
  assert.equal(await semRede.hasPendingRemoval(), true);
  const demorada = createPushRegistration({
    push: pushParaRegistro().push,
    putToken: async () => undefined,
    deleteToken: () => new Promise<void>(() => undefined),
    pending: pend,
    removalTimeoutMs: 20,
  });
  const inicio = Date.now();
  assert.equal(await demorada.unregister(), 'PENDING');
  assert.ok(Date.now() - inicio < 1_000);
  // Próximo login: o PUT liga o token à conta nova (a API o tira da conta anterior) e limpa a pendência
  assert.equal(await semRede.register(), 'REGISTERED');
  assert.equal(pend.valor(), false);
});

checkAsync('Token recusado (TOKEN_DISPOSITIVO_INVALIDO), sem token ou sem push: nada lança erro', async () => {
  const recusado = createPushRegistration({
    push: pushParaRegistro().push,
    putToken: async () => {
      throw httpError(400, 'Token inválido', 'TOKEN_DISPOSITIVO_INVALIDO');
    },
    deleteToken: async () => undefined,
    pending: pendencia(),
  });
  assert.equal(await recusado.register(), 'INVALID_TOKEN');
  const falhou = createPushRegistration({
    push: pushParaRegistro().push,
    putToken: async () => {
      throw networkError();
    },
    deleteToken: async () => undefined,
    pending: pendencia(),
  });
  assert.equal(await falhou.register(), 'FAILED');
  let chamou = false;
  const marcar = async () => void (chamou = true);
  const semToken = createPushRegistration({ push: pushParaRegistro({ token: null }).push, putToken: marcar, deleteToken: marcar, pending: pendencia() });
  assert.equal(await semToken.register(), 'NO_TOKEN');
  const semPush = createPushRegistration({ push: pushParaRegistro({ supported: false }).push, putToken: marcar, deleteToken: marcar, pending: pendencia() });
  assert.equal(await semPush.register(), 'UNSUPPORTED');
  assert.equal(await semPush.unregister(), 'UNSUPPORTED');
  assert.equal(chamou, false);
});

checkAsync('Registro pelo cliente HTTP real: PUT e DELETE /api/cuidadores/me/fcm-token', async () => {
  const chamadas = fakeFetch([{ status: 204 }, { status: 204 }]);
  const reg = createPushRegistration({
    push: pushParaRegistro().push,
    putToken: (token) => request<void>('PUT', '/api/cuidadores/me/fcm-token', { token }),
    deleteToken: () => request<void>('DELETE', '/api/cuidadores/me/fcm-token'),
    pending: pendencia(),
  });
  assert.equal(await reg.register(), 'REGISTERED');
  assert.equal(await reg.unregister(), 'REMOVED');
  assert.deepEqual(chamadas.map((c) => `${c.method} ${c.path}`), ['PUT /api/cuidadores/me/fcm-token', 'DELETE /api/cuidadores/me/fcm-token']);
  assert.deepEqual(chamadas[0].body, { token: 'fcm-aparelho' });
});

check('Alerta simulado só no demo; no modo real, pedido de permissão e push', () => {
  const ler = (p: string) => readFileSync(join(__dirname, '..', 'src', p), 'utf8');
  assert.match(ler('app/navigation/CaregiverTabs.tsx'), /\{IS_DEMO \? <AlertWatcher \/> : <PushPermissionPrompt \/>\}/);
  assert.match(ler('app/App.tsx'), /startPush\(\)/);
  assert.match(ler('lib/session.ts'), /pushRegistration\.unregister\(\)/);
});

// --- Histórico real, cor da dose e estoque ---------------------------------------------------------------------------
check('Cor do remédio na dose: #RRGGBB vira a cor do desenho; texto livre, nulo ou ausente fica sem cor', () => {
  assert.equal(toDoseView({ ...DOSE_DTO, cor: '#3D7DCA' }).medication.primaryColor, '#3D7DCA');
  assert.equal(toDoseView({ ...DOSE_DTO, cor: 'Branco' }).medication.primaryColor, undefined);
  assert.equal(toDoseView({ ...DOSE_DTO, cor: null }).medication.primaryColor, undefined);
  assert.equal(toDoseView(DOSE_DTO).medication.primaryColor, undefined);
});

check('Período do histórico: 7 e 30 dias contando hoje (SP), personalizado em DD/MM/AAAA e início depois do fim recusado', () => {
  assert.deepEqual(historyRange('7', '2026-10-18', '', ''), { from: '2026-10-12', to: '2026-10-18', error: null });
  assert.deepEqual(historyRange('30', '2026-03-01', '', ''), { from: '2026-01-31', to: '2026-03-01', error: null });
  assert.deepEqual(historyRange('custom', '2026-10-18', '01/10/2026', '05/10/2026'), { from: '2026-10-01', to: '2026-10-05', error: null });
  assert.equal(historyRange('custom', '2026-10-18', '05/10/2026', '05/10/2026').error, null);
  assert.match(historyRange('custom', '2026-10-18', '06/10/2026', '05/10/2026').error ?? '', /início não pode ser depois/);
  assert.match(historyRange('custom', '2026-10-18', '31/02/2026', '05/10/2026').error ?? '', /DD\/MM\/AAAA/);
});

check('Caminho do histórico só com os filtros informados; carregar mais e junção sem repetir dose', () => {
  const base = { from: '2026-10-01', to: '2026-10-18', page: 0, size: 20 };
  assert.equal(historyPath('/api/historico', { ...base, status: 'ALL' }), '/api/historico?de=2026-10-01&ate=2026-10-18&page=0&size=20');
  assert.equal(
    historyPath('/api/historico', { ...base, elderApiId: 12, medicationApiId: 501, status: 'NAO_TOMADA', page: 2 }),
    '/api/historico?idosoId=12&medicamentoId=501&de=2026-10-01&ate=2026-10-18&status=NAO_TOMADA&page=2&size=20',
  );
  assert.equal(hasMoreHistory({ page: 0, totalPages: 2 }), true);
  assert.equal(hasMoreHistory({ page: 1, totalPages: 2 }), false);
  assert.equal(hasMoreHistory({ page: 0, totalPages: 0 }), false);
  const a = toDoseView({ ...DOSE_DTO, id: 3 });
  const b = toDoseView({ ...DOSE_DTO, id: 2 });
  const c = toDoseView({ ...DOSE_DTO, id: 1 });
  assert.deepEqual(mergeHistory([a, b], [b, c]).map((d) => d.id), ['3', '2', '1']);
  assert.match(emptyHistoryNotice({ from: '2026-10-01', to: '2026-10-18' }, false).description, /entre 01\/10\/2026 e 18\/10\/2026/);
  assert.match(emptyHistoryNotice({ from: '2026-10-18', to: '2026-10-18' }, true).description, /em 18\/10\/2026 com os filtros/);
});

checkAsync('Histórico real: GET /api/historico com filtros e página; 400 VALIDACAO chega com a mensagem da API', async () => {
  setViewerProvider(() => 'CAREGIVER');
  const chamadas = fakeFetch([
    { status: 200, body: { conteudo: [{ ...DOSE_DTO, cor: '#FF0000', status: 'NAO_TOMADA', statusExibicao: 'NAO_TOMADA' }], pagina: 1, tamanho: 20, totalElementos: 21, totalPaginas: 2 } },
  ]);
  const pagina = await httpDoseService.listHistory({ elder: '12', medicationId: '501', from: '2026-10-01', to: '2026-10-18', status: 'NAO_TOMADA', page: 1 });
  assert.equal(chamadas[0].path, '/api/historico?idosoId=12&medicamentoId=501&de=2026-10-01&ate=2026-10-18&status=NAO_TOMADA&page=1&size=20');
  assert.deepEqual({ page: pagina.page, size: pagina.size, total: pagina.totalElements, pages: pagina.totalPages }, { page: 1, size: 20, total: 21, pages: 2 });
  assert.equal(pagina.items[0].status, 'NAO_TOMADA');
  assert.equal(pagina.items[0].medication.primaryColor, '#FF0000');
  // A dose do histórico abre o detalhe (fica registrado de onde veio)
  fakeFetch([{ status: 200, body: [DOSE_DTO] }]);
  assert.equal((await httpDoseService.get('5000')).id, '5000');
  const invertido = fakeFetch([
    { status: 400, body: { codigo: 'VALIDACAO', mensagem: 'A data de início não pode ser posterior à data de fim', campos: [{ campo: 'de', mensagem: 'x' }] } },
  ]);
  const erro = await httpDoseService.listHistory({ elder: 'ALL', from: '2026-10-18', to: '2026-10-01', status: 'ALL' }).then(() => null, (e: unknown) => e);
  assert.ok(erro instanceof AppError && erro.status === 400 && erro.code === 'VALIDACAO');
  assert.match((erro as AppError).message, /início não pode ser posterior/);
  assert.equal(invertido[0].path, '/api/historico?de=2026-10-18&ate=2026-10-01&page=0&size=20');
  setViewerProvider(() => null);
});

check('Estoque: só o campo opcional do cadastro; sem "Estoque baixo", alerta nem preferência', () => {
  const ler = (p: string) => readFileSync(join(__dirname, '..', 'src', p), 'utf8');
  for (const arquivo of ['features/settings/SettingsScreen.tsx', 'features/medications/MedicationCard.tsx', 'store/appStore.ts', 'lib/medicationMeta.ts', 'lib/secureStorage.ts', 'types/views.ts']) {
    assert.doesNotMatch(ler(arquivo), /lowStock|isLowStock|Estoque baixo/, arquivo);
  }
  assert.match(ler('features/medications/MedicationForm.tsx'), /name="stock"/);
  assert.equal(toMedicamentoRequest({ ...MED_INPUT, stock: 12 }).quantidadeEstoque, 12);
  assert.equal(toMedication({ ...MED_DTO, quantidadeEstoque: 7 }).stock, 7);
});

// --- Segurança do aparelho: HTTPS no release, texto claro, permissões e PIN ------------------------------------------
check('Endereço da API: http:// recusado no release; aceito em desenvolvimento; https:// aceito; demo não usa', () => {
  const release = { dev: false, demo: false };
  const dev = { dev: true, demo: false };
  assert.match(apiUrlProblem('http://192.168.0.10:8080', release) ?? '', /https:\/\//);
  assert.match(apiUrlProblem('HTTP://api.exemplo.com', release) ?? '', /conexão segura/);
  assert.equal(apiUrlProblem('https://api.exemplo.com/', release), null);
  assert.equal(apiUrlProblem('http://192.168.0.10:8080', dev), null);
  assert.equal(apiUrlProblem('https://api.exemplo.com', dev), null);
  assert.match(apiUrlProblem('', release) ?? '', /não está configurado/);
  assert.match(apiUrlProblem('ftp://x', dev) ?? '', /não está configurado/);
  assert.equal(apiUrlProblem('', { dev: false, demo: true }), null);
});

check('Texto claro só no perfil development; release com usesCleartextTraffic=false e permissões mínimas', () => {
  const plugins = withCleartextPolicy(['expo-font', ['expo-build-properties', { android: { minSdkVersion: 26 } }]], false);
  assert.deepEqual(plugins, ['expo-font', ['expo-build-properties', { android: { minSdkVersion: 26, usesCleartextTraffic: false } }]]);
  assert.deepEqual(withCleartextPolicy([['expo-build-properties', {}]], true), [['expo-build-properties', { android: { usesCleartextTraffic: true } }]]);
  const eas = JSON.parse(readFileSync(join(__dirname, '..', 'eas.json'), 'utf8'));
  assert.equal(eas.build.development.env.ANDROID_ALLOW_CLEARTEXT, 'true');
  assert.equal(eas.build.preview.env.ANDROID_ALLOW_CLEARTEXT, undefined);
  assert.equal(eas.build.production.env.ANDROID_ALLOW_CLEARTEXT, undefined);
  assert.deepEqual([...ANDROID_PERMISSIONS].sort(), [
    'android.permission.ACCESS_NETWORK_STATE', 'android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS',
    'android.permission.VIBRATE', 'android.permission.WAKE_LOCK', 'com.google.android.c2dm.permission.RECEIVE',
  ]);
  for (const p of ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO', 'android.permission.READ_EXTERNAL_STORAGE', 'android.permission.SYSTEM_ALERT_WINDOW']) {
    assert.ok(ANDROID_BLOCKED_PERMISSIONS.includes(p), p);
  }
  assert.equal(ANDROID_PERMISSIONS.some((p) => ANDROID_BLOCKED_PERMISSIONS.includes(p)), false);
  const config = appConfig({ config: { name: 'MedCare Sênior', slug: 'medcare-senior' } } as Parameters<typeof appConfig>[0]);
  assert.deepEqual(config.android?.permissions, ANDROID_PERMISSIONS);
  assert.deepEqual(config.android?.blockedPermissions, ANDROID_BLOCKED_PERMISSIONS);
});

checkAsync('PIN: só hash com sal, 5 erros bloqueiam (mesmo com o PIN certo) e o PIN antigo em texto é convertido', async () => {
  const dados = new Map<string, string>([['medcare.elder.pin', '2580']]);
  const store = { get: async (k: string) => dados.get(k) ?? null, set: async (k: string, v: string) => void dados.set(k, v), remove: async (k: string) => void dados.delete(k) };
  const relogio = { agora: 0 };
  const guard = createPinGuard({ store, randomBytes: (n) => new Uint8Array(randomBytes(n)), monotonicNow: () => relogio.agora, iterations: 10 });
  assert.deepEqual(await guard.verify('2580'), { result: 'OK' });
  assert.equal(dados.has('medcare.elder.pin'), false);
  assert.ok(![...dados.values()].some((v) => v.includes('2580')));
  for (let i = 0; i < 4; i += 1) await guard.verify('0000');
  assert.deepEqual(await guard.verify('0000'), { result: 'LOCKED', remainingMs: 30_000 });
  assert.deepEqual(await guard.verify('2580'), { result: 'LOCKED', remainingMs: 30_000 });
  relogio.agora += 30_000;
  assert.deepEqual(await guard.verify('2580'), { result: 'OK' });
  assert.equal(createPinRecord('1234', (n) => new Uint8Array(randomBytes(n))).iterations, PIN_ITERATIONS);
});

// --- Mensagens (UC-010) ----------------------------------------------------------------------------------------------
const MSG = (id: number, remetente: 'CUIDADOR' | 'IDOSO', criadaEm: string, lidaEm: string | null = null) => ({ id, remetente, conteudo: `m${id}`, criadaEm, lidaEm });

checkAsync('Mensagens pelo cliente HTTP: conversas, conversa paginada, envio, leitura e contador', async () => {
  setViewerProvider(() => 'CAREGIVER');
  const chamadas = fakeFetch([
    { status: 200, body: [{ idosoId: 12, idosoNome: 'Maria', ultimaMensagem: { conteudo: 'Oi', remetente: 'IDOSO', criadaEm: '2026-10-20T08:00:00' }, naoLidas: 3 }] },
    { status: 200, body: { conteudo: [MSG(2, 'IDOSO', '2026-10-20T08:01:00'), MSG(1, 'CUIDADOR', '2026-10-20T08:00:00', '2026-10-20T08:02:00')], pagina: 0, tamanho: 20, totalElementos: 22, totalPaginas: 2 } },
    { status: 201, body: MSG(3, 'CUIDADOR', '2026-10-20T08:03:00') },
    { status: 200, body: { marcadas: 1 } },
    { status: 200, body: { naoLidas: 4 } },
  ]);
  const conversas = await httpMessageService.listConversations();
  assert.deepEqual([conversas[0].elder.id, conversas[0].unread, conversas[0].lastMessage?.text], ['12', 3, 'Oi']);
  const pagina = await httpMessageService.listThread('12');
  assert.deepEqual(pagina.items.map((m) => [m.id, m.from, m.read]), [['2', 'IDOSO', false], ['1', 'CUIDADOR', true]]);
  assert.equal(pagina.totalPages, 2);
  const enviada = await httpMessageService.send('12', 'CUIDADOR', 'Bom dia');
  assert.deepEqual([enviada.id, enviada.elderId, enviada.from], ['3', '12', 'CUIDADOR']);
  assert.equal(await httpMessageService.markRead('12', 'CUIDADOR'), 1);
  assert.equal(await httpMessageService.unreadCount('ALL', 'CUIDADOR'), 4);
  assert.deepEqual(chamadas.map((c) => `${c.method} ${c.path}`), [
    'GET /api/mensagens/conversas',
    'GET /api/mensagens?idosoId=12&page=0&size=20',
    'POST /api/mensagens',
    'PUT /api/mensagens/lidas?idosoId=12',
    'GET /api/mensagens/nao-lidas',
  ]);
  assert.deepEqual(chamadas[2].body, { idosoId: 12, conteudo: 'Bom dia' });
  setViewerProvider(() => null);
});

checkAsync('Mensagens: erros da API chegam com o código (VALIDACAO no campo, ACESSO_NEGADO, RECURSO_NAO_ENCONTRADO, SESSAO_INVALIDA)', async () => {
  const casos: [number, string, Record<string, unknown>][] = [
    [400, 'VALIDACAO', { campos: [{ campo: 'conteudo', mensagem: 'A mensagem não pode ser vazia' }] }],
    [403, 'ACESSO_NEGADO', {}],
    [404, 'RECURSO_NAO_ENCONTRADO', {}],
    [401, 'SESSAO_INVALIDA', {}],
  ];
  for (const [status, codigo, extra] of casos) {
    fakeFetch([{ status, body: { codigo, mensagem: 'x', campos: [], ...extra } }]);
    const erro = await httpMessageService.send('12', 'IDOSO', 'Oi').then(() => null, (e: unknown) => e);
    assert.ok(erro instanceof AppError && erro.status === status && erro.code === codigo, codigo);
    if (codigo === 'VALIDACAO') assert.equal(messageSendError(erro), 'A mensagem não pode ser vazia');
  }
});

check('Mensagens: atualização automática só na tela de mensagens; contadores ao focar o app; demo com o mesmo contrato', () => {
  const ler = (p: string) => readFileSync(join(__dirname, '..', 'src', p), 'utf8');
  assert.match(ler('lib/useMessageThread.ts'), /usePolling\(latest\.refresh, MESSAGE_POLL_MS, active/);
  assert.match(ler('features/messages/CaregiverMessagesScreen.tsx'), /usePolling\(q\.refresh, MESSAGE_POLL_MS, active/);
  const abas = ler('app/navigation/CaregiverTabs.tsx');
  assert.match(abas, /useRefreshOnAppActive\(unread\.refresh\)/);
  assert.doesNotMatch(abas, /silentKey/);
  assert.match(ler('features/elder/ElderHomeScreen.tsx'), /useRefreshOnFocus\(unread\.refresh\)/);
  assert.match(ler('adapters/http/index.ts'), /messages: httpMessageService/);
  assert.match(ler('adapters/mock/demo.ts'), /messages: mockMessageService/);
  assert.equal(MESSAGE_POLL_MS, 10_000);
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
