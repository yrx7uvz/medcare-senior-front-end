import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '../../app/navigation/types';
import { StackHeader } from '../../components/layout/StackHeader';
import { AppText } from '../../components/ui';
import { spacing, useTheme } from '../../theme';

const DOCS = {
  termos: {
    title: 'Termos de Uso',
    sections: [
      ['O que é o MedCare Sênior', 'Um aplicativo para lembrar e registrar as doses de remédio de idosos e avisar o cuidador quando uma dose não é confirmada.'],
      ['O que o app não faz', 'Não substitui orientação médica nem altera receitas. As informações de aparência dos remédios podem variar conforme o fabricante.'],
      ['Responsabilidades do cuidador', 'Cadastrar corretamente remédios, horários e pacientes, e manter o código de vínculo em sigilo.'],
      ['Registros de doses', 'Doses confirmadas ou não tomadas não podem ser alteradas depois (RN08), para que o histórico seja confiável.'],
    ],
  },
  lgpd: {
    title: 'Política de Privacidade (LGPD)',
    sections: [
      ['Dados tratados', 'Do cuidador: nome, e-mail, telefone e senha (guardada só como hash). Do paciente: nome, data de nascimento, telefone, remédios, horários e registros de doses.'],
      ['Notificações', 'Para avisar sobre doses não confirmadas, o nome do paciente, o remédio e o horário passam pelo Firebase Cloud Messaging (Google).'],
      ['Aparelho do paciente', 'O PIN de 4 dígitos fica guardado apenas no aparelho do paciente.'],
      ['Exclusão da conta', 'Você pode excluir a conta a qualquer momento. Os dados pessoais seus e dos pacientes vinculados são removidos em até 30 dias; o histórico de doses já registradas é mantido de forma anonimizada, sem ligação com nenhuma pessoa (RN13).'],
    ],
  },
} as const;

export function LegalScreen({ route }: RootScreenProps<'Legal'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const doc = DOCS[route.params.doc];
  return (
    <>
      <StackHeader title={doc.title} subtitle="Versão do protótipo" />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + spacing.xxl }]}>
        {doc.sections.map(([title, text]) => (
          <React.Fragment key={title}>
            <AppText variant="heading" accessibilityRole="header">{title}</AppText>
            <AppText>{text}</AppText>
          </React.Fragment>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({ body: { padding: spacing.lg, gap: spacing.sm } });
