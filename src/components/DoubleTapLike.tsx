import React, { useState, useRef } from 'react';
import {
  View,
  TouchableWithoutFeedback,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

interface DoubleTapLikeProps {
  children: React.ReactNode;
  onLike: () => void;
  isLiked: boolean;
  disabled?: boolean;
}

export const DoubleTapLike: React.FC<DoubleTapLikeProps> = ({
  children,
  onLike,
  isLiked,
  disabled = false,
}) => {
  const [lastTap, setLastTap] = useState<number>(0);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [showHeart, setShowHeart] = useState(false);

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;

    if (lastTap && (now - lastTap) < DOUBLE_PRESS_DELAY) {
      // Double tap detected
      if (!isLiked && !disabled) {
        onLike();
        showLikeAnimation();
      }
    } else {
      setLastTap(now);
    }
  };

  const showLikeAnimation = () => {
    setShowHeart(true);
    scaleAnim.setValue(0);
    opacityAnim.setValue(1);

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }),
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(500),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setShowHeart(false);
    });
  };

  return (
    <TouchableWithoutFeedback onPress={handleDoubleTap}>
      <View style={styles.container}>
        {children}
        
        {showHeart && (
          <Animated.View
            style={[
              styles.heartContainer,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
            pointerEvents="none"
          >
            <Icon name="heart" size={80} color="#FF3040" />
          </Animated.View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  heartContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
    zIndex: 1000,
    pointerEvents: 'none',
  },
});
