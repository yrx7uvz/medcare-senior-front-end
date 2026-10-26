import * as Clipboard from 'expo-clipboard';
import Copy from 'lucide-react-native/icons/copy';
import Share2 from 'lucide-react-native/icons/share-2';
import TimerOff from 'lucide-react-native/icons/timer-off';
import { Share, StyleSheet, View } from 'react-native';
import { AppText, Button } from '../../components/ui';
import { useAppStore } from '../../store/appStore';
import { formatCountdown } from '../../lib/date';
import { useNow } from '../../lib/useNow';
import type { LinkCode } from '../../types/domain';
import { radius, spacing, useTheme } from '../../theme';

/** Código de vínculo de 6 dígitos, uso único, válido por 24 h (RN11). */
export function LinkCodeDisplay({ link, patientName }: { link: LinkCode; patientName: string }) {
  const { colors } = useTheme();
  const showToast = useAppStore((s) => s.showToast);
  const now = useNow(1000);
  const remaining = link.expiresAt - now.getTime();
  const expired = remaining <= 0 || link.used;

  return (
    <View style={styles.wrap}>
      <View
        style={styles.digits}
        accessible
        accessibilityLabel={expired ? 'Código expirado' : `Código de vínculo: ${link.code.split('').join(' ')}`}
      >
        {link.code.split('').map((d, i) => (
          <View
            key={i}
            style={[
              styles.digit,
              { borderColor: expired ? colors.border : colors.primary, backgroundColor: expired ? colors.surfaceAlt : colors.primarySoft },
            ]}
          >
            <AppText variant="display" color={expired ? colors.textMuted : colors.primaryDark} style={expired ? styles.strike : undefined}>
              {d}
            </AppText>
          </View>
        ))}
      </View>

      {expired ? (
        <View style={styles.row}>
          <TimerOff color={colors.danger} size={18} />
          <AppText variant="bodyStrong" color={colors.danger}>
            {link.used ? 'Este código já foi usado.' : 'Este código expirou.'} Gere um novo.
          </AppText>
        </View>
      ) : (
        <AppText variant="body" align="center" accessibilityLiveRegion="none">
          Válido por mais <AppText variant="bodyStrong">{formatCountdown(remaining)}</AppText> • uso único
        </AppText>
      )}

      <View style={styles.actions}>
        <Button
          title="Copiar"
          icon={Copy}
          variant="secondary"
          disabled={expired}
          style={styles.flex}
          onPress={async () => {
            await Clipboard.setStringAsync(link.code);
            showToast('Código copiado');
          }}
        />
        <Button
          title="Compartilhar"
          icon={Share2}
          disabled={expired}
          style={styles.flex}
          onPress={() =>
            Share.share({
              message: `Código para conectar o celular de ${patientName} ao MedCare Sênior: ${link.code}. Vale por 24 horas e só pode ser usado uma vez.`,
            })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, alignItems: 'stretch' },
  digits: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  digit: { width: 46, height: 60, borderRadius: radius.md, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  strike: { textDecorationLine: 'line-through' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
