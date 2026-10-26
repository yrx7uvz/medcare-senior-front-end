/// <reference types="node" />
/**
 * Importado ANTES de tudo pelo check-core: os adapters HTTP leem EXPO_PUBLIC_API_URL ao carregar
 * src/config/env. A URL é fictícia; o check-core troca o fetch global e nunca acessa a rede.
 */
process.env.EXPO_PUBLIC_API_URL = 'http://api.check-core.invalid'; // NOSONAR: domínio .invalid, nunca acessado
process.env.EXPO_PUBLIC_DEMO = 'false';
