import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, TouchableOpacity } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { applyLoginOrientation, applyAuthedOrientation } from '../utils/orientation';

export const navigationRef = createNavigationContainerRef<any>();
import { createDrawerNavigator } from '@react-navigation/drawer';
import {
  LayoutDashboard, Contact2, GitBranch,
  Target, TrendingUp, UserPlus, BarChart3, MapPin, Navigation,
  Building2, Settings, CreditCard, Monitor,
  ClipboardList, CalendarClock, CalendarDays,
  Activity, Briefcase, Menu, DollarSign, FileEdit, Home, Calculator,
  CalendarOff, Wallet, Map, Library, Users,
} from 'lucide-react-native';
import { useOffline } from '../context/OfflineContext';
import { CustomDrawerContent } from '../components/common/CustomDrawerContent';
import messaging from '@react-native-firebase/messaging';
import { requestFCMPermission } from '../services/pushNotificationService';

import { useAuth } from '../context/AuthContext';
import { RoleSplash } from '../components/splash/RoleSplash';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ROLE_COLORS } from '../utils/constants';
import { rf, isTabletDevice } from '../utils/responsive';

// Auth
import { LandingScreen } from '../screens/auth/LandingScreen';
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

// Contacts: no standalone screens — contacts are managed inside SchoolDetail,
// mirroring web. The files under screens/contacts/ are unreachable dead code.

// Demos
import { DemoListScreen } from '../screens/demos/DemoListScreen';
import { DemoDetailScreen } from '../screens/demos/DemoDetailScreen';
import { AssignDemoScreen } from '../screens/demos/AssignDemoScreen';
import { RecordDemoScreen } from '../screens/demos/RecordDemoScreen';

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
import { AppSidebar, SIDEBAR_W, SIDEBAR_RAIL_W, SIDEBAR_PHONE_W } from '../components/layout/AppSidebar';
import { AppTopbar } from '../components/layout/AppTopbar';
import { GradientBackground } from '../components/common/GradientBackground';
import { Sunstone } from '../theme';
import { useAppTheme } from '../theme/useAppTheme';

// Settings
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { ProfileScreen } from '../screens/settings/ProfileScreen';
import { UserManualScreen } from '../screens/settings/UserManualScreen';
import { AllowanceConfigScreen } from '../screens/settings/AllowanceConfigScreen';
import { VisitFieldConfigScreen } from '../screens/settings/VisitFieldConfigScreen';
import { HomeLocationScreen } from '../screens/settings/HomeLocationScreen';

// Audit History
import { AuditHistoryScreen } from '../screens/audit/AuditHistoryScreen';

// Weekly Plan
import { WeeklyPlanScreen } from '../screens/weeklyPlan/WeeklyPlanScreen';

// New feature screens
import { LeaveManagementScreen } from '../screens/leaves/LeaveManagementScreen';
import { AllowancesScreen } from '../screens/allowances/AllowancesScreen';
import { RegionsZonesScreen } from '../screens/regionsZones/RegionsZonesScreen';
import { TeamManagementScreen } from '../screens/team/TeamManagementScreen';

// ─── B2C (student enrollment) screens ─────────────────────────────────────────
import { B2CAdminDashboard } from '../screens/b2c/B2CAdminDashboard';
import { AgentDashboard } from '../screens/b2c/AgentDashboard';
import { CounselorDashboard } from '../screens/b2c/CounselorDashboard';
import { B2CLeadsListScreen } from '../screens/b2c/B2CLeadsListScreen';
import { B2CLeadDetailScreen } from '../screens/b2c/B2CLeadDetailScreen';
import { B2CAddLeadScreen } from '../screens/b2c/B2CAddLeadScreen';
import { B2CCounselorsListScreen } from '../screens/b2c/B2CCounselorsListScreen';
import { B2CBillingScreen } from '../screens/b2c/B2CBillingScreen';
import { B2CAgentVisitScreen } from '../screens/b2c/B2CAgentVisitScreen';
import { B2CCounselorRecordingScreen } from '../screens/b2c/B2CCounselorRecordingScreen';
import { B2CAiCoachScreen } from '../screens/b2c/B2CAiCoachScreen';
// B2C phase-1 stub screens (mirror the web B2C sidebars).
import { B2CPipelineScreen } from '../screens/b2c/B2CPipelineScreen';
import { B2CUserManagementScreen } from '../screens/b2c/B2CUserManagementScreen';
import { B2CApprovalCenterScreen } from '../screens/b2c/B2CApprovalCenterScreen';
import { B2CLiveTrackingScreen } from '../screens/b2c/B2CLiveTrackingScreen';
import { B2CGeoComplianceScreen } from '../screens/b2c/B2CGeoComplianceScreen';
import { B2CReportsScreen } from '../screens/b2c/B2CReportsScreen';
import { B2CCounselingScreen } from '../screens/b2c/B2CCounselingScreen';
import { B2CCalendarScreen } from '../screens/b2c/B2CCalendarScreen';
import { B2CMyDayScreen } from '../screens/b2c/B2CMyDayScreen';
import { B2CRoutePlannerScreen } from '../screens/b2c/B2CRoutePlannerScreen';
import { B2CActivityLogScreen } from '../screens/b2c/B2CActivityLogScreen';
import { B2CMyLeavesScreen } from '../screens/b2c/B2CMyLeavesScreen';
import { B2CMyAllowancesScreen } from '../screens/b2c/B2CMyAllowancesScreen';
import { B2CMyExpensesScreen } from '../screens/b2c/B2CMyExpensesScreen';
import { B2CMyPerformanceScreen } from '../screens/b2c/B2CMyPerformanceScreen';
import { B2CWeeklyPlanScreen } from '../screens/b2c/B2CWeeklyPlanScreen';
import { B2CReengagementScreen } from '../screens/b2c/B2CReengagementScreen';
import { B2CTeamScreen } from '../screens/b2c/B2CTeamScreen';
import { B2CTeamLeadsScreen } from '../screens/b2c/B2CTeamLeadsScreen';
import { B2CTeamTrackingScreen } from '../screens/b2c/B2CTeamTrackingScreen';
import { B2CTeamApprovalsScreen } from '../screens/b2c/B2CTeamApprovalsScreen';
import { B2CConvertScreen } from '../screens/b2c/B2CConvertScreen';

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
/**
 * FO shell — the new sidebar + topbar (SingularityCRM-Components.html).
 *   iPad : sidebar is PERMANENT, 240 expanded / 76 rail via the collapse chip.
 *   Phone: sidebar is a 280 slide-over behind a scrim, opened by the topbar hamburger.
 * Screen order/grouping lives in navConfig.ts (mirrors the web sidebar).
 */
function FODrawer() {
  const T = useAppTheme();
  const [collapsed, setCollapsed] = useState(false);
  const permanent = isTabletDevice;

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(p) => (
        <AppSidebar {...p} collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
      )}
      screenOptions={({ navigation, route }) => ({
        headerShown: true,
        header: () => (
          <AppTopbar
            title={route.name}
            onMenu={() => navigation.openDrawer()}
            onNotifications={() => navigation.navigate('Notifications' as never)}
            onProfile={() => navigation.navigate('Profile' as never)}
            onSettings={() => navigation.navigate('Settings' as never)}
          />
        ),
        drawerType: permanent ? 'permanent' : 'front',
        drawerStyle: {
          width: permanent ? (collapsed ? SIDEBAR_RAIL_W : SIDEBAR_W) : SIDEBAR_PHONE_W,
          borderRightWidth: 0,
        },
        overlayColor: 'rgba(0,0,0,0.4)',
        sceneContainerStyle: { backgroundColor: T.bg },
        swipeEnabled: !permanent,
      })}
    >
      <Drawer.Screen name="Dashboard" component={FODashboard} />
      <Drawer.Screen name="Schools" component={SchoolsListScreen} />
      <Drawer.Screen name="Leads" component={LeadsListScreen} />
      <Drawer.Screen name="Pipeline" component={PipelineScreen} />
      <Drawer.Screen name="Deal Estimate" component={DealEstimateScreen} />
      <Drawer.Screen name="Create Deal" component={CreateDealScreen} />
      <Drawer.Screen name="Activity Log" component={ActivityLogScreen} />
      <Drawer.Screen name="Demos" component={DemoListScreen} />
      <Drawer.Screen name="Record Demo" component={RecordDemoScreen} />
      <Drawer.Screen name="Route Planner" component={RoutePlannerScreen} />
      <Drawer.Screen name="Calendar" component={CalendarScreen} />
      <Drawer.Screen name="My Tracking" component={MyDayTrackingScreen} />
      <Drawer.Screen name="Home Location" component={HomeLocationScreen} />
      <Drawer.Screen name="Weekly Plan" component={WeeklyPlanScreen} />
      <Drawer.Screen name="Payment Integration" component={PaymentsScreen} />
      <Drawer.Screen name="My Targets" component={TargetsScreen} />
      <Drawer.Screen name="My Performance" component={PerformanceScreen} />
      <Drawer.Screen name="Allowances" component={AllowancesScreen} />
      <Drawer.Screen name="Leaves" component={LeaveManagementScreen} />
      <Drawer.Screen name="Reports" component={ReportsScreen} />
      {/* Both reachable from the topbar profile dropdown, not the sidebar (per spec).
          "My profile" = identity/org; "Settings" = preferences. They used to point
          at the same screen, which made the two menu entries indistinguishable. */}
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer.Navigator>
  );
}

// ─── ZH Drawer Navigator ──────────────────────────────────────────────────────
function ZHDrawer() {
  const T = useAppTheme();
  const [collapsed, setCollapsed] = useState(false);
  const permanent = isTabletDevice;

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(p) => (
        <AppSidebar {...p} collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
      )}
      screenOptions={({ navigation, route }) => ({
        headerShown: true,
        header: () => (
          <AppTopbar
            title={route.name}
            onMenu={() => navigation.openDrawer()}
            onNotifications={() => navigation.navigate('Notifications' as never)}
            onProfile={() => navigation.navigate('Profile' as never)}
            onSettings={() => navigation.navigate('Settings' as never)}
          />
        ),
        drawerType: permanent ? 'permanent' : 'front',
        drawerStyle: {
          width: permanent ? (collapsed ? SIDEBAR_RAIL_W : SIDEBAR_W) : SIDEBAR_PHONE_W,
          borderRightWidth: 0,
        },
        overlayColor: 'rgba(0,0,0,0.4)',
        sceneContainerStyle: { backgroundColor: T.bg },
        swipeEnabled: !permanent,
      })}
    >
      {/* Order and membership mirror web's Sidebar.jsx ZH array exactly (20 items).
          Record Demo and Payment Integration are new here — both screens already
          existed but had no ZH drawer entry, so ZH could not reach them at all. */}
      <Drawer.Screen name="Dashboard" component={ZHDashboard} />
      <Drawer.Screen name="Team" component={TeamManagementScreen} />
      <Drawer.Screen name="Schools" component={SchoolsListScreen} />
      <Drawer.Screen name="All Leads" component={LeadsListScreen} />
      <Drawer.Screen name="Pipeline" component={PipelineScreen} />
      <Drawer.Screen name="Deal Estimate" component={DealEstimateScreen} />
      <Drawer.Screen name="Create Deal" component={CreateDealScreen} />
      <Drawer.Screen name="Demo Management" component={DemoListScreen} />
      <Drawer.Screen name="Record Demo" component={RecordDemoScreen} />
      <Drawer.Screen name="Onboarding" component={OnboardListScreen} />
      <Drawer.Screen name="Calendar" component={CalendarScreen} />
      <Drawer.Screen name="Live Tracking" component={LiveTrackingScreen} />
      <Drawer.Screen name="Home Location" component={HomeLocationScreen} />
      <Drawer.Screen name="Weekly Plan" component={WeeklyPlanScreen} />
      <Drawer.Screen name="Payment Integration" component={PaymentsScreen} />
      <Drawer.Screen name="Targets" component={TargetsScreen} />
      <Drawer.Screen name="Allowances" component={AllowancesScreen} />
      <Drawer.Screen name="Leaves" component={LeaveManagementScreen} />
      <Drawer.Screen name="Reports" component={ReportsScreen} />
      <Drawer.Screen name="Manage Users" component={UserManagementScreen} />

      {/* Reached from the topbar profile menu, not the sidebar — same as FO. */}
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer.Navigator>
  );
}

// ─── RH Drawer Navigator ──────────────────────────────────────────────────────
function RHDrawer() {
  const T = useAppTheme();
  const [collapsed, setCollapsed] = useState(false);
  const permanent = isTabletDevice;

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(p) => (
        <AppSidebar {...p} collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
      )}
      screenOptions={({ navigation, route }) => ({
        headerShown: true,
        header: () => (
          <AppTopbar
            title={route.name}
            onMenu={() => navigation.openDrawer()}
            onNotifications={() => navigation.navigate('Notifications' as never)}
            onProfile={() => navigation.navigate('Profile' as never)}
            onSettings={() => navigation.navigate('Settings' as never)}
          />
        ),
        drawerType: permanent ? 'permanent' : 'front',
        drawerStyle: {
          width: permanent ? (collapsed ? SIDEBAR_RAIL_W : SIDEBAR_W) : SIDEBAR_PHONE_W,
          borderRightWidth: 0,
        },
        overlayColor: 'rgba(0,0,0,0.4)',
        sceneContainerStyle: { backgroundColor: T.bg },
        swipeEnabled: !permanent,
      })}
    >
      {/* Order + membership mirror web's Sidebar.jsx RH array, plus Team (which the
          backend supports for RH and mobile already had). Record Demo and Payment
          Integration are new here — both screens existed but had no RH drawer entry. */}
      <Drawer.Screen name="Dashboard" component={RHDashboard} />
      <Drawer.Screen name="Team" component={TeamManagementScreen} />
      <Drawer.Screen name="Schools" component={SchoolsListScreen} />
      <Drawer.Screen name="Leads" component={LeadsListScreen} />
      <Drawer.Screen name="Pipeline" component={PipelineScreen} />
      <Drawer.Screen name="Deal Estimate" component={DealEstimateScreen} />
      <Drawer.Screen name="Create Deal" component={CreateDealScreen} />
      <Drawer.Screen name="Demo Management" component={DemoListScreen} />
      <Drawer.Screen name="Record Demo" component={RecordDemoScreen} />
      <Drawer.Screen name="Onboarding" component={OnboardListScreen} />
      <Drawer.Screen name="Calendar" component={CalendarScreen} />
      <Drawer.Screen name="Live Tracking" component={LiveTrackingScreen} />
      <Drawer.Screen name="Home Location" component={HomeLocationScreen} />
      <Drawer.Screen name="Weekly Plan" component={WeeklyPlanScreen} />
      <Drawer.Screen name="Payment Integration" component={PaymentsScreen} />
      <Drawer.Screen name="Targets" component={TargetsScreen} />
      <Drawer.Screen name="Allowances" component={AllowancesScreen} />
      <Drawer.Screen name="Leaves" component={LeaveManagementScreen} />
      <Drawer.Screen name="Reports" component={ReportsScreen} />
      <Drawer.Screen name="Regions & Zones" component={RegionsZonesScreen} />
      <Drawer.Screen name="Manage Users" component={UserManagementScreen} />

      {/* Reached from the topbar profile menu, not the sidebar — same as FO/ZH. */}
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer.Navigator>
  );
}

function SHDrawer() {
  const T = useAppTheme();
  const [collapsed, setCollapsed] = useState(false);
  const permanent = isTabletDevice;

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(p) => (
        <AppSidebar {...p} collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
      )}
      screenOptions={({ navigation, route }) => ({
        headerShown: true,
        header: () => (
          <AppTopbar
            title={route.name}
            onMenu={() => navigation.openDrawer()}
            onNotifications={() => navigation.navigate('Notifications' as never)}
            onProfile={() => navigation.navigate('Profile' as never)}
            onSettings={() => navigation.navigate('Settings' as never)}
          />
        ),
        drawerType: permanent ? 'permanent' : 'front',
        drawerStyle: {
          width: permanent ? (collapsed ? SIDEBAR_RAIL_W : SIDEBAR_W) : SIDEBAR_PHONE_W,
          borderRightWidth: 0,
        },
        overlayColor: 'rgba(0,0,0,0.4)',
        sceneContainerStyle: { backgroundColor: T.bg },
        swipeEnabled: !permanent,
      })}
    >
      {/* Order + membership mirror web's Sidebar.jsx SH array, plus Team (backend supports
          it for SH). Migrated from the legacy drawer to the AppSidebar/AppTopbar shell so
          SH now gets the topbar Profile/Notifications/Settings like FO/ZH/RH. */}
      <Drawer.Screen name="Dashboard" component={SHDashboard} />
      <Drawer.Screen name="Team" component={TeamManagementScreen} />
      <Drawer.Screen name="Schools" component={SchoolsListScreen} />
      <Drawer.Screen name="All Leads" component={LeadsListScreen} />
      <Drawer.Screen name="Pipeline" component={PipelineScreen} />
      <Drawer.Screen name="Deal Estimate" component={DealEstimateScreen} />
      <Drawer.Screen name="Create Deal" component={CreateDealScreen} />
      <Drawer.Screen name="Demo Management" component={DemoListScreen} />
      <Drawer.Screen name="Record Demo" component={RecordDemoScreen} />
      <Drawer.Screen name="Onboarding" component={OnboardListScreen} />
      <Drawer.Screen name="Calendar" component={CalendarScreen} />
      <Drawer.Screen name="Live Tracking" component={LiveTrackingScreen} />
      <Drawer.Screen name="Home Location" component={HomeLocationScreen} />
      <Drawer.Screen name="Weekly Plan" component={WeeklyPlanScreen} />
      <Drawer.Screen name="Payment Integration" component={PaymentsScreen} />
      <Drawer.Screen name="Targets" component={TargetsScreen} />
      <Drawer.Screen name="Allowances" component={AllowancesScreen} />
      <Drawer.Screen name="Leaves" component={LeaveManagementScreen} />
      <Drawer.Screen name="Reports" component={ReportsScreen} />
      <Drawer.Screen name="Allowance Config" component={AllowanceConfigScreen} />
      <Drawer.Screen name="Visit Fields" component={VisitFieldConfigScreen} />
      <Drawer.Screen name="Regions & Zones" component={RegionsZonesScreen} />
      <Drawer.Screen name="Manage Users" component={UserManagementScreen} />

      {/* Reached from the topbar profile menu, not the sidebar — same as FO/ZH/RH. */}
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer.Navigator>
  );
}

// ─── SCA Drawer Navigator ─────────────────────────────────────────────────────
function SCADrawer() {
  const T = useAppTheme();
  const [collapsed, setCollapsed] = useState(false);
  const permanent = isTabletDevice;

  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(p) => (
        <AppSidebar {...p} collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />
      )}
      screenOptions={({ navigation, route }) => ({
        headerShown: true,
        header: () => (
          <AppTopbar
            title={route.name}
            onMenu={() => navigation.openDrawer()}
            onNotifications={() => navigation.navigate('Notifications' as never)}
            onProfile={() => navigation.navigate('Profile' as never)}
            onSettings={() => navigation.navigate('Settings' as never)}
          />
        ),
        drawerType: permanent ? 'permanent' : 'front',
        drawerStyle: {
          width: permanent ? (collapsed ? SIDEBAR_RAIL_W : SIDEBAR_W) : SIDEBAR_PHONE_W,
          borderRightWidth: 0,
        },
        overlayColor: 'rgba(0,0,0,0.4)',
        sceneContainerStyle: { backgroundColor: T.bg },
        swipeEnabled: !permanent,
      })}
    >
      {/* Order + membership mirror web's Sidebar.jsx SCA array. Payment Integration is the
          real gateway screen (the old "Deal Payments" direct-payment screen called
          endpoints the backend never served). Migrated to the AppSidebar/AppTopbar shell. */}
      <Drawer.Screen name="Dashboard" component={SCADashboard} />
      <Drawer.Screen name="Schools" component={SchoolsListScreen} />
      <Drawer.Screen name="All Leads" component={LeadsListScreen} />
      <Drawer.Screen name="Pipeline" component={PipelineScreen} />
      <Drawer.Screen name="Deal Estimate" component={DealEstimateScreen} />
      <Drawer.Screen name="Create Deal" component={CreateDealScreen} />
      <Drawer.Screen name="Demo Management" component={DemoListScreen} />
      <Drawer.Screen name="Record Demo" component={RecordDemoScreen} />
      <Drawer.Screen name="Onboarding" component={OnboardListScreen} />
      <Drawer.Screen name="Calendar" component={CalendarScreen} />
      <Drawer.Screen name="Live Tracking" component={LiveTrackingScreen} />
      <Drawer.Screen name="Home Location" component={HomeLocationScreen} />
      <Drawer.Screen name="Weekly Plan" component={WeeklyPlanScreen} />
      <Drawer.Screen name="Payment Integration" component={PaymentsScreen} />
      <Drawer.Screen name="Targets" component={TargetsScreen} />
      <Drawer.Screen name="Performance" component={PerformanceScreen} />
      <Drawer.Screen name="Allowances" component={AllowancesScreen} />
      <Drawer.Screen name="Leaves" component={LeaveManagementScreen} />
      <Drawer.Screen name="Reports" component={ReportsScreen} />
      <Drawer.Screen name="Allowance Config" component={AllowanceConfigScreen} />
      <Drawer.Screen name="Regions & Zones" component={RegionsZonesScreen} />
      <Drawer.Screen name="Manage Users" component={UserManagementScreen} />

      {/* Reached from the topbar profile menu, not the sidebar — same as FO/ZH/RH. */}
      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer.Navigator>
  );
}

// ─── B2C shell (identical AppSidebar/AppTopbar shell as the B2B drawers) ───────
const b2cScreenOptions = (T: ReturnType<typeof useAppTheme>, permanent: boolean, collapsed: boolean) =>
  ({ navigation, route }: any) => ({
    headerShown: true,
    header: () => (
      <AppTopbar
        title={route.name}
        onMenu={() => navigation.openDrawer()}
        onNotifications={() => navigation.navigate('Notifications' as never)}
        onProfile={() => navigation.navigate('Profile' as never)}
        onSettings={() => navigation.navigate('Settings' as never)}
      />
    ),
    drawerType: permanent ? ('permanent' as const) : ('front' as const),
    drawerStyle: {
      width: permanent ? (collapsed ? SIDEBAR_RAIL_W : SIDEBAR_W) : SIDEBAR_PHONE_W,
      borderRightWidth: 0,
    },
    overlayColor: 'rgba(0,0,0,0.4)',
    sceneContainerStyle: { backgroundColor: T.bg },
    swipeEnabled: !permanent,
  });

// ─── B2CAdmin Drawer ──────────────────────────────────────────────────────────
function B2CAdminDrawer() {
  const T = useAppTheme();
  const [collapsed, setCollapsed] = useState(false);
  const permanent = isTabletDevice;
  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(p) => <AppSidebar {...p} collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />}
      screenOptions={b2cScreenOptions(T, permanent, collapsed)}
    >
      {/* Names MUST equal navConfig B2CAdmin_NAV routes. Order mirrors web. */}
      <Drawer.Screen name="Dashboard" component={B2CAdminDashboard} />
      <Drawer.Screen name="Student Leads" component={B2CLeadsListScreen} />
      <Drawer.Screen name="Pipeline" component={B2CPipelineScreen} />
      <Drawer.Screen name="Counselors" component={B2CCounselorsListScreen} />
      <Drawer.Screen name="User Management" component={B2CUserManagementScreen} />
      <Drawer.Screen name="Approval Center" component={B2CApprovalCenterScreen} />
      <Drawer.Screen name="Live Tracking" component={B2CLiveTrackingScreen} />
      <Drawer.Screen name="Calendar" component={B2CCalendarScreen} />
      <Drawer.Screen name="Geo Compliance" component={B2CGeoComplianceScreen} />
      <Drawer.Screen name="Reports" component={B2CReportsScreen} />
      <Drawer.Screen name="Counseling" component={B2CCounselingScreen} />
      <Drawer.Screen name="Billing" component={B2CBillingScreen} />
      {/* Read-only counselor-quality overview (AI Coach) — reachable route, not in the sidebar. */}
      <Drawer.Screen name="B2CAiCoach" component={B2CAiCoachScreen} options={{ drawerItemStyle: { display: 'none' } }} />

      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer.Navigator>
  );
}

// ─── Agent Drawer ─────────────────────────────────────────────────────────────
function AgentDrawer() {
  const T = useAppTheme();
  const [collapsed, setCollapsed] = useState(false);
  const permanent = isTabletDevice;
  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(p) => <AppSidebar {...p} collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />}
      screenOptions={b2cScreenOptions(T, permanent, collapsed)}
    >
      {/* Names MUST equal navConfig Agent_NAV routes. Order mirrors web. */}
      <Drawer.Screen name="Dashboard" component={AgentDashboard} />
      <Drawer.Screen name="My Leads" component={B2CLeadsListScreen} />
      <Drawer.Screen name="Pipeline" component={B2CPipelineScreen} />
      <Drawer.Screen name="My Day" component={B2CMyDayScreen} />
      <Drawer.Screen name="Route Planner" component={B2CRoutePlannerScreen} />
      <Drawer.Screen name="Calendar" component={B2CCalendarScreen} />
      <Drawer.Screen name="Weekly Plan" component={B2CWeeklyPlanScreen} />
      <Drawer.Screen name="Activity Log" component={B2CActivityLogScreen} />
      <Drawer.Screen name="Leaves" component={B2CMyLeavesScreen} />
      <Drawer.Screen name="My Allowances" component={B2CMyAllowancesScreen} />
      <Drawer.Screen name="My Expenses" component={B2CMyExpensesScreen} />
      <Drawer.Screen name="My Performance" component={B2CMyPerformanceScreen} />
      {/* Native geo-verified visit capture. Also reachable from a lead's detail (with leadId). */}
      <Drawer.Screen name="Visit" component={B2CAgentVisitScreen} />

      {/* Manager (Agent + isManager) Team section. Registered here even though the
          sidebar shows them only when isManager (AppSidebar appends MANAGER_NAV). */}
      <Drawer.Screen name="My Team" component={B2CTeamScreen} />
      <Drawer.Screen name="Team Leads" component={B2CTeamLeadsScreen} />
      <Drawer.Screen name="Team Tracking" component={B2CTeamTrackingScreen} />
      <Drawer.Screen name="Team Approvals" component={B2CTeamApprovalsScreen} />

      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer.Navigator>
  );
}

// ─── Counselor Drawer ─────────────────────────────────────────────────────────
function CounselorDrawer() {
  const T = useAppTheme();
  const [collapsed, setCollapsed] = useState(false);
  const permanent = isTabletDevice;
  return (
    <Drawer.Navigator
      initialRouteName="Dashboard"
      drawerContent={(p) => <AppSidebar {...p} collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)} />}
      screenOptions={b2cScreenOptions(T, permanent, collapsed)}
    >
      {/* Names MUST equal navConfig Counselor_NAV routes. Order mirrors web. */}
      <Drawer.Screen name="Dashboard" component={CounselorDashboard} />
      <Drawer.Screen name="Re-engagement Queue" component={B2CReengagementScreen} />
      {/* Route "My Leads" — labelled "Assigned Students" in the sidebar. */}
      <Drawer.Screen name="My Leads" component={B2CLeadsListScreen} />
      <Drawer.Screen name="My Day" component={B2CMyDayScreen} />
      <Drawer.Screen name="Route Planner" component={B2CRoutePlannerScreen} />
      <Drawer.Screen name="Calendar" component={B2CCalendarScreen} />
      <Drawer.Screen name="Activity Log" component={B2CActivityLogScreen} />
      <Drawer.Screen name="Leaves" component={B2CMyLeavesScreen} />
      <Drawer.Screen name="My Allowances" component={B2CMyAllowancesScreen} />
      <Drawer.Screen name="My Expenses" component={B2CMyExpensesScreen} />
      <Drawer.Screen name="My Performance" component={B2CMyPerformanceScreen} />
      {/* Native session recording + AI coaching (labelled "AI Coach" in the sidebar). */}
      <Drawer.Screen name="Recording" component={B2CCounselorRecordingScreen} />
      {/* Credits — reuses the shared B2C billing/wallet screen (reachable route, not in the sidebar). */}
      <Drawer.Screen name="B2CBilling" component={B2CBillingScreen} options={{ drawerItemStyle: { display: 'none' } }} />

      <Drawer.Screen name="Profile" component={ProfileScreen} options={{ drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="Settings" component={SettingsScreen} options={{ drawerItemStyle: { display: 'none' } }} />
    </Drawer.Navigator>
  );
}

const getRoleNavigator = (role: string) => {
  switch (role) {
    case 'ZH':  return ZHDrawer;
    case 'RH':  return RHDrawer;
    case 'SH':  return SHDrawer;
    case 'SCA': return SCADrawer;
    case 'B2CAdmin':  return B2CAdminDrawer;
    case 'Agent':     return AgentDrawer;
    case 'Counselor': return CounselorDrawer;
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
    backgroundColor: '#C2492D', paddingVertical: 6, paddingHorizontal: 16, // spec error
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
      <GradientBackground glow={false} style={StyleSheet.absoluteFillObject} />
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
  // Sunstone gradient — the app's brand surface, identical in light and dark.
  bar: {
    overflow: 'hidden',
    paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  text: { flex: 1, color: '#FFF', fontSize: rf(12), fontWeight: '500' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  enableBtn: {
    backgroundColor: '#FFF', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  enableText: { color: Sunstone.from, fontSize: rf(12), fontWeight: '700' },
  dismissText: { color: '#FFF', fontSize: rf(14), fontWeight: '600' },
});

// ─── Root Navigator ───────────────────────────────────────────────────────────
export const AppNavigator = () => {
  const { user, isLoading, justLoggedIn, clearJustLoggedIn } = useAuth();

  // Apply the per-device orientation lock (tablet → landscape, phone → portrait)
  // for whichever flow is active. This also covers the app starting already
  // logged-in (session restored), where the login screen never mounts.
  useEffect(() => {
    if (user) applyAuthedOrientation();
    else applyLoginOrientation();
  }, [user]);

  if (isLoading) return <LoadingSpinner fullScreen message="Loading..." />;

  const MainTabs = user ? getRoleNavigator(user.role) : null;

  return (
    <NavigationContainer ref={navigationRef}>
      <OfflineBanner />
      {user && <NotifPermBanner />}
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!user ? (
          <>
            {/* Landing/Hero — the initial unauthenticated route (B2B / B2C picker). */}
            <Stack.Screen name="Landing" component={LandingScreen} />
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

            {/* Demos */}
            <Stack.Screen name="DemoList" component={DemoListScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="DemoDetail" component={DemoDetailScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AssignDemo" component={AssignDemoScreen} options={{ animation: 'slide_from_bottom' }} />

            {/* Onboarding */}
            <Stack.Screen name="OnboardList" component={OnboardListScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="OnboardDetail" component={OnboardDetailScreen} options={{ animation: 'slide_from_right' }} />

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
            <Stack.Screen name="UserManual" component={UserManualScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AuditHistory" component={AuditHistoryScreen} options={{ animation: 'slide_from_right' }} />

            {/* Misc */}
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Activities" component={ActivityLogScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="SchoolsList" component={SchoolsListScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="LeadsList" component={LeadsListScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="Calendar" component={CalendarScreen} options={{ animation: 'slide_from_right' }} />

            {/* Weekly Plan */}
            <Stack.Screen name="WeeklyPlanScreen" component={WeeklyPlanScreen} options={{ animation: 'slide_from_right' }} />

            {/* New feature screens */}
            <Stack.Screen name="LeaveManagement" component={LeaveManagementScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="AllowancesScreen" component={AllowancesScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="RegionsZones" component={RegionsZonesScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="TeamManagement" component={TeamManagementScreen} options={{ animation: 'slide_from_right' }} />

            {/* ── B2C (student enrollment) ── */}
            <Stack.Screen name="B2CLeadDetail" component={B2CLeadDetailScreen} options={{ animation: 'slide_from_right' }} />
            {/* Lead → deal conversion, reached from the lead detail (phase-1 stub). */}
            <Stack.Screen name="B2CConvert" component={B2CConvertScreen} options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="B2CAddLead" component={B2CAddLeadScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="B2CEditLead" component={B2CAddLeadScreen} options={{ animation: 'slide_from_bottom' }} />
            {/* Native geo-visit (Agent) + session recording/AI coaching (Counselor) flows. */}
            <Stack.Screen name="B2CAgentVisit" component={B2CAgentVisitScreen} options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="B2CCounselorRecording" component={B2CCounselorRecordingScreen} options={{ animation: 'slide_from_bottom' }} />
          </>
        )}
      </Stack.Navigator>
      {/* Role splash — plays once over the freshly-mounted app after an
          interactive login. The app renders underneath meanwhile, so there is no
          second loading beat when the splash clears. */}
      {user && justLoggedIn && (
        <RoleSplash role={user.role} onComplete={clearJustLoggedIn} />
      )}
    </NavigationContainer>
  );
};
