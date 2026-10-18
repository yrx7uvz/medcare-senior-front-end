import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { AppError } from '../services/errors';

/** Nomes de campo da API (ErroResponse.campos[].campo) para os nomes dos formulários do app. */
export const API_FIELD_TO_FORM: Readonly<Record<string, string>> = {
  nome: 'name',
  senha: 'password',
  telefone: 'phone',
  consentimentoLgpd: 'lgpdConsent',
  dataNascimento: 'birthDate',
  email: 'email',
};

/** Erros por campo do AppError traduzidos para os campos que existem no formulário. */
export function mapFieldErrors<T extends FieldValues>(
  error: AppError | undefined,
  formFields: readonly Path<T>[],
  fieldMap: Readonly<Record<string, string>> = API_FIELD_TO_FORM,
): [Path<T>, string][] {
  if (!error?.fieldErrors) return [];
  return Object.entries(error.fieldErrors)
    .map(([apiField, message]) => [(fieldMap[apiField] ?? apiField) as Path<T>, message] as [Path<T>, string])
    .filter(([formField]) => formFields.includes(formField));
}

/**
 * Leva os erros por campo de um AppError (fieldErrors, nomes da API) para o react-hook-form.
 *
 * @returns quantos campos receberam erro (0 = mostre a mensagem geral)
 */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  error: AppError | undefined,
  formFields: readonly Path<T>[],
  fieldMap: Readonly<Record<string, string>> = API_FIELD_TO_FORM,
): number {
  const mapped = mapFieldErrors<T>(error, formFields, fieldMap);
  for (const [field, message] of mapped) setError(field, { message });
  return mapped.length;
}
