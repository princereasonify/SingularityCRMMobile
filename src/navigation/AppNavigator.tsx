import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, TouchableOpacity } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

export const navigationRef = createNavigationContainerRef<any>();
import { createDrawerNavigator } from '@react-navigation/drawer';
import {
  LayoutDashboard, Contact2, GitBranch,
  Target, TrendingUp, UserPlus, BarChart3, MapPin, Navigation,
  Building2, Settings, CreditCard, Monitor,
  ClipboardList, CalendarClock, CalendarDays,
  Activity, Briefcase, Menu, DollarSign, FileEdit, Home, Calculator,
} from 'lucide-react-native';
import { useOffline } from '../context/OfflineContext';
import { CustomDrawerContent } from '../components/common/CustomDrawerContent';
import messaging from '@react-native-firebase/messaging';
import { requestFCMPermission } from '../services/pushNotificationService';

import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../utils/constants';
import { rf } from '../utils/responsive';

// Auth
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';
import { DeleteAccountScreen } from '../screens/auth/DeleteAccountScreen';

// Dashboard
import { FODashboard } from '../screens/dashboard/FODashboard';
import { ZHDashboard } from '../screens/dashboard/ZHDashboard';
import { RHDashboard } from '../screens/dashboard/RHDashboard';
import { SHDashboard } from '../screens/dashboard/SHDashboard';
import { SCADashboard } from '../screens/dashboard/SCADashboard';

// Core screens
import { LeadsListScreen } from '../screens/leads/LeadsListScreen';
import { LeadDetailScreen } from '../screens/leads/LeadDetailScreen';
import { AddLeadScreen } from '../screens/leads/AddLeadScreen';
import { ActivityLogScreen } from '../screens/activities/ActivityLogScreen';
import { CreateDealScreen } from '../screens/deals/CreateDealScreen';
import { DealEstimateScreen } from '../screens/deals/DealEstimateScreen';
import { PipelineScreen } from '../screens/pipeline/PipelineScreen';
import { TargetsScreen } from '../screens/targets/TargetsScreen';
import { PerformanceScreen } from '../screens/performance/PerformanceScreen';
import { ReportsScreen } from '../screens/reports/ReportsScreen';
import { UserManagementScreen } from '../screens/users/UserManagementScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { MyDayTrackingScreen } from '../screens/tracking/MyDayTrackingScreen';
import { LiveTrackingScreen } from '../screens/tracking/LiveTrackingScreen';
import { AssignedSchoolsScreen } from '../screens/tracking/AssignedSchoolsScreen';
import { RoutePlannerScreen } from '../screens/tracking/RoutePlannerScreen';

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
import { ScaPaymentsScreen } from '../screens/payments/ScaPaymentsScreen';

// Settings
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { DashboardCustomizeScreen } from '../screens/settings/DashboardCustomizeScreen';
import { UserManualScreen } from '../screens/settings/UserManualScreen';
import { AllowanceConfigScreen } from '../screens/settings/AllowanceConfigScreen';
import { VisitFieldConfigScreen } from '../screens/settings/VisitFieldConfigScreen';
import { HomeLocationScreen } from '../screens/settings/HomeLocationScreen';

// Audit History
import { AuditHistoryScreen } from '../screens/audit/AuditHistoryScreen';

// Weekly Plan
import { WeeklyPlanScreen } from '../screens/weeklyPlan/WeeklyPlanScreen';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

const DrawerIcon =
  (IconComponent: any, size = 20) =>
  ({ focused, color: c }: any) =>
    <IconComponent size={size} color={c} strokeWidth={focused ? 2.5 : 1.8} />;

const drawerStyle = (primaryColor: string) => ({
  headerShown: false,
  headerTitleStyle: { fontSize: rf(14), fontWeight: '700' as const },
  headerStyle: { backgroundColor: '#FFF' },
  headerTintColor: '#111827',
  headerShadowVisible: false,
  headerTitleAlign: 'center' as const,
  drawerActiveTintColor: primaryColor,
  drawerInactiveTintColor: '#6B7280',
  drawerLabelStyle: { fontSize: rf(12), fontWeight: '600' as const },
  drawerStyle: { backgroundColor: '#FFF' },
  drawerType: 'front' as const,
  overlayColor: 'rgba(17,24,39,0.25)',
  sceneContainerStyle: { backgroundColor: '#F8FAFC' },
});

const withHeader = { headerShown: true as const };

const withDrawerHeader =
  (primaryColor: string) =>
  ({ navigation }: any) => ({
    ...drawerStyle(primaryColor),
    headerLeft: () => (
      <Pressable
        onPress={() => navigation.toggleDrawer()}
        style={({ pressed }) => [
          navStyles.headerLeftButton,
          pressed && navStyles.headerLeftButtonPressed,
        ]}
        android_ripple={{ color: 'rgba(17,24,39,0.08)', borderless: true }}
        hitSlop={12}
      >
        <View style={navStyles.headerLeftIconWrap}>
          <Menu size={20} color={primaryColor} />
        </View>
      </Pressable>
    ),
  });

const navStyles = StyleSheet.create({
  headerLeftButton: {
    marginLeft: 12,
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  headerLeftButtonPressed: { opacity: 0.6 },
  headerLeftIconWrap: { alignItems: 'center', justifyContent: 'center' },
});

// ─── FO Drawer Navigator ──────────────────────────────────────────────────────
function FODrawer() {
  const C = ROLE_COLORS.FO;
  return (
    <Drawer.Navigator
      screenOptions={withDrawerHeader(C.primary)}
      drawerContent={CustomDrawerContent}
      initialRouteName="Dashboard"
    >
      <Drawer.Screen name="Dashboard" component={FODashboard} options={{ drawerIcon: DrawerIcon(LayoutDashboard) }} />
      <Drawer.Screen name="Schools" component={SchoolsListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Building2) }} />
      <Drawer.Screen name="Leads" component={LeadsListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Contact2) }} />
      <Drawer.Screen name="Demos" component={DemoListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Monitor) }} />
      <Drawer.Screen name="Pipeline" component={PipelineScreen} options={{ drawerIcon: DrawerIcon(GitBranch) }} />
      <Drawer.Screen name="Activity" component={ActivityLogScreen} options={{ drawerIcon: DrawerIcon(Activity) }} />
      <Drawer.Screen name="New Deal" component={CreateDealScreen} options={{ drawerIcon: DrawerIcon(Briefcase) }} />
      <Drawer.Screen name="My Day" component={MyDayTrackingScreen} options={{ drawerIcon: DrawerIcon(MapPin) }} />
      <Drawer.Screen name="Route Planner" component={RoutePlannerScreen} options={{ drawerIcon: DrawerIcon(Navigation) }} />
      <Drawer.Screen name="Calendar" component={CalendarScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(CalendarDays) }} />
      <Drawer.Screen name="My Targets" component={TargetsScreen} options={{ drawerIcon: DrawerIcon(Target) }} />
      <Drawer.Screen name="My Stats" component={PerformanceScreen} options={{ drawerIcon: DrawerIcon(TrendingUp) }} />
      <Drawer.Screen name="Reports" component={ReportsScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(BarChart3) }} />
      <Drawer.Screen name="Week Plan" component={WeeklyPlanScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(CalendarClock) }} />
      <Drawer.Screen name="Deal Estimate" component={DealEstimateScreen} options={{ drawerIcon: DrawerIcon(Calculator) }} />
      <Drawer.Screen name="Home Location" component={HomeLocationScreen} options={{ drawerIcon: DrawerIcon(Home) }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Settings) }} />
    </Drawer.Navigator>
  );
}

// ─── ZH Drawer Navigator ──────────────────────────────────────────────────────
function ZHDrawer() {
  const C = ROLE_COLORS.ZH;
  return (
    <Drawer.Navigator screenOptions={withDrawerHeader(C.primary)} drawerContent={CustomDrawerContent} initialRouteName="Dashboard">
      <Drawer.Screen name="Dashboard" component={ZHDashboard} options={{ drawerIcon: DrawerIcon(LayoutDashboard) }} />
      <Drawer.Screen name="Leads" component={LeadsListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Contact2) }} />
      <Drawer.Screen name="Schools" component={SchoolsListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Building2) }} />
      <Drawer.Screen name="Demos" component={DemoListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Monitor) }} />
      <Drawer.Screen name="Pipeline" component={PipelineScreen} options={{ drawerIcon: DrawerIcon(GitBranch) }} />
      <Drawer.Screen name="New Deal" component={CreateDealScreen} options={{ drawerIcon: DrawerIcon(Briefcase) }} />
      <Drawer.Screen name="Onboard" component={OnboardListScreen} options={{ drawerIcon: DrawerIcon(ClipboardList) }} />
      <Drawer.Screen name="Reports" component={ReportsScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(BarChart3) }} />
      <Drawer.Screen name="Targets" component={TargetsScreen} options={{ drawerIcon: DrawerIcon(Target) }} />
      <Drawer.Screen name="Team" component={PerformanceScreen} options={{ drawerIcon: DrawerIcon(TrendingUp) }} />
      <Drawer.Screen name="My Day" component={MyDayTrackingScreen} options={{ drawerIcon: DrawerIcon(Navigation) }} />
      <Drawer.Screen name="Live" component={LiveTrackingScreen} options={{ drawerIcon: DrawerIcon(MapPin) }} />
      <Drawer.Screen name="Users" component={UserManagementScreen} options={{ drawerIcon: DrawerIcon(UserPlus) }} />
      <Drawer.Screen name="Week Plan" component={WeeklyPlanScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(CalendarClock) }} />
      <Drawer.Screen name="Calendar" component={CalendarScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(CalendarDays) }} />
      <Drawer.Screen name="Deal Estimate" component={DealEstimateScreen} options={{ drawerIcon: DrawerIcon(Calculator) }} />
      <Drawer.Screen name="Home Location" component={HomeLocationScreen} options={{ drawerIcon: DrawerIcon(Home) }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Settings) }} />
    </Drawer.Navigator>
  );
}

// ─── RH Drawer Navigator ──────────────────────────────────────────────────────
function RHDrawer() {
  const C = ROLE_COLORS.RH;
  return (
    <Drawer.Navigator screenOptions={withDrawerHeader(C.primary)} drawerContent={CustomDrawerContent} initialRouteName="Dashboard">
      <Drawer.Screen name="Dashboard" component={RHDashboard} options={{ drawerIcon: DrawerIcon(LayoutDashboard) }} />
      <Drawer.Screen name="Leads" component={LeadsListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Contact2) }} />
      <Drawer.Screen name="Schools" component={SchoolsListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Building2) }} />
      <Drawer.Screen name="Demos" component={DemoListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Monitor) }} />
      <Drawer.Screen name="Pipeline" component={PipelineScreen} options={{ drawerIcon: DrawerIcon(GitBranch) }} />
      <Drawer.Screen name="New Deal" component={CreateDealScreen} options={{ drawerIcon: DrawerIcon(Briefcase) }} />
      <Drawer.Screen name="Onboard" component={OnboardListScreen} options={{ drawerIcon: DrawerIcon(ClipboardList) }} />
      <Drawer.Screen name="Reports" component={ReportsScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(BarChart3) }} />
      <Drawer.Screen name="Targets" component={TargetsScreen} options={{ drawerIcon: DrawerIcon(Target) }} />
      <Drawer.Screen name="Team" component={PerformanceScreen} options={{ drawerIcon: DrawerIcon(TrendingUp) }} />
      <Drawer.Screen name="My Day" component={MyDayTrackingScreen} options={{ drawerIcon: DrawerIcon(Navigation) }} />
      <Drawer.Screen name="Live" component={LiveTrackingScreen} options={{ drawerIcon: DrawerIcon(MapPin) }} />
      <Drawer.Screen name="Users" component={UserManagementScreen} options={{ drawerIcon: DrawerIcon(UserPlus) }} />
      <Drawer.Screen name="Week Plan" component={WeeklyPlanScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(CalendarClock) }} />
      <Drawer.Screen name="Calendar" component={CalendarScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(CalendarDays) }} />
      <Drawer.Screen name="Deal Estimate" component={DealEstimateScreen} options={{ drawerIcon: DrawerIcon(Calculator) }} />
      <Drawer.Screen name="Home Location" component={HomeLocationScreen} options={{ drawerIcon: DrawerIcon(Home) }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Settings) }} />
    </Drawer.Navigator>
  );
}

// ─── SH Drawer Navigator ──────────────────────────────────────────────────────
function SHDrawer() {
  const C = ROLE_COLORS.SH;
  return (
    <Drawer.Navigator screenOptions={withDrawerHeader(C.primary)} drawerContent={CustomDrawerContent} initialRouteName="Dashboard">
      <Drawer.Screen name="Dashboard" component={SHDashboard} options={{ drawerIcon: DrawerIcon(LayoutDashboard) }} />
      <Drawer.Screen name="Leads" component={LeadsListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Contact2) }} />
      <Drawer.Screen name="Schools" component={SchoolsListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Building2) }} />
      <Drawer.Screen name="Demos" component={DemoListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Monitor) }} />
      <Drawer.Screen name="Pipeline" component={PipelineScreen} options={{ drawerIcon: DrawerIcon(GitBranch) }} />
      <Drawer.Screen name="New Deal" component={CreateDealScreen} options={{ drawerIcon: DrawerIcon(Briefcase) }} />
      <Drawer.Screen name="Onboard" component={OnboardListScreen} options={{ drawerIcon: DrawerIcon(ClipboardList) }} />
      <Drawer.Screen name="Reports" component={ReportsScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(BarChart3) }} />
      <Drawer.Screen name="Targets" component={TargetsScreen} options={{ drawerIcon: DrawerIcon(Target) }} />
      <Drawer.Screen name="Team" component={PerformanceScreen} options={{ drawerIcon: DrawerIcon(TrendingUp) }} />
      <Drawer.Screen name="My Day" component={MyDayTrackingScreen} options={{ drawerIcon: DrawerIcon(Navigation) }} />
      <Drawer.Screen name="Live" component={LiveTrackingScreen} options={{ drawerIcon: DrawerIcon(MapPin) }} />
      <Drawer.Screen name="Users" component={UserManagementScreen} options={{ drawerIcon: DrawerIcon(UserPlus) }} />
      <Drawer.Screen name="Week Plan" component={WeeklyPlanScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(CalendarClock) }} />
      <Drawer.Screen name="Calendar" component={CalendarScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(CalendarDays) }} />
      <Drawer.Screen name="Allowance" component={AllowanceConfigScreen} options={{ drawerIcon: DrawerIcon(DollarSign) }} />
      <Drawer.Screen name="Visit Fields" component={VisitFieldConfigScreen} options={{ drawerIcon: DrawerIcon(FileEdit) }} />
      <Drawer.Screen name="Deal Estimate" component={DealEstimateScreen} options={{ drawerIcon: DrawerIcon(Calculator) }} />
      <Drawer.Screen name="Home Location" component={HomeLocationScreen} options={{ drawerIcon: DrawerIcon(Home) }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Settings) }} />
    </Drawer.Navigator>
  );
}

// ─── SCA Drawer Navigator ─────────────────────────────────────────────────────
function SCADrawer() {
  const C = ROLE_COLORS.SCA;
  return (
    <Drawer.Navigator screenOptions={withDrawerHeader(C.primary)} drawerContent={CustomDrawerContent} initialRouteName="Dashboard">
      <Drawer.Screen name="Dashboard" component={SCADashboard} options={{ drawerIcon: DrawerIcon(LayoutDashboard) }} />
      <Drawer.Screen name="Schools" component={SchoolsListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Building2) }} />
      <Drawer.Screen name="Leads" component={LeadsListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Contact2) }} />
      <Drawer.Screen name="Demos" component={DemoListScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Monitor) }} />
      <Drawer.Screen name="Pipeline" component={PipelineScreen} options={{ drawerIcon: DrawerIcon(GitBranch) }} />
      <Drawer.Screen name="New Deal" component={CreateDealScreen} options={{ drawerIcon: DrawerIcon(Briefcase) }} />
      <Drawer.Screen name="Onboard" component={OnboardListScreen} options={{ drawerIcon: DrawerIcon(ClipboardList) }} />
      <Drawer.Screen name="Calendar" component={CalendarScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(CalendarDays) }} />
      <Drawer.Screen name="Reports" component={ReportsScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(BarChart3) }} />
      <Drawer.Screen name="Gateway" component={ScaPaymentsScreen} options={{ drawerIcon: DrawerIcon(CreditCard) }} />
      <Drawer.Screen name="Targets" component={TargetsScreen} options={{ drawerIcon: DrawerIcon(Target) }} />
      <Drawer.Screen name="Team" component={PerformanceScreen} options={{ drawerIcon: DrawerIcon(TrendingUp) }} />
      <Drawer.Screen name="Live" component={LiveTrackingScreen} options={{ drawerIcon: DrawerIcon(MapPin) }} />
      <Drawer.Screen name="Week Plan" component={WeeklyPlanScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(CalendarClock) }} />
      <Drawer.Screen name="Users" component={UserManagementScreen} options={{ drawerIcon: DrawerIcon(UserPlus) }} />
      <Drawer.Screen name="Allowance" component={AllowanceConfigScreen} options={{ drawerIcon: DrawerIcon(DollarSign) }} />
      <Drawer.Screen name="Visit Fields" component={VisitFieldConfigScreen} options={{ drawerIcon: DrawerIcon(FileEdit) }} />
      <Drawer.Screen name="Deal Estimate" component={DealEstimateScreen} options={{ drawerIcon: DrawerIcon(Calculator) }} />
      <Drawer.Screen name="Home Location" component={HomeLocationScreen} options={{ drawerIcon: DrawerIcon(Home) }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ ...withHeader, drawerIcon: DrawerIcon(Settings) }} />
    </Drawer.Navigator>
  );
}

const getRoleNavigator = (role: string) => {
  switch (role) {
    case 'ZH':  return ZHDrawer;
    case 'RH':  return RHDrawer;
    case 'SH':  return SHDrawer;
    case 'SCA': return SCADrawer;
    default:    return FODrawer;
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

// ─── Notification Permission Banner ──────────────────────────────────────────
function NotifPermBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    messaging().hasPermission().then((status) => {
      const granted =
        status === messaging.AuthorizationStatus.AUTHORIZED ||
        status === messaging.AuthorizationStatus.PROVISIONAL;
      if (!granted) setVisible(true);
    }).catch(() => {});
  }, []);

  if (!visible) return null;

  const handleEnable = async () => {
    try {
      await requestFCMPermission();
    } catch {}
    setVisible(false);
  };

  return (
    <View style={notifBannerStyles.bar}>
      <Text style={notifBannerStyles.text} numberOfLines={2}>
        Enable push notifications to stay updated on leads, deals, and approvals
      </Text>
      <View style={notifBannerStyles.actions}>
        <TouchableOpacity style={notifBannerStyles.enableBtn} onPress={handleEnable}>
          <Text style={notifBannerStyles.enableText}>Enable</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setVisible(false)} hitSlop={8}>
          <Text style={notifBannerStyles.dismissText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const notifBannerStyles = StyleSheet.create({
  bar: {
    backgroundColor: '#0D9488',
    paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  text: { flex: 1, color: '#FFF', fontSize: rf(12), fontWeight: '500' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  enableBtn: {
    backgroundColor: '#FFF', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  enableText: { color: '#0D9488', fontSize: rf(12), fontWeight: '700' },
  dismissText: { color: '#FFF', fontSize: rf(14), fontWeight: '600' },
});

// ─── Root Navigator ───────────────────────────────────────────────────────────
export const AppNavigator = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner fullScreen message="Loading..." />;

  const MainTabs = user ? getRoleNavigator(user.role) : null;

  return (
    <NavigationContainer ref={navigationRef}>
      <OfflineBanner />
      {user && <NotifPermBanner />}
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ animation: 'slide_from_bottom' }} />
          </>
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

            {/* Tracking & Route */}
            <Stack.Screen name="AssignedSchools" component={AssignedSchoolsScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="RoutePlanner" component={RoutePlannerScreen} options={{ animation: 'slide_from_right' }} />

            {/* Visit Report */}
            <Stack.Screen name="VisitReport" component={VisitReportScreen} options={{ animation: 'slide_from_bottom' }} />

            {/* AI */}
            <Stack.Screen name="AiDailyPlan" component={AiDailyPlanScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AiDailyReport" component={AiDailyReportScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AiInsights" component={AiInsightsScreen} options={{ animation: 'slide_from_right' }} />

            {/* Payments */}
            <Stack.Screen name="Payments" component={PaymentsScreen} options={{ animation: 'slide_from_right' }} />

            {/* Admin config (SH) */}
            <Stack.Screen name="AllowanceConfig" component={AllowanceConfigScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="VisitFieldConfig" component={VisitFieldConfigScreen} options={{ animation: 'slide_from_right' }} />

            {/* Settings & Audit */}
            <Stack.Screen name="DashboardCustomize" component={DashboardCustomizeScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="UserManual" component={UserManualScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AuditHistory" component={AuditHistoryScreen} options={{ animation: 'slide_from_right' }} />

            {/* Misc */}
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Activities" component={ActivityLogScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="SchoolsList" component={SchoolsListScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Calendar" component={CalendarScreen} options={{ animation: 'slide_from_right' }} />

            {/* Weekly Plan */}
            <Stack.Screen name="WeeklyPlanScreen" component={WeeklyPlanScreen} options={{ animation: 'slide_from_right' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
