import { z } from 'zod';
import { MEDICATION_TYPE_VALUES, PILL_SHAPE_VALUES } from '../types/domain';
import { dateBRToKey, isValidDateBR, parseDateBR } from './date';
import { meetsPasswordPolicy } from './password';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Informe seu e-mail').regex(EMAIL_RE, 'E-mail inválido'),
  password: z.string().min(1, 'Informe sua senha'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const signUpSchema = z
  .object({
    name: z.string().trim().min(3, 'Informe seu nome completo'),
    email: z.string().trim().regex(EMAIL_RE, 'E-mail inválido'),
    phone: z.string().refine((v) => v === '' || v.replace(/\D/g, '').length >= 10, 'Telefone incompleto'),
    password: z.string().refine(meetsPasswordPolicy, 'A senha não atende aos requisitos (RN02)'),
    confirmPassword: z.string(),
    lgpdConsent: z.boolean().refine((v) => v, 'É preciso aceitar para criar a conta'),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem' });
export type SignUpValues = z.infer<typeof signUpSchema>;

export const elderSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome completo'),
  birthDate: z
    .string()
    .refine(isValidDateBR, 'Data inválida (DD/MM/AAAA)')
    .refine((v) => {
      const d = parseDateBR(v);
      return !d || d.getFullYear() >= 1900;
    }, 'Confira o ano de nascimento'),
  phone: z.string().refine((v) => v === '' || v.replace(/\D/g, '').length >= 10, 'Telefone incompleto'),
});
export type ElderValues = z.infer<typeof elderSchema>;

/**
 * Formulário de remédio + tratamento: só os campos que a API guarda (MedicamentoRequestDTO e TratamentoRequestDTO),
 * com os mesmos limites de tamanho dela.
 */
export const medicationFormSchema = z
  .object({
    elderId: z.string().min(1, 'Escolha o paciente'),
    name: z.string().trim().min(1, 'Informe o nome do remédio (RN05)').max(255, 'Até 255 caracteres'),
    dosage: z.string().trim().min(1, 'Informe a dosagem (RN05)').max(100, 'Até 100 caracteres'),
    type: z.enum(MEDICATION_TYPE_VALUES, { errorMap: () => ({ message: 'Escolha o tipo (RN05)' }) }),
    shape: z.enum(PILL_SHAPE_VALUES),
    primaryColor: z.string().max(50),
    stock: z.string().refine((v) => v.trim() === '' || /^\d{1,5}$/.test(v.trim()), 'Use um número inteiro'),
    bulaUrl: z
      .string()
      .trim()
      .max(2048, 'Até 2.048 caracteres')
      .refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'Use um link que comece com http:// ou https://'),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1, 'Escolha ao menos um dia'),
    times: z
      .array(z.object({ time: z.string().regex(TIME_RE, 'Use HH:MM') }))
      .min(1, 'Adicione ao menos um horário')
      .superRefine((times, ctx) => {
        const seen = new Set<string>();
        times.forEach((t, i) => {
          if (seen.has(t.time)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: [i, 'time'], message: 'Horário repetido (RN07)' });
          }
          seen.add(t.time);
        });
      }),
    startDate: z.string().refine(isValidDateBR, 'Data inválida (DD/MM/AAAA)'),
    endDate: z.string().refine((v) => v === '' || isValidDateBR(v), 'Data inválida (DD/MM/AAAA)'),
  })
  .superRefine((v, ctx) => {
    const start = dateBRToKey(v.startDate);
    const end = v.endDate ? dateBRToKey(v.endDate) : null;
    if (start && end && start > end) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'O início não pode ser depois do fim' });
    }
  });
export type MedicationFormValues = z.infer<typeof medicationFormSchema>;

