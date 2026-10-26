type DemoModule = typeof import('../adapters/mock/demo');

let cached: DemoModule | null = null;

/**
 * Ponto ÚNICO de acesso aos mocks fora de src/adapters/mock. Fora do modo demonstração devolve null.
 *
 * A condição fica escrita aqui por extenso, com a variável literal: no build o Expo troca
 * process.env.EXPO_PUBLIC_DEMO pelo valor, a condição vira "false" e o Metro tira este require do bundle de
 * produção junto com todos os mocks. Não troque por IS_DEMO nem mova o require para fora do if
 * (o check:mocks confere).
 */
export function getDemo(): DemoModule | null {
  if (process.env.EXPO_PUBLIC_DEMO === 'true') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- require dentro da condição de build: só o demo leva os mocks
    cached ??= require('../adapters/mock/demo') as DemoModule;
    return cached;
  }
  return null;
}
