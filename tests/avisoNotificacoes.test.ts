import { describe, expect, it } from '@jest/globals';
import { createElement, type ReactElement } from 'react';
import { NotificationsOffBanner } from '../src/components/ui/NotificationsOffBanner';
import {
  ENABLE_NOTIFICATIONS_LABEL,
  NOTIFICATIONS_OFF_MESSAGE,
  enableNotifications,
  enableStep,
  shouldWarnNotificationsOff,
} from '../src/lib/notificationsOff';
import { createPushService, type NotificationsModule, type PushPermission } from '../src/lib/pushCore';

/** O pacote não traz tipos: só o que este teste usa. */
interface NoDaArvore {
  props: Record<string, unknown>;
}
interface ReactTestRenderer {
  root: { findAll(predicado: (no: NoDaArvore) => boolean): NoDaArvore[] };
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer') as {
  act(acao: () => void): void;
  create(elemento: ReactElement): ReactTestRenderer;
};

/** Push falso: a permissão atual, se o Android ainda pergunta e o que o pedido devolve. */
function pushFalso(permissao: PushPermission, podePerguntar: boolean, depoisDoPedido: PushPermission) {
  const chamadas: string[] = [];
  return {
    chamadas,
    servico: {
      getPermission: async () => permissao,
      canAskAgain: async () => podePerguntar,
      requestPermission: async () => {
        chamadas.push('pedido');
        return depoisDoPedido;
      },
    },
    abrirConfiguracoes: async () => {
      chamadas.push('configurações');
    },
  };
}

describe('aviso de notificações desligadas', () => {
  it('textos do aviso e do botão', () => {
    expect(NOTIFICATIONS_OFF_MESSAGE).toBe('As notificações estão desligadas neste aparelho. Você não receberá o aviso de dose não confirmada.');
    expect(ENABLE_NOTIFICATIONS_LABEL).toBe('Ativar notificações');
  });

  it('aparece com a permissão negada ou ainda não pedida, só onde o push existe', () => {
    expect(shouldWarnNotificationsOff(true, 'denied')).toBe(true);
    expect(shouldWarnNotificationsOff(true, 'undetermined')).toBe(true);
    expect(shouldWarnNotificationsOff(true, 'granted')).toBe(false);
    // Lendo a permissão: ainda não mostra (sem piscar o aviso)
    expect(shouldWarnNotificationsOff(true, null)).toBe(false);
    // Expo Go, demo, iPhone e web: o push não existe
    expect(shouldWarnNotificationsOff(false, 'denied')).toBe(false);
    expect(shouldWarnNotificationsOff(false, 'unavailable')).toBe(false);
  });

  it('no Expo Go, no demo e fora do Android o serviço de push é inerte, e o aviso não aparece', async () => {
    const semModulo = () => {
      throw new Error('o módulo nativo não deveria ser carregado');
    };
    for (const env of [
      { os: 'android', isExpoGo: true, isDemo: false },
      { os: 'android', isExpoGo: false, isDemo: true },
      { os: 'ios', isExpoGo: false, isDemo: false },
      { os: 'web', isExpoGo: false, isDemo: false },
    ]) {
      const servico = createPushService(env, semModulo as () => NotificationsModule);
      expect(shouldWarnNotificationsOff(servico.supported, await servico.getPermission())).toBe(false);
      expect(await servico.canAskAgain()).toBe(false);
    }
  });

  it('o botão pede a permissão se o Android ainda pergunta; senão, abre as configurações', () => {
    expect(enableStep('undetermined', true)).toBe('request');
    expect(enableStep('denied', true)).toBe('request');
    expect(enableStep('denied', false)).toBe('settings');
    expect(enableStep('undetermined', false)).toBe('request');
  });

  it('ativar: pedido aceito liga; recusado de vez vai às configurações', async () => {
    const primeiraVez = pushFalso('undetermined', true, 'granted');
    expect(await enableNotifications(primeiraVez.servico, primeiraVez.abrirConfiguracoes)).toBe('granted');
    expect(primeiraVez.chamadas).toEqual(['pedido']);

    const bloqueado = pushFalso('denied', false, 'denied');
    expect(await enableNotifications(bloqueado.servico, bloqueado.abrirConfiguracoes)).toBe('denied');
    expect(bloqueado.chamadas).toEqual(['configurações']);
  });

  it('a faixa é um alerta acessível, com o texto e o botão', () => {
    let ativou = 0;
    let tela!: ReactTestRenderer;
    act(() => {
      tela = create(createElement(NotificationsOffBanner, { onEnable: () => (ativou += 1) }));
    });
    const textos = tela.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children);
    expect(textos).toContain(NOTIFICATIONS_OFF_MESSAGE);
    expect(tela.root.findAll((n) => n.props.accessibilityRole === 'alert').length).toBeGreaterThan(0);
    const botao = tela.root.findAll((n) => n.props.accessibilityLabel === ENABLE_NOTIFICATIONS_LABEL && typeof n.props.onPress === 'function')[0];
    act(() => (botao.props.onPress as () => void)());
    expect(ativou).toBe(1);
  });
});
