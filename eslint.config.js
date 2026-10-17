// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  // Desliga as regras de estilo que conflitam com o Prettier (a formatação é responsabilidade dele).
  prettierConfig,
  {
    ignores: ['node_modules/*', 'dist/*', 'dist-check/*', '.expo/*'],
  },
]);
