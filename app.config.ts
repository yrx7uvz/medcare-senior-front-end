import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Configuração dinâmica do Expo: parte do app.json e acrescenta o que depende do ambiente de build.
 *
 * - android.googleServicesFile: caminho do google-services.json do Firebase, SEMPRE de fora do repositório. No EAS,
 *   vem do arquivo secreto GOOGLE_SERVICES_JSON (eas env:create --type file); localmente, da mesma variável apontando
 *   para um arquivo fora do projeto. Sem a variável, o app compila sem Firebase (o push fica inerte).
 * - expo-notifications: canal padrão "alertas-dose" (o mesmo que o backend usa no FCM) e cor do ícone.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  return {
    ...config,
    name: config.name ?? 'MedCare Sênior',
    slug: config.slug ?? 'medcare-senior',
    android: {
      ...config.android,
      package: 'br.ucb.medcaresenior',
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    plugins: [...(config.plugins ?? []), 'expo-dev-client', ['expo-notifications', { color: '#1A6FB5', defaultChannel: 'alertas-dose' }]],
  };
};
