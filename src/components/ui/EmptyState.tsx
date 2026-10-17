import { StyleSheet, View } from 'react-native';
import { spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import type { IconComponent } from './icons';

interface Props {
  icon: IconComponent;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: Props) {
  const { colors, elder } = useTheme();
  return (
    <View style={styles.wrap} accessible={!actionLabel} accessibilityLabel={`${title}. ${description ?? ''}`}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Icon color={colors.primary} size={elder ? 40 : 30} strokeWidth={2} />
      </View>
      <AppText variant={elder ? 'elderTitle' : 'heading'} align="center">
        {title}
      </AppText>
      {description ? (
        <AppText variant={elder ? 'elderBody' : 'body'} muted align="center">
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={styles.btn} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.sm },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  btn: { marginTop: spacing.md, alignSelf: 'stretch' },
});
