import type { DoseView } from '../types/views';
import { firstName, formatTime } from './date';
import { confirmedByText } from './doseRules';

/**
 * O que a tela da dose do cuidador mostra sobre a confirmação. Usa só o que veio do servidor (janela e
 * limiteConfirmacao, já atualizados pelo relógio da tela em liveAt): nenhuma janela é recalculada no aparelho.
 *
 * - registrada: a dose já tem status definitivo (o texto diz quem confirmou, se foi confirmada);
 * - cedo: ainda não abriu ("A confirmação abre às 07:00");
 * - encerrada: o prazo passou ("O prazo terminou às 09:00");
 * - pode: botão "Confirmar dose" com "Pode ser confirmada até 09:00".
 */
export type CaregiverConfirmState =
  | { kind: 'registrada'; message: string | null }
  | { kind: 'cedo'; message: string }
  | { kind: 'encerrada'; message: string }
  | { kind: 'pode'; message: string };

export function caregiverConfirmState(dose: DoseView): CaregiverConfirmState {
  if (dose.storedStatus !== 'PENDENTE') {
    return { kind: 'registrada', message: dose.confirmedAt ? confirmedByText(dose.confirmedBy, firstName(dose.elderName), formatTime(dose.confirmedAt)) : null };
  }
  if (dose.confirmability === 'MUITO_CEDO') return { kind: 'cedo', message: `A confirmação abre às ${formatTime(dose.window.opensAt)}` };
  if (dose.confirmability === 'ENCERRADA' || dose.status === 'NAO_TOMADA') {
    return { kind: 'encerrada', message: `O prazo terminou às ${formatTime(dose.confirmUntil)}` };
  }
  return { kind: 'pode', message: `Pode ser confirmada até ${formatTime(dose.confirmUntil)}` };
}

/** Pergunta do diálogo antes de enviar: "Confirmar que José tomou Losartana das 08:00?" */
export const confirmQuestion = (dose: DoseView) =>
  `Confirmar que ${firstName(dose.elderName)} tomou ${dose.medication.name} das ${formatTime(dose.scheduledAt)}?`;

/**
 * Mensagem clara para cada falha da confirmação. `reload` = a dose mudou no servidor (já registrada ou fora do prazo):
 * a tela recarrega para mostrar o estado certo.
 */
export function confirmFailure(error: { kind?: string; status?: number; code?: string; message?: string }): { message: string; reload: boolean } {
  if (error.kind === 'NETWORK') return { message: 'Sem conexão. A dose não foi confirmada; tente de novo quando a internet voltar.', reload: false };
  switch (error.code) {
    case 'DOSE_JA_REGISTRADA':
      return { message: 'Esta dose já foi registrada. Veja abaixo o status atual.', reload: true };
    case 'DOSE_ENCERRADA':
      return { message: 'O prazo para confirmar esta dose terminou.', reload: true };
    case 'DOSE_MUITO_CEDO':
      return { message: 'Ainda é cedo para confirmar esta dose.', reload: true };
    case 'RECURSO_NAO_ENCONTRADO':
      return { message: 'Não encontramos esta dose. Ela pode ter sido removida.', reload: true };
    default:
      return { message: error.message || 'Não foi possível confirmar a dose. Tente de novo.', reload: false };
  }
}

/** Texto curto da linha da dose nas listas (Painel, Histórico, relatório do dia). */
export function doseCardDetail(dose: DoseView): string | null {
  switch (dose.status) {
    case 'ATRASADA':
      return `Aviso enviado às ${formatTime(dose.window.alertAt)}. Pode ser confirmada até ${formatTime(dose.confirmUntil)}`;
    case 'PENDENTE':
      return 'Aguardando confirmação';
    case 'NAO_TOMADA':
      return 'Prazo encerrado sem confirmação';
    default:
      return dose.confirmedAt ? confirmedByText(dose.confirmedBy, firstName(dose.elderName), formatTime(dose.confirmedAt)) : null;
  }
}
