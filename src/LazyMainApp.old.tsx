import React, { Suspense, lazy } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Lazy load heavy components
const MainNavigator = lazy(() => import('./navigation/AppNavigator'));
const AuthFlow = lazy(() => import('./screens/auth/SignInScreen'));

interface LazyMainAppProps {
  isAuthenticated: boolean;
}

const LazyMainApp: React.FC<LazyMainAppProps> = ({ isAuthenticated }) => {
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    initializeApp();
    setupAppStateHandling();
    setupBackButtonHandling();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize managers
      await initializeMemoryManagement();
      
      setIsAppReady(true);
    } catch (error) {
      console.error('App initialization failed:', error);
      // Continue anyway to prevent app from being stuck
      setIsAppReady(true);
    }
  };

  const initializeMemoryManagement = async () => {
    try {
      // Clean up old cache on app start
      await MemoryManager.clearImageCache();
      
      const stats = await MemoryManager.getStorageStats();
      console.log('📊 Storage stats:', {
        size: Math.round(stats.totalSize / 1024 / 1024 * 100) / 100 + 'MB',
        items: stats.itemCount
      });
    } catch (error) {
      console.error('Memory management initialization failed:', error);
    }
  };

  const setupAppStateHandling = () => {
    const handleAppStateChange = (nextAppState: string) => {
      console.log('App state changed to:', nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  };

  const setupBackButtonHandling = () => {
    const backAction = () => {
      // Handle back button gracefully
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  };

  if (!isAppReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <Suspense fallback={
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    }>
      {isAuthenticated ? <MainNavigator /> : <AuthFlow />}
    </Suspense>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});

export default LazyMainApp;
