import { Pressable, StyleSheet } from 'react-native';
import { switchProfile } from '../../lib/session';
import { touch, useTheme } from '../../theme';
import { AppText } from '../ui';

/**
 * "Não é você? Trocar perfil": volta à escolha de perfil limpando só o perfil do
 * aparelho (não apaga a sessão do idoso já pareada). Não usar na tela de PIN.
 */
export function SwitchProfileLink() {
  const { colors, elder } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Não é você? Trocar perfil"
      onPress={() => void switchProfile()}
      hitSlop={8}
      style={({ pressed }) => [styles.link, { minHeight: elder ? touch.elder : 44, opacity: pressed ? 0.7 : 1 }]}
    >
      <AppText variant={elder ? 'elderStrong' : 'bodyStrong'} color={colors.primary} align="center">
        Não é você? Trocar perfil
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 12 },
});
