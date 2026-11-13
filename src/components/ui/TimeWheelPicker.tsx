import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, PixelRatio, Platform, Pressable, StyleSheet, View } from 'react-native';
import {
  indexFromOffset, nearestRowFor, pad2, spokenHours, spokenMinutes, spokenTime, startRow, valueAtRow, wheelItemHeight, wheelRowCount,
  wheelSteps,
} from '../../lib/timeWheel';
import { radius, spacing, useTheme } from '../../theme';
import { AppText } from './AppText';

/** Linhas visíveis por coluna: a do centro é a escolhida. */
const VISIBLE_ROWS = 5;
const CENTER = Math.floor(VISIBLE_ROWS / 2);

/** Linhas de cada roda (índices; o valor de cada uma é índice % 24 ou % 60). Fora do componente: criadas uma vez. */
const HOUR_ROWS = Array.from({ length: wheelRowCount(24) }, (_, i) => i);
const MINUTE_ROWS = Array.from({ length: wheelRowCount(60) }, (_, i) => i);

/** Intervalo mínimo entre dois "tiques" de vibração ao rolar (num arremesso rápido não vira zumbido). */
const TICK_MIN_MS = 40;

interface Props {
  hour: number;
  minute: number;
  onChange: (hour: number, minute: number) => void;
  /** Nome do campo para o leitor de tela (ex.: "Novo horário"). */
  label?: string;
}

/**
 * Seletor de horário em rolagem, sem biblioteca nativa: duas rodas largas (horas e minutos) que dão a volta (depois
 * do 23 vem o 00) e encaixam no valor, com uma faixa suave de ponta a ponta atrás da linha escolhida. Os números
 * crescem e ficam mais nítidos ao chegar ao centro (animação na thread nativa) e o celular vibra de leve a cada número
 * que passa. Tocar num número visível leva a roda até ele; na web, a roda do mouse muda o valor. Para o leitor de
 * tela, cada roda é "ajustável" (deslizar para cima ou para baixo muda o valor) e o horário é falado por extenso
 * ("oito horas e trinta minutos"). As linhas têm 52 dp e crescem com a fonte ampliada.
 */
export function TimeWheelPicker({ hour, minute, onChange, label = 'Horário' }: Props) {
  const { colors } = useTheme();
  // Altura com um número inteiro de pixels: com fração, o encaixe do Android arredonda a cada linha e, em milhares de
  // linhas, a roda para fora do centro da faixa
  const itemHeight = PixelRatio.roundToNearestPixel(wheelItemHeight(PixelRatio.getFontScale()));
  return (
    <View style={styles.wrap} accessibilityLabel={`${label}: ${spokenTime(hour, minute)}`}>
      <View style={styles.wheel}>
        {/* Faixa da linha escolhida: antes das colunas, para ficar atrás delas */}
        <View pointerEvents="none" style={[styles.band, { top: itemHeight * CENTER, height: itemHeight, backgroundColor: colors.primarySoft }]} />
        <WheelColumn
          // Fonte do sistema mudou com o seletor aberto: remonta com a altura nova
          key={`h-${itemHeight}`}
          count={24}
          rows={HOUR_ROWS}
          value={hour}
          itemHeight={itemHeight}
          name="Horas"
          spoken={spokenHours}
          onChange={(h) => onChange(h, minute)}
        />
        <View pointerEvents="none" style={[styles.colonBox, { height: itemHeight * VISIBLE_ROWS }]}>
          <AppText variant="number" importantForAccessibility="no">
            :
          </AppText>
        </View>
        <WheelColumn
          key={`m-${itemHeight}`}
          count={60}
          rows={MINUTE_ROWS}
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
  count: number;
  rows: number[];
  value: number;
  itemHeight: number;
  name: string;
  spoken: (v: number) => string;
  onChange: (v: number) => void;
}

function WheelColumn({ count, rows, value, itemHeight, name, spoken, onChange }: ColumnProps) {
  const list = useRef<FlatList<number>>(null);
  const wheelArea = useRef<View>(null);
  const [scrollY] = useState(() => new Animated.Value(startRow(value, count) * itemHeight));
  // Linha no centro agora (a fonte da verdade da rolagem): evita "pular" de volta quando o próprio arraste mudou o valor
  const row = useRef(startRow(value, count));
  const tickRow = useRef(startRow(value, count));
  const lastTick = useRef(0);
  const webSettle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Valor mais recente, já com os passos dados: a roda do mouse pode mandar vários passos antes do novo render
  const current = useRef(value);
  useEffect(() => {
    current.current = value;
  }, [value]);

  // Valor mudou por fora (leitor de tela, roda do mouse): rola pelo caminho mais curto, dando a volta
  useEffect(() => {
    if (valueAtRow(row.current, count) === value) return;
    row.current = nearestRowFor(row.current, value, count);
    list.current?.scrollToOffset({ offset: row.current * itemHeight, animated: true });
  }, [value, itemHeight, count]);

  useEffect(
    () => () => {
      if (webSettle.current) clearTimeout(webSettle.current);
    },
    [],
  );

  const emit = (v: number) => {
    if (v === current.current) return;
    current.current = v;
    onChange(v);
  };

  const settle = (y: number) => {
    const r = indexFromOffset(y, itemHeight, rows.length);
    row.current = r;
    // Parou fora do centro (arraste lento sem encaixe, arredondamento): completa até a linha
    if (Math.abs(y - r * itemHeight) > 0.5) list.current?.scrollToOffset({ offset: r * itemHeight, animated: true });
    emit(valueAtRow(r, count));
  };

  // Toque num número visível: a roda vai até ele (a rolagem programática nem sempre avisa o fim; o valor muda já)
  const select = (r: number) => {
    row.current = r;
    list.current?.scrollToOffset({ offset: r * itemHeight, animated: true });
    emit(valueAtRow(r, count));
  };

  const stepRef = useRef((delta: number) => emit(valueAtRow(current.current + delta, count)));
  useEffect(() => {
    stepRef.current = (delta: number) => emit(valueAtRow(current.current + delta, count));
  });

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

  // A cada quadro da rolagem (fora do render): encaixe na web e o "tique" de vibração a cada número que passa
  const onPosition = useRef<(y: number) => void>(() => undefined);
  useEffect(() => {
    onPosition.current = (y) => {
      if (Platform.OS === 'web') {
        // Na web não há fim de arraste/impulso: encaixa o valor quando a rolagem para
        if (webSettle.current) clearTimeout(webSettle.current);
        webSettle.current = setTimeout(() => settle(y), 150);
        return;
      }
      const r = Math.round(y / itemHeight);
      const now = Date.now();
      if (r !== tickRow.current && now - lastTick.current >= TICK_MIN_MS) {
        tickRow.current = r;
        lastTick.current = now;
        Haptics.selectionAsync().catch(() => undefined);
      }
    };
  });
  useEffect(() => {
    const id = scrollY.addListener(({ value: y }) => onPosition.current(y));
    return () => scrollY.removeListener(id);
  }, [scrollY]);
  // A posição vai direto para a animação na thread nativa (e chega ao ouvinte acima)
  const [onScroll] = useState(() => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }));

  return (
    <View style={styles.column}>
      <View
        ref={wheelArea}
        style={{ height: itemHeight * VISIBLE_ROWS }}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={name}
        accessibilityValue={{ text: spoken(value) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => stepRef.current(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      >
        <Animated.FlatList
          ref={list}
          data={rows}
          keyExtractor={String}
          importantForAccessibility="no-hide-descendants"
          // Dentro do ScrollView do formulário: no Android, sem isto o arraste rola a tela em vez da roda
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          snapToInterval={itemHeight}
          // Um arremesso atravessa vários valores; o encaixe para sempre exatamente numa linha
          decelerationRate="normal"
          getItemLayout={(_, index) => ({ length: itemHeight, offset: itemHeight * index, index })}
          initialScrollIndex={startRow(value, count)}
          initialNumToRender={VISIBLE_ROWS + 4}
          windowSize={5}
          maxToRenderPerBatch={10}
          removeClippedSubviews={Platform.OS === 'android'}
          contentContainerStyle={{ paddingVertical: itemHeight * CENTER }}
          scrollEventThrottle={16}
          onScroll={onScroll}
          onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.y)}
          onScrollEndDrag={(e) => {
            // Arraste sem impulso não gera momentum: encaixa aqui
            if (!e.nativeEvent.velocity || Math.abs(e.nativeEvent.velocity.y) < 0.05) settle(e.nativeEvent.contentOffset.y);
          }}
          renderItem={({ index }) => {
            const center = index * itemHeight;
            const inputRange = [center - 2 * itemHeight, center - itemHeight, center, center + itemHeight, center + 2 * itemHeight];
            const opacity = scrollY.interpolate({ inputRange, outputRange: [0.35, 0.6, 1, 0.6, 0.35], extrapolate: 'clamp' });
            const scale = scrollY.interpolate({ inputRange, outputRange: [0.68, 0.84, 1, 0.84, 0.68], extrapolate: 'clamp' });
            return (
              // Linha tocável só para o dedo: o leitor de tela usa a roda ajustável (as linhas ficam escondidas dele)
              <Pressable
                testID={`${name}-linha-${index}`}
                importantForAccessibility="no"
                onPress={() => select(index)}
                style={[styles.item, { height: itemHeight }]}
              >
                <Animated.View style={{ opacity, transform: [{ scale }] }}>
                  <AppText variant="number" align="center">
                    {pad2(valueAtRow(index, count))}
                  </AppText>
                </Animated.View>
              </Pressable>
            );
          }}
        />
      </View>
      <AppText variant="caption" muted align="center" importantForAccessibility="no">
        {name.toLowerCase()}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  wheel: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', maxWidth: 320, alignSelf: 'center' },
  band: { position: 'absolute', left: 0, right: 0, borderRadius: radius.md },
  column: { flex: 1, gap: spacing.xs },
  colonBox: { width: 28, alignItems: 'center', justifyContent: 'center' },
  item: { alignItems: 'center', justifyContent: 'center' },
});
