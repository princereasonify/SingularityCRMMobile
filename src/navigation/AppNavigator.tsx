import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  LayoutDashboard, Contact2, GitBranch,
  Target, TrendingUp, UserPlus, BarChart3, MapPin, Navigation,
  Calendar, Building2, Settings,
} from 'lucide-react-native';
import { useOffline } from '../context/OfflineContext';

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

// Core screens
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

// Schools
import { SchoolsListScreen } from '../screens/schools/SchoolsListScreen';
import { SchoolDetailScreen } from '../screens/schools/SchoolDetailScreen';
import { AddSchoolScreen } from '../screens/schools/AddSchoolScreen';

// Contacts
import { ContactsListScreen } from '../screens/contacts/ContactsListScreen';
import { ContactDetailScreen } from '../screens/contacts/ContactDetailScreen';
import { AddContactScreen } from '../screens/contacts/AddContactScreen';

// Demos
import { DemoListScreen } from '../screens/demos/DemoListScreen';
import { DemoDetailScreen } from '../screens/demos/DemoDetailScreen';
import { AssignDemoScreen } from '../screens/demos/AssignDemoScreen';

// Onboarding
import { OnboardListScreen } from '../screens/onboarding/OnboardListScreen';
import { OnboardDetailScreen } from '../screens/onboarding/OnboardDetailScreen';

// Calendar
import { CalendarScreen } from '../screens/calendar/CalendarScreen';

// Visit Report
import { VisitReportScreen } from '../screens/visitReport/VisitReportScreen';

// AI
import { AiDailyPlanScreen } from '../screens/ai/AiDailyPlanScreen';
import { AiDailyReportScreen } from '../screens/ai/AiDailyReportScreen';
import { AiInsightsScreen } from '../screens/ai/AiInsightsScreen';

// Payments
import { PaymentsScreen } from '../screens/payments/PaymentsScreen';

// Settings
import { SettingsScreen } from '../screens/settings/SettingsScreen';

// Audit History
import { AuditHistoryScreen } from '../screens/audit/AuditHistoryScreen';

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
      <Tab.Screen name="Schools" component={SchoolsListScreen} options={{ tabBarIcon: TabIcon(Building2, C.primary) }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ tabBarIcon: TabIcon(Calendar, C.primary) }} />
      <Tab.Screen name="Tracking" component={MyDayTrackingScreen} options={{ tabBarLabel: 'My Day', tabBarIcon: TabIcon(MapPin, C.primary) }} />
      <Tab.Screen name="Targets" component={TargetsScreen} options={{ tabBarIcon: TabIcon(Target, C.primary) }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: TabIcon(Settings, C.primary) }} />
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
      <Tab.Screen name="MyTracking" component={MyDayTrackingScreen} options={{ tabBarLabel: 'My Day', tabBarIcon: TabIcon(Navigation, C.primary) }} />
      <Tab.Screen name="Tracking" component={LiveTrackingScreen} options={{ tabBarLabel: 'Live', tabBarIcon: TabIcon(MapPin, C.primary) }} />
      <Tab.Screen name="ManageUsers" component={UserManagementScreen} options={{ tabBarLabel: 'Users', tabBarIcon: TabIcon(UserPlus, C.primary) }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: TabIcon(Settings, C.primary) }} />
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
      <Tab.Screen name="MyTracking" component={MyDayTrackingScreen} options={{ tabBarLabel: 'My Day', tabBarIcon: TabIcon(Navigation, C.primary) }} />
      <Tab.Screen name="Tracking" component={LiveTrackingScreen} options={{ tabBarLabel: 'Live', tabBarIcon: TabIcon(MapPin, C.primary) }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: TabIcon(Settings, C.primary) }} />
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
      <Tab.Screen name="MyTracking" component={MyDayTrackingScreen} options={{ tabBarLabel: 'My Day', tabBarIcon: TabIcon(Navigation, C.primary) }} />
      <Tab.Screen name="Tracking" component={LiveTrackingScreen} options={{ tabBarLabel: 'Live', tabBarIcon: TabIcon(MapPin, C.primary) }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: TabIcon(Settings, C.primary) }} />
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

// ─── Offline Banner ───────────────────────────────────────────────────────────
function OfflineBanner() {
  const { isOnline, pendingCount } = useOffline();
  if (isOnline) return null;
  return (
    <View style={bannerStyles.bar}>
      <Text style={bannerStyles.text}>
        No internet — {pendingCount > 0 ? `${pendingCount} actions queued` : 'offline mode'}
      </Text>
    </View>
  );
}
const bannerStyles = StyleSheet.create({
  bar: {
    backgroundColor: '#DC2626', paddingVertical: 6, paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: { color: '#FFF', fontSize: 12, fontWeight: '600' },
});

// ─── Root Navigator ───────────────────────────────────────────────────────────
export const AppNavigator = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner fullScreen message="Loading..." />;

  const MainTabs = user ? getRoleNavigator(user.role) : null;

  return (
    <NavigationContainer>
      <OfflineBanner />
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs!} />

            {/* Leads */}
            <Stack.Screen name="LeadDetail" component={LeadDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AddLead" component={AddLeadScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="EditLead" component={AddLeadScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="CreateDeal" component={CreateDealScreen} options={{ animation: 'slide_from_bottom' }} />

            {/* Schools */}
            <Stack.Screen name="SchoolDetail" component={SchoolDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AddSchool" component={AddSchoolScreen} options={{ animation: 'slide_from_bottom' }} />

            {/* Contacts */}
            <Stack.Screen name="ContactDetail" component={ContactDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AddContact" component={AddContactScreen} options={{ animation: 'slide_from_bottom' }} />

            {/* Demos */}
            <Stack.Screen name="DemoList" component={DemoListScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="DemoDetail" component={DemoDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AssignDemo" component={AssignDemoScreen} options={{ animation: 'slide_from_bottom' }} />

            {/* Onboarding */}
            <Stack.Screen name="OnboardList" component={OnboardListScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="OnboardDetail" component={OnboardDetailScreen} options={{ animation: 'slide_from_right' }} />

            {/* Contacts List (standalone navigation) */}
            <Stack.Screen name="ContactsList" component={ContactsListScreen} options={{ animation: 'slide_from_right' }} />

            {/* Visit Report */}
            <Stack.Screen name="VisitReport" component={VisitReportScreen} options={{ animation: 'slide_from_bottom' }} />

            {/* AI */}
            <Stack.Screen name="AiDailyPlan" component={AiDailyPlanScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AiDailyReport" component={AiDailyReportScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AiInsights" component={AiInsightsScreen} options={{ animation: 'slide_from_right' }} />

            {/* Payments */}
            <Stack.Screen name="Payments" component={PaymentsScreen} options={{ animation: 'slide_from_right' }} />

            {/* Settings & Audit */}
            <Stack.Screen name="AuditHistory" component={AuditHistoryScreen} options={{ animation: 'slide_from_right' }} />

            {/* Misc */}
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Activities" component={ActivityLogScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="SchoolsList" component={SchoolsListScreen} options={{ animation: 'slide_from_right' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
