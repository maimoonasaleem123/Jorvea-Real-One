/**
 * 🎯 FIREBASE DYNAMIC LIKE BUTTON
 * 
 * Instagram-quality like button with:
 * - Firebase real-time sync
 * - Heart animations
 * - Haptic feedback
 * - Error handling
 * - Optimistic updates
 */

import React, { memo, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ViewStyle,
  TextStyle
} from 'react-native';
import { useFirebaseLike } from '../hooks/useFirebaseLike';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

interface FirebaseLikeButtonProps {
  contentId: string;
  userId: string;
  contentType?: 'post' | 'reel' | 'comment';
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
  showAnimation?: boolean;
  style?: ViewStyle;
  buttonStyle?: ViewStyle;
  textStyle?: TextStyle;
  color?: string;
  activeColor?: string;
  onLikeChange?: (isLiked: boolean, likesCount: number) => void;
  disabled?: boolean;
}

const FirebaseLikeButton: React.FC<FirebaseLikeButtonProps> = memo(({
  contentId,
  userId,
  contentType = 'post',
  size = 'medium',
  showCount = true,
  showAnimation = true,
  style,
  buttonStyle,
  textStyle,
  color = '#666',
  activeColor = '#FF3040',
  onLikeChange,
  disabled = false
}) => {
  const {
    isLiked,
    likesCount,
    isLoading,
    error,
    toggleLike,
    hasOptimisticUpdate
  } = useFirebaseLike({
    contentId,
    userId,
    contentType,
    enableRealtime: true,
    onLikeSuccess: (result) => {
      onLikeChange?.(result.isLiked, result.likesCount);
    },
    onLikeError: (error) => {
      console.warn('Like error:', error);
    }
  });

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countAnim = useRef(new Animated.Value(1)).current;

  // Size configurations
  const sizeConfig = {
    small: { iconSize: 18, fontSize: 12, padding: 8 },
    medium: { iconSize: 24, fontSize: 14, padding: 10 },
    large: { iconSize: 32, fontSize: 16, padding: 12 }
  };

  const config = sizeConfig[size];

  // Animate on like change
  useEffect(() => {
    if (showAnimation) {
      if (isLiked) {
        // Like animation sequence
        Animated.sequence([
          // Scale down and up
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(scaleAnim, {
              toValue: 1.2,
              duration: 150,
              useNativeDriver: true,
            }),
            Animated.timing(heartAnim, {
              toValue: 1,
              duration: 150,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();

        // Pulse effect
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.1,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
          { iterations: 3 }
        ).start();
      } else {
        // Unlike animation
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 0.9,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(heartAnim, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start(() => {
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }).start();
        });
      }

      // Count animation
      Animated.sequence([
        Animated.timing(countAnim, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(countAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLiked, showAnimation]);

  // Handle like press
  const handlePress = async () => {
    if (disabled || isLoading) return;

    // Immediate feedback animation
    Animated.timing(scaleAnim, {
      toValue: 0.85,
      duration: 50,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });

    await toggleLike();
  };

  // Format likes count
  const formatLikesCount = (count: number): string => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  };

  const heartColor = isLiked ? activeColor : color;
  const opacity = disabled ? 0.5 : 1;

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || isLoading}
        style={[
          styles.button,
          buttonStyle,
          {
            padding: config.padding,
            opacity
          }
        ]}
        activeOpacity={0.7}
      >
        <Animated.View
          style={{
            transform: [
              { scale: scaleAnim },
              { scale: pulseAnim }
            ]
          }}
        >
          <View style={styles.heartContainer}>
            {/* Main heart icon */}
            <Animated.View
              style={{
                transform: [{ scale: heartAnim }]
              }}
            >
              <Icon
                name={isLiked ? 'favorite' : 'favorite-border'}
                size={config.iconSize}
                color={heartColor}
                style={[
                  styles.heartIcon,
                  hasOptimisticUpdate && styles.optimisticIcon
                ]}
              />
            </Animated.View>

            {/* Loading indicator */}
            {isLoading && (
              <View style={[styles.loadingOverlay, { 
                width: config.iconSize, 
                height: config.iconSize 
              }]}>
                <Animated.View
                  style={{
                    width: config.iconSize * 0.6,
                    height: config.iconSize * 0.6,
                    borderRadius: config.iconSize * 0.3,
                    borderWidth: 2,
                    borderColor: heartColor,
                    borderTopColor: 'transparent',
                    transform: [
                      {
                        rotate: pulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '360deg']
                        })
                      }
                    ]
                  }}
                />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Likes count */}
        {showCount && (
          <Animated.Text
            style={[
              styles.countText,
              textStyle,
              {
                fontSize: config.fontSize,
                color: isLiked ? activeColor : color,
                transform: [{ scale: countAnim }]
              }
            ]}
          >
            {likesCount > 0 ? formatLikesCount(likesCount) : ''}
          </Animated.Text>
        )}

        {/* Error indicator */}
        {error && (
          <View style={styles.errorIndicator}>
            <Icon name="warning" size={config.iconSize * 0.6} color="#FF6B6B" />
          </View>
        )}
      </TouchableOpacity>

      {/* Floating hearts animation */}
      {showAnimation && isLiked && (
        <View style={styles.floatingHeartsContainer}>
          {[...Array(3)].map((_, index) => (
            <Animated.View
              key={index}
              style={[
                styles.floatingHeart,
                {
                  opacity: heartAnim,
                  transform: [
                    {
                      translateY: heartAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -30 - index * 10]
                      })
                    },
                    {
                      translateX: heartAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, (index - 1) * 15]
                      })
                    },
                    {
                      scale: heartAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, 1.2, 0.8]
                      })
                    }
                  ]
                }
              ]}
            >
              <Icon
                name="favorite"
                size={config.iconSize * 0.7}
                color={activeColor}
              />
            </Animated.View>
          ))}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  heartContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  optimisticIcon: {
    opacity: 0.7,
  },
  loadingOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    marginLeft: 6,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  errorIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 1,
  },
  floatingHeartsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  floatingHeart: {
    position: 'absolute',
  },
});

export default FirebaseLikeButton;
