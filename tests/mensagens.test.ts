import { describe, expect, it } from '@jest/globals';
import { toConversation, toMessage, toMessagePage } from '../src/adapters/http/HttpMessageService';
import {
  byConversationOrder,
  hasOlderMessages,
  hasUnreadFrom,
  MESSAGE_MAX_LENGTH,
  messageCounter,
  messageError,
  messageLength,
  messageSendError,
  mergeThread,
  singleFlight,
  unreadBadge,
} from '../src/lib/messages';
import { AppError } from '../src/services/errors';
import type { Message } from '../src/types/domain';

const msg = (id: string, sentAt: string, over: Partial<Message> = {}): Message => ({ id, patientId: '12', from: 'CUIDADOR', text: id, sentAt, read: false, ...over });

describe('validação antes de enviar (mesma regra da API)', () => {
  it('vazio ou só espaços não envia; até 500 caracteres envia; 501 não', () => {
    expect(messageError('')).toBe('Escreva uma mensagem antes de enviar.');
    expect(messageError('  \n ')).toBe('Escreva uma mensagem antes de enviar.');
    expect(messageError('a'.repeat(MESSAGE_MAX_LENGTH))).toBeNull();
    expect(messageError(` ${'a'.repeat(MESSAGE_MAX_LENGTH)} `)).toBeNull();
    expect(messageError('a'.repeat(MESSAGE_MAX_LENGTH + 1))).toBe('A mensagem pode ter até 500 caracteres.');
  });

  it('conta caracteres como a API (emoji = 1) e mostra o contador', () => {
    expect(messageLength('😀😀')).toBe(2);
    expect(messageError('😀'.repeat(500))).toBeNull();
    expect(messageCounter('  Oi  ')).toBe('2/500');
  });

  it('erro de envio mostra o motivo do campo na validação e a mensagem nos outros códigos', () => {
    const validacao = new AppError('HTTP', 400, 'Um ou mais campos são inválidos', 'VALIDACAO', undefined, { conteudo: 'A mensagem não pode ser vazia' });
    expect(messageSendError(validacao)).toBe('A mensagem não pode ser vazia');
    expect(messageSendError(new AppError('HTTP', 400, 'Geral', 'VALIDACAO'))).toBe('Geral');
    expect(messageSendError(new AppError('HTTP', 403, 'Você não tem permissão', 'ACESSO_NEGADO'))).toBe('Você não tem permissão');
  });
});

describe('contador de não lidas e conversa', () => {
  it('selo some no zero e para em 99+', () => {
    expect(unreadBadge(0)).toBeUndefined();
    expect(unreadBadge(7)).toBe('7');
    expect(unreadBadge(150)).toBe('99+');
  });

  it('ordem da tela: mais antiga primeiro; mesmo minuto pelo id numérico', () => {
    const lista = [msg('10', '2026-10-20T08:00'), msg('9', '2026-10-20T08:00'), msg('2', '2026-10-20T07:00')];
    expect([...lista].sort(byConversationOrder).map((m) => m.id)).toEqual(['2', '9', '10']);
  });

  it('junta a página mais recente (atualizada) com as antigas sem repetir', () => {
    const antigas = [msg('3', '2026-10-20T08:03'), msg('2', '2026-10-20T08:02'), msg('1', '2026-10-20T08:01')];
    const recente = [msg('5', '2026-10-20T08:05'), msg('4', '2026-10-20T08:04'), msg('3', '2026-10-20T08:03', { read: true })];
    const juntas = mergeThread(recente, antigas);
    expect(juntas.map((m) => m.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(juntas.find((m) => m.id === '3')?.read).toBe(true);
    expect(hasOlderMessages({ page: 0, totalPages: 2 })).toBe(true);
    expect(hasOlderMessages({ page: 1, totalPages: 2 })).toBe(false);
  });

  it('marca como lida só se há mensagem do outro lado não lida', () => {
    const lista = [msg('1', '2026-10-20T08:00', { from: 'PACIENTE', read: true }), msg('2', '2026-10-20T08:01', { from: 'CUIDADOR' })];
    expect(hasUnreadFrom(lista, 'PACIENTE')).toBe(false);
    expect(hasUnreadFrom(lista, 'CUIDADOR')).toBe(true);
  });
});

describe('envio único no toque duplo', () => {
  it('toques enquanto envia recebem a mesma promessa; depois de terminar, envia de novo', async () => {
    let chamadas = 0;
    let terminar: (v: boolean) => void = () => undefined;
    const enviar = singleFlight(() => {
      chamadas += 1;
      return new Promise<boolean>((resolve) => {
        terminar = resolve;
      });
    });
    const a = enviar();
    const b = enviar();
    expect(a).toBe(b);
    terminar(true);
    await expect(a).resolves.toBe(true);
    expect(chamadas).toBe(1);
    const c = enviar();
    terminar(false);
    await expect(c).resolves.toBe(false);
    expect(chamadas).toBe(2);
  });

  it('falha libera para tentar de novo', async () => {
    let chamadas = 0;
    const enviar = singleFlight(async () => {
      chamadas += 1;
      throw new Error('rede');
    });
    await expect(enviar()).rejects.toThrow('rede');
    await expect(enviar()).rejects.toThrow('rede');
    expect(chamadas).toBe(2);
  });
});

describe('mapeadores das mensagens', () => {
  it('MensagemResponse vira Message no paciente da conversa, lida pelo lidaEm', () => {
    expect(toMessage({ id: 301, remetente: 'PACIENTE', conteudo: 'Já tomei', criadaEm: '2026-10-20T08:05:12.123', lidaEm: null }, '12')).toEqual({
      id: '301', patientId: '12', from: 'PACIENTE', text: 'Já tomei', sentAt: '2026-10-20T08:05', read: false,
    });
    expect(toMessage({ id: 302, remetente: 'CUIDADOR', conteudo: 'Ok', criadaEm: '2026-10-20T08:06:00', lidaEm: '2026-10-20T08:07:00' }, '12').read).toBe(true);
  });

  it('página da conversa e conversa da lista (com e sem mensagem)', () => {
    const pagina = toMessagePage({ conteudo: [{ id: 1, remetente: 'CUIDADOR', conteudo: 'a', criadaEm: '2026-10-20T08:00:00', lidaEm: null }], pagina: 1, tamanho: 20, totalElementos: 21, totalPaginas: 2 }, '12');
    expect(pagina).toMatchObject({ page: 1, totalPages: 2, totalElements: 21 });
    expect(pagina.items[0].patientId).toBe('12');
    const comMensagem = toConversation({ pacienteId: 12, pacienteNome: 'Maria', ultimaMensagem: { conteudo: 'Oi', remetente: 'PACIENTE', criadaEm: '2026-10-20T09:00:00' }, naoLidas: 2 });
    expect(comMensagem).toMatchObject({ patient: { id: '12', name: 'Maria' }, lastMessage: { text: 'Oi', from: 'PACIENTE', sentAt: '2026-10-20T09:00' }, unread: 2 });
    expect(comMensagem.patient.avatarColor).toMatch(/^#/);
    expect(toConversation({ pacienteId: 13, pacienteNome: 'João', ultimaMensagem: null, naoLidas: 0 }).lastMessage).toBeUndefined();
  });
});
