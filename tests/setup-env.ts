/**
 * Carregado antes de cada arquivo de teste: os adapters HTTP leem EXPO_PUBLIC_API_URL ao carregar src/config/env.
 * A URL é fictícia; nenhum teste acessa a rede.
 */
process.env.EXPO_PUBLIC_API_URL = 'http://api.jest.invalid';
process.env.EXPO_PUBLIC_DEMO = 'false';
