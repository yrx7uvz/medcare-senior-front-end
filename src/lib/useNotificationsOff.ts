import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { enableNotifications, shouldWarnNotificationsOff } from './notificationsOff';
import { push, type PushPermission } from './push';
import { useAppActive } from './useScreenActivity';

/**
 * Permissão de notificações do aparelho, lida ao abrir a tela e de novo sempre que o app volta ao primeiro plano (o
 * usuário pode ter ligado nas configurações do Android). `show`: o aviso de notificações desligadas aparece.
 */
export function useNotificationsOff() {
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const active = useAppActive();

  useEffect(() => {
    if (!push.supported || !active) return;
    let current = true;
    void push.getPermission().then((p) => {
      if (current) setPermission(p);
    });
    return () => {
      current = false;
    };
  }, [active]);

  const enable = useCallback(async () => {
    setPermission(await enableNotifications(push, () => Linking.openSettings()));
  }, []);

  return { permission, show: shouldWarnNotificationsOff(push.supported, permission), enable };
}
