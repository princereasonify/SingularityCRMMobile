/**
 * EduCRM Sales Portal — Mobile Application
 * Built with React Native 0.84 + New Architecture
 */

import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { Alert, DeviceEventEmitter } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ThemedStatusBar from './src/components/common/ThemedStatusBar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { OfflineProvider } from './src/context/OfflineContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import messaging from '@react-native-firebase/messaging';
import { onForegroundMessage, onNotifeeEvent } from './src/services/pushNotificationService';
import { navigationRef } from './src/navigation/AppNavigator';

const navigateToNotifications = () => {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Notifications' as never);
  }
};

function App() {
  // Foreground FCM message — show alert, then go to Notifications
  useEffect(() => {
    const unsubscribe = onForegroundMessage(msg => {
      DeviceEventEmitter.emit('new-notification');
      Alert.alert(msg.title, msg.body, [
        { text: 'Dismiss', style: 'cancel' },
        { text: 'View', onPress: navigateToNotifications },
      ]);
    });
    return unsubscribe;
  }, []);

  // Background tap — app was running in background, user tapped FCM notification
  useEffect(() => {
    const unsubscribe = messaging().onNotificationOpenedApp(() => {
      navigateToNotifications();
    });
    return unsubscribe;
  }, []);

  // Quit-state tap — app was fully closed, user tapped notification to open it
  useEffect(() => {
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          navigateToNotifications();
        }
      });
  }, []);

  // Notifee foreground banner press → navigate to notifications
  useEffect(() => {
    const unsubscribe = onNotifeeEvent(navigateToNotifications);
    return unsubscribe;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
      <SafeAreaProvider>
        <ThemeProvider>
          {/* Theme-aware status/notification bar — reads the user's light/dark choice. */}
          <ThemedStatusBar />
          <LanguageProvider>
            <OfflineProvider>
              <AuthProvider>
                <NotificationProvider>
                  <AppNavigator />
                </NotificationProvider>
              </AuthProvider>
            </OfflineProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default App;
