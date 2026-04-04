/**
 * EduCRM Sales Portal — Mobile Application
 * Built with React Native 0.84 + New Architecture
 */

import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { Alert, DeviceEventEmitter, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { OfflineProvider } from './src/context/OfflineContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import messaging from '@react-native-firebase/messaging';
import { onForegroundMessage } from './src/services/pushNotificationService';
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

  // Background tap — app was running in background, user tapped notification
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <LanguageProvider>
          <OfflineProvider>
            <AuthProvider>
              <AppNavigator />
            </AuthProvider>
          </OfflineProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
