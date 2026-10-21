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
 * Build de desenvolvimento. No app, __DEV__ é false no build de release (preview e production); fora do React
 * Native (scripts de verificação e smoke no Node) não existe e vale como desenvolvimento.
 */
const IS_DEV_BUILD = typeof __DEV__ === 'undefined' ? true : __DEV__;

/**
 * O que impede usar o endereço da API neste tipo de build (null = pode usar). No release o endereço precisa ser
 * https://: o tráfego em texto claro também é bloqueado no Android (usesCleartextTraffic=false nos perfis preview e
 * production). Desenvolvimento aceita http:// da rede local; o demo não usa a API.
 */
export function apiUrlProblem(raw: string, build: { dev: boolean; demo: boolean }): string | null {
  if (build.demo) return null;
  const url = normalizeApiBaseUrl(raw);
  if (!url) {
    return 'O endereço do servidor não está configurado. Defina EXPO_PUBLIC_API_URL (ex.: http://192.168.0.10:8080) no arquivo .env e reinicie o app.';
  }
  if (!build.dev && !/^https:\/\//i.test(url)) {
    return 'Esta versão do app só conversa com o servidor por conexão segura. O endereço configurado não começa com https://: gere o app de novo com EXPO_PUBLIC_API_URL em https://.';
  }
  return null;
}

/** Problema de configuração deste build (null = ok). O app mostra uma tela própria e não chama a API. */
export const API_CONFIG_PROBLEM = apiUrlProblem(API_URL, { dev: IS_DEV_BUILD, demo: IS_DEMO });

/**
 * Endereço base da API para o cliente HTTP. Fora do modo demo, ausente, inválido ou http:// no release gera um
 * AppError de configuração (as telas mostram a mensagem; o app não fecha).
 */
export function getApiBaseUrl(): string {
  if (IS_DEMO) return normalizeApiBaseUrl(API_URL) ?? '';
  if (API_CONFIG_PROBLEM) throw configError(API_CONFIG_PROBLEM);
  return normalizeApiBaseUrl(API_URL)!;
}
