import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { IS_DEMO } from '../config/env';
import { createPushService, type NotificationsModule } from './pushCore';

export { ALERT_CHANNEL_ID, ALERT_CHANNEL_NAME, type PushPermission, type PushService } from './pushCore';

/**
 * Push do aparelho (FCM via expo-notifications). Inerte no Expo Go, no iOS, na web e no modo demo: o módulo nativo só
 * é carregado no app Android de development/produção.
 */
export const push = createPushService(
  { os: Platform.OS, isExpoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient, isDemo: IS_DEMO },
  // Carregado só quando suportado: no Expo Go o expo-notifications nem é avaliado
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  () => require('expo-notifications') as NotificationsModule,
);
