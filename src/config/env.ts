/**
 * Configuração de build (variáveis EXPO_PUBLIC_*, embutidas no bundle pelo Expo).
 * Acesse sempre como `process.env.EXPO_PUBLIC_X` literal: é o que o Expo substitui.
 */

/** Modo demonstração: dados fictícios em memória, relógio simulado e menu do protótipo. Padrão: desligado. */
export const IS_DEMO = process.env.EXPO_PUBLIC_DEMO === 'true';

/** URL da API Spring Boot, como veio do ambiente (sem validação). */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
