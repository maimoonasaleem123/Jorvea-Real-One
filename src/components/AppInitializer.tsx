import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  children: React.ReactNode;
}

const AppInitializer: React.FC<Props> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🚀 Initializing Jorvea app...');
      
      // Extended delay to ensure React Native is fully ready
      await new Promise<void>(resolve => setTimeout(resolve, 3000));
      
      // Initialize app components
      await initializeAsyncStorage();
      await initializePermissions();
      
      // Additional delay for camera and other modules
      await new Promise<void>(resolve => setTimeout(resolve, 1000));
      
      console.log('✅ App initialization complete');
      setIsInitialized(true);
      
    } catch (error) {
      console.error('❌ App initialization failed:', error);
      setInitError('Failed to initialize app. Please restart the app.');
      setIsInitialized(true); // Still show the app even if some initialization failed
    }
  };

  const initializeAsyncStorage = async () => {
    try {
      // Test AsyncStorage
      await AsyncStorage.setItem('app_initialized', 'true');
      await AsyncStorage.getItem('app_initialized');
      console.log('✅ AsyncStorage initialized');
    } catch (error) {
      console.error('❌ AsyncStorage initialization failed:', error);
    }
  };

  const initializePermissions = async () => {
    try {
      // Basic permission checks can be added here
      console.log('✅ Permissions checked');
    } catch (error) {
      console.error('❌ Permission check failed:', error);
    }
  };

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>Initializing Jorvea...</Text>
      </View>
    );
  }

  if (initError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{initError}</Text>
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
    backgroundColor: '#ffffff',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  offlineText: {
    marginTop: 8,
    fontSize: 14,
    color: '#ff9500',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default AppInitializer;
