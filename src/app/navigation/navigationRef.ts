import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** Navegação fora das telas (ex.: toque numa notificação de push). */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
