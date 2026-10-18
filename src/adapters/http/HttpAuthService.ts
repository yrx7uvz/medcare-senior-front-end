import { AppError } from '../../services/errors';
import type { AuthService } from '../../services/types';
import type { CaregiverSession, SignUpInput } from '../../types/views';
import { endpoints } from './endpoints';
import { request } from './httpClient';
import { fromApiId } from './ids';

/** POST /api/auth/login e POST /api/vinculo/validar */
interface AuthResponse {
  token: string;
  tipo: string;
  id: number;
  nome: string;
}

/** Corpo de POST /api/cuidadores (nomes da API). */
function toCuidadorRequest(input: SignUpInput) {
  return {
    nome: input.name.trim(),
    email: input.email.trim(),
    senha: input.password,
    telefone: input.phone?.trim() ? input.phone.trim() : undefined,
    consentimentoLgpd: input.lgpdConsent,
  };
}

async function login(email: string, password: string): Promise<CaregiverSession> {
  const res = await request<AuthResponse>('POST', endpoints.login, { email: email.trim(), senha: password });
  return { caregiverId: fromApiId(res.id), name: res.nome, email: email.trim(), token: res.token };
}

/**
 * Autenticação do cuidador contra a API Spring Boot. O mapeamento de campos
 * (name <-> nome, password -> senha...) fica aqui, fora das telas.
 */
export const httpAuthService: AuthService = {
  login,

  /** Cadastro (201) seguido de login com as mesmas credenciais: o app entra já com o token. */
  async signUp(input) {
    await request<unknown>('POST', endpoints.signUp, toCuidadorRequest(input));
    return login(input.email, input.password);
  },

  /** DELETE /api/cuidadores/me (204): a API apaga na hora, sem prazo. */
  async deleteAccount() {
    await request<void>('DELETE', endpoints.deleteAccount);
    return { removalDeadlineDays: 0 };
  },

  loginDemo: () =>
    Promise.reject(new AppError('HTTP', 0, 'A conta de demonstração só existe no modo demonstração.', 'DEMO_INDISPONIVEL')),
};
