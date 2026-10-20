import { toAppError } from '../services/errors';
import type { PushService } from './pushCore';

/** Pendência de remoção do token: a saída aconteceu sem conseguir avisar a API (sem rede, por exemplo). */
export interface PendingRemovalStore {
  get(): Promise<boolean>;
  set(pending: boolean): Promise<void>;
}

interface Deps {
  push: Pick<PushService, 'supported' | 'getDeviceToken' | 'onTokenChange'>;
  /** PUT /api/cuidadores/me/fcm-token com { token } (usa o JWT da sessão atual). */
  putToken(token: string): Promise<void>;
  /** DELETE /api/cuidadores/me/fcm-token (204, idempotente). */
  deleteToken(): Promise<void>;
  pending: PendingRemovalStore;
  /** Limite para a remoção não segurar a saída do usuário. */
  removalTimeoutMs?: number;
}

export type RegisterResult = 'REGISTERED' | 'UNSUPPORTED' | 'NO_TOKEN' | 'INVALID_TOKEN' | 'FAILED';

/**
 * Liga o token FCM do aparelho à conta do cuidador (FE-27). Nada aqui lança erro: push é um extra e nunca pode
 * impedir login, saída ou exclusão de conta.
 *
 * - Depois do login/cadastro (e ao abrir o app já logado): registra o token. A API tira o mesmo token de qualquer
 *   outra conta, então isso também resolve uma remoção que ficou pendente numa saída sem rede.
 * - Token trocado pelo FCM: registra o novo.
 * - Saída, exclusão de conta e troca de perfil: remove o token ANTES de apagar a sessão (precisa do JWT), em melhor
 *   esforço e com tempo limite; se falhar, guarda a pendência para o próximo login.
 */
export function createPushRegistration(deps: Deps) {
  let stopListening: (() => void) | null = null;

  async function put(token: string): Promise<RegisterResult> {
    try {
      await deps.putToken(token);
      await deps.pending.set(false).catch(() => undefined);
      return 'REGISTERED';
    } catch (e) {
      // Token recusado pela API (vazio ou grande demais): tentar de novo com o mesmo não adianta
      return toAppError(e).code === 'TOKEN_DISPOSITIVO_INVALIDO' ? 'INVALID_TOKEN' : 'FAILED';
    }
  }

  return {
    async register(): Promise<RegisterResult> {
      if (!deps.push.supported) return 'UNSUPPORTED';
      const token = await deps.push.getDeviceToken();
      if (!token) return 'NO_TOKEN';
      const result = await put(token);
      stopListening?.();
      stopListening = deps.push.onTokenChange((novo) => void put(novo));
      return result;
    },

    async unregister(): Promise<'REMOVED' | 'UNSUPPORTED' | 'PENDING'> {
      stopListening?.();
      stopListening = null;
      if (!deps.push.supported) return 'UNSUPPORTED';
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('tempo esgotado')), deps.removalTimeoutMs ?? 4_000);
      });
      try {
        await Promise.race([deps.deleteToken(), timeout]);
        await deps.pending.set(false).catch(() => undefined);
        return 'REMOVED';
      } catch {
        await deps.pending.set(true).catch(() => undefined);
        return 'PENDING';
      } finally {
        clearTimeout(timer);
      }
    },

    hasPendingRemoval: () => deps.pending.get().catch(() => false),
  };
}
