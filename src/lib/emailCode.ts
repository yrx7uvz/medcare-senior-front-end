import { meetsPasswordPolicy } from './password';

/**
 * Código de 6 números enviado ao e-mail do cuidador (confirmação do e-mail e troca de senha). Puro e testável; as telas
 * ficam em src/features/auth.
 */

/** No modo demonstração não há e-mail de verdade: o código é sempre este (a tela do demo mostra). */
export const DEMO_EMAIL_CODE = '123456';

/** Só os números, até 6 (o teclado numérico ainda deixa colar texto). */
export const onlyCodeDigits = (text: string) => text.replace(/\D/g, '').slice(0, 6);

/** O que falta para trocar a senha, na ordem dos campos; null quando dá para enviar. */
export function resetFormProblem(code: string, password: string, confirmation: string): string | null {
  if (code.length !== 6) return 'Digite os 6 números do código.';
  if (!meetsPasswordPolicy(password)) return 'A senha nova não atende aos requisitos.';
  if (password !== confirmation) return 'As senhas não conferem.';
  return null;
}
