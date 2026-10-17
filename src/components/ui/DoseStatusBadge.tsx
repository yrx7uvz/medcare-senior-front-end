import { AlarmClockCheck, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import type { DisplayStatus } from '../../types/domain';
import { radius, useTheme } from '../../theme';
import { AppText } from './AppText';
import type { IconComponent } from './icons';

/** Status sempre com cor + ícone + texto (nunca só cor). */
export const STATUS_META: Record<DisplayStatus, { label: string; elderLabel: string; icon: IconComponent }> = {
  TOMADA: { label: 'Tomada', elderLabel: 'Tomado', icon: CheckCircle2 },
  PENDENTE: { label: 'Pendente', elderLabel: 'Aguardando', icon: Clock },
  ATRASADA: { label: 'Não confirmada', elderLabel: 'Atrasado', icon: AlertTriangle },
  NAO_TOMADA: { label: 'Não tomada', elderLabel: 'Não tomado', icon: XCircle },
  CONFIRMADA_COM_ATRASO: { label: 'Com atraso', elderLabel: 'Tomado com atraso', icon: AlarmClockCheck },
};

export function statusLabel(status: DisplayStatus, elder = false) {
  return elder ? STATUS_META[status].elderLabel : status === 'CONFIRMADA_COM_ATRASO' ? 'Confirmada com atraso' : STATUS_META[status].label;
}

interface Props {
  status: DisplayStatus;
  size?: 'sm' | 'md' | 'elder';
}

export function DoseStatusBadge({ status, size = 'sm' }: Props) {
  const { colors, highContrast } = useTheme();
  const c = colors.status[status];
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const elder = size === 'elder';
  const label = elder ? meta.elderLabel : size === 'md' ? statusLabel(status) : meta.label;
  return (
    <View
      accessible
      accessibilityLabel={`Status: ${statusLabel(status, elder)}`}
      style={[
        styles.badge,
        {
          backgroundColor: c.bg,
          borderColor: c.fg,
          borderWidth: highContrast ? 2 : 0,
          paddingHorizontal: elder ? 14 : 8,
          paddingVertical: elder ? 6 : 3,
        },
      ]}
    >
      <Icon color={c.fg} size={elder ? 24 : 14} strokeWidth={2.5} />
      <AppText variant={elder ? 'elderBody' : 'caption'} color={c.fg} style={elder ? undefined : styles.bold}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, alignSelf: 'flex-start' },
  bold: { fontFamily: 'NunitoSans_700Bold' },
});
