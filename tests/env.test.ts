import { describe, expect, it } from '@jest/globals';
import { withCleartextPolicy } from '../app.config';
import { apiUrlProblem, normalizeApiBaseUrl } from '../src/config/env';

describe('endereço da API por tipo de build', () => {
  const release = { dev: false, demo: false };
  const dev = { dev: true, demo: false };

  it('release recusa http:// e aceita https:// (com ou sem barra final)', () => {
    expect(apiUrlProblem('http://192.168.0.10:8080', release)).toMatch(/https:\/\//);
    expect(apiUrlProblem('https://medcare.duckdns.org', release)).toBeNull();
    expect(apiUrlProblem('https://medcare.duckdns.org///', release)).toBeNull();
    expect(normalizeApiBaseUrl(' https://medcare.duckdns.org/ ')).toBe('https://medcare.duckdns.org');
  });

  it('desenvolvimento aceita http:// da rede local e https://', () => {
    expect(apiUrlProblem('http://10.0.2.2:8080', dev)).toBeNull();
    expect(apiUrlProblem('https://medcare.duckdns.org', dev)).toBeNull();
  });

  it('ausente ou inválido é problema em qualquer build fora do demo', () => {
    expect(apiUrlProblem('', dev)).toMatch(/não está configurado/);
    expect(apiUrlProblem('medcare.duckdns.org', release)).toMatch(/não está configurado/);
    expect(apiUrlProblem('', { dev: false, demo: true })).toBeNull();
  });
});

describe('tráfego em texto claro no Android', () => {
  it('liga só quando pedido e preserva as outras opções do expo-build-properties', () => {
    const base: [string, [string, { android: { minSdkVersion: number } }]] = ['expo-font', ['expo-build-properties', { android: { minSdkVersion: 26 } }]];
    expect(withCleartextPolicy([...base], false)).toEqual(['expo-font', ['expo-build-properties', { android: { minSdkVersion: 26, usesCleartextTraffic: false } }]]);
    expect(withCleartextPolicy([...base], true)).toEqual(['expo-font', ['expo-build-properties', { android: { minSdkVersion: 26, usesCleartextTraffic: true } }]]);
    expect(withCleartextPolicy(undefined, false)).toEqual([]);
  });
});
