import type { AuthService } from '../../services/types';
import type { CaregiverSession } from '../../types/views';
import { httpError } from '../../services/errors';
import { getNow } from '../../lib/clock';
import { toDateTimeKey } from '../../lib/date';
import { uid } from '../../lib/ids';
import { meetsPasswordPolicy } from '../../lib/password';
import { getDb, mutateDb } from '../../mocks/db';
import type { CaregiverAccount } from '../../mocks/seed';
import { simulate } from './simulate';

/** Hash apenas ilustrativo do mock. O backend usa BCrypt (RNF02). */
function mockHash(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return `mock$${(h >>> 0).toString(16)}`;
}

const GENERIC_LOGIN_ERROR = 'E-mail ou senha incorretos.';

function toSession(a: CaregiverAccount): CaregiverSession {
  return { caregiverId: a.id, name: a.name, email: a.email, token: `mock.jwt.${a.id}` };
}

/**
 * No protótipo, a base de demonstração (José e Helena) pertence à conta que
 * entrar, para que o roteiro de apresentação funcione com uma conta nova.
 */
function activate(account: CaregiverAccount) {
  mutateDb((db) => {
    db.activeCaregiverId = account.id;
    db.elders.forEach((e) => {
      e.caregiverId = account.id;
    });
  });
}

export const mockAuthService: AuthService = {
  login: (email, password) =>
    simulate(() => {
      const account = getDb().accounts.find((a) => a.email === email.trim().toLowerCase());
      // Mesma mensagem para e-mail inexistente e senha incorreta.
      if (!account || !account.passwordHash || account.passwordHash !== mockHash(password)) {
        throw httpError(401, GENERIC_LOGIN_ERROR, 'CREDENCIAIS_INVALIDAS');
      }
      activate(account);
      return toSession(account);
    }, 300),

  loginDemo: () =>
    simulate(() => {
      const account = getDb().accounts.find((a) => a.id === 'c-maria') ?? getDb().accounts[0];
      activate(account);
      return toSession(account);
    }),

  signUp: (input) =>
    simulate(() => {
      if (!input.lgpdConsent) throw httpError(400, 'É necessário aceitar o termo de consentimento (LGPD).', 'CONSENTIMENTO_OBRIGATORIO');
      if (!meetsPasswordPolicy(input.password)) throw httpError(400, 'A senha não atende aos requisitos.', 'SENHA_FRACA');
      const email = input.email.trim().toLowerCase();
      if (getDb().accounts.some((a) => a.email === email)) {
        throw httpError(409, 'Este e-mail já está cadastrado.', 'EMAIL_DUPLICADO');
      }
      const now = toDateTimeKey(getNow());
      const account: CaregiverAccount = {
        id: uid('c'),
        name: input.name.trim(),
        email,
        phone: input.phone || undefined,
        createdAt: now,
        lgpdConsentAt: now,
        passwordHash: mockHash(input.password),
      };
      mutateDb((db) => {
        db.accounts.push(account);
      });
      activate(account);
      return toSession(account);
    }, 400),

  deleteAccount: () => simulate(() => ({ removalDeadlineDays: 30 }), 600),
};
