/**
 * Desvincular paciente (o cuidador remove um paciente da própria conta): textos e regra da confirmação, sem React,
 * iguais na API e no modo demonstração.
 */

export const UNLINK_MESSAGES = {
  action: 'Desvincular paciente',
  explanation:
    'O histórico de doses já registradas fica sem o nome do paciente. Remédios, horários e mensagens serão apagados. Isso não pode ser desfeito.',
  deviceNote: 'O celular do paciente sai da conta na próxima vez que abrir o app.',
  confirmLabel: 'Desvincular definitivamente',
  success: 'Paciente desvinculado.',
} as const;

export const unlinkTitle = (patientName: string) => `Desvincular ${patientName}?`;
export const unlinkTypeNameMessage = (patientName: string) => `Para confirmar, digite o nome do paciente: ${patientName}`;

/** Sem acento, sem diferença de maiúsculas e com espaços simples: "  josé   FERREIRA " confere com "José Ferreira". */
export function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

/** A segunda etapa só libera o botão quando o nome digitado é o do paciente (nome vazio nunca confere). */
export function unlinkNameMatches(typed: string, patientName: string): boolean {
  const expected = normalizeName(patientName);
  return expected.length > 0 && normalizeName(typed) === expected;
}

/** Depois de desvincular, o filtro de paciente que apontava para ele volta a "Todos". */
export const filterAfterUnlink = <T extends string>(filter: T | 'ALL', removedId: string): T | 'ALL' =>
  filter === removedId ? 'ALL' : filter;
