import { configError } from '../services/errors';

/**
 * Configuração de build (variáveis EXPO_PUBLIC_*, embutidas no bundle pelo Expo).
 * Acesse sempre como `process.env.EXPO_PUBLIC_X` literal: é o que o Expo substitui.
 */

/** Modo demonstração: dados fictícios em memória, relógio simulado e menu do protótipo. Padrão: desligado. */
export const IS_DEMO = process.env.EXPO_PUBLIC_DEMO === 'true';

/** URL da API Spring Boot, como veio do ambiente (sem validação). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

/** Apara espaços e barras finais; devolve null se não for uma URL http(s) utilizável. */
export function normalizeApiBaseUrl(raw: string): string | null {
  const url = raw.trim().replace(/\/+$/, '');
  return /^https?:\/\/[^/\s]+/i.test(url) ? url : null;
}

/**
 * Endereço base da API para o cliente HTTP. Fora do modo demo, ausente ou inválido
 * gera um AppError de configuração (as telas mostram a mensagem; o app não fecha).
 */
export function getApiBaseUrl(): string {
  const url = normalizeApiBaseUrl(API_URL);
  if (url) return url;
  if (IS_DEMO) return '';
  throw configError(
    'O endereço do servidor não está configurado. Defina EXPO_PUBLIC_API_URL (ex.: http://192.168.0.10:8080) no arquivo .env e reinicie o app.',
  );
}
