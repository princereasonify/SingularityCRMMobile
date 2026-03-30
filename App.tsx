/**
 * EduCRM Sales Portal — Mobile Application
 * Built with React Native 0.84 + New Architecture
 */

import 'react-native-reanimated';
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { OfflineProvider } from './src/context/OfflineContext';
import { AppNavigator } from './src/navigation/AppNavigator';

function App() {
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
