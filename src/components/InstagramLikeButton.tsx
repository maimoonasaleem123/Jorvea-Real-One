import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useInstagramLike, ContentType } from '../hooks/useInstagramLike';

interface InstagramLikeButtonProps {
  contentId: string;
  contentType: ContentType;
  initialLiked?: boolean;
  initialCount?: number;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'story' | 'minimal';
  showCount?: boolean;
  showAnimation?: boolean;
  enableHaptics?: boolean;
  enableDoubleTap?: boolean;
  style?: ViewStyle;
  iconStyle?: ViewStyle;
  textStyle?: TextStyle;
  onLikeChange?: (isLiked: boolean, likesCount: number) => void;
  disabled?: boolean;
}

export const InstagramLikeButton: React.FC<InstagramLikeButtonProps> = ({
  contentId,
  contentType,
  initialLiked = false,
  initialCount = 0,
  size = 'medium',
  variant = 'default',
  showCount = true,
  showAnimation = true,
  enableHaptics = true,
  enableDoubleTap = false,
  style,
  iconStyle,
  textStyle,
  onLikeChange,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const { 
    isLiked, 
    likesCount, 
    isLoading, 
    isAnimating, 
    handleLike, 
    handleDoubleTap,
    getLikeText 
  } = useInstagramLike({
    contentId,
    contentType,
    initialLiked,
    initialCount,
    onLikeChange,
    enableHaptics,
    enableAnimation: showAnimation,
  });

  // Animations
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  // Handle like animation
  useEffect(() => {
    if (isAnimating && showAnimation) {
      // Heart scale animation
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
      Animated.sequence([
        Animated.timing(heartAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(heartAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isAnimating, showAnimation, scaleAnim, heartAnim]);

  // Handle press animation
  const handlePressIn = () => {
    if (!disabled) {
      Animated.timing(pulseAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  };

  // Get icon size based on size prop
  const getIconSize = () => {
    switch (size) {
      case 'small': return 20;
      case 'medium': return 24;
      case 'large': return 28;
      default: return 24;
    }
  };

  // Get text size based on size prop
  const getTextSize = () => {
    switch (size) {
      case 'small': return 12;
      case 'medium': return 14;
      case 'large': return 16;
      default: return 14;
    }
  };

  // Render like button based on variant
  const renderLikeButton = () => {
    const iconSize = getIconSize();
    const iconName = isLiked ? 'heart' : 'heart-outline';
    const iconColor = isLiked ? '#FF3B30' : colors.text;

    if (variant === 'story') {
      return (
        <View style={styles.storyButton}>
          <LinearGradient
            colors={isLiked ? ['#FF3B30', '#FF6B6B'] : ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)']}
            style={styles.storyGradient}
          >
            <Icon name={iconName} size={iconSize} color={isLiked ? '#FFFFFF' : '#FFFFFF'} />
          </LinearGradient>
        </View>
      );
    }

    if (variant === 'minimal') {
      return (
        <Icon 
          name={iconName} 
          size={iconSize} 
          color={iconColor}
          style={[iconStyle]}
        />
      );
    }

    return (
      <Icon 
        name={iconName} 
        size={iconSize} 
        color={iconColor}
        style={[iconStyle]}
      />
    );
  };

  const Component = enableDoubleTap ? Pressable : TouchableOpacity;
  const onPress = enableDoubleTap ? handleDoubleTap : handleLike;

  return (
    <View style={[styles.container, style]}>
      <Component
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isLoading}
        style={styles.buttonContainer}
        activeOpacity={0.7}
      >
        <Animated.View 
          style={[
            styles.iconContainer, 
            { 
              transform: [
                { scale: Animated.multiply(scaleAnim, pulseAnim) }
              ] 
            }
          ]}
        >
          {renderLikeButton()}
        </Animated.View>
      </Component>

      {showCount && likesCount > 0 && (
        <Text style={[styles.likeText, { color: colors.text, fontSize: getTextSize() }, textStyle]}>
          {getLikeText()}
        </Text>
      )}

      {/* Floating heart animation */}
      {showAnimation && (
        <Animated.View
          style={[
            styles.floatingHeart,
            {
              opacity: heartAnim,
              transform: [
                {
                  translateY: heartAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -30],
                  }),
                },
                {
                  scale: heartAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1.2, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <Icon name="heart" size={24} color="#FF3B30" />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  buttonContainer: {
    padding: 8,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  storyGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeText: {
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 8,
  },
  floatingHeart: {
    position: 'absolute',
    left: 16,
    top: -10,
  },
});

export default InstagramLikeButton;
