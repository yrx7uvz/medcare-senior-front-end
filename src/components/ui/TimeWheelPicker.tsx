import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { FlatList, PixelRatio, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import {
  HOURS, MINUTES, indexFromOffset, pad2, spokenHours, spokenMinutes, spokenTime, stepValue, wheelItemHeight,
} from '../../lib/timeWheel';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

/** Linhas visíveis por coluna: a do centro é a escolhida. */
const VISIBLE_ROWS = 5;

interface Props {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  /** Nome do campo para o leitor de tela (ex.: "Novo horário"). */
  label?: string;
}

/**
 * Seletor de horário em rolagem (estilo iPhone), sem biblioteca nativa: duas colunas (00–23 e 00–59) que encaixam no
 * valor, com faixa de destaque no centro. Para quem tem pouca destreza há os botões "+" e "−" em cada coluna; para o
 * leitor de tela, cada coluna é "ajustável" (deslizar para cima ou para baixo muda o valor) e o horário é falado por
 * extenso ("oito horas e trinta minutos"). As linhas têm no mínimo 48 dp e crescem com a fonte ampliada.
 */
export function TimeWheelPicker({ hour, minute, onChange, label = 'Horário' }: Props) {
  const itemHeight = wheelItemHeight(PixelRatio.getFontScale());
  return (
    <View style={styles.wrap} accessibilityLabel={`${label}: ${spokenTime(hour, minute)}`}>
      <View style={styles.columns}>
        <WheelColumn
          values={HOURS}
          value={hour}
          itemHeight={itemHeight}
          name="Horas"
          spoken={spokenHours}
          onChange={(h) => onChange(h, minute)}
        />
        <AppText variant="title" style={[styles.colon, { lineHeight: itemHeight }]} importantForAccessibility="no">
          :
        </AppText>
        <WheelColumn
          values={MINUTES}
          value={minute}
          itemHeight={itemHeight}
          name="Minutos"
          spoken={spokenMinutes}
          onChange={(m) => onChange(hour, m)}
        />
      </View>
      <AppText variant="caption" muted align="center" accessibilityLiveRegion="polite">
        {spokenTime(hour, minute)}
      </AppText>
    </View>
  );
}

interface ColumnProps {
  values: number[];
  value: number;
  itemHeight: number;
  name: string;
  spoken: (v: number) => string;
  onChange: (v: number) => void;
}

function WheelColumn({ values, value, itemHeight, name, spoken, onChange }: ColumnProps) {
  const { colors } = useTheme();
  const list = useRef<FlatList<number>>(null);
  // Onde a rolagem está agora: evita "pular" de volta quando o próprio arraste mudou o valor
  const scrolledTo = useRef(value);

  useEffect(() => {
    if (scrolledTo.current === value) return;
    scrolledTo.current = value;
    list.current?.scrollToOffset({ offset: value * itemHeight, animated: true });
  }, [value, itemHeight]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = indexFromOffset(e.nativeEvent.contentOffset.y, itemHeight, values.length);
    scrolledTo.current = values[index];
    if (values[index] !== value) onChange(values[index]);
  };

  const step = (delta: number) => onChange(values[stepValue(values.indexOf(value), delta, values.length)]);

  return (
    <View style={styles.column}>
      <IconButton icon={Plus} accessibilityLabel={`Aumentar ${name.toLowerCase()}`} background={colors.primarySoft} color={colors.primary}
        onPress={() => step(1)} />
      <View
        style={{ height: itemHeight * VISIBLE_ROWS }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={name}
        accessibilityValue={{ text: spoken(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        {/* Faixa de destaque do valor escolhido */}
        <View
          pointerEvents="none"
          style={[
            styles.band,
            { top: itemHeight * Math.floor(VISIBLE_ROWS / 2), height: itemHeight, backgroundColor: colors.primarySoft, borderColor: colors.primary },
          ]}
        />
        <FlatList
          ref={list}
          data={values}
          keyExtractor={(v) => String(v)}
          importantForAccessibility="no-hide-descendants"
          showsVerticalScrollIndicator={false}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({ length: itemHeight, offset: itemHeight * index, index })}
          initialScrollIndex={values.indexOf(value)}
          contentContainerStyle={{ paddingVertical: itemHeight * Math.floor(VISIBLE_ROWS / 2) }}
          onMomentumScrollEnd={settle}
          onScrollEndDrag={(e) => {
            // Arraste sem impulso não gera momentum: encaixa aqui
            if (!e.nativeEvent.velocity || Math.abs(e.nativeEvent.velocity.y) < 0.05) settle(e);
          }}
          renderItem={({ item }) => (
            <View style={[styles.item, { height: itemHeight }]}>
              <AppText variant={item === value ? 'title' : 'heading'} color={item === value ? colors.primaryDark : colors.textMuted}>
                {pad2(item)}
              </AppText>
            </View>
          )}
        />
      </View>
      <IconButton icon={Minus} accessibilityLabel={`Diminuir ${name.toLowerCase()}`} background={colors.primarySoft} color={colors.primary}
        onPress={() => step(-1)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  columns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  column: { alignItems: 'center', gap: spacing.xs, width: 96 },
  colon: { marginTop: 0 },
  band: { position: 'absolute', left: 0, right: 0, borderRadius: radius.md, borderWidth: 2 },
  item: { alignItems: 'center', justifyContent: 'center' },
});
