import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { History, LayoutDashboard, MessageCircle, Pill, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertWatcher } from '../../components/layout/AlertWatcher';
import { DashboardScreen } from '../../features/dashboard/DashboardScreen';
import { HistoryScreen } from '../../features/history/HistoryScreen';
import { MedicationsScreen } from '../../features/medications/MedicationsScreen';
import { CaregiverMessagesScreen } from '../../features/messages/CaregiverMessagesScreen';
import { SettingsScreen } from '../../features/settings/SettingsScreen';
import { services } from '../../services';
import { useQuery } from '../../lib/useQuery';
import { useNow } from '../../lib/useNow';
import { fonts, useTheme } from '../../theme';
import type { CaregiverTabParamList } from './types';

const Tab = createBottomTabNavigator<CaregiverTabParamList>();

export function CaregiverTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = useNow(20_000);
  const unread = useQuery(['unread-caregiver'], () => services.messages.unreadCount('ALL', 'CUIDADOR'), {
    silentKey: Math.floor(now.getTime() / 20_000),
  });

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
          tabBarLabelStyle: { fontFamily: fonts.bodySemi, fontSize: 12 },
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
            tabBarBadge: unread.data ? unread.data : undefined,
            tabBarAccessibilityLabel: unread.data ? `Mensagens, ${unread.data} não lidas` : 'Mensagens',
          }}
        />
        <Tab.Screen name="Config" component={SettingsScreen} options={{ title: 'Config.', tabBarAccessibilityLabel: 'Configurações', tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
      </Tab.Navigator>
      <AlertWatcher />
    </>
  );
}
