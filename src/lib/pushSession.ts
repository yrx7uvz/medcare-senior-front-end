import { endpoints } from '../adapters/http/endpoints';
import { request } from '../adapters/http/httpClient';
import { useAppStore } from '../store/appStore';
import { push } from './push';
import { parseLeavePayload } from './leaveRequest';
import { parseDosePayload } from './pushPayload';
import { createPushRegistration } from './pushRegistrationCore';
import { openReminder, reminderInForeground } from './reminders';
import { patientPushStorage, pushStorage } from './secureStorage';

/** Registro do token FCM do aparelho na conta do cuidador. Inerte onde não há push. */
export const pushRegistration = createPushRegistration({
  push,
  putToken: (token) => request<void>('PUT', endpoints.fcmToken, { token }),
  deleteToken: () => request<void>('DELETE', endpoints.fcmToken),
  pending: { get: () => pushStorage.getPendingRemoval(), set: (p) => pushStorage.setPendingRemoval(p) },
});

/**
 * Registro do token FCM do aparelho no paciente pareado (PUT/DELETE /api/pacientes/me/fcm-token), para o servidor
 * reforçar o lembrete de dose se o aparelho não tocar. O paciente vem do JWT do aparelho (o cliente HTTP usa o token do
 * perfil em uso). Inerte onde não há push.
 */
export const patientPushRegistration = createPushRegistration({
  push,
  putToken: (token) => request<void>('PUT', endpoints.patientFcmToken, { token }),
  deleteToken: () => request<void>('DELETE', endpoints.patientFcmToken),
  pending: { get: () => patientPushStorage.getPendingRemoval(), set: (p) => patientPushStorage.setPendingRemoval(p) },
});

/**
 * Toque numa notificação: payload válido vira a dose do cuidador, o pedido de saída ou, no perfil do paciente, a dose
 * do lembrete a abrir; qualquer outro é ignorado.
 */
function onNotificationOpened(data: Record<string, unknown>) {
  if (openReminder(data)) return;
  const target = parseDosePayload(data);
  if (target) useAppStore.getState().setPendingDoseOpen(target);
  const leave = parseLeavePayload(data);
  if (leave) useAppStore.getState().setPendingLeaveOpen(leave);
}

/**
 * Liga o push no boot: canal "Alertas de dose", banner com o app aberto (o aviso ao cuidador segue a preferência; o
 * lembrete do paciente aparece no perfil do paciente, sem repetir o que já está na tela), toque com o app aberto ou em
 * segundo plano e a notificação que abriu o app fechado. Sem push, não faz nada.
 */
export function startPush(): () => void {
  if (!push.supported) return () => undefined;
  void push.ensureAlertChannel();
  push.showInForeground(async ({ data, remote }) => {
    const reminder = await reminderInForeground(data, remote);
    if (reminder !== null) return reminder;
    return useAppStore.getState().notificationPrefs.missedDose;
  });
  const stop = push.onOpen(onNotificationOpened);
  void push.getLaunchData().then((data) => {
    if (data) onNotificationOpened(data);
  });
  return stop;
}
