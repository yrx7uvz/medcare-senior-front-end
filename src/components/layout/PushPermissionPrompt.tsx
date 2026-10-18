import { BellRing } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { push } from '../../lib/push';
import { pushStorage } from '../../lib/secureStorage';
import { useAppStore } from '../../store/appStore';
import { ConfirmDialog } from '../ui';

/**
 * FE-26: explica e pede a permissão de notificações (Android 13+: POST_NOTIFICATIONS) no momento em que ela faz
 * sentido, já com o cuidador dentro do app, uma única vez por aparelho. Recusar não trava nada: os avisos só não
 * aparecem, e dá para ativar depois em Configurações. Sem push (Expo Go, iOS, demo) não aparece.
 */
export function PushPermissionPrompt() {
  const showToast = useAppStore((s) => s.showToast);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!push.supported) return;
    let active = true;
    void (async () => {
      const answered = await pushStorage.getPromptAnswered().catch(() => true);
      const permission = await push.getPermission();
      // Android abaixo do 13 já vem "granted": nada a pedir
      if (active && !answered && permission === 'undetermined') setVisible(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function answer(allow: boolean) {
    setVisible(false);
    await pushStorage.setPromptAnswered().catch(() => undefined);
    const permission = allow ? await push.requestPermission() : 'denied';
    if (permission === 'granted') showToast('Avisos de dose ativados neste celular.');
    else showToast('Sem permissão, os avisos não aparecem. Você pode ativar depois em Configurações.', 'info');
  }

  return (
    <ConfirmDialog
      visible={visible}
      icon={BellRing}
      title="Receber avisos de dose?"
      message="O MedCare Sênior avisa você quando um paciente não confirma um remédio no prazo. Para isso, o Android precisa da sua permissão para mostrar notificações."
      confirmLabel="Ativar avisos"
      cancelLabel="Agora não"
      onConfirm={() => void answer(true)}
      onCancel={() => void answer(false)}
    />
  );
}
