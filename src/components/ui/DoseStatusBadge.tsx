import AlarmClockCheck from 'lucide-react-native/icons/alarm-clock-check';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import CheckCircle2 from 'lucide-react-native/icons/circle-check';
import Clock from 'lucide-react-native/icons/clock';
import XCircle from 'lucide-react-native/icons/circle-x';
import { StyleSheet, View } from 'react-native';
import type { DisplayStatus } from '../../types/domain';
import { radius, useTheme } from '../../theme';
import { AppText } from './AppText';
import type { IconComponent } from './icons';

/**
 * Status sempre com cor + ícone + texto (nunca só cor). Os rótulos do paciente falam do remédio ("Confirmado"); os do
 * cuidador, da dose ("Confirmada").
 */
export const STATUS_META: Record<DisplayStatus, { label: string; patientLabel: string; icon: IconComponent }> = {
  CONFIRMADA_NO_HORARIO: { label: 'Confirmada no horário', patientLabel: 'Confirmado no horário', icon: CheckCircle2 },
  PENDENTE: { label: 'Pendente', patientLabel: 'Aguardando', icon: Clock },
  ATRASADA: { label: 'Atrasada', patientLabel: 'Atrasado', icon: AlertTriangle },
  NAO_TOMADA: { label: 'Não confirmada', patientLabel: 'Não confirmado', icon: XCircle },
  CONFIRMADA_COM_ATRASO: { label: 'Confirmada com atraso', patientLabel: 'Confirmado com atraso', icon: AlarmClockCheck },
};

export function statusLabel(status: DisplayStatus, patient = false) {
  return patient ? STATUS_META[status].patientLabel : STATUS_META[status].label;
}

interface Props {
  status: DisplayStatus;
  size?: 'sm' | 'md' | 'patient';
}

export function DoseStatusBadge({ status, size = 'sm' }: Props) {
  const { colors, highContrast } = useTheme();
  const c = colors.status[status];
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const patient = size === 'patient';
  const label = patient ? meta.patientLabel : meta.label;
  return (
    <View
      accessible
      accessibilityLabel={`Status: ${statusLabel(status, patient)}`}
      style={[
        styles.badge,
        {
          backgroundColor: c.bg,
          borderColor: c.fg,
          borderWidth: highContrast ? 2 : 0,
          paddingHorizontal: patient ? 14 : 8,
          paddingVertical: patient ? 6 : 3,
        },
      ]}
    >
      <Icon color={c.fg} size={patient ? 24 : 14} strokeWidth={2.5} />
      {/* Rótulo longo ("Confirmada no horário") quebra linha em tela estreita, sem cortar */}
      <AppText variant={patient ? 'patientBody' : 'caption'} color={c.fg} style={[styles.text, patient ? undefined : styles.bold]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, alignSelf: 'flex-start', maxWidth: '100%', flexShrink: 1 },
  text: { flexShrink: 1 },
  bold: { fontFamily: 'NunitoSans_700Bold' },
});
