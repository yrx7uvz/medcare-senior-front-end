import type { ViewStyle } from 'react-native';

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

/** Toque mínimo (RNF01: 48dp; botões do idoso são maiores). */
export const touch = { min: 48, elder: 64, elderPrimary: 88 } as const;

/** hitSlop (em cada lado) para um alvo visual de `size` dp chegar à área de toque mínima de 48 dp. */
export const hitSlopFor = (size: number) => Math.max(0, Math.ceil((touch.min - size) / 2));

export function cardShadow(dark: boolean): ViewStyle {
  return dark
    ? { elevation: 0 }
    : {
        shadowColor: '#1A6FB5',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      };
}
