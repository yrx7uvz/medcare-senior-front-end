import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { medcareAlarmes } from '../../modules/medcare-alarmes';
import { enableNotifications } from './notificationsOff';
import type { PushPermission } from './pushCore';
import { reminderWarning, type ReminderIssue } from './reminderHealth';
import { reminderScheduler, sincronizarLembretesDoPaciente } from './reminders';
import { useAppActive } from './useScreenActivity';

/** Lê sem lançar: módulo nativo ausente (Expo Go, web) ou com erro vira "não sei" (null). */
function readNative(fn: () => boolean): boolean | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

/**
 * Situação do lembrete neste aparelho, lida ao abrir a tela e de novo sempre que o app volta ao primeiro plano (o
 * paciente pode ter ligado nas configurações do Android): notificações, alarme exato e economia de bateria.
 *
 * - `warning`: o aviso grande ("O lembrete pode atrasar. Toque aqui para ativar"), ou null;
 * - `fix`: pede a permissão ou abre a tela certa das configurações;
 * - `batteryUnrestricted` e `openBattery`: a orientação de bateria dos Ajustes.
 */
export function useReminderHealth() {
  const active = useAppActive();
  const supported = reminderScheduler.supported;
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [exactAlarm, setExactAlarm] = useState<boolean | null>(null);
  const [batteryUnrestricted, setBatteryUnrestricted] = useState<boolean | null>(null);
  const lastExact = useRef<boolean | null>(null);

  useEffect(() => {
    if (!supported || !active) return;
    let current = true;
    void reminderScheduler.getPermission().then((p) => {
      if (!current) return;
      setPermission(p);
      const exact = medcareAlarmes ? readNative(() => medcareAlarmes!.podeAgendarAlarmeExato()) : null;
      // Alarme exato acabou de ser liberado: os lembretes já agendados como inexatos são agendados de novo
      if (lastExact.current === false && exact === true) void sincronizarLembretesDoPaciente({ reagendarTudo: true });
      lastExact.current = exact;
      setExactAlarm(exact);
      setBatteryUnrestricted(medcareAlarmes ? readNative(() => medcareAlarmes!.ignoraOtimizacaoDeBateria()) : null);
    });
    return () => {
      current = false;
    };
  }, [active, supported]);

  const fix = useCallback(async (issue: ReminderIssue) => {
    if (issue === 'NOTIFICACOES_DESLIGADAS') {
      const next = await enableNotifications(reminderScheduler, () => Linking.openSettings());
      setPermission(next);
      // Com a permissão dada agora, os lembretes já ficam agendados sem esperar a próxima abertura
      if (next === 'granted') void sincronizarLembretesDoPaciente();
      return;
    }
    const opened = medcareAlarmes ? readNative(() => medcareAlarmes!.abrirAjusteDeAlarmeExato()) : null;
    if (!opened) await Linking.openSettings().catch(() => undefined);
  }, []);

  const openBattery = useCallback(async () => {
    const opened = medcareAlarmes ? readNative(() => medcareAlarmes!.abrirAjusteDeBateria()) : null;
    if (!opened) await Linking.openSettings().catch(() => undefined);
  }, []);

  return {
    supported,
    warning: reminderWarning({ supported, permission, exactAlarm }),
    fix,
    batteryUnrestricted,
    openBattery,
  };
}
