/** RN02: mínimo 8 caracteres, com maiúscula, minúscula e número. */
export interface PasswordCheck {
  key: 'length' | 'upper' | 'lower' | 'number';
  label: string;
  ok: boolean;
}

export function passwordChecks(pw: string): PasswordCheck[] {
  return [
    { key: 'length', label: 'Pelo menos 8 caracteres', ok: pw.length >= 8 },
    { key: 'upper', label: 'Uma letra maiúscula', ok: /[A-Z]/.test(pw) },
    { key: 'lower', label: 'Uma letra minúscula', ok: /[a-z]/.test(pw) },
    { key: 'number', label: 'Um número', ok: /\d/.test(pw) },
  ];
}

export const meetsPasswordPolicy = (pw: string) => passwordChecks(pw).every((c) => c.ok);

/** 0 a 4: usado pelo medidor de força. */
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: 'Digite uma senha' };
  let score = passwordChecks(pw).filter((c) => c.ok).length;
  if (score === 4 && (pw.length >= 12 || /[^A-Za-z0-9]/.test(pw))) score = 4;
  else if (score === 4) score = 3;
  const s = Math.max(1, Math.min(4, score)) as 1 | 2 | 3 | 4;
  const labels = { 1: 'Fraca', 2: 'Fraca', 3: 'Boa', 4: 'Forte' } as const;
  return { score: s, label: meetsPasswordPolicy(pw) ? labels[s] : 'Ainda não atende aos requisitos' };
}
