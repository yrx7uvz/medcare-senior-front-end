import React from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { AppText } from '../../components/ui';
import { formatDayHeader } from '../../lib/date';
import type { DoseView } from '../../types/views';
import { spacing } from '../../theme';
import { DoseCard } from '../dashboard/DoseCard';

interface Props {
  doses: DoseView[];
  todayKey: string;
  showPatient: boolean;
  onPress: (d: DoseView) => void;
  header?: React.ReactElement;
  footer?: React.ReactElement;
  empty?: React.ReactElement;
  bottomInset: number;
}

/** Histórico agrupado por dia, do mais recente para o mais antigo. */
export function HistoryList({ doses, todayKey, showPatient, onPress, header, footer, empty, bottomInset }: Props) {
  const sections: { title: string; data: DoseView[] }[] = [];
  for (const d of doses) {
    const day = d.scheduledAt.slice(0, 10);
    const last = sections[sections.length - 1];
    if (last && last.title === day) last.data.push(d);
    else sections.push({ title: day, data: [d] });
  }
  return (
    <SectionList
      sections={sections}
      keyExtractor={(d) => d.id}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={[styles.list, { paddingBottom: bottomInset + spacing.xxl }]}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={empty}
      renderSectionHeader={({ section }) => (
        <View style={styles.header}>
          <AppText variant="heading" accessibilityRole="header">
            {formatDayHeader(section.title, todayKey)}
          </AppText>
          <AppText variant="caption" muted>
            {section.data.length} {section.data.length === 1 ? 'dose' : 'doses'}
          </AppText>
        </View>
      )}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <DoseCard dose={item} showPatient={showPatient} onPress={() => onPress(item)} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.md, marginBottom: spacing.sm },
  item: { marginBottom: spacing.sm },
});
