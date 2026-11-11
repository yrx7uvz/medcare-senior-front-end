import { describe, expect, it } from '@jest/globals';
import { httpPatientService } from '../src/adapters/http/HttpPatientService';
import { filterAfterUnlink, normalizeName, UNLINK_MESSAGES, unlinkNameMatches, unlinkTitle, unlinkTypeNameMessage } from '../src/lib/unlinkPatient';

describe('confirmação da desvinculação', () => {
  it('o nome digitado confere sem acento, maiúsculas nem espaços sobrando', () => {
    expect(unlinkNameMatches('José Ferreira', 'José Ferreira')).toBe(true);
    expect(unlinkNameMatches('  jose   FERREIRA ', 'José Ferreira')).toBe(true);
    expect(normalizeName('  Conceição  Áurea ')).toBe('conceicao aurea');
  });

  it('nome diferente, só o primeiro nome ou vazio não libera', () => {
    expect(unlinkNameMatches('José', 'José Ferreira')).toBe(false);
    expect(unlinkNameMatches('Helena Souza', 'José Ferreira')).toBe(false);
    expect(unlinkNameMatches('', 'José Ferreira')).toBe(false);
    expect(unlinkNameMatches('', '')).toBe(false);
    expect(unlinkNameMatches('   ', '  ')).toBe(false);
  });

  it('textos em português simples, iguais na API e no demo', () => {
    expect(UNLINK_MESSAGES.explanation).toBe(
      'O histórico de doses já registradas fica sem o nome do paciente. Remédios, horários e mensagens serão apagados. Isso não pode ser desfeito.',
    );
    expect(UNLINK_MESSAGES.success).toBe('Paciente desvinculado.');
    expect(unlinkTitle('José Ferreira')).toBe('Desvincular José Ferreira?');
    expect(unlinkTypeNameMessage('José Ferreira')).toBe('Para confirmar, digite o nome do paciente: José Ferreira');
  });

  it('o filtro que apontava para o paciente desvinculado volta a Todos', () => {
    expect(filterAfterUnlink('e-jose', 'e-jose')).toBe('ALL');
    expect(filterAfterUnlink('e-helena', 'e-jose')).toBe('e-helena');
    expect(filterAfterUnlink('ALL', 'e-jose')).toBe('ALL');
  });
});

describe('serviço HTTP de desvincular', () => {
  type Chamada = { url: string; method?: string };
  function fetchFalso(status: number, corpo = '') {
    const chamadas: Chamada[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (url: string, init?: { method?: string }) => {
      chamadas.push({ url, method: init?.method });
      return new Response(corpo || null, { status, headers: corpo ? { 'Content-Type': 'application/json' } : {} });
    }) as typeof fetch;
    return { chamadas, restaurar: () => (globalThis.fetch = original) };
  }

  it('DELETE /api/pacientes/{id}, 204 sem corpo', async () => {
    const f = fetchFalso(204);
    try {
      await httpPatientService.remove('42');
    } finally {
      f.restaurar();
    }
    expect(f.chamadas).toEqual([{ url: 'http://api.jest.invalid/api/pacientes/42', method: 'DELETE' }]);
  });

  it('404 (já desvinculado ou de outra conta) chega como erro com o código da API', async () => {
    const f = fetchFalso(404, JSON.stringify({ status: 404, codigo: 'RECURSO_NAO_ENCONTRADO', mensagem: 'Paciente não encontrado' }));
    try {
      await expect(httpPatientService.remove('42')).rejects.toMatchObject({ status: 404, code: 'RECURSO_NAO_ENCONTRADO' });
    } finally {
      f.restaurar();
    }
  });
});
