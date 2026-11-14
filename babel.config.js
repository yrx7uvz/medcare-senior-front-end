/*
 * Configuração do Babel com o preset do Expo, que compila TypeScript e JSX para o motor Hermes.
 */
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
