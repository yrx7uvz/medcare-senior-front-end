import Minus from 'lucide-react-native/icons/minus';
import Plus from 'lucide-react-native/icons/plus';
import { useCallback, useEffect, useRef } from 'react';
import { FlatList, PixelRatio, Platform, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import {
  HOURS, HOUR_SHORTCUTS, MINUTES, MINUTE_SHORTCUTS, holdRepeatDelay, hourShortcutLabel, indexFromOffset, minuteShortcutLabel, pad2,
  spokenHours, spokenMinutes, spokenTime, stepValue, wheelItemHeight, wheelSteps,
} from '../../lib/timeWheel';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Chip } from './Chip';
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
 * valor, com faixa de destaque no centro. Para quem tem pouca destreza há o "−" acima e o "+" abaixo de cada coluna
 * (segurar repete, cada vez mais rápido) e atalhos para as horas e os minutos mais comuns; na web, a roda do mouse
 * também muda o valor. Para o leitor de tela, cada coluna é "ajustável" (deslizar para cima ou para baixo muda o
 * valor) e o horário é falado por extenso ("oito horas e trinta minutos"). As linhas e os botões têm no mínimo 48 dp
 * e crescem com a fonte ampliada.
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
      <AppText variant="label">Atalhos de horas</AppText>
      <View style={styles.shortcuts}>
        {HOUR_SHORTCUTS.map((h) => (
          <Chip key={h} label={pad2(h)} accessibilityLabel={hourShortcutLabel(h)} selected={h === hour} onPress={() => onChange(h, minute)} />
        ))}
      </View>
      <AppText variant="label">Atalhos de minutos</AppText>
      <View style={styles.shortcuts}>
        {MINUTE_SHORTCUTS.map((m) => (
          <Chip key={m} label={`:${pad2(m)}`} accessibilityLabel={minuteShortcutLabel(m)} selected={m === minute} onPress={() => onChange(hour, m)} />
        ))}
      </View>
    </View>
  );
}

/**
 * Passo ao tocar e repetição enquanto o botão fica pressionado (400 ms, depois cada vez mais rápido). O leitor de
 * tela ativa o botão só com onPress (sem onPressIn): aí dá um passo.
 */
function useHoldRepeat(action: () => void) {
  const actionRef = useRef(action);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressedIn = useRef(false);
  useEffect(() => {
    actionRef.current = action;
  });
  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const repeat = (repeats: number) => {
    timer.current = setTimeout(() => {
      actionRef.current();
      repeat(repeats + 1);
    }, holdRepeatDelay(repeats));
  };
  return {
    onPressIn: () => {
      pressedIn.current = true;
      stop();
      actionRef.current();
      repeat(0);
    },
    onPressOut: () => {
      stop();
      // O onPress do mesmo toque chega junto (antes ou logo depois): só então libera o próximo toque do leitor de tela
      setTimeout(() => {
        pressedIn.current = false;
      }, 0);
    },
    onPress: () => {
      if (!pressedIn.current) actionRef.current();
    },
  };
}

/** Nó da página na web (o ref de uma View do react-native-web). */
interface WebNode {
  addEventListener: (type: 'wheel', fn: (e: WheelLike) => void, options: { passive: boolean }) => void;
  removeEventListener: (type: 'wheel', fn: (e: WheelLike) => void) => void;
}
interface WheelLike {
  deltaY: number;
  deltaMode: number;
  preventDefault: () => void;
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
  const wheelArea = useRef<View>(null);
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

  // Valor mais recente, já com os passos dados: ao segurar o botão, um passo pode vir antes do novo render
  const current = useRef(value);
  useEffect(() => {
    current.current = value;
  }, [value]);
  const step = (delta: number) => {
    current.current = values[stepValue(values.indexOf(current.current), delta, values.length)];
    onChange(current.current);
  };
  const stepRef = useRef(step);
  useEffect(() => {
    stepRef.current = step;
  });
  const minus = useHoldRepeat(() => stepRef.current(-1));
  const plus = useHoldRepeat(() => stepRef.current(1));

  // Web: a lista não encaixa sozinha com a roda do mouse; cada "clique" da roda vira um passo. Ouvinte não passivo
  // para impedir que a página role junto.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = wheelArea.current as unknown as WebNode | null;
    if (!node?.addEventListener) return;
    let rest = 0;
    const onWheel = (e: WheelLike) => {
      e.preventDefault();
      const r = wheelSteps(rest, e.deltaY, e.deltaMode);
      rest = r.rest;
      if (r.steps) stepRef.current(r.steps);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <View style={styles.column}>
      <IconButton icon={Minus} accessibilityLabel={`Diminuir ${name.toLowerCase()}`} background={colors.primarySoft} color={colors.primary}
        {...minus} />
      <View
        ref={wheelArea}
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
          // Dentro do ScrollView do formulário: no Android, sem isto o arraste rola a tela em vez da coluna
          nestedScrollEnabled
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
      <IconButton icon={Plus} accessibilityLabel={`Aumentar ${name.toLowerCase()}`} background={colors.primarySoft} color={colors.primary}
        {...plus} />
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
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
