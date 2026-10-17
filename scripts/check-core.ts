/// <reference types="node" />
/**
 * Verificações do núcleo do app (sem React): decodificador de JWT.
 * Uso: npm run check:core — termina com código != 0 na primeira asserção que falhar.
 */
import assert from 'node:assert/strict';
import { decodeJwtPayload, getJwtExp, isJwtExpired } from '../src/lib/jwt';

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

console.log(`\n${checks} verificações OK`);
