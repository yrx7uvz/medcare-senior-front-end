import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';
import type { IconComponent } from './icons';

interface Props {
  visible: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  icon?: IconComponent;
  loading?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  visible, title, message, confirmLabel, cancelLabel = 'Cancelar', tone = 'default', icon: Icon,
  loading, confirmDisabled, onConfirm, onCancel, children,
}: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
          {Icon ? (
            <View style={[styles.icon, { backgroundColor: tone === 'danger' ? colors.dangerSoft : colors.primarySoft }]}>
              <Icon color={tone === 'danger' ? colors.danger : colors.primary} size={26} />
            </View>
          ) : null}
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
          {typeof message === 'string' ? <AppText muted>{message}</AppText> : message}
          {children}
          <View style={styles.actions}>
            <Button
              title={confirmLabel}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onPress={onConfirm}
              loading={loading}
              disabled={confirmDisabled}
            />
            <Button title={cancelLabel} variant="ghost" onPress={onCancel} disabled={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  card: { borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: spacing.xs, marginTop: spacing.sm },
});
