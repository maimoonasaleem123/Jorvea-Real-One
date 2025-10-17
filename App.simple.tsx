import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar, LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { AuthProvider } from './src/context/FastAuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { PostsProvider } from './src/context/PostsContext';
import AppNavigator from './src/navigation/AppNavigator';
import SafeErrorBoundary from './src/components/SafeErrorBoundary';

// Polyfills
import 'react-native-get-random-values';

// Ignore warnings for cleaner development
LogBox.ignoreAllLogs();

const App = (): React.JSX.Element => {
  return (
    <SafeErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar 
          hidden 
          translucent 
          backgroundColor="transparent" 
          barStyle="light-content"
        />
        <ThemeProvider>
          <AuthProvider>
            <PostsProvider>
              <NavigationContainer>
                <AppNavigator />
              </NavigationContainer>
            </PostsProvider>
          </AuthProvider>
        </ThemeProvider>
        <Toast />
      </GestureHandlerRootView>
    </SafeErrorBoundary>
  );
};

export default App;
