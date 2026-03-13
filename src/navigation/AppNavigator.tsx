import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  LayoutDashboard, Contact2, GitBranch, FileText,
  Handshake, Target, TrendingUp, Users, UserPlus, BarChart3, MapPin,
} from 'lucide-react-native';

import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../utils/constants';
import { rf } from '../utils/responsive';

// Auth
import { LoginScreen } from '../screens/auth/LoginScreen';

// Dashboard
import { FODashboard } from '../screens/dashboard/FODashboard';
import { ZHDashboard } from '../screens/dashboard/ZHDashboard';
import { RHDashboard } from '../screens/dashboard/RHDashboard';
import { SHDashboard } from '../screens/dashboard/SHDashboard';

// Shared screens
import { LeadsListScreen } from '../screens/leads/LeadsListScreen';
import { LeadDetailScreen } from '../screens/leads/LeadDetailScreen';
import { AddLeadScreen } from '../screens/leads/AddLeadScreen';
import { ActivityLogScreen } from '../screens/activities/ActivityLogScreen';
import { CreateDealScreen } from '../screens/deals/CreateDealScreen';
import { PipelineScreen } from '../screens/pipeline/PipelineScreen';
import { TargetsScreen } from '../screens/targets/TargetsScreen';
import { PerformanceScreen } from '../screens/performance/PerformanceScreen';
import { ReportsScreen } from '../screens/reports/ReportsScreen';
import { UserManagementScreen } from '../screens/users/UserManagementScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { MyDayTrackingScreen } from '../screens/tracking/MyDayTrackingScreen';
import { LiveTrackingScreen } from '../screens/tracking/LiveTrackingScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TabIcon = (IconComponent: any, color: string, size = 22) => ({ focused, color: c }: any) => (
  <IconComponent size={size} color={c} strokeWidth={focused ? 2.5 : 1.8} />
);

const tabBarStyle = (primaryColor: string) => ({
  tabBarActiveTintColor: primaryColor,
  tabBarInactiveTintColor: '#9CA3AF',
  tabBarStyle: {
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingBottom: 6,
    paddingTop: 6,
    height: 62,
  },
  tabBarLabelStyle: {
    fontSize: rf(10),
    fontWeight: '600' as const,
    marginTop: 2,
  },
});

// ─── FO Tab Navigator ─────────────────────────────────────────────────────────
function FOTabs({ navigation }: any) {
  const C = ROLE_COLORS.FO;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, ...tabBarStyle(C.primary) }}>
      <Tab.Screen name="Dashboard" component={FODashboard} options={{ tabBarIcon: TabIcon(LayoutDashboard, C.primary) }} initialParams={{ navigation }} />
      <Tab.Screen name="Leads" component={LeadsListScreen} options={{ tabBarIcon: TabIcon(Contact2, C.primary) }} />
      <Tab.Screen name="Pipeline" component={PipelineScreen} options={{ tabBarIcon: TabIcon(GitBranch, C.primary) }} />
      <Tab.Screen name="Activities" component={ActivityLogScreen} options={{ tabBarLabel: 'Activity', tabBarIcon: TabIcon(FileText, C.primary) }} />
      <Tab.Screen name="Tracking" component={MyDayTrackingScreen} options={{ tabBarIcon: TabIcon(MapPin, C.primary) }} />
      <Tab.Screen name="Targets" component={TargetsScreen} options={{ tabBarIcon: TabIcon(Target, C.primary) }} />
    </Tab.Navigator>
  );
}

// ─── ZH Tab Navigator ─────────────────────────────────────────────────────────
function ZHTabs({ navigation }: any) {
  const C = ROLE_COLORS.ZH;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, ...tabBarStyle(C.primary) }}>
      <Tab.Screen name="Dashboard" component={ZHDashboard} options={{ tabBarIcon: TabIcon(LayoutDashboard, C.primary) }} />
      <Tab.Screen name="Leads" component={LeadsListScreen} options={{ tabBarIcon: TabIcon(Contact2, C.primary) }} />
      <Tab.Screen name="Pipeline" component={PipelineScreen} options={{ tabBarIcon: TabIcon(GitBranch, C.primary) }} />
      <Tab.Screen name="Targets" component={TargetsScreen} options={{ tabBarIcon: TabIcon(Target, C.primary) }} />
      <Tab.Screen name="Performance" component={PerformanceScreen} options={{ tabBarLabel: 'Team', tabBarIcon: TabIcon(TrendingUp, C.primary) }} />
      <Tab.Screen name="Tracking" component={LiveTrackingScreen} options={{ tabBarIcon: TabIcon(MapPin, C.primary) }} />
      <Tab.Screen name="ManageUsers" component={UserManagementScreen} options={{ tabBarLabel: 'Users', tabBarIcon: TabIcon(UserPlus, C.primary) }} />
    </Tab.Navigator>
  );
}

// ─── RH Tab Navigator ─────────────────────────────────────────────────────────
function RHTabs({ navigation }: any) {
  const C = ROLE_COLORS.RH;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, ...tabBarStyle(C.primary) }}>
      <Tab.Screen name="Dashboard" component={RHDashboard} options={{ tabBarIcon: TabIcon(LayoutDashboard, C.primary) }} />
      <Tab.Screen name="Leads" component={LeadsListScreen} options={{ tabBarIcon: TabIcon(Contact2, C.primary) }} />
      <Tab.Screen name="Pipeline" component={PipelineScreen} options={{ tabBarIcon: TabIcon(GitBranch, C.primary) }} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{ tabBarIcon: TabIcon(BarChart3, C.primary) }} />
      <Tab.Screen name="Targets" component={TargetsScreen} options={{ tabBarIcon: TabIcon(Target, C.primary) }} />
      <Tab.Screen name="Performance" component={PerformanceScreen} options={{ tabBarLabel: 'Team', tabBarIcon: TabIcon(TrendingUp, C.primary) }} />
      <Tab.Screen name="Tracking" component={LiveTrackingScreen} options={{ tabBarIcon: TabIcon(MapPin, C.primary) }} />
    </Tab.Navigator>
  );
}

// ─── SH Tab Navigator ─────────────────────────────────────────────────────────
function SHTabs({ navigation }: any) {
  const C = ROLE_COLORS.SH;
  return (
    <Tab.Navigator screenOptions={{ headerShown: false, ...tabBarStyle(C.primary) }}>
      <Tab.Screen name="Dashboard" component={SHDashboard} options={{ tabBarIcon: TabIcon(LayoutDashboard, C.primary) }} />
      <Tab.Screen name="Leads" component={LeadsListScreen} options={{ tabBarIcon: TabIcon(Contact2, C.primary) }} />
      <Tab.Screen name="Pipeline" component={PipelineScreen} options={{ tabBarIcon: TabIcon(GitBranch, C.primary) }} />
      <Tab.Screen name="Reports" component={ReportsScreen} options={{ tabBarIcon: TabIcon(BarChart3, C.primary) }} />
      <Tab.Screen name="Targets" component={TargetsScreen} options={{ tabBarIcon: TabIcon(Target, C.primary) }} />
      <Tab.Screen name="Performance" component={PerformanceScreen} options={{ tabBarLabel: 'Team', tabBarIcon: TabIcon(TrendingUp, C.primary) }} />
      <Tab.Screen name="Tracking" component={LiveTrackingScreen} options={{ tabBarIcon: TabIcon(MapPin, C.primary) }} />
    </Tab.Navigator>
  );
}

const getRoleNavigator = (role: string) => {
  switch (role) {
    case 'ZH': return ZHTabs;
    case 'RH': return RHTabs;
    case 'SH': return SHTabs;
    default: return FOTabs;
  }
};

// ─── Root Navigator ───────────────────────────────────────────────────────────
export const AppNavigator = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner fullScreen message="Loading..." />;

  const MainTabs = user ? getRoleNavigator(user.role) : null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs!} />
            <Stack.Screen name="LeadDetail" component={LeadDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AddLead" component={AddLeadScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="EditLead" component={AddLeadScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="CreateDeal" component={CreateDealScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
