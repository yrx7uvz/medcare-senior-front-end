import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createElement, type ReactElement } from 'react';
import { TimeWheelPicker } from '../src/components/ui/TimeWheelPicker';

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
  return { tela, mudancas, porRotulo };
}

afterEach(() => {
  // Desmonta antes dos temporizadores internos da lista (evita avisos de atualização fora do act)
  act(() => montadas.splice(0).forEach((t) => t.unmount()));
  jest.useRealTimers();
});

describe('seletor de horário', () => {
  it('"−" fica acima e "+" abaixo de cada coluna', () => {
    const { tela } = montar();
    const rotulos = tela.root
      .findAll((n) => typeof n.props.accessibilityLabel === 'string' && /^(Aumentar|Diminuir) /.test(n.props.accessibilityLabel as string) && typeof n.props.onPressIn === 'function')
      .map((n) => n.props.accessibilityLabel as string)
      .filter((r, i, todos) => todos.indexOf(r) === i);
    expect(rotulos).toEqual(['Diminuir horas', 'Aumentar horas', 'Diminuir minutos', 'Aumentar minutos']);
  });

  it('a ação acessível increment aumenta e decrement diminui, com volta', () => {
    const { porRotulo, mudancas } = montar(23, 0);
    act(() => porRotulo('Horas').onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    act(() => porRotulo('Minutos').onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
    expect(mudancas).toEqual([[0, 0], [0, 59]]);
  });

  it('atalhos de horas e minutos, com rótulo falado e o escolhido marcado', () => {
    const { porRotulo, mudancas, tela } = montar(8, 0);
    act(() => porRotulo('Horas: vinte e duas').onPress());
    act(() => porRotulo('Minutos: quinze').onPress());
    expect(mudancas).toEqual([[22, 0], [22, 15]]);
    const marcados = tela.root
      .findAll((n) => (n.props.accessibilityState as { selected?: boolean } | undefined)?.selected === true && typeof n.props.onPress === 'function')
      .map((n) => n.props.accessibilityLabel)
      .filter((r, i, todos) => todos.indexOf(r) === i);
    expect(marcados).toEqual(['Horas: vinte e duas', 'Minutos: quinze']);
  });

  it('tocar dá um passo; segurar repete depois de 400 ms e acelera; soltar para', () => {
    jest.useFakeTimers();
    const { porRotulo, mudancas } = montar(8, 0);
    const mais = () => porRotulo('Aumentar minutos');
    act(() => mais().onPressIn());
    expect(mudancas).toEqual([[8, 1]]);
    act(() => jest.advanceTimersByTime(399));
    expect(mudancas).toHaveLength(1);
    act(() => jest.advanceTimersByTime(1));
    expect(mudancas).toHaveLength(2);
    act(() => jest.advanceTimersByTime(2000));
    const segurando = mudancas.length;
    // 2 s depois de começar a repetir, já passou de 12 passos
    expect(segurando).toBeGreaterThan(14);
    act(() => mais().onPressOut());
    act(() => mais().onPress());
    act(() => jest.advanceTimersByTime(2000));
    expect(mudancas).toHaveLength(segurando);
    expect(mudancas[mudancas.length - 1]).toEqual([8, segurando]);
  });

  it('leitor de tela: ativar o botão (só onPress) dá um passo', () => {
    jest.useFakeTimers();
    const { porRotulo, mudancas } = montar(8, 0);
    act(() => porRotulo('Diminuir horas').onPress());
    act(() => jest.advanceTimersByTime(1000));
    expect(mudancas).toEqual([[7, 0]]);
  });
});
