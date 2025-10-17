import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, AppState, Platform, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MemoryManager from '../utils/MemoryManager';
import PerformanceManager from '../utils/PerformanceManager';

interface Props {
  children: React.ReactNode;
}

const SafeAppWrapper: React.FC<Props> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const appState = useRef(AppState.currentState);
  const initAttempts = useRef(0);

  useEffect(() => {
    initializeAppSafely();
    setupAppStateHandling();
  }, []);

  const setupAppStateHandling = () => {
    const handleAppStateChange = (nextAppState: any) => {
      console.log('🔄 App state changing from', appState.current, 'to', nextAppState);
      
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App returning from background - critical for preventing crashes
        console.log('✅ App returning from background - performing safe restart');
        handleAppRestart();
      } else if (nextAppState.match(/inactive|background/)) {
        // App going to background - cleanup
        console.log('💤 App going to background - performing cleanup');
        PerformanceManager.handleMemoryPressure();
        saveAppState();
      }

      appState.current = nextAppState;
    };

    const appStateListener = AppState.addEventListener('change', handleAppStateChange);

    // Handle memory warnings
    let memoryWarningListener: any;
    if (Platform.OS === 'ios') {
      const { DeviceEventEmitter } = require('react-native');
      memoryWarningListener = DeviceEventEmitter.addListener('memoryWarning', () => {
        console.warn('⚠️ Memory warning - performing emergency cleanup');
        PerformanceManager.handleMemoryPressure();
        MemoryManager.clearImageCache();
      });
    }

    // Handle Android back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      // Don't crash on back button
      try {
        return false; // Let the app handle it normally
      } catch (error) {
        console.warn('Back button error:', error);
        return true; // Prevent default to avoid crash
      }
    });

    return () => {
      appStateListener?.remove();
      memoryWarningListener?.remove();
      backHandler?.remove();
    };
  };

  const handleAppRestart = async () => {
    try {
      setIsRestarting(true);
      
      // Clear any problematic cached data
      await PerformanceManager.forceCleanup();
      
      // Reset navigation state to prevent crashes
      await AsyncStorage.removeItem('@navigation_state');
      
      // Restore app state
      await restoreAppState();
      
      setIsRestarting(false);
      console.log('✅ App restart completed successfully');
    } catch (error) {
      console.error('❌ App restart failed:', error);
      setIsRestarting(false);
      // Continue anyway to prevent permanent crash
    }
  };

  const saveAppState = async () => {
    try {
      const appStateData = {
        timestamp: Date.now(),
        version: '1.0.0',
        lastActiveScreen: 'MainTabs'
      };
      await AsyncStorage.setItem('@app_state', JSON.stringify(appStateData));
    } catch (error) {
      console.warn('Failed to save app state:', error);
    }
  };

  const restoreAppState = async () => {
    try {
      const appStateData = await AsyncStorage.getItem('@app_state');
      if (appStateData) {
        const parsed = JSON.parse(appStateData);
        console.log('📱 Restored app state from:', new Date(parsed.timestamp));
      }
    } catch (error) {
      console.warn('Failed to restore app state:', error);
    }
  };

  const initializeAppSafely = async () => {
    try {
      initAttempts.current++;
      console.log(`🚀 Starting safe app initialization (attempt ${initAttempts.current})...`);
      
      // Initialize core services with timeouts
      await Promise.race([
        initializeCore(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Initialization timeout')), 15000)
        )
      ]);

      console.log('✅ App initialization complete');
      setIsReady(true);
      
    } catch (error) {
      console.error('❌ App initialization failed:', error);
      
      if (initAttempts.current < 3) {
        // Retry initialization up to 3 times
        console.log('🔄 Retrying initialization...');
        setTimeout(() => initializeAppSafely(), 2000);
      } else {
        // Even if initialization fails, show the app to prevent black screen
        console.log('⚠️ Max initialization attempts reached, proceeding anyway');
        setError(null); 
        setIsReady(true);
      }
    }
  };

  const initializeCore = async () => {
    // Test AsyncStorage with timeout
    try {
      await Promise.race([
        AsyncStorage.setItem('app_test', 'working'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AsyncStorage timeout')), 3000)
        )
      ]);
      await AsyncStorage.removeItem('app_test');
      console.log('✅ AsyncStorage test passed');
    } catch (e) {
      console.warn('⚠️ AsyncStorage test failed:', e);
    }

    // Initialize memory manager
    try {
      const stats = await MemoryManager.getStorageStats();
      console.log('📊 Initial storage:', Math.round(stats.totalSize / 1024 / 1024 * 100) / 100 + 'MB');
    } catch (e) {
      console.warn('⚠️ Memory manager initialization failed:', e);
    }

    // Clear any navigation state that might cause crashes
    try {
      await AsyncStorage.removeItem('@navigation_state');
    } catch (e) {
      console.warn('Navigation state cleanup failed:', e);
    }

    // Restore app state if available
    await restoreAppState();

    // Add small delay to ensure React Native is fully ready
    await new Promise<void>(resolve => setTimeout(resolve, 1000));
  };

  if (!isReady || isRestarting) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.text}>
          {isRestarting ? 'Restarting Jorvea...' : 'Starting Jorvea...'}
        </Text>
        {initAttempts.current > 1 && (
          <Text style={styles.subText}>
            Attempt {initAttempts.current} of 3
          </Text>
        )}
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  text: {
    marginTop: 16,
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    color: '#cccccc',
  },
});

export default SafeAppWrapper;
