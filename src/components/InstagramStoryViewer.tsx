import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  Alert,
  Vibration,
  Modal,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video, { VideoRef } from 'react-native-video';
import { Story } from '../services/firebaseService';
import FirebaseService from '../services/firebaseService';
import { useAuth } from '../context/FastAuthContext';
import { UniversalLikeButton } from './UniversalLikeButton';

const { width, height } = Dimensions.get('window');

interface InstagramStoryViewerProps {
  stories: Story[];
  userStories: { [userId: string]: Story[] };
  initialUserIndex: number;
  initialStoryIndex: number;
  visible: boolean;
  onClose: () => void;
  currentUserId?: string;
  isFollowing?: boolean;
}

export const InstagramStoryViewer: React.FC<InstagramStoryViewerProps> = ({
  stories,
  userStories,
  initialUserIndex,
  initialStoryIndex,
  visible,
  onClose,
  currentUserId,
  isFollowing = false,
}) => {
  const { user } = useAuth();
  const [currentUserIndex, setCurrentUserIndex] = useState(initialUserIndex);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialStoryIndex);
  const [progress, setProgress] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const videoRef = useRef<VideoRef>(null);
  const progressInterval = useRef<any>(null);

  // Get current user's stories
  const userIds = Object.keys(userStories);
  const currentUserId_actual = userIds[currentUserIndex];
  const currentUserStories = userStories[currentUserId_actual] || [];
  const currentStory = currentUserStories[currentStoryIndex];

  // Initialize like status for current story
  useEffect(() => {
    if (currentStory && user) {
      setIsLiked(currentStory.isLiked || false);
      setLikesCount(currentStory.likesCount || 0);
    }
  }, [currentUserIndex, currentStoryIndex, currentStory, user]);

  useEffect(() => {
    if (visible && !isPaused) {
      startProgress();
    } else {
      pauseProgress();
    }
    
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [currentUserIndex, currentStoryIndex, visible, isPaused]);

  const startProgress = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
    
    // Mark story as viewed when it starts playing
    if (currentStory && user && currentStory.userId !== user.uid) {
      FirebaseService.markStoryAsViewed(currentStory.id, user.uid)
        .catch(error => console.error('Error marking story as viewed:', error));
    }
    
    setProgress(0);
    progressAnim.setValue(0);
    
    const duration = currentStory?.mediaType === 'video' ? 15000 : 5000;
    const steps = 100;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    
    progressInterval.current = setInterval(() => {
      currentStep++;
      const newProgress = currentStep / steps;
      setProgress(newProgress);
      
      Animated.timing(progressAnim, {
        toValue: newProgress,
        duration: stepDuration,
        useNativeDriver: false,
      }).start();
      
      if (currentStep >= steps) {
        nextStory();
      }
    }, stepDuration);
  };

  const pauseProgress = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
    }
  };

  const nextStory = () => {
    if (currentStoryIndex < currentUserStories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else if (currentUserIndex < userIds.length - 1) {
      setCurrentUserIndex(currentUserIndex + 1);
      setCurrentStoryIndex(0);
    } else {
      onClose();
    }
  };

  const previousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
    } else if (currentUserIndex > 0) {
      const prevUserStories = userStories[userIds[currentUserIndex - 1]];
      setCurrentUserIndex(currentUserIndex - 1);
      setCurrentStoryIndex(prevUserStories.length - 1);
    } else {
      onClose();
    }
  };

  const handleTap = (event: any) => {
    const { locationX } = event.nativeEvent;
    if (locationX < width / 2) {
      previousStory();
    } else {
      nextStory();
    }
  };

  const handleLongPress = () => {
    setIsPaused(true);
  };

  const handlePressOut = () => {
    setIsPaused(false);
  };

  const handleLike = async () => {
    if (!currentStory || !user) return;

    try {
      Vibration.vibrate(50);
      
      Animated.parallel([
        Animated.sequence([
          Animated.timing(heartScale, {
            toValue: 1.3,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(heartScale, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(heartOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(heartOpacity, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      const newLikedState = !isLiked;
      setIsLiked(newLikedState);
      setLikesCount(prev => newLikedState ? prev + 1 : Math.max(0, prev - 1));

      await FirebaseService.likeStory(currentStory.id, user.uid);
      
    } catch (error) {
      console.error('Error liking story:', error);
      setIsLiked(!isLiked);
      setLikesCount(prev => isLiked ? prev + 1 : Math.max(0, prev - 1));
    }
  };

  const handleReply = () => {
    if (!currentStory || !user || currentStory.userId === user.uid) return;
    
    // Navigate to chat to reply to story
    // Implementation depends on your navigation structure
    onClose();
  };

  if (!visible || !currentStory) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <StatusBar backgroundColor="black" barStyle="light-content" />
      <SafeAreaView style={styles.container}>
        {/* Progress bars */}
        <View style={styles.progressContainer}>
          {currentUserStories.map((_, index) => (
            <View key={index} style={styles.progressBarBackground}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width:
                      index < currentStoryIndex
                        ? '100%'
                        : index === currentStoryIndex
                        ? progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          })
                        : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Image
              source={{ uri: currentStory.user?.photoURL || 'https://via.placeholder.com/32/E1306C/FFFFFF?text=U' }}
              style={styles.avatar}
            />
            <View style={styles.userText}>
              <Text style={styles.username}>{currentStory.user?.displayName || currentStory.user?.username || 'User'}</Text>
              <Text style={styles.timeAgo}>
                {new Date(currentStory.createdAt).toLocaleTimeString()}
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            {currentStory.userId !== user?.uid && (
              <TouchableOpacity style={styles.headerButton}>
                <Icon name="ellipsis-horizontal" size={24} color="white" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.headerButton} onPress={onClose}>
              <Icon name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Story Content */}
        <TouchableOpacity
          style={styles.content}
          activeOpacity={1}
          onPress={handleTap}
          onLongPress={handleLongPress}
          onPressOut={handlePressOut}
        >
          {currentStory.mediaType === 'video' ? (
            <Video
              ref={videoRef}
              source={{ uri: currentStory.mediaUrl }}
              style={styles.media}
              resizeMode="cover"
              repeat={false}
              paused={isPaused}
            />
          ) : (
            <Image
              source={{ uri: currentStory.mediaUrl }}
              style={styles.media}
              resizeMode="cover"
            />
          )}

          {/* Like animation overlay */}
          <Animated.View
            style={[
              styles.likeAnimation,
              {
                opacity: heartOpacity,
                transform: [{ scale: heartScale }],
              },
            ]}
          >
            <Icon name="heart" size={80} color="#ff3040" />
          </Animated.View>
        </TouchableOpacity>

        {/* Bottom Actions */}
        {currentStory.userId !== user?.uid && (
          <View style={styles.bottomActions}>
            <TouchableOpacity style={styles.replyInput} onPress={handleReply}>
              <Text style={styles.replyPlaceholder}>Send message</Text>
            </TouchableOpacity>
            <View style={styles.actionButton}>
              <UniversalLikeButton
                contentId={currentStory.id}
                contentType="story"
                initialLiked={isLiked}
                initialCount={likesCount}
                variant="story"
                size="medium"
                showCount={false}
                onLikeChange={(liked, count) => {
                  setIsLiked(liked);
                  setLikesCount(count);
                }}
              />
            </View>
            <TouchableOpacity style={styles.actionButton}>
              <Icon name="paper-plane-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {/* User indicator at bottom */}
        <View style={styles.userIndicator}>
          {userIds.map((userId, index) => (
            <View
              key={userId}
              style={[
                styles.userIndicatorDot,
                { 
                  backgroundColor: index === currentUserIndex ? 'white' : 'rgba(255,255,255,0.5)' 
                }
              ]}
            />
          ))}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 2,
  },
  progressBarBackground: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1,
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  userText: {
    flex: 1,
  },
  username: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  timeAgo: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: width,
    height: height - 200,
  },
  likeAnimation: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  replyPlaceholder: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  actionButton: {
    padding: 8,
  },
  userIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  userIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
