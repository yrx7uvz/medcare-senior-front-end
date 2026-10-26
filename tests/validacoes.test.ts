import { describe, expect, it } from '@jest/globals';
import { emptyMedicationValues } from '../src/features/medications/formValues';
import { mapFieldErrors } from '../src/lib/formErrors';
import { meetsPasswordPolicy, passwordChecks, passwordStrength } from '../src/lib/password';
import { patientSchema, loginSchema, medicationFormSchema, signUpSchema } from '../src/lib/schemas';
import { AppError } from '../src/services/errors';

const campos = (r: { success: boolean; error?: { issues: { path: (string | number)[] }[] } }) =>
  r.success ? [] : (r.error?.issues ?? []).map((i) => i.path.join('.'));

describe('login e cadastro do cuidador', () => {
  it('login exige e-mail válido e senha', () => {
    expect(loginSchema.safeParse({ email: ' ana@teste.com ', password: 'x' }).success).toBe(true);
    expect(campos(loginSchema.safeParse({ email: 'ana@', password: '' }))).toEqual(['email', 'password']);
  });

  it('senha segue a RN02 (8+, maiúscula, minúscula e número) e o medidor de força', () => {
    expect(meetsPasswordPolicy('Senha123')).toBe(true);
    expect(meetsPasswordPolicy('senha123')).toBe(false);
    expect(passwordChecks('Ab1').filter((c) => !c.ok).map((c) => c.key)).toEqual(['length']);
    expect(passwordStrength('')).toEqual({ score: 0, label: 'Digite uma senha' });
    expect(passwordStrength('Senha123').label).toBe('Boa');
    expect(passwordStrength('Senha123!').label).toBe('Forte');
    expect(passwordStrength('abc').label).toBe('Ainda não atende aos requisitos');
  });

  it('cadastro confere senhas, telefone e consentimento LGPD', () => {
    const ok = { name: 'Ana Souza', email: 'ana@teste.com', phone: '', password: 'Senha123', confirmPassword: 'Senha123', lgpdConsent: true };
    expect(signUpSchema.safeParse(ok).success).toBe(true);
    expect(campos(signUpSchema.safeParse({ ...ok, confirmPassword: 'Outra123' }))).toEqual(['confirmPassword']);
    expect(campos(signUpSchema.safeParse({ ...ok, phone: '(11) 9999' }))).toEqual(['phone']);
    expect(campos(signUpSchema.safeParse({ ...ok, lgpdConsent: false }))).toEqual(['lgpdConsent']);
  });
});

describe('cadastro do paciente', () => {
  it('nome com 3+ letras, nascimento válido a partir de 1900 e telefone opcional', () => {
    expect(patientSchema.safeParse({ name: 'José', birthDate: '12/03/1945', phone: '' }).success).toBe(true);
    expect(campos(patientSchema.safeParse({ name: 'Jo', birthDate: '31/02/1945', phone: '' }))).toEqual(['name', 'birthDate']);
    expect(campos(patientSchema.safeParse({ name: 'José', birthDate: '01/01/1899', phone: '' }))).toEqual(['birthDate']);
  });
});

describe('formulário de remédio', () => {
  const base = { ...emptyMedicationValues('12', new Date(2026, 9, 18)), name: 'Losartana', dosage: '50mg' };

  it('aceita o formulário padrão preenchido', () => {
    expect(medicationFormSchema.safeParse(base).success).toBe(true);
  });

  it('limites da API, estoque inteiro, link da bula, dias, horários repetidos e período', () => {
    expect(campos(medicationFormSchema.safeParse({ ...base, name: 'x'.repeat(256), dosage: '' }))).toEqual(['name', 'dosage']);
    expect(campos(medicationFormSchema.safeParse({ ...base, stock: '-1' }))).toEqual(['stock']);
    expect(campos(medicationFormSchema.safeParse({ ...base, stock: '12' }))).toEqual([]);
    expect(campos(medicationFormSchema.safeParse({ ...base, bulaUrl: 'ftp://bula' }))).toEqual(['bulaUrl']);
    expect(campos(medicationFormSchema.safeParse({ ...base, weekdays: [] }))).toEqual(['weekdays']);
    expect(campos(medicationFormSchema.safeParse({ ...base, times: [{ time: '08:00' }, { time: '08:00' }] }))).toEqual(['times.1.time']);
    expect(campos(medicationFormSchema.safeParse({ ...base, times: [{ time: '24:00' }] }))).toEqual(['times.0.time']);
    expect(campos(medicationFormSchema.safeParse({ ...base, startDate: '10/10/2026', endDate: '09/10/2026' }))).toEqual(['endDate']);
  });
});

describe('erros por campo da API', () => {
  it('traduz os nomes da API e ignora campos que o formulário não tem', () => {
    const erro = new AppError('HTTP', 400, 'x', 'VALIDACAO', undefined, { nome: 'curto', senha: 'fraca', outro: 'y' });
    expect(mapFieldErrors(erro, ['name', 'password'])).toEqual([['name', 'curto'], ['password', 'fraca']]);
    expect(mapFieldErrors(undefined, ['name'])).toEqual([]);
  });
});
