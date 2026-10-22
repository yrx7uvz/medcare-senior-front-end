import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { History, LayoutDashboard, MessageCircle, Pill, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertWatcher } from '../../components/layout/AlertWatcher';
import { PushPermissionPrompt } from '../../components/layout/PushPermissionPrompt';
import { AppText } from '../../components/ui';
import { IS_DEMO } from '../../config/env';
import { DashboardScreen } from '../../features/dashboard/DashboardScreen';
import { HistoryScreen } from '../../features/history/HistoryScreen';
import { MedicationsScreen } from '../../features/medications/MedicationsScreen';
import { CaregiverMessagesScreen } from '../../features/messages/CaregiverMessagesScreen';
import { SettingsScreen } from '../../features/settings/SettingsScreen';
import { services } from '../../services';
import { unreadBadge } from '../../lib/messages';
import { useQuery } from '../../lib/useQuery';
import { useRefreshOnAppActive } from '../../lib/useScreenActivity';
import { CAREGIVER_MIN_LABEL, fonts, useTheme } from '../../theme';
import type { CaregiverTabParamList } from './types';

const Tab = createBottomTabNavigator<CaregiverTabParamList>();

export function CaregiverTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Sem atualização periódica fora da tela de mensagens: ao voltar ao app e a cada escrita (cache invalidado)
  const unread = useQuery(['unread-caregiver'], () => services.messages.unreadCount('ALL', 'CUIDADOR'));
  useRefreshOnAppActive(unread.refresh);
  const badge = unreadBadge(unread.data ?? 0);

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 64 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
            paddingTop: 6,
          },
          // Rótulo inteiro em tela estreita ou com fonte ampliada: diminui um pouco para caber, em vez de cortar ("Mensage…")
          tabBarLabel: ({ color, children }) => (
            <AppText
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              maxFontSizeMultiplier={1.3}
              color={color}
              style={{ fontFamily: fonts.bodySemi, fontSize: CAREGIVER_MIN_LABEL }}
            >
              {children}
            </AppText>
          ),
        }}
      >
        <Tab.Screen name="Painel" component={DashboardScreen} options={{ tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
        <Tab.Screen name="Remedios" component={MedicationsScreen} options={{ title: 'Remédios', tabBarIcon: ({ color, size }) => <Pill color={color} size={size} /> }} />
        <Tab.Screen name="Historico" component={HistoryScreen} options={{ title: 'Histórico', tabBarIcon: ({ color, size }) => <History color={color} size={size} /> }} />
        <Tab.Screen
          name="Mensagens"
          component={CaregiverMessagesScreen}
          options={{
            tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
            tabBarBadge: badge,
            tabBarAccessibilityLabel: unread.data ? `Mensagens, ${unread.data} não lidas` : 'Mensagens',
          }}
        />
        <Tab.Screen name="Config" component={SettingsScreen} options={{ title: 'Ajustes', tabBarAccessibilityLabel: 'Configurações', tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
      </Tab.Navigator>
      {/* O alerta simulado só existe no demo; no modo real o aviso chega por push */}
      {IS_DEMO ? <AlertWatcher /> : <PushPermissionPrompt />}
    </>
  );
}
