import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';

interface DynamicLoadingProps {
  visible: boolean;
  message?: string;
  subMessage?: string;
  type?: 'upload' | 'download' | 'process' | 'generate' | 'analyze';
  progress?: number; // 0-100
}

const { width, height } = Dimensions.get('window');

export const DynamicLoading: React.FC<DynamicLoadingProps> = ({
  visible,
  message = 'Loading...',
  subMessage,
  type = 'process',
  progress,
}) => {
  const { colors, isDarkMode } = useTheme();
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const dotsAnim = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // Color schemes for different types
  const getTypeColors = () => {
    switch (type) {
      case 'upload':
        return ['#667eea', '#764ba2'];
      case 'download':
        return ['#11998e', '#38ef7d'];
      case 'process':
        return ['#833ab4', '#fd1d1d', '#fcb045'];
      case 'generate':
        return ['#f093fb', '#f5576c'];
      case 'analyze':
        return ['#4facfe', '#00f2fe'];
      default:
        return ['#667eea', '#764ba2'];
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'upload':
        return '📤';
      case 'download':
        return '📥';
      case 'process':
        return '⚙️';
      case 'generate':
        return '✨';
      case 'analyze':
        return '🔍';
      default:
        return '⚙️';
    }
  };

  useEffect(() => {
    if (visible) {
      // Entry animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Continuous rotation
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );
      rotateAnimation.start();

      // Pulse animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      // Dots animation
      const createDotsAnimation = () => {
        const animations = dotsAnim.map((dot, index) =>
          Animated.loop(
            Animated.sequence([
              Animated.delay(index * 200),
              Animated.timing(dot, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
              }),
              Animated.timing(dot, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
              }),
            ])
          )
        );
        
        Animated.parallel(animations).start();
      };
      createDotsAnimation();

      return () => {
        rotateAnimation.stop();
        pulseAnimation.stop();
      };
    } else {
      // Exit animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Progress animation
  useEffect(() => {
    if (progress !== undefined) {
      Animated.timing(progressAnim, {
        toValue: progress / 100,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [progress]);

  if (!visible) return null;

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={getTypeColors()}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.container}>
          {/* Main Icon with Rotation */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                transform: [
                  { scale: pulseAnim },
                  { rotate: spin },
                ],
              },
            ]}
          >
            <Text style={styles.typeIcon}>{getTypeIcon()}</Text>
          </Animated.View>

          {/* Loading Spinner */}
          <View style={styles.spinnerContainer}>
            <ActivityIndicator size="large" color="#fff" />
          </View>

          {/* Progress Bar (if progress is provided) */}
          {progress !== undefined && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBackground}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{Math.round(progress)}%</Text>
            </View>
          )}

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Animated Dots */}
          <View style={styles.dotsContainer}>
            {dotsAnim.map((dot, index) => (
              <Animated.View
                key={index}
                style={[
                  styles.dot,
                  {
                    opacity: dot,
                    transform: [
                      {
                        scale: dot.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.5, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
            ))}
          </View>

          {/* Sub Message */}
          {subMessage && (
            <Text style={styles.subMessage}>{subMessage}</Text>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  background: {
    width: width * 0.8,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  container: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  typeIcon: {
    fontSize: 40,
  },
  spinnerContainer: {
    position: 'absolute',
    top: 20,
    left: '50%',
    marginLeft: -20,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressBackground: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 3,
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  message: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginHorizontal: 3,
  },
  subMessage: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default DynamicLoading;
