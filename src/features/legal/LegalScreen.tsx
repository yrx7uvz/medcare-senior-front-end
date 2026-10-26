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
      ['O que é o MedCare Sênior', 'Um aplicativo para lembrar e registrar as doses de remédio dos pacientes e avisar quem cuida deles quando uma dose não é confirmada. Foi pensado para pessoas idosas, mas pode ser usado por pacientes de qualquer idade.'],
      ['O que o app não faz', 'Não substitui orientação médica nem altera receitas. A aparência dos remédios pode variar conforme o fabricante.'],
      ['Responsabilidades de quem cuida', 'Cadastrar corretamente remédios, horários e pacientes, e manter o código de conexão em sigilo.'],
      ['Registros de doses', 'Doses confirmadas ou não confirmadas não podem ser alteradas depois, para que o histórico seja confiável. A dose pode ser confirmada pelo paciente, no celular dele, ou por você, na tela da dose, e o registro guarda quem confirmou.'],
    ],
  },
  lgpd: {
    title: 'Política de Privacidade (LGPD)',
    sections: [
      ['Dados tratados', 'Seus: nome, e-mail, telefone e senha (guardada de forma protegida, nunca em texto). Dos pacientes: nome, data de nascimento, telefone, remédios, horários, registro das doses (e quem confirmou) e as mensagens trocadas no app.'],
      ['Para que usamos', 'Organizar os remédios, lembrar os horários, conectar o celular do paciente à sua conta e avisar você quando uma dose não for confirmada no horário.'],
      ['Notificações (Google)', 'Os avisos chegam ao seu celular pelo Firebase Cloud Messaging, serviço do Google, que atua apenas para entregar a notificação e pode usar servidores fora do Brasil. Para isso, o Google recebe o código do seu aparelho para notificações (um dado pessoal) e o texto do aviso, com o nome do paciente e o horário da dose. O nome do remédio e outras informações de saúde nunca vão na notificação.'],
      ['Por quanto tempo', 'Os dados ficam guardados enquanto a conta existir. O código do aparelho para notificações é apagado quando você sai da conta neste celular ou exclui a conta.'],
      ['Aparelho do paciente', 'O PIN de 4 números fica guardado apenas no celular do paciente, de forma protegida.'],
      ['Compartilhamento', 'Não vendemos nem compartilhamos dados para publicidade. O relatório em PDF só é enviado para onde você escolher.'],
      ['Exclusão da conta', 'Você pode excluir a conta a qualquer momento, na tela de ajustes. Seus dados pessoais e os dos pacientes vinculados, as mensagens, o código do aparelho para notificações e o registro dos avisos são apagados na hora; o histórico de doses já registradas fica apenas de forma anônima, sem ligação com nenhuma pessoa.'],
    ],
  },
} as const;

export function LegalScreen({ route }: RootScreenProps<'Legal'>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const doc = DOCS[route.params.doc];
  return (
    <>
      <StackHeader title={doc.title} subtitle="MedCare Sênior" />
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
