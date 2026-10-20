import type { DoseView } from '../types/views';
import { appNowMs, doseInstantMs } from './serverClock';

/**
 * Atualiza status de exibição e confirmabilidade de uma dose entre uma busca e outra, comparando "agora" SÓ com os
 * instantes da janela que vieram do servidor (abreEm, avisoEm, encerraEm). Nenhuma janela é calculada no aparelho:
 * as regras de limite são as do servidor (PoliticaDeJanela), e só avançam o estado (ex.: PENDENTE -> ATRASADA).
 * Dose já registrada no servidor não muda.
 *
 * @param nowMs   agora, já corrigido pela diferença de relógio com o servidor
 * @param instant converte uma data e hora da janela em instante (ms); null = ilegível (a dose fica como veio)
 */
export function liveDose(view: DoseView, nowMs: number, instant: (key: string) => number | null): DoseView {
  if (view.storedStatus !== 'PENDENTE') return view;
  const opensAt = instant(view.window.opensAt);
  const alertAt = instant(view.window.alertAt);
  const closesAt = instant(view.window.closesAt);
  if (opensAt === null || alertAt === null || closesAt === null) return view;

  // Mesmas comparações do servidor: limites exatos ainda contam como dentro (isBefore/isAfter estritos)
  const localStatus = nowMs > closesAt ? 'NAO_TOMADA' : nowMs > alertAt ? 'ATRASADA' : 'PENDENTE';
  const localConfirmability = nowMs < opensAt ? 'MUITO_CEDO' : nowMs > closesAt ? 'ENCERRADA' : 'OK';
  // Nunca volta atrás do que o servidor já disse (ex.: relógio do aparelho um pouco atrasado)
  const status = STATUS_ORDER.indexOf(localStatus) > STATUS_ORDER.indexOf(view.status) ? localStatus : view.status;
  const confirmability = CONFIRM_ORDER.indexOf(localConfirmability) > CONFIRM_ORDER.indexOf(view.confirmability) ? localConfirmability : view.confirmability;
  if (status === view.status && confirmability === view.confirmability) return view;
  return { ...view, status, confirmability };
}

const STATUS_ORDER: readonly DoseView['status'][] = ['PENDENTE', 'ATRASADA', 'NAO_TOMADA'];
const CONFIRM_ORDER: readonly DoseView['confirmability'][] = ['MUITO_CEDO', 'OK', 'ENCERRADA'];

/** {@link liveDose} com o "agora" da tela (useNow), corrigido pelo relógio do servidor. */
export const liveAt = (view: DoseView, now: Date): DoseView => liveDose(view, appNowMs(now), doseInstantMs);
