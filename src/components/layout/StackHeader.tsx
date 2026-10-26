import { useNavigation } from '@react-navigation/native';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, useTheme } from '../../theme';
import { AppText, IconButton } from '../ui';

/** Cabeçalho das telas empilhadas do cuidador (formulários, detalhes). */
export function StackHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  return (
    <View style={[styles.header, { backgroundColor: colors.header, paddingTop: insets.top + spacing.sm }]}>
      <IconButton icon={ArrowLeft} color={colors.onHeader} accessibilityLabel="Voltar" onPress={onBack ?? (() => navigation.goBack())} />
      <View style={styles.texts}>
        <AppText variant="title" color={colors.onHeader} accessibilityRole="header" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color={colors.onHeaderMuted} numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingBottom: spacing.md },
  texts: { flex: 1 },
});
