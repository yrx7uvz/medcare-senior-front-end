import AlarmClockOff from 'lucide-react-native/icons/alarm-clock-off';
import BellOff from 'lucide-react-native/icons/bell-off';
import { StyleSheet, View } from 'react-native';
import { ENABLE_NOTIFICATIONS_LABEL, NOTIFICATIONS_OFF_MESSAGE } from '../../lib/notificationsOff';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { BigActionButton } from './BigActionButton';
import { Button } from './Button';

interface Props {
  onEnable: () => void;
  /**
   * caregiver (padrão): faixa do Painel e das Configurações do cuidador. patient: o aviso grande do paciente (texto de
   * 20 sp ou mais e botão de 88 dp ou mais), para o lembrete de dose.
   */
  variant?: 'caregiver' | 'patient';
  message?: string;
  actionLabel?: string;
  /** Ícone de alarme (alarme exato desligado) em vez do sino. */
  alarm?: boolean;
}

/**
 * Faixa de atenção quando algo no aparelho impede o aviso de chegar: sem notificações, o cuidador não recebe o aviso de
 * dose não confirmada e o paciente não recebe o lembrete; sem alarme exato, o lembrete pode atrasar. O botão pede a
 * permissão ou abre a tela certa das configurações do Android.
 */
export function NotificationsOffBanner({ onEnable, variant = 'caregiver', message, actionLabel, alarm }: Props) {
  const { colors } = useTheme();
  const Icon = alarm ? AlarmClockOff : BellOff;
  const patient = variant === 'patient';
  return (
    <View
      style={[styles.wrap, patient && styles.patientWrap, { backgroundColor: colors.warningSoft, borderColor: colors.warningText }]}
      accessibilityRole="alert"
    >
      <View style={styles.top}>
        <Icon color={colors.warningText} size={patient ? 32 : 22} />
        <AppText variant={patient ? 'patientStrong' : 'body'} color={colors.warningText} style={styles.flex}>
          {message ?? NOTIFICATIONS_OFF_MESSAGE}
        </AppText>
      </View>
      {patient ? (
        <BigActionButton title={actionLabel ?? ENABLE_NOTIFICATIONS_LABEL} variant="primary" onPress={onEnable} />
      ) : (
        <Button title={actionLabel ?? ENABLE_NOTIFICATIONS_LABEL} size="sm" variant="secondary" onPress={onEnable} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  patientWrap: { borderWidth: 3, gap: spacing.md },
  top: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  flex: { flex: 1 },
});
