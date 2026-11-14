import { describe, expect, it } from '@jest/globals';
import { httpAuthService } from '../src/adapters/http/HttpAuthService';
import { mockAuthService } from '../src/adapters/mock/MockAuthService';
import { DEMO_EMAIL_CODE, onlyCodeDigits, resetFormProblem } from '../src/lib/emailCode';
import { COMMON_EMAIL_DOMAINS, editDistance, suggestEmail } from '../src/lib/emailSuggestion';
import { isEmail } from '../src/lib/schemas';
import { resendLabel } from '../src/lib/useSecondsLeft';
import { messageForApiError } from '../src/services/errorMessages';

/** E-mail do cuidador: sugestão de domínio, código do e-mail, troca de senha e o que vai e volta da API. */

describe('sugestão de correção do e-mail', () => {
  it('corrige os erros de digitação mais comuns no domínio', () => {
    expect(suggestEmail('ana@gmial.com')).toBe('ana@gmail.com');
    expect(suggestEmail('ana@gmail.con')).toBe('ana@gmail.com');
    expect(suggestEmail('Ana.Souza@Hotmial.com')).toBe('ana.souza@hotmail.com');
    expect(suggestEmail('ana@hotmail.com.bt')).toBe('ana@hotmail.com.br');
    expect(suggestEmail('ana@outlok.com')).toBe('ana@outlook.com');
    expect(suggestEmail('ana@yaho.com.br')).toBe('ana@yahoo.com.br');
  });

  it('completa o provedor digitado sem o final', () => {
    expect(suggestEmail('ana@gmail')).toBe('ana@gmail.com');
    expect(suggestEmail('ana@hotmail')).toBe('ana@hotmail.com');
  });

  it('não sugere nada para domínio conhecido, domínio diferente de verdade ou e-mail ainda incompleto', () => {
    for (const d of COMMON_EMAIL_DOMAINS) expect(suggestEmail(`ana@${d}`)).toBeNull();
    expect(suggestEmail('ana@ucb.br')).toBeNull();
    expect(suggestEmail('ana@empresa.com.br')).toBeNull();
    expect(suggestEmail('ana@gmx.com')).toBeNull();
    expect(suggestEmail('ana')).toBeNull();
    expect(suggestEmail('ana@')).toBeNull();
    expect(suggestEmail('@gmail.com')).toBeNull();
    expect(suggestEmail('ana@@gmial.com')).toBeNull();
  });

  it('distância de edição conta troca de letras vizinhas como um erro só', () => {
    expect(editDistance('gmial', 'gmail')).toBe(1);
    expect(editDistance('abc', 'abc')).toBe(0);
    expect(editDistance('', 'abc')).toBe(3);
    expect(editDistance('kitten', 'sitting')).toBe(3);
  });

  it('formato do e-mail é o mesmo do servidor', () => {
    expect(isEmail(' ana@email.com ')).toBe(true);
    expect(isEmail('ana@b')).toBe(false);
    expect(isEmail('ana @email.com')).toBe(false);
  });
});

describe('código do e-mail e troca de senha', () => {
  it('o campo do código guarda só 6 números', () => {
    expect(onlyCodeDigits('48 29-15')).toBe('482915');
    expect(onlyCodeDigits('1234567890')).toBe('123456');
    expect(onlyCodeDigits('abc')).toBe('');
  });

  it('mostra o que falta na ordem dos campos', () => {
    expect(resetFormProblem('123', 'SenhaNova1', 'SenhaNova1')).toBe('Digite os 6 números do código.');
    expect(resetFormProblem('123456', 'fraca', 'fraca')).toBe('A senha nova não atende aos requisitos.');
    expect(resetFormProblem('123456', 'SenhaNova1', 'SenhaNova2')).toBe('As senhas não conferem.');
    expect(resetFormProblem('123456', 'SenhaNova1', 'SenhaNova1')).toBeNull();
  });

  it('o botão de reenviar mostra quanto falta', () => {
    expect(resendLabel(0)).toBe('Reenviar código');
    expect(resendLabel(-3)).toBe('Reenviar código');
    expect(resendLabel(42)).toBe('Reenviar código em 0:42');
    expect(resendLabel(60)).toBe('Reenviar código em 1:00');
  });

  it('cadastrar paciente sem confirmar o e-mail tem mensagem própria', () => {
    expect(messageForApiError('EMAIL_NAO_VERIFICADO', 'x')).toBe(
      'Confirme o seu e-mail com o código que enviamos antes de cadastrar pacientes.',
    );
    // Código errado: a mensagem da API, que diz quantas tentativas restam
    expect(messageForApiError('CODIGO_EMAIL_INVALIDO', 'Código incorreto. Você tem mais 4 tentativas.')).toBe(
      'Código incorreto. Você tem mais 4 tentativas.',
    );
  });
});

describe('serviço HTTP do e-mail', () => {
  type Chamada = { url: string; method?: string; body?: unknown };
  function fetchFalso(status: number, corpo: unknown = null) {
    const chamadas: Chamada[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: { method?: string; body?: string }) => {
      chamadas.push({ url, method: init?.method, body: init?.body ? JSON.parse(init.body) : undefined });
      const texto = corpo === null ? null : JSON.stringify(corpo);
      return new Response(texto, { status, headers: texto ? { 'Content-Type': 'application/json' } : {} });
    }) as typeof fetch;
    return { chamadas, restaurar: () => (globalThis.fetch = original) };
  }
  const API = 'http://api.jest.invalid';

  it('login com e-mail não confirmado vira emailVerified=false; servidor antigo (sem o campo) conta como confirmado', async () => {
    let f = fetchFalso(200, { token: 't', tipo: 'Bearer', id: 7, nome: 'Ana', emailVerificado: false });
    try {
      expect(await httpAuthService.login(' ana@email.com ', 'SenhaForte1')).toEqual({
        caregiverId: '7',
        name: 'Ana',
        email: 'ana@email.com',
        token: 't',
        emailVerified: false,
      });
    } finally {
      f.restaurar();
    }
    f = fetchFalso(200, { token: 't', tipo: 'Bearer', id: 7, nome: 'Ana' });
    try {
      expect((await httpAuthService.login('ana@email.com', 'x')).emailVerified).toBe(true);
    } finally {
      f.restaurar();
    }
  });

  it('confirmar, reenviar, esqueci e redefinir usam as rotas e os nomes da API', async () => {
    const f = fetchFalso(204);
    try {
      await httpAuthService.confirmEmail(' 482915 ');
      await httpAuthService.resendEmailCode();
      await httpAuthService.requestPasswordReset(' ana@email.com ');
      await httpAuthService.resetPassword({ email: 'ana@email.com', code: '482915', newPassword: 'SenhaNova1' });
    } finally {
      f.restaurar();
    }
    expect(f.chamadas).toEqual([
      { url: `${API}/api/cuidadores/me/verificacao-email/confirmar`, method: 'POST', body: { codigo: '482915' } },
      { url: `${API}/api/cuidadores/me/verificacao-email/reenviar`, method: 'POST', body: undefined },
      { url: `${API}/api/auth/esqueci-senha`, method: 'POST', body: { email: 'ana@email.com' } },
      { url: `${API}/api/auth/redefinir-senha`, method: 'POST', body: { email: 'ana@email.com', codigo: '482915', novaSenha: 'SenhaNova1' } },
    ]);
  });

  it('reenviar antes de 1 minuto chega como 429 com o tempo de espera', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ codigo: 'LIMITE_TENTATIVAS', mensagem: 'Aguarde 40 segundos para pedir outro código.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '40' },
      })) as typeof fetch;
    try {
      await expect(httpAuthService.resendEmailCode()).rejects.toMatchObject({ status: 429, retryAfterSec: 40 });
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('demonstração', () => {
  it('troca a senha com o código fixo do demo e recusa outro', async () => {
    const conta = await mockAuthService.signUp({
      name: 'Ana Demo',
      email: `ana-${Date.now()}@exemplo.com`,
      password: 'SenhaForte1',
      lgpdConsent: true,
    });
    await expect(mockAuthService.resetPassword({ email: conta.email, code: '000000', newPassword: 'SenhaNova1' })).rejects.toMatchObject({
      code: 'CODIGO_EMAIL_INVALIDO',
    });
    await mockAuthService.resetPassword({ email: conta.email, code: DEMO_EMAIL_CODE, newPassword: 'SenhaNova1' });
    expect((await mockAuthService.login(conta.email, 'SenhaNova1')).caregiverId).toBe(conta.caregiverId);
    await expect(mockAuthService.confirmEmail(DEMO_EMAIL_CODE)).resolves.toBeUndefined();
  }, 15_000);
});
