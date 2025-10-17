import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  Animated,
  Alert,
} from 'react-native';
import {
  PanGestureHandler,
  State,
} from 'react-native-gesture-handler';
import Video from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import PerfectStoryService from '../services/PerfectStoryService';
import { useAuth } from '../context/FastAuthContext';

const { width, height } = Dimensions.get('window');

interface PerfectStory {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  duration: number;
  texts?: any[];
  stickers?: any[];
  viewsCount: number;
  likesCount: number;
  isLiked?: boolean;
  isViewed?: boolean;
  createdAt: string;
  expiresAt: string;
}

interface Props {
  stories: PerfectStory[];
  initialIndex: number;
  onClose: () => void;
  onStoryChange?: (index: number) => void;
}

export default function PerfectStoryViewer({
  stories,
  initialIndex,
  onClose,
  onStoryChange,
}: Props): React.JSX.Element {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  // Animations
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const likeAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;

  // Refs
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (currentStory) {
      setIsLiked(currentStory.isLiked || false);
      markStoryAsViewed();
      startProgressAnimation();
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [currentIndex]);

  const markStoryAsViewed = async () => {
    if (user && currentStory && !currentStory.isViewed) {
      try {
        await PerfectStoryService.viewStory(currentStory.id, user.uid);
      } catch (error) {
        console.error('Error marking story as viewed:', error);
      }
    }
  };

  const startProgressAnimation = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }

    setProgress(0);
    progressAnimation.setValue(0);

    const duration = currentStory.mediaType === 'video' 
      ? currentStory.duration * 1000 
      : 5000; // 5 seconds for images

    const startTime = Date.now();

    Animated.timing(progressAnimation, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        nextStory();
      }
    });

    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min(elapsed / duration, 1);
      setProgress(newProgress);
    }, 100);
  };

  const pauseProgress = () => {
    setIsPlaying(false);
    progressAnimation.stopAnimation();
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
  };

  const resumeProgress = () => {
    setIsPlaying(true);
    startProgressAnimation();
  };

  const nextStory = () => {
    if (currentIndex < stories.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      onStoryChange?.(newIndex);
    } else {
      onClose();
    }
  };

  const previousStory = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      onStoryChange?.(newIndex);
    }
  };

  const handleLike = async () => {
    if (!user) return;

    try {
      const newLikedState = !isLiked;
      setIsLiked(newLikedState);

      // Animate like
      if (newLikedState) {
        Animated.sequence([
          Animated.timing(likeAnimation, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(likeAnimation, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }

      // Update in database
      if (newLikedState) {
        await PerfectStoryService.likeStory(currentStory.id, user.uid);
      } else {
        await PerfectStoryService.unlikeStory(currentStory.id, user.uid);
      }
    } catch (error) {
      console.error('Error updating like status:', error);
      setIsLiked(!isLiked); // Revert on error
    }
  };

  const handleTap = (event: any) => {
    const { locationX } = event.nativeEvent;
    const tapZone = width / 3;

    if (locationX < tapZone) {
      // Left third - previous story
      previousStory();
    } else if (locationX > width - tapZone) {
      // Right third - next story
      nextStory();
    } else {
      // Middle third - pause/resume
      if (isPlaying) {
        pauseProgress();
      } else {
        resumeProgress();
      }
    }
  };

  const handleLongPress = () => {
    pauseProgress();
  };

  const handlePressOut = () => {
    if (!isPlaying) {
      resumeProgress();
    }
  };

  const handleMediaLoad = () => {
    setIsLoading(false);
  };

  const formatTimeRemaining = () => {
    const now = new Date();
    const expiresAt = new Date(currentStory.expiresAt);
    const remainingHours = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
    return `${remainingHours}h`;
  };

  const renderStoryContent = () => {
    if (currentStory.mediaType === 'video') {
      return (
        <Video
          source={{ uri: currentStory.mediaUrl }}
          style={styles.media}
          resizeMode="cover"
          repeat={false}
          paused={!isPlaying}
          onLoad={handleMediaLoad}
          onEnd={nextStory}
          muted={false}
        />
      );
    } else {
      return (
        <Image
          source={{ uri: currentStory.mediaUrl }}
          style={styles.media}
          resizeMode="cover"
          onLoad={handleMediaLoad}
        />
      );
    }
  };

  const renderStoryElements = () => {
    if (!currentStory.texts && !currentStory.stickers) return null;

    return (
      <View style={styles.elementsOverlay}>
        {/* Text Elements */}
        {currentStory.texts?.map((text: any, index: number) => (
          <View
            key={`text-${index}`}
            style={[
              styles.textElement,
              {
                left: text.x - 50,
                top: text.y - 20,
                transform: [
                  { rotate: `${text.rotation || 0}deg` },
                  { scale: text.scale || 1 },
                ],
              },
            ]}
          >
            <Text
              style={[
                styles.textElementText,
                {
                  color: text.color || '#FFFFFF',
                  fontSize: text.fontSize || 24,
                  fontFamily: text.fontFamily || 'System',
                },
              ]}
            >
              {text.text}
            </Text>
          </View>
        ))}

        {/* Sticker Elements */}
        {currentStory.stickers?.map((sticker: any, index: number) => (
          <View
            key={`sticker-${index}`}
            style={[
              styles.stickerElement,
              {
                left: sticker.x - 25,
                top: sticker.y - 25,
                transform: [
                  { rotate: `${sticker.rotation || 0}deg` },
                  { scale: sticker.scale || 1 },
                ],
              },
            ]}
          >
            <Text style={styles.stickerEmoji}>{sticker.emoji}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Progress Bars */}
      <View style={styles.progressContainer}>
        {stories.map((_, index) => (
          <View key={index} style={styles.progressBarBackground}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  width: index === currentIndex 
                    ? progressAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      })
                    : index < currentIndex ? '100%' : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>

      {/* Story Content */}
      <TouchableOpacity
        style={styles.contentContainer}
        activeOpacity={1}
        onPress={handleTap}
        onLongPress={handleLongPress}
        onPressOut={handlePressOut}
      >
        {renderStoryContent()}
        {renderStoryElements()}

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {/* Pause Indicator */}
        {!isPlaying && !isLoading && (
          <View style={styles.pauseIndicator}>
            <Icon name="pause" size={60} color="rgba(255,255,255,0.8)" />
          </View>
        )}
      </TouchableOpacity>

      {/* Story Header */}
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'transparent']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Image
              source={{ 
                uri: currentStory.userAvatar || 'https://via.placeholder.com/40x40/666/fff?text=U' 
              }}
              style={styles.userAvatar}
            />
            <View style={styles.userDetails}>
              <Text style={styles.username}>{currentStory.username}</Text>
              <Text style={styles.timeRemaining}>{formatTimeRemaining()} remaining</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Story Footer */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.footerGradient}
      >
        <View style={styles.footer}>
          <View style={styles.storyStats}>
            <View style={styles.statItem}>
              <Icon name="visibility" size={16} color="#fff" />
              <Text style={styles.statText}>{currentStory.viewsCount}</Text>
            </View>
            <View style={styles.statItem}>
              <Icon name="favorite" size={16} color="#fff" />
              <Text style={styles.statText}>{currentStory.likesCount}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.likeButton}
            onPress={handleLike}
          >
            <Animated.View
              style={[
                styles.likeButtonContent,
                {
                  transform: [
                    {
                      scale: likeAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.3],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Icon
                name={isLiked ? "favorite" : "favorite-border"}
                size={28}
                color={isLiked ? "#FF6B6B" : "#fff"}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    zIndex: 10,
    flexDirection: 'row',
    gap: 4,
  },
  progressBarBackground: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },
  contentContainer: {
    flex: 1,
  },
  media: {
    width: '100%',
    height: '100%',
  },
  elementsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  textElement: {
    position: 'absolute',
    padding: 5,
  },
  textElementText: {
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  stickerElement: {
    position: 'absolute',
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerEmoji: {
    fontSize: 30,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  pauseIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 80,
    paddingBottom: 15,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  timeRemaining: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 40,
  },
  storyStats: {
    flexDirection: 'row',
    gap: 15,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  likeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeButtonContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
