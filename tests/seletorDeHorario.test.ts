import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createElement, type ReactElement } from 'react';
import { TimeWheelPicker } from '../src/components/ui/TimeWheelPicker';
import { startRow } from '../src/lib/timeWheel';

/** O pacote não traz tipos: só o que este teste usa. */
interface NoDaArvore {
  props: Record<string, unknown>;
}
interface ReactTestRenderer {
  root: { findAll(predicado: (no: NoDaArvore) => boolean): NoDaArvore[] };
  update(elemento: ReactElement): void;
  unmount(): void;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { act, create } = require('react-test-renderer') as {
  act(acao: () => void): void;
  create(elemento: ReactElement): ReactTestRenderer;
};

const montadas: ReactTestRenderer[] = [];

/** Seletor controlado como no formulário: cada mudança vira o novo valor. */
function montar(hora = 8, minuto = 0) {
  const mudancas: [number, number][] = [];
  let tela!: ReactTestRenderer;
  const render = (h: number, m: number) =>
    createElement(TimeWheelPicker, {
      hour: h,
      minute: m,
      onChange: (nh: number, nm: number) => {
        mudancas.push([nh, nm]);
        act(() => tela.update(render(nh, nm)));
      },
    });
  act(() => {
    tela = create(render(hora, minuto));
    montadas.push(tela);
  });
  const porRotulo = (rotulo: string) => {
    // O Pressable aparece mais de uma vez na árvore (componente e host): fica o primeiro com o handler
    const no = tela.root.findAll((n) => n.props.accessibilityLabel === rotulo && (typeof n.props.onPress === 'function' || typeof n.props.onAccessibilityAction === 'function'))[0];
    if (!no) throw new Error(`sem elemento "${rotulo}"`);
    return no.props as Record<string, (...args: unknown[]) => void>;
  };
  const porTestId = (id: string) => {
    const no = tela.root.findAll((n) => n.props.testID === id && typeof n.props.onPress === 'function')[0];
    if (!no) throw new Error(`sem elemento "${id}"`);
    return no.props as Record<string, (...args: unknown[]) => void>;
  };
  return { tela, mudancas, porRotulo, porTestId };
}

afterEach(() => {
  // Desmonta antes dos temporizadores internos da lista (evita avisos de atualização fora do act)
  act(() => montadas.splice(0).forEach((t) => t.unmount()));
  jest.useRealTimers();
});

describe('seletor de horário', () => {
  it('sem botões − e + nem atalhos: só as duas rodas ajustáveis', () => {
    const { tela } = montar();
    const botoes = tela.root.findAll(
      (n) => typeof n.props.accessibilityLabel === 'string' && /^(Aumentar|Diminuir|Horas:|Minutos:)/.test(n.props.accessibilityLabel as string),
    );
    expect(botoes).toEqual([]);
    const rodas = tela.root
      .findAll((n) => n.props.accessibilityRole === 'adjustable' && typeof n.props.onAccessibilityAction === 'function')
      .map((n) => n.props.accessibilityLabel)
      .filter((r, i, todos) => todos.indexOf(r) === i);
    expect(rodas).toEqual(['Horas', 'Minutos']);
  });

  it('a ação acessível increment aumenta e decrement diminui, com volta', () => {
    const { porRotulo, mudancas } = montar(23, 0);
    act(() => porRotulo('Horas').onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    act(() => porRotulo('Minutos').onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
    expect(mudancas).toEqual([[0, 0], [0, 59]]);
  });

  it('tocar numa linha vizinha escolhe aquele valor, dando a volta', () => {
    const { porTestId, mudancas } = montar(23, 59);
    act(() => porTestId(`Horas-linha-${startRow(23, 24) + 1}`).onPress());
    act(() => porTestId(`Minutos-linha-${startRow(59, 60) + 2}`).onPress());
    expect(mudancas).toEqual([[0, 59], [0, 1]]);
  });
});
