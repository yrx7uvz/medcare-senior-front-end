/// <reference types="node" />
/**
 * Verificações do núcleo do app (sem React): decodificador de JWT, parse do ErroResponse da API,
 * endereço da API e mapeamento de erros por campo.
 * Uso: npm run check:core — termina com código != 0 na primeira asserção que falhar.
 */
import assert from 'node:assert/strict';
import { parseApiError, parseJsonBody } from '../src/adapters/http/apiError';
import { fromApiId, toApiId } from '../src/adapters/http/ids';
import { normalizeApiBaseUrl } from '../src/config/env';
import { mapFieldErrors } from '../src/lib/formErrors';
import { decodeJwtPayload, getJwtExp, isJwtExpired } from '../src/lib/jwt';
import { AppError } from '../src/services/errors';

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

console.log(`\n${checks} verificações OK`);
