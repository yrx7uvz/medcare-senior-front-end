/**
 * Mensagens para o usuário por código de erro da API (ErroResponse.codigo). Ponto único: as telas
 * mostram AppError.message, que já sai daqui. Códigos fora da lista mantêm a mensagem da API, que já
 * vem em português e específica (ex.: validação de campo, regra de tratamento).
 */
const MESSAGES: Readonly<Record<string, string>> = {
  CODIGO_INVALIDO: 'Código inválido, expirado ou já usado. Confira os 6 números com quem cuida de você.',
  IDOSO_DUPLICADO: 'Você já cadastrou um paciente com este nome e esta data de nascimento.',
  ACESSO_NEGADO: 'Você não tem permissão para acessar estas informações.',
  RECURSO_NAO_ENCONTRADO: 'Não encontramos este item. Ele pode ter sido removido. Atualize a tela.',
  DOSE_JA_REGISTRADA: 'Esta dose já foi registrada. A tela foi atualizada.',
  DOSE_MUITO_CEDO: 'Ainda é cedo para confirmar esta dose. A confirmação abre 1 hora antes do horário.',
  DOSE_ENCERRADA: 'O prazo para confirmar esta dose terminou.',
  TRATAMENTO_ATIVO: 'Este remédio tem tratamento ativo. Confirme se quer remover mesmo assim.',
  // Erros de contrato (o app mandou algo que a API não entende): sem detalhe técnico para o usuário
  CORPO_INVALIDO: 'Não foi possível enviar os dados. Atualize o app e tente de novo.',
  REQUISICAO_INVALIDA: 'Não foi possível enviar os dados. Atualize o app e tente de novo.',
  METODO_NAO_PERMITIDO: 'Não foi possível concluir a operação. Atualize o app e tente de novo.',
};

/** "2 minutos", "1 minuto", "40 segundos". */
export function formatWait(seconds: number): string {
  const s = Math.max(1, Math.ceil(seconds));
  if (s < 60) return `${s} ${s === 1 ? 'segundo' : 'segundos'}`;
  const min = Math.ceil(s / 60);
  return `${min} ${min === 1 ? 'minuto' : 'minutos'}`;
}

/**
 * Mensagem final de um erro da API. LIMITE_TENTATIVAS ganha o tempo de espera do header Retry-After,
 * quando houver.
 */
export function messageForApiError(code: string | undefined, apiMessage: string, retryAfterSec?: number): string {
  if (code === 'LIMITE_TENTATIVAS') {
    return retryAfterSec
      ? `Muitas tentativas erradas. Aguarde ${formatWait(retryAfterSec)} para tentar de novo.`
      : 'Muitas tentativas erradas. Aguarde alguns minutos para tentar de novo.';
  }
  return (code && MESSAGES[code]) || apiMessage;
}
