import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  SafeAreaView,
  StatusBar,
  Modal,
  Animated,
  PanResponder,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import Video from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService, { Story as FirebaseStory } from '../services/firebaseService';

const { width, height } = Dimensions.get('window');

interface StoryViewerProps {
  visible: boolean;
  stories: FirebaseStory[];
  initialStoryIndex: number;
  onClose: () => void;
}

const StoryViewer: React.FC<StoryViewerProps> = ({
  visible,
  stories,
  initialStoryIndex,
  onClose,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialStoryIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  const storyDuration = 7000; // 7 seconds per story
  const progressTimer = useRef<NodeJS.Timeout | null>(null);

  const currentStory = stories[currentStoryIndex];

  // Auto progress animation
  const startProgress = useCallback(() => {
    if (!currentStory || isPaused) return;

    progressAnim.setValue(0);
    
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: storyDuration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !isPaused) {
        goToNextStory();
      }
    });
  }, [currentStory, isPaused]);

  const pauseProgress = useCallback(() => {
    setIsPaused(true);
    progressAnim.stopAnimation();
  }, [progressAnim]);

  const resumeProgress = useCallback(() => {
    setIsPaused(false);
    startProgress();
  }, [startProgress]);

  const goToNextStory = useCallback(() => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
      setLoading(true);
    } else {
      onClose();
    }
  }, [currentStoryIndex, stories.length, onClose]);

  const goToPrevStory = useCallback(() => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
      setLoading(true);
    } else {
      onClose();
    }
  }, [currentStoryIndex, onClose]);

  // Mark story as viewed
  const markAsViewed = useCallback(async () => {
    if (currentStory && user) {
      try {
        console.log(`Marking story ${currentStory.id} as viewed by ${user.uid}`);
        await FirebaseService.markStoryAsViewed(currentStory.id, user.uid);
        console.log(`Successfully marked story ${currentStory.id} as viewed`);
      } catch (error) {
        console.error('Error marking story as viewed:', error);
      }
    }
  }, [currentStory, user]);

  // Pan responder for swipe gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 50 || Math.abs(gestureState.dy) > 50;
      },
      onPanResponderMove: () => {
        pauseProgress();
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          // Swipe down to close
          onClose();
        } else if (gestureState.dx > 100) {
          // Swipe right to go to previous story
          goToPrevStory();
        } else if (gestureState.dx < -100) {
          // Swipe left to go to next story
          goToNextStory();
        } else {
          resumeProgress();
        }
      },
    })
  ).current;

  // Handle tap navigation
  const handleTap = useCallback((event: any) => {
    const { locationX } = event.nativeEvent;
    const screenWidth = width;
    
    if (locationX < screenWidth / 2) {
      // Tap left side - previous story
      goToPrevStory();
    } else {
      // Tap right side - next story
      goToNextStory();
    }
  }, [goToPrevStory, goToNextStory]);

  // Effects
  useEffect(() => {
    if (visible && currentStory) {
      markAsViewed();
      startProgress();
    }
    
    return () => {
      if (progressTimer.current) {
        clearTimeout(progressTimer.current);
      }
      progressAnim.stopAnimation();
    };
  }, [visible, currentStory, markAsViewed, startProgress]);

  useEffect(() => {
    setCurrentStoryIndex(initialStoryIndex);
  }, [initialStoryIndex]);

  if (!visible || !currentStory) {
    return null;
  }

  const isVideo = currentStory.mediaType === 'video';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.container} {...panResponder.panHandlers}>
        {/* Background */}
        <View style={styles.background}>
          {isVideo ? (
            <Video
              source={{ uri: currentStory.mediaUrl }}
              style={styles.media}
              resizeMode="cover"
              repeat={false}
              paused={isPaused}
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                Alert.alert('Error', 'Failed to load story');
              }}
            />
          ) : (
            <Image
              source={{ uri: currentStory.mediaUrl }}
              style={styles.media}
              resizeMode="cover"
              onLoad={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                Alert.alert('Error', 'Failed to load story');
              }}
            />
          )}
        </View>

        {/* Gradient overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.3)']}
          style={styles.overlay}
        />

        {/* Progress bars */}
        <View style={styles.progressContainer}>
          {stories.map((_, index) => (
            <View key={index} style={styles.progressBarContainer}>
              <View style={[styles.progressBarBackground, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    backgroundColor: '#FFFFFF',
                    width: index === currentStoryIndex
                      ? progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        })
                      : index < currentStoryIndex ? '100%' : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Story header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Image
              source={{ 
                uri: currentStory.user?.profilePicture || 'https://via.placeholder.com/40x40.png?text=👤' 
              }}
              style={styles.avatar}
            />
            <Text style={styles.username}>
              {currentStory.user?.username || currentStory.user?.displayName || 'User'}
            </Text>
            <Text style={styles.timestamp}>
              {getTimeAgo(currentStory.createdAt)}
            </Text>
          </View>
          
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Loading indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        )}

        {/* Tap areas for navigation */}
        <View style={styles.tapAreas}>
          <TouchableOpacity
            style={styles.tapArea}
            onPress={() => handleTap({ nativeEvent: { locationX: width * 0.25 } })}
            activeOpacity={1}
          />
          <TouchableOpacity
            style={styles.tapArea}
            onPress={() => handleTap({ nativeEvent: { locationX: width * 0.75 } })}
            activeOpacity={1}
          />
        </View>

        {/* Story caption */}
        {currentStory.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.caption}>{currentStory.caption}</Text>
          </View>
        )}

        {/* Navigation indicators */}
        <View style={styles.navigationHints}>
          <View style={styles.leftHint}>
            <Icon name="chevron-back" size={20} color="rgba(255,255,255,0.5)" />
          </View>
          <View style={styles.rightHint}>
            <Icon name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Utility function to get time ago
const getTimeAgo = (dateString: string): string => {
  const now = new Date();
  const storyDate = new Date(dateString);
  const diffInMs = now.getTime() - storyDate.getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  
  if (diffInHours < 1) {
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    return `${diffInMinutes}m`;
  } else if (diffInHours < 24) {
    return `${diffInHours}h`;
  } else {
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d`;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  media: {
    width: width,
    height: height,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  progressContainer: {
    position: 'absolute',
    top: StatusBar.currentHeight || 44,
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
    zIndex: 1000,
  },
  progressBarContainer: {
    flex: 1,
    height: 2,
    position: 'relative',
  },
  progressBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 1,
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: 1,
  },
  header: {
    position: 'absolute',
    top: (StatusBar.currentHeight || 44) + 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1000,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  timestamp: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  tapAreas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  tapArea: {
    flex: 1,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 16,
    lineHeight: 22,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  navigationHints: {
    position: 'absolute',
    top: '50%',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    pointerEvents: 'none',
  },
  leftHint: {
    alignItems: 'flex-start',
  },
  rightHint: {
    alignItems: 'flex-end',
  },
});

export default StoryViewer;
