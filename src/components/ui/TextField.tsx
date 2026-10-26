import { Eye, EyeOff } from 'lucide-react-native';
import React, { forwardRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { applyMask, type MaskKind } from '../../lib/masks';
import { fonts, radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  hint?: string;
  mask?: MaskKind;
  required?: boolean;
  password?: boolean;
  right?: React.ReactNode;
  large?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, mask, required, password, right, large, onChangeText, multiline, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? colors.danger : focused ? colors.focus : colors.inputBorder;

  return (
    <View style={styles.wrap}>
      <AppText variant={large ? 'patientBody' : 'label'} nativeID={`${label}-label`}>
        {label}
        {required ? <AppText variant="label" color={colors.danger}> *</AppText> : null}
      </AppText>
      <View
        style={[
          styles.inputRow,
          { borderColor, backgroundColor: colors.inputBackground, borderWidth: focused || error ? 2 : 1.5, minHeight: large ? 64 : 48 },
        ]}
      >
        <TextInput
          ref={ref}
          {...rest}
          multiline={multiline}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          accessibilityHint={error ?? hint}
          secureTextEntry={password ? hidden : rest.secureTextEntry}
          placeholderTextColor={colors.textMuted}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          onChangeText={(t) => onChangeText?.(mask ? applyMask(mask, t) : t)}
          style={[
            styles.input,
            {
              color: colors.text,
              fontFamily: fonts.body,
              fontSize: large ? 22 : 16,
              minHeight: multiline ? 88 : undefined,
              textAlignVertical: multiline ? 'top' : 'center',
            },
          ]}
        />
        {password ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}
            onPress={() => setHidden((h) => !h)}
            style={styles.eye}
            hitSlop={8}
          >
            {hidden ? <Eye color={colors.textMuted} size={20} /> : <EyeOff color={colors.textMuted} size={20} />}
          </Pressable>
        ) : null}
        {right}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingHorizontal: spacing.md },
  input: { flex: 1, paddingVertical: spacing.sm },
  eye: { padding: spacing.xs, minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
});
