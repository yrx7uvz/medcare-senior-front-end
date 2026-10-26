import { endpoints } from '../adapters/http/endpoints';
import { request } from '../adapters/http/httpClient';
import { useAppStore } from '../store/appStore';
import { push } from './push';
import { parseDosePayload } from './pushPayload';
import { createPushRegistration } from './pushRegistrationCore';
import { pushStorage } from './secureStorage';

/** Registro do token FCM do aparelho na conta do cuidador. Inerte onde não há push. */
export const pushRegistration = createPushRegistration({
  push,
  putToken: (token) => request<void>('PUT', endpoints.fcmToken, { token }),
  deleteToken: () => request<void>('DELETE', endpoints.fcmToken),
  pending: { get: () => pushStorage.getPendingRemoval(), set: (p) => pushStorage.setPendingRemoval(p) },
});

/** Toque numa notificação: payload válido vira a dose a abrir; qualquer outro é ignorado. */
function onNotificationOpened(data: Record<string, unknown>) {
  const target = parseDosePayload(data);
  if (target) useAppStore.getState().setPendingDoseOpen(target);
}

/**
 * Liga o push no boot: canal "Alertas de dose", banner com o app aberto (se a preferência deixar),
 * toque com o app aberto ou em segundo plano e a notificação que abriu o app fechado. Sem push, não faz nada.
 */
export function startPush(): () => void {
  if (!push.supported) return () => undefined;
  void push.ensureAlertChannel();
  push.showInForeground(() => useAppStore.getState().notificationPrefs.missedDose);
  const stop = push.onOpen(onNotificationOpened);
  void push.getLaunchData().then((data) => {
    if (data) onNotificationOpened(data);
  });
  return stop;
}
