import React, { Suspense, lazy } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Lazy load heavy components
const MainNavigator = lazy(() => import('./navigation/AppNavigator'));
const AuthFlow = lazy(() => import('./screens/auth/SignInScreen'));

interface LazyMainAppProps {
  isAuthenticated: boolean;
}

const LazyMainApp: React.FC<LazyMainAppProps> = ({ isAuthenticated }) => {
  const LoadingFallback = () => (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007bff" />
    </View>
  );

  return (
    <Suspense fallback={<LoadingFallback />}>
      {isAuthenticated ? <MainNavigator /> : <AuthFlow />}
    </Suspense>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
});

export default LazyMainApp;
