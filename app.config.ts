import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Configuração dinâmica do Expo: parte do app.json e acrescenta o que depende do ambiente de build.
 *
 * - android.googleServicesFile: caminho do google-services.json do Firebase, SEMPRE de fora do repositório. No EAS,
 *   vem do arquivo secreto GOOGLE_SERVICES_JSON (eas env:create --type file); localmente, da mesma variável apontando
 *   para um arquivo fora do projeto. Sem a variável, o app compila sem Firebase (o push fica inerte).
 * - expo-notifications: canal padrão "alertas-dose" (o mesmo que o backend usa no FCM) e cor do ícone.
 * - Permissões: lista mínima explícita e bloqueio do que bibliotecas ou o modelo do Expo acrescentam sem o app usar.
 */

/** Só o que o app usa: rede (API), notificações e o que o push do FCM exige; VIBRATE para expo-haptics. */
export const ANDROID_PERMISSIONS = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.POST_NOTIFICATIONS',
  'android.permission.VIBRATE',
  'android.permission.WAKE_LOCK',
  'com.google.android.c2dm.permission.RECEIVE',
];

/**
 * Removidas do manifesto final mesmo se uma biblioteca as declarar: o app não lê arquivos, não grava áudio nem usa
 * câmera, localização, telefone, biometria, sobreposição de tela, nem agenda notificações locais (os avisos vêm
 * do servidor pelo FCM).
 */
export const ANDROID_BLOCKED_PERMISSIONS = [
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_AUDIO',
  'android.permission.RECORD_AUDIO',
  'android.permission.CAMERA',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.READ_PHONE_STATE',
  'android.permission.READ_CONTACTS',
  'android.permission.USE_BIOMETRIC',
  'android.permission.USE_FINGERPRINT',
  'android.permission.RECEIVE_BOOT_COMPLETED',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.USE_EXACT_ALARM',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.REQUEST_INSTALL_PACKAGES',
  // Identificador de publicidade que bibliotecas do Google Play Services podem declarar
  'com.google.android.gms.permission.AD_ID',
];

/**
 * Tráfego em texto claro (http://): só no build de desenvolvimento, que fala com o backend na rede local. O perfil
 * development do eas.json define ANDROID_ALLOW_CLEARTEXT=true; preview e production (e qualquer build sem a variável)
 * ficam com usesCleartextTraffic=false, e o app ainda recusa EXPO_PUBLIC_API_URL sem https:// no release.
 */
export function withCleartextPolicy(plugins: ExpoConfig['plugins'], allowCleartext: boolean): ExpoConfig['plugins'] {
  return (plugins ?? []).map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== 'expo-build-properties') return plugin;
    const options = (plugin[1] ?? {}) as { android?: Record<string, unknown> };
    return ['expo-build-properties', { ...options, android: { ...options.android, usesCleartextTraffic: allowCleartext } }];
  });
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  const allowCleartext = process.env.ANDROID_ALLOW_CLEARTEXT === 'true';
  return {
    ...config,
    name: config.name ?? 'MedCare Sênior',
    slug: config.slug ?? 'medcare-senior',
    extra: { ...config.extra, eas: { projectId: 'd83af2b0-0aac-4096-9851-9ebb4f214580' } },
    android: {
      ...config.android,
      package: 'br.ucb.medcaresenior',
      permissions: ANDROID_PERMISSIONS,
      blockedPermissions: ANDROID_BLOCKED_PERMISSIONS,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
    plugins: [
      ...(withCleartextPolicy(config.plugins, allowCleartext) ?? []),
      'expo-dev-client',
      ['expo-notifications', { color: '#1A6FB5', defaultChannel: 'alertas-dose' }],
    ],
  };
};
