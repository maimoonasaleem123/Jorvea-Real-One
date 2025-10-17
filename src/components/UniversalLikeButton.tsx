import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useLike, ContentType } from '../hooks/useLike';

interface UniversalLikeButtonProps {
  contentId: string;
  contentType: ContentType;
  initialLiked?: boolean;
  initialCount?: number;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'gradient' | 'minimal' | 'story';
  showCount?: boolean;
  showAnimation?: boolean;
  enableHaptics?: boolean;
  style?: ViewStyle;
  iconStyle?: ViewStyle;
  textStyle?: TextStyle;
  onLikeChange?: (isLiked: boolean, likesCount: number) => void;
  disabled?: boolean;
}

export const UniversalLikeButton: React.FC<UniversalLikeButtonProps> = ({
  contentId,
  contentType,
  initialLiked = false,
  initialCount = 0,
  size = 'medium',
  variant = 'default',
  showCount = true,
  showAnimation = true,
  enableHaptics = true,
  style,
  iconStyle,
  textStyle,
  onLikeChange,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const { isLiked, likesCount, isLoading, handleLike } = useLike({
    contentId,
    contentType,
    initialLiked,
    initialCount,
    onLikeChange,
    enableHaptics,
  });

  // Animation refs
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartFloatAnim = useRef(new Animated.Value(0)).current;
  const heartOpacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Particle animations for explosion effect
  const particleAnims = useRef(
    Array.from({ length: 6 }, () => ({
      scale: new Animated.Value(0),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  // Size configurations
  const sizeConfig = {
    small: { icon: 20, font: 12, spacing: 4 },
    medium: { icon: 24, font: 14, spacing: 6 },
    large: { icon: 28, font: 16, spacing: 8 },
  };

  const { icon: iconSize, font: fontSize, spacing } = sizeConfig[size];

  // Trigger animation when liked state changes
  useEffect(() => {
    if (showAnimation && isLiked) {
      startLikeAnimation();
    }
  }, [isLiked, showAnimation]);

  const startLikeAnimation = () => {
    // Main button scale animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating heart animation
    if (variant !== 'minimal') {
      Animated.parallel([
        Animated.timing(heartFloatAnim, {
          toValue: -30,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(heartOpacityAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(heartOpacityAnim, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        heartFloatAnim.setValue(0);
        heartOpacityAnim.setValue(0);
      });

      // Particle explosion effect
      particleAnims.forEach((particle, index) => {
        const angle = (index * 60) * (Math.PI / 180);
        const distance = 25;
        
        Animated.parallel([
          Animated.timing(particle.scale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(particle.translateX, {
            toValue: Math.cos(angle) * distance,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(particle.translateY, {
            toValue: Math.sin(angle) * distance,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(particle.opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(particle.opacity, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          // Reset particle
          particle.scale.setValue(0);
          particle.translateX.setValue(0);
          particle.translateY.setValue(0);
          particle.opacity.setValue(0);
        });
      });
    }

    // Pulse animation for story variant
    if (variant === 'story') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
        { iterations: 2 }
      ).start();
    }
  };

  const formatLikeCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const renderButton = () => {
    const buttonContent = (
      <View style={[styles.buttonContainer, style]}>
        {/* Floating Heart */}
        {showAnimation && variant !== 'minimal' && (
          <Animated.View
            style={[
              styles.floatingHeart,
              {
                transform: [{ translateY: heartFloatAnim }],
                opacity: heartOpacityAnim,
              },
            ]}
          >
            <Icon
              name="heart"
              size={iconSize - 4}
              color={colors.error}
            />
          </Animated.View>
        )}

        {/* Particle Effects */}
        {showAnimation && variant !== 'minimal' && particleAnims.map((particle, index) => (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              {
                transform: [
                  { scale: particle.scale },
                  { translateX: particle.translateX },
                  { translateY: particle.translateY },
                ],
                opacity: particle.opacity,
              },
            ]}
          >
            <Icon
              name="heart"
              size={iconSize / 2}
              color={colors.error}
            />
          </Animated.View>
        ))}

        {/* Main Button */}
        <Animated.View
          style={[
            styles.heartContainer,
            iconStyle,
            {
              transform: [
                { scale: scaleAnim },
                ...(variant === 'story' ? [{ scale: pulseAnim }] : []),
              ],
            },
          ]}
        >
          <Icon
            name={isLiked ? "heart" : "heart-outline"}
            size={iconSize}
            color={isLiked ? colors.error : colors.textSecondary}
          />
        </Animated.View>

        {/* Like Count */}
        {showCount && (
          <Text
            style={[
              styles.likeCount,
              {
                color: colors.textSecondary,
                fontSize,
                marginLeft: spacing,
              },
              textStyle,
            ]}
          >
            {formatLikeCount(likesCount)}
          </Text>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <View style={[styles.loadingOverlay, { backgroundColor: colors.background + '80' }]}>
            <Animated.View
              style={{
                transform: [{
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  })
                }]
              }}
            >
              <Icon name="refresh" size={iconSize} color={colors.textSecondary} />
            </Animated.View>
          </View>
        )}
      </View>
    );

    if (variant === 'gradient') {
      return (
        <LinearGradient
          colors={isLiked ? ['#FF6B6B', '#FF8E8E'] : [colors.background, colors.card]}
          style={[styles.gradientButton, { opacity: disabled ? 0.5 : 1 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {buttonContent}
        </LinearGradient>
      );
    }

    return (
      <View style={{ opacity: disabled ? 0.5 : 1 }}>
        {buttonContent}
      </View>
    );
  };

  // Start loading animation
  useEffect(() => {
    if (isLoading) {
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ).start();
    } else {
      rotateAnim.stopAnimation();
      rotateAnim.setValue(0);
    }
  }, [isLoading]);

  return (
    <TouchableOpacity
      onPress={handleLike}
      disabled={disabled || isLoading}
      activeOpacity={0.7}
      style={[
        styles.container,
        variant === 'story' && styles.storyContainer,
      ]}
    >
      {renderButton()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  storyContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  gradientButton: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heartContainer: {
    position: 'relative',
  },
  floatingHeart: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1,
  },
  particle: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1,
  },
  likeCount: {
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
});

export default UniversalLikeButton;
