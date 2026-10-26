import type { PushPermission, PushService } from './pushCore';

/**
 * Aviso de notificações desligadas no aparelho do cuidador (Painel e Configurações). Puro: o estado da permissão e as
 * ações chegam de fora (push do expo-notifications e Linking.openSettings), para testar sem aparelho.
 */

export const NOTIFICATIONS_OFF_MESSAGE =
  'As notificações estão desligadas neste aparelho. Você não receberá o aviso de dose não confirmada.';
export const ENABLE_NOTIFICATIONS_LABEL = 'Ativar notificações';

/**
 * Mostra o aviso só onde o push existe (Android instalado; nunca no Expo Go, no demo, no iPhone ou na web) e a
 * permissão não foi dada. Enquanto a permissão é lida (null), não mostra.
 */
export function shouldWarnNotificationsOff(supported: boolean, permission: PushPermission | null): boolean {
  return supported && (permission === 'denied' || permission === 'undetermined');
}

/** O que o botão faz: pedir a permissão, se o Android ainda mostra o pedido; senão, abrir as configurações do app. */
export function enableStep(permission: PushPermission | null, canAskAgain: boolean): 'request' | 'settings' {
  return permission === 'undetermined' || (permission === 'denied' && canAskAgain) ? 'request' : 'settings';
}

/**
 * "Ativar notificações": pede a permissão ou abre as configurações do Android. Devolve a permissão depois do pedido
 * (ou a atual, se abriu as configurações: ela é lida de novo quando o app volta ao primeiro plano).
 */
export async function enableNotifications(
  service: Pick<PushService, 'getPermission' | 'canAskAgain' | 'requestPermission'>,
  openSettings: () => Promise<void>,
): Promise<PushPermission> {
  const permission = await service.getPermission();
  if (enableStep(permission, await service.canAskAgain()) === 'request') return service.requestPermission();
  await openSettings();
  return permission;
}
