import React, { useState, useRef, useEffect } from 'react';
import { 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  View, 
  Text,
  Vibration,
  Easing,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface LikeButtonProps {
  isLiked: boolean;
  likesCount: number;
  onPress: () => void;
  size?: number;
  color?: string;
  showCount?: boolean;
  disabled?: boolean;
  style?: any;
}

const LikeButton: React.FC<LikeButtonProps> = ({
  isLiked,
  likesCount,
  onPress,
  size = 24,
  color = '#000',
  showCount = true,
  disabled = false,
  style,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [localLiked, setLocalLiked] = useState(isLiked);
  const [localCount, setLocalCount] = useState(likesCount);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartScaleAnim = useRef(new Animated.Value(1)).current;
  const countScaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  // Floating hearts animation
  const floatingHearts = useRef<Animated.Value[]>([]).current;
  const [showFloatingHearts, setShowFloatingHearts] = useState(false);

  useEffect(() => {
    setLocalLiked(isLiked);
    setLocalCount(likesCount);
  }, [isLiked, likesCount]);

  const createFloatingHeart = () => {
    const heart = new Animated.Value(0);
    floatingHearts.push(heart);
    
    Animated.timing(heart, {
      toValue: 1,
      duration: 1500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      const index = floatingHearts.indexOf(heart);
      if (index > -1) {
        floatingHearts.splice(index, 1);
      }
    });
  };

  const animateHeartBeat = () => {
    Animated.sequence([
      Animated.timing(heartScaleAnim, {
        toValue: 1.3,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(heartScaleAnim, {
        toValue: 1,
        duration: 150,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateButtonPress = () => {
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

  const animateCountChange = () => {
    Animated.sequence([
      Animated.timing(countScaleAnim, {
        toValue: 1.2,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(countScaleAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateLike = () => {
    // Create floating hearts effect
    setShowFloatingHearts(true);
    createFloatingHeart();
    
    // Bounce animation for the heart
    Animated.sequence([
      Animated.timing(bounceAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: true,
      }),
      Animated.timing(bounceAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowFloatingHearts(false));

    // Heart beat animation
    animateHeartBeat();
    
    // Haptic feedback
    Vibration.vibrate(50);
  };

  const animateUnlike = () => {
    // Simple scale down animation
    Animated.timing(heartScaleAnim, {
      toValue: 0.8,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(heartScaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
  };

  const handlePress = async () => {
    if (disabled || isAnimating) return;
    
    setIsAnimating(true);
    
    // Optimistic update
    const wasLiked = localLiked;
    const newLikedState = !wasLiked;
    const newCount = wasLiked ? localCount - 1 : localCount + 1;
    
    setLocalLiked(newLikedState);
    setLocalCount(newCount);
    
    // Animate button press
    animateButtonPress();
    animateCountChange();
    
    // Animate based on like/unlike
    if (newLikedState) {
      animateLike();
    } else {
      animateUnlike();
    }
    
    try {
      // Call the actual like function
      await onPress();
    } catch (error) {
      // Revert optimistic update on error
      setLocalLiked(wasLiked);
      setLocalCount(localCount);
      console.error('Error liking post:', error);
    } finally {
      setIsAnimating(false);
    }
  };

  const formatCount = (count: number): string => {
    if (count === 0) return '';
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
    return `${(count / 1000000).toFixed(1)}m`;
  };

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity 
          onPress={handlePress} 
          style={styles.button}
          disabled={disabled || isAnimating}
          activeOpacity={0.7}
        >
          <Animated.View 
            style={[
              styles.heartContainer,
              { transform: [{ scale: heartScaleAnim }] }
            ]}
          >
            <Icon
              name={localLiked ? 'heart' : 'heart-outline'}
              size={size}
              color={localLiked ? '#FF3040' : color}
            />
            
            {/* Bounce effect overlay when liking */}
            {showFloatingHearts && (
              <Animated.View
                style={[
                  styles.bounceHeart,
                  {
                    transform: [
                      {
                        scale: bounceAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 1.5],
                        }),
                      },
                    ],
                    opacity: bounceAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, 1, 0],
                    }),
                  },
                ]}
              >
                <Icon name="heart" size={size} color="#FF3040" />
              </Animated.View>
            )}
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      {/* Like count */}
      {showCount && localCount > 0 && (
        <Animated.View style={{ transform: [{ scale: countScaleAnim }] }}>
          <Text style={[styles.countText, { color }]}>
            {formatCount(localCount)}
          </Text>
        </Animated.View>
      )}

      {/* Floating hearts */}
      {showFloatingHearts && floatingHearts.map((heart, index) => (
        <Animated.View
          key={index}
          style={[
            styles.floatingHeart,
            {
              transform: [
                {
                  translateY: heart.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -50],
                  }),
                },
                {
                  translateX: heart.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, (index % 2 === 0 ? 1 : -1) * 20],
                  }),
                },
                {
                  scale: heart.interpolate({
                    inputRange: [0, 0.2, 1],
                    outputRange: [0, 1, 0],
                  }),
                },
              ],
              opacity: heart.interpolate({
                inputRange: [0, 0.2, 0.8, 1],
                outputRange: [0, 1, 1, 0],
              }),
            },
          ]}
        >
          <Icon name="heart" size={size * 0.8} color="#FF3040" />
        </Animated.View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  button: {
    padding: 8,
    borderRadius: 20,
  },
  heartContainer: {
    position: 'relative',
  },
  bounceHeart: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  floatingHeart: {
    position: 'absolute',
    left: 4,
    top: -10,
    pointerEvents: 'none',
  },
});

export default LikeButton;
