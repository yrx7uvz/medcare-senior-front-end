import Clock from 'lucide-react-native/icons/clock';
import Plus from 'lucide-react-native/icons/plus';
import X from 'lucide-react-native/icons/x';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Button, TimeWheelPicker } from '../../../components/ui';
import { EMPTY_TIMES_MESSAGE, addTime, removeTime, type TimeEntry } from '../../../lib/timeList';
import { parseHHmm, spokenTime, toHHmm } from '../../../lib/timeWheel';
import { radius, spacing, useTheme } from '../../../theme';

interface Props {
  value: TimeEntry[];
  onChange: (times: TimeEntry[]) => void;
  /** Erro do formulário (validação ao salvar). */
  error?: string;
}

/**
 * Horários do tratamento como etiquetas ("08:00 ×"), em ordem. "Adicionar horário" abre o seletor em rolagem; o "×"
 * tira o horário, inclusive o último (aí aparece "Informe ao menos um horário"). Repetido não entra.
 */
export function TimesField({ value, onChange, error }: Props) {
  const { colors } = useTheme();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<[number, number]>([8, 0]);
  const [duplicate, setDuplicate] = useState<string | null>(null);

  function openPicker() {
    // Começa uma hora depois do último horário (ou às 08:00), para o caso comum de várias doses no dia
    const last = parseHHmm(value[value.length - 1]?.time);
    setDraft(last ? [(last[0] + 1) % 24, last[1]] : [8, 0]);
    setDuplicate(null);
    setAdding(true);
  }

  function confirmDraft() {
    const result = addTime(value, toHHmm(draft[0], draft[1]));
    if (result.error) {
      setDuplicate(result.error);
      return;
    }
    onChange(result.times);
    setAdding(false);
  }

  const message = duplicate ?? error ?? (value.length === 0 ? EMPTY_TIMES_MESSAGE : null);

  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {value.map((t) => {
          const parsed = parseHHmm(t.time);
          return (
            <Pressable
              key={t.time}
              accessibilityRole="button"
              accessibilityLabel={`Remover horário ${parsed ? spokenTime(parsed[0], parsed[1]) : t.time}`}
              onPress={() => {
                onChange(removeTime(value, t.time));
                setDuplicate(null);
              }}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: colors.primarySoft, borderColor: colors.inputBorder, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Clock color={colors.primaryDark} size={18} />
              <AppText variant="bodyStrong" color={colors.primaryDark}>{t.time}</AppText>
              <X color={colors.danger} size={20} />
            </Pressable>
          );
        })}
      </View>
      {message ? (
        <AppText variant="caption" color={colors.danger} accessibilityRole="alert">{message}</AppText>
      ) : null}

      {adding ? (
        <View style={[styles.panel, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
          <TimeWheelPicker
            label="Novo horário"
            hour={draft[0]}
            minute={draft[1]}
            onChange={(h, m) => {
              setDraft([h, m]);
              setDuplicate(null);
            }}
          />
          <View style={styles.actions}>
            <Button title="Cancelar" variant="secondary" style={styles.flex} onPress={() => setAdding(false)} />
            <Button title={`Adicionar ${toHHmm(draft[0], draft[1])}`} icon={Plus} style={styles.flex} onPress={confirmDraft} />
          </View>
        </View>
      ) : (
        <Button title="Adicionar horário" icon={Plus} variant="secondary" size="sm" style={styles.add} onPress={openPicker} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  flex: { flexGrow: 1, flexBasis: 140 },
  add: { alignSelf: 'flex-start' },
});
