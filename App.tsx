import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { AuthProvider } from './src/context/FastAuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { InstagramFastPostsProvider } from './src/context/InstagramFastPostsContext';
import AppNavigator from './src/navigation/AppNavigator';
import CrashGuardBoundary from './src/components/CrashGuardBoundary';
import { OuterCrashGuard } from './src/components/OuterCrashGuard';
import { LightningFastInitializer } from './src/components/LightningFastInitializer';

// Polyfills
import 'react-native-get-random-values';

const App = (): React.JSX.Element => {
  return (
    <OuterCrashGuard>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar 

          hidden
         
        />
        <ThemeProvider>
          <AuthProvider>
            <LightningFastInitializer>
              <CrashGuardBoundary>
                <InstagramFastPostsProvider>
                  <NavigationContainer>
                    <AppNavigator />
                  </NavigationContainer>
                </InstagramFastPostsProvider>
              </CrashGuardBoundary>
            </LightningFastInitializer>
          </AuthProvider>
        </ThemeProvider>
        <Toast />
      </GestureHandlerRootView>
    </OuterCrashGuard>
  );
};

export default App;
