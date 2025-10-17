import React, { useRef, useState } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Pressable,
  ViewStyle,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useInstagramLike, ContentType } from '../hooks/useInstagramLike';

interface EnhancedDoubleTapLikeProps {
  contentId: string;
  contentType: ContentType;
  children: React.ReactNode;
  onSingleTap?: () => void;
  onDoubleTap?: () => void;
  style?: ViewStyle;
  disabled?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export const EnhancedDoubleTapLike: React.FC<EnhancedDoubleTapLikeProps> = ({
  contentId,
  contentType,
  children,
  onSingleTap,
  onDoubleTap,
  style,
  disabled = false,
}) => {
  const { isLiked, handleDoubleTap } = useInstagramLike({
    contentId,
    contentType,
    enableAnimation: true,
    enableHaptics: true,
  });

  const [lastTap, setLastTap] = useState<number>(0);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);
  const heartId = useRef(0);

  // Animation values for floating hearts
  const createHeartAnimation = (heartData: { id: number; x: number; y: number }) => {
    const scaleAnim = new Animated.Value(0);
    const translateYAnim = new Animated.Value(0);
    const opacityAnim = new Animated.Value(1);

    // Start animation
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(translateYAnim, {
        toValue: -100,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Remove heart from array after animation
      setHearts(prev => prev.filter(h => h.id !== heartData.id));
    });

    return { scaleAnim, translateYAnim, opacityAnim };
  };

  const handlePress = (event: any) => {
    if (disabled) return;

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap < DOUBLE_TAP_DELAY) {
      // Double tap detected
      const { locationX, locationY } = event.nativeEvent;
      
      // Only like if not already liked
      if (!isLiked) {
        handleDoubleTap();
      }

      // Create floating heart at tap location
      const newHeart = {
        id: heartId.current++,
        x: locationX || screenWidth / 2,
        y: locationY || 200,
      };

      setHearts(prev => [...prev, newHeart]);
      
      onDoubleTap?.();
    } else {
      // Single tap
      setTimeout(() => {
        if (Date.now() - lastTap >= DOUBLE_TAP_DELAY) {
          onSingleTap?.();
        }
      }, DOUBLE_TAP_DELAY);
    }

    setLastTap(now);
  };

  return (
    <View style={[styles.container, style]}>
      <Pressable
        style={styles.pressable}
        onPress={handlePress}
        disabled={disabled}
      >
        {children}
        
        {/* Floating hearts */}
        {hearts.map((heart) => {
          const animations = createHeartAnimation(heart);
          return (
            <FloatingHeart
              key={heart.id}
              x={heart.x}
              y={heart.y}
              {...animations}
            />
          );
        })}
      </Pressable>
    </View>
  );
};

interface FloatingHeartProps {
  x: number;
  y: number;
  scaleAnim: Animated.Value;
  translateYAnim: Animated.Value;
  opacityAnim: Animated.Value;
}

const FloatingHeart: React.FC<FloatingHeartProps> = ({
  x,
  y,
  scaleAnim,
  translateYAnim,
  opacityAnim,
}) => {
  return (
    <Animated.View
      style={[
        styles.floatingHeart,
        {
          left: x - 15, // Center the heart
          top: y - 15,
          transform: [
            { scale: scaleAnim },
            { translateY: translateYAnim },
          ],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="none"
    >
      <Icon name="heart" size={30} color="#FF3B30" />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pressable: {
    flex: 1,
  },
  floatingHeart: {
    position: 'absolute',
    zIndex: 1000,
  },
});

export default EnhancedDoubleTapLike;
