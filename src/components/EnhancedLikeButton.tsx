import React, { useState, useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  Animated,
  StyleSheet,
  View,
  Text,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

interface EnhancedLikeButtonProps {
  isLiked: boolean;
  likeCount: number;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
  disabled?: boolean;
  style?: any;
}

export const EnhancedLikeButton: React.FC<EnhancedLikeButtonProps> = ({
  isLiked,
  likeCount,
  onPress,
  size = 'medium',
  showCount = true,
  disabled = false,
  style,
}) => {
  const { colors } = useTheme();
  const [isAnimating, setIsAnimating] = useState(false);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartFloatAnim = useRef(new Animated.Value(0)).current;
  const heartOpacityAnim = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef(
    Array.from({ length: 6 }, () => ({
      scale: new Animated.Value(0),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  ).current;

  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return { iconSize: 18, containerSize: 32 };
      case 'large':
        return { iconSize: 28, containerSize: 48 };
      default:
        return { iconSize: 24, containerSize: 40 };
    }
  };

  const { iconSize, containerSize } = getSizeConfig();

  const handlePress = () => {
    if (disabled || isAnimating) return;

    setIsAnimating(true);
    
    // Simple vibration feedback (can be enhanced with react-native-haptic-feedback)
    // if (Haptic?.impact) {
    //   Haptic.impact(Haptic.ImpactFeedbackStyle.Light);
    // }

    if (!isLiked) {
      // Like animation
      startLikeAnimation();
    } else {
      // Unlike animation
      startUnlikeAnimation();
    }

    onPress();
    
    setTimeout(() => setIsAnimating(false), 800);
  };

  const startLikeAnimation = () => {
    // Main heart animation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.3,
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
    Animated.parallel([
      Animated.timing(heartFloatAnim, {
        toValue: -30,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(heartOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(heartOpacityAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Reset floating heart
      heartFloatAnim.setValue(0);
      heartOpacityAnim.setValue(0);
    });

    // Particle explosion animation
    startParticleAnimation();
  };

  const startUnlikeAnimation = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startParticleAnimation = () => {
    const animations = particleAnims.map((anim, index) => {
      const angle = (index * 60) * (Math.PI / 180); // 6 particles, 60 degrees apart
      const distance = 25;
      const finalX = Math.cos(angle) * distance;
      const finalY = Math.sin(angle) * distance;

      return Animated.parallel([
        Animated.timing(anim.scale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(anim.translateX, {
          toValue: finalX,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(anim.translateY, {
          toValue: finalY,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(anim.opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(anim.opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    Animated.parallel(animations).start(() => {
      // Reset particles
      particleAnims.forEach(anim => {
        anim.scale.setValue(0);
        anim.translateX.setValue(0);
        anim.translateY.setValue(0);
        anim.opacity.setValue(0);
      });
    });
  };

  const formatLikeCount = (count: number) => {
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled}
        style={[
          styles.likeButton,
          { width: containerSize, height: containerSize },
          disabled && styles.disabled,
        ]}
        activeOpacity={0.7}
      >
        {/* Particle Effects */}
        {particleAnims.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.particle,
              {
                transform: [
                  { scale: anim.scale },
                  { translateX: anim.translateX },
                  { translateY: anim.translateY },
                ],
                opacity: anim.opacity,
              },
            ]}
          >
            <Icon
              name="heart"
              size={8}
              color={colors.error}
            />
          </Animated.View>
        ))}

        {/* Floating Heart */}
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

        {/* Main Heart */}
        <Animated.View
          style={[
            styles.heartContainer,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Icon
            name={isLiked ? "heart" : "heart-outline"}
            size={iconSize}
            color={isLiked ? colors.error : colors.textSecondary}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Like Count */}
      {showCount && (
        <Text style={[
          styles.likeCount,
          { 
            color: colors.textSecondary,
            fontSize: size === 'small' ? 12 : size === 'large' ? 16 : 14,
          }
        ]}>
          {formatLikeCount(likeCount)}
        </Text>
      )}
    </View>
  );
};

interface DoubleTapLikeProps {
  children: React.ReactNode;
  onDoubleTap: () => void;
  isLiked: boolean;
}

export const DoubleTapLike: React.FC<DoubleTapLikeProps> = ({
  children,
  onDoubleTap,
  isLiked,
}) => {
  const { colors } = useTheme();
  const lastTap = useRef<number>(0);
  const heartAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (lastTap.current && (now - lastTap.current) < DOUBLE_PRESS_DELAY) {
      // Double tap detected
      if (!isLiked) {
        startDoubleTapAnimation();
        onDoubleTap();
      }
    }
    
    lastTap.current = now;
  };

  const startDoubleTapAnimation = () => {
    heartAnim.setValue(0);
    opacityAnim.setValue(0);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(heartAnim, {
          toValue: 1.5,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(heartAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      heartAnim.setValue(0);
      opacityAnim.setValue(0);
    });
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      {children}
      
      {/* Double Tap Heart Effect */}
      <Animated.View
        style={[
          styles.doubleTapHeart,
          {
            transform: [{ scale: heartAnim }],
            opacity: opacityAnim,
          },
        ]}
        pointerEvents="none"
      >
        <Icon name="heart" size={80} color={colors.error} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  likeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  disabled: {
    opacity: 0.5,
  },
  heartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingHeart: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  particle: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  likeCount: {
    marginTop: 4,
    fontWeight: '600',
  },
  doubleTapHeart: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
});

export default EnhancedLikeButton;
