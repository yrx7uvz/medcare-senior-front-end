import type { ViewAs } from '../store/appStore';
import { parseDosePayload, type DoseOpenTarget } from './pushPayload';

/**
 * Para onde levar quem tocou num aviso de dose não confirmada. Função pura: as telas e a navegação só executam a
 * decisão.
 *
 * - ignorar: payload inválido ou de outro tipo, ou aparelho no perfil do idoso (o aviso é só do cuidador);
 * - aguardar-login: o destino fica guardado e abre assim que houver sessão de cuidador (sessão expirada, perfil ainda
 *   não escolhido);
 * - abrir-dose: abre o detalhe da dose, com o Painel por baixo (voltar leva ao Painel);
 * - painel: o idoso do aviso não é de quem está logado (ex.: conta trocada no mesmo celular): Painel com o aviso.
 */
export type DoseOpenDecision =
  | { action: 'ignorar' }
  | { action: 'aguardar-login'; target: DoseOpenTarget }
  | { action: 'abrir-dose'; target: DoseOpenTarget }
  | { action: 'painel'; notice: string };

export interface DoseOpenContext {
  /** Perfil deste aparelho (null = ainda não escolhido). */
  viewAs: ViewAs | null;
  /** Há sessão de cuidador válida. */
  hasSession: boolean;
  /** Idosos da conta logada, se já conhecidos; sem a lista, quem confere o dono é a API (404 no detalhe). */
  knownElderIds?: readonly string[];
}

export const FOREIGN_ELDER_NOTICE = 'Este aviso é de um paciente que não está na sua conta.';
export const MISSING_DOSE_NOTICE = 'Não encontramos esta dose. Ela pode ter sido removida ou não ser de um paciente seu.';

export function decideDoseOpen(target: DoseOpenTarget | null, ctx: DoseOpenContext): DoseOpenDecision {
  if (!target) return { action: 'ignorar' };
  if (ctx.viewAs === 'ELDER') return { action: 'ignorar' };
  if (ctx.viewAs === null || !ctx.hasSession) return { action: 'aguardar-login', target };
  if (ctx.knownElderIds && !ctx.knownElderIds.includes(target.elderId)) return { action: 'painel', notice: FOREIGN_ELDER_NOTICE };
  return { action: 'abrir-dose', target };
}

/** Payload bruto do push (data da notificação) até a decisão. */
export const resolveDoseOpen = (data: unknown, ctx: DoseOpenContext): DoseOpenDecision => decideDoseOpen(parseDosePayload(data), ctx);

/**
 * Falha ao carregar a dose aberta: dose inexistente ou de idoso que não é da conta (a API responde 404 igual nos dois
 * casos) vira aviso amigável com o caminho para o Painel. Outros erros (rede, servidor) ficam com a tela de erro e o
 * "Tentar novamente".
 */
export function doseOpenFailure(error: { status?: number; code?: string } | null | undefined): { notice: string } | null {
  if (!error) return null;
  return error.status === 404 || error.code === 'RECURSO_NAO_ENCONTRADO' ? { notice: MISSING_DOSE_NOTICE } : null;
}
