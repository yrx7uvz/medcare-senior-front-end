import { describe, expect, it, jest } from '@jest/globals';
import { createElement, type ReactElement } from 'react';

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

/**
 * Build de release (__DEV__ falso) com a API em http://: o app não usa o endereço e mostra a tela de configuração
 * (App.tsx renderiza ConfigErrorScreen quando API_CONFIG_PROBLEM não é nulo).
 */
jest.mock('react-native-safe-area-context', () => (jest.requireActual('react-native-safe-area-context/jest/mock') as { default: unknown }).default);

type Env = typeof import('../src/config/env');

function envDoBuild(apiUrl: string, dev: boolean): Env {
  const anterior = { url: process.env.EXPO_PUBLIC_API_URL, dev: (globalThis as { __DEV__?: boolean }).__DEV__ };
  process.env.EXPO_PUBLIC_API_URL = apiUrl;
  (globalThis as { __DEV__?: boolean }).__DEV__ = dev;
  let env!: Env;
  jest.isolateModules(() => {
    // Módulo novo a cada build simulado: o env lê as variáveis ao carregar
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    env = require('../src/config/env') as Env;
  });
  process.env.EXPO_PUBLIC_API_URL = anterior.url;
  (globalThis as { __DEV__?: boolean }).__DEV__ = anterior.dev;
  return env;
}

describe('app de release e o endereço da API', () => {
  it('recusa http:// no release: há problema de configuração e o cliente HTTP não recebe o endereço', () => {
    const env = envDoBuild('http://192.168.0.10:8080', false);
    expect(env.API_CONFIG_PROBLEM).toMatch(/https:\/\//);
    expect(() => env.getApiBaseUrl()).toThrow(/https:\/\//);
  });

  it('aceita https:// no release', () => {
    const env = envDoBuild('https://medcare.exemplo.invalid/', false);
    expect(env.API_CONFIG_PROBLEM).toBeNull();
    expect(env.getApiBaseUrl()).toBe('https://medcare.exemplo.invalid');
  });

  it('aceita http:// da rede local só no build de desenvolvimento', () => {
    expect(envDoBuild('http://10.0.2.2:8080', true).API_CONFIG_PROBLEM).toBeNull();
  });

  it('a tela de configuração mostra o motivo, como alerta acessível', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ConfigErrorScreen } = require('../src/components/layout/ConfigErrorScreen') as typeof import('../src/components/layout/ConfigErrorScreen');
    const problema = envDoBuild('http://192.168.0.10:8080', false).API_CONFIG_PROBLEM!;
    let tela!: ReactTestRenderer;
    act(() => {
      tela = create(createElement(ConfigErrorScreen, { problem: problema }));
    });
    const textos = tela.root.findAll((n) => typeof n.props.children === 'string').map((n) => n.props.children as string);
    expect(textos).toContain('App com configuração inválida');
    expect(textos).toContain(problema);
    expect(tela.root.findAll((n) => n.props.accessibilityRole === 'alert').length).toBeGreaterThan(0);
  });
});
