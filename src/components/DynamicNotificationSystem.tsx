import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Vibration,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';

interface NotificationProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'like' | 'comment' | 'follow';
  title: string;
  message: string;
  duration?: number;
  showAvatar?: boolean;
  avatarUri?: string;
  onPress?: () => void;
  onDismiss?: (id: string) => void;
  actionButton?: {
    label: string;
    onPress: () => void;
  };
}

interface DynamicNotificationSystemProps {
  notifications: NotificationProps[];
  onRemoveNotification: (id: string) => void;
}

const { width, height } = Dimensions.get('window');
const NOTIFICATION_HEIGHT = 80;

const getNotificationConfig = (type: NotificationProps['type']) => {
  switch (type) {
    case 'success':
      return {
        colors: ['#00d2ff', '#3a7bd5'],
        icon: 'check-circle',
        iconColor: '#fff',
      };
    case 'error':
      return {
        colors: ['#ff416c', '#ff4b2b'],
        icon: 'error',
        iconColor: '#fff',
      };
    case 'warning':
      return {
        colors: ['#f7971e', '#ffd200'],
        icon: 'warning',
        iconColor: '#fff',
      };
    case 'info':
      return {
        colors: ['#667eea', '#764ba2'],
        icon: 'info',
        iconColor: '#fff',
      };
    case 'like':
      return {
        colors: ['#ff0844', '#ffb199'],
        icon: 'favorite',
        iconColor: '#fff',
      };
    case 'comment':
      return {
        colors: ['#833ab4', '#fd1d1d'],
        icon: 'chat-bubble',
        iconColor: '#fff',
      };
    case 'follow':
      return {
        colors: ['#11998e', '#38ef7d'],
        icon: 'person-add',
        iconColor: '#fff',
      };
    default:
      return {
        colors: ['#667eea', '#764ba2'],
        icon: 'notifications',
        iconColor: '#fff',
      };
  }
};

const DynamicNotification: React.FC<NotificationProps & { onRemove: (id: string) => void; index: number }> = ({
  id,
  type,
  title,
  message,
  duration = 4000,
  showAvatar,
  avatarUri,
  onPress,
  onDismiss,
  actionButton,
  onRemove,
  index,
}) => {
  const { colors } = useTheme();
  const config = getNotificationConfig(type);
  
  // Animation values
  const translateY = useRef(new Animated.Value(-100)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  // Pan responder for swipe to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 20;
      },
      onPanResponderMove: (evt, gestureState) => {
        translateX.setValue(gestureState.dx);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (Math.abs(gestureState.dx) > width * 0.3) {
          // Swipe to dismiss
          dismissNotification();
        } else {
          // Snap back
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const dismissNotification = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onRemove(id);
      onDismiss?.(id);
    });
  };

  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Progress animation
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: duration,
      useNativeDriver: false,
    }).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      dismissNotification();
    }, duration);

    // Vibration feedback for certain types
    if (type === 'like' || type === 'comment' || type === 'follow') {
      Vibration.vibrate(50);
    }

    return () => clearTimeout(timer);
  }, []);

  const handlePress = () => {
    if (onPress) {
      onPress();
      dismissNotification();
    }
  };

  return (
    <Animated.View
      style={[
        styles.notification,
        {
          top: 60 + (index * (NOTIFICATION_HEIGHT + 10)),
          transform: [
            { translateY },
            { translateX },
            { scale },
          ],
          opacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <LinearGradient
        colors={config.colors}
        style={styles.notificationContent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        {/* Progress Bar */}
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />

        <TouchableOpacity
          style={styles.notificationTouchable}
          onPress={handlePress}
          activeOpacity={0.9}
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Icon
              name={config.icon}
              size={24}
              color={config.iconColor}
            />
          </View>

          {/* Content */}
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.message} numberOfLines={2}>
              {message}
            </Text>
          </View>

          {/* Action Button */}
          {actionButton && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                actionButton.onPress();
                dismissNotification();
              }}
            >
              <Text style={styles.actionButtonText}>
                {actionButton.label}
              </Text>
            </TouchableOpacity>
          )}

          {/* Dismiss Button */}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={dismissNotification}
          >
            <Icon name="close" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
};

export const DynamicNotificationSystem: React.FC<DynamicNotificationSystemProps> = ({
  notifications,
  onRemoveNotification,
}) => {
  return (
    <View style={styles.container} pointerEvents="box-none">
      {notifications.map((notification, index) => (
        <DynamicNotification
          key={notification.id}
          {...notification}
          onRemove={onRemoveNotification}
          index={index}
        />
      ))}
    </View>
  );
};

// Hook for managing notifications
export const useNotificationSystem = () => {
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);

  const showNotification = (notification: Omit<NotificationProps, 'id'>) => {
    const id = Date.now().toString();
    const newNotification: NotificationProps = {
      ...notification,
      id,
    };

    setNotifications(prev => [...prev, newNotification]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return {
    notifications,
    showNotification,
    removeNotification,
    clearAll,
    NotificationSystem: () => (
      <DynamicNotificationSystem
        notifications={notifications}
        onRemoveNotification={removeNotification}
      />
    ),
  };
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
  },
  notification: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: NOTIFICATION_HEIGHT,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  notificationContent: {
    flex: 1,
    borderRadius: 15,
    overflow: 'hidden',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  notificationTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  message: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default DynamicNotificationSystem;
