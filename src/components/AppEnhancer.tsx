import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  AppState,
  NetInfo,
  BackHandler,
  StatusBar,
} from 'react-native';
import { DynamicLoading } from './DynamicLoading';
import { DynamicNotificationSystem, useNotificationSystem } from './DynamicNotificationSystem';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';

interface AppEnhancerProps {
  children: React.ReactNode;
}

const { width, height } = Dimensions.get('window');

export const AppEnhancer: React.FC<AppEnhancerProps> = ({ children }) => {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const { NotificationSystem, showNotification } = useNotificationSystem();
  
  // State management
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [loadingType, setLoadingType] = useState<'upload' | 'download' | 'process' | 'generate' | 'analyze'>('process');
  const [isConnected, setIsConnected] = useState(true);
  const [appState, setAppState] = useState(AppState.currentState);
  
  // Animation values
  const backgroundOpacity = useRef(new Animated.Value(1)).current;
  const connectionIndicator = useRef(new Animated.Value(0)).current;
  
  // Network monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected && state.isInternetReachable;
      
      if (connected !== isConnected) {
        setIsConnected(connected);
        
        if (connected) {
          showNotification({
            type: 'success',
            title: 'Back Online',
            message: 'Internet connection restored',
            duration: 2000,
          });
          
          // Animate connection indicator
          Animated.timing(connectionIndicator, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start();
        } else {
          showNotification({
            type: 'warning',
            title: 'No Internet',
            message: 'Check your connection',
            duration: 3000,
          });
          
          // Show connection indicator
          Animated.timing(connectionIndicator, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }
      }
    });

    return unsubscribe;
  }, [isConnected, showNotification, connectionIndicator]);

  // App state monitoring
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        if (user) {
          showNotification({
            type: 'info',
            title: `Welcome back, ${user.displayName || 'User'}!`,
            message: 'See what\'s new on Jorvea',
            duration: 3000,
          });
        }
        
        // Animate background
        Animated.timing(backgroundOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background
        Animated.timing(backgroundOpacity, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
      
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [appState, user, showNotification, backgroundOpacity]);

  // Back handler for better UX
  useEffect(() => {
    const backAction = () => {
      showNotification({
        type: 'info',
        title: 'Press again to exit',
        message: 'Tap back once more to close the app',
        duration: 2000,
      });
      return true; // Prevent default behavior
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showNotification]);

  // Global loading functions
  const showLoading = (message: string, type: typeof loadingType = 'process') => {
    setLoadingMessage(message);
    setLoadingType(type);
    setIsLoading(true);
  };

  const hideLoading = () => {
    setIsLoading(false);
  };

  // Auto-hide loading after timeout
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        hideLoading();
      }, 10000); // Auto-hide after 10 seconds

      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  // Welcome notification for new users
  useEffect(() => {
    if (user) {
      const isNewUser = !user.lastLoginTime || 
        (Date.now() - new Date(user.lastLoginTime).getTime()) > 24 * 60 * 60 * 1000; // 24 hours
      
      if (isNewUser) {
        setTimeout(() => {
          showNotification({
            type: 'follow',
            title: 'Welcome to Jorvea! 🎉',
            message: 'Start sharing your moments with the world',
            duration: 5000,
            actionButton: {
              label: 'Create Post',
              onPress: () => {
                // Navigation logic would go here
                console.log('Navigate to create post');
              },
            },
          });
        }, 2000);
      }
    }
  }, [user, showNotification]);

  // Dynamic status bar
  const statusBarStyle = isDarkMode ? 'light-content' : 'dark-content';
  const statusBarBackground = isDarkMode ? '#000' : '#fff';

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor={statusBarBackground}
        translucent={false}
      />
      
      <Animated.View
        style={[
          styles.content,
          {
            opacity: backgroundOpacity,
          },
        ]}
      >
        {children}
      </Animated.View>

      {/* Connection Status Indicator */}
      <Animated.View
        style={[
          styles.connectionIndicator,
          {
            opacity: connectionIndicator,
            backgroundColor: isConnected ? '#4CAF50' : '#F44336',
          },
        ]}
      >
        <Animated.Text style={styles.connectionText}>
          {isConnected ? '● Online' : '● Offline'}
        </Animated.Text>
      </Animated.View>

      {/* Global Loading */}
      <DynamicLoading
        visible={isLoading}
        message={loadingMessage}
        type={loadingType}
        subMessage={!isConnected ? 'Waiting for connection...' : undefined}
      />

      {/* Notification System */}
      <NotificationSystem />
    </View>
  );
};

// Export enhanced functions for global use
export const useAppEnhancer = () => {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const { showNotification } = useNotificationSystem();

  const showGlobalLoading = (message: string, type: 'upload' | 'download' | 'process' | 'generate' | 'analyze' = 'process') => {
    setLoadingMessage(message);
    setLoading(true);
  };

  const hideGlobalLoading = () => {
    setLoading(false);
  };

  const showSuccessNotification = (title: string, message: string) => {
    showNotification({
      type: 'success',
      title,
      message,
      duration: 3000,
    });
  };

  const showErrorNotification = (title: string, message: string) => {
    showNotification({
      type: 'error',
      title,
      message,
      duration: 4000,
    });
  };

  const showSocialNotification = (type: 'like' | 'comment' | 'follow', title: string, message: string) => {
    showNotification({
      type,
      title,
      message,
      duration: 3000,
    });
  };

  return {
    loading,
    loadingMessage,
    showGlobalLoading,
    hideGlobalLoading,
    showSuccessNotification,
    showErrorNotification,
    showSocialNotification,
  };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  connectionIndicator: {
    position: 'absolute',
    top: 50,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 9997,
  },
  connectionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default AppEnhancer;
