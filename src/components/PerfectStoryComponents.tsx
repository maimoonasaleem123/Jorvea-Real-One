import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  Animated,
  Modal,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  Vibration,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import IconMaterial from 'react-native-vector-icons/MaterialIcons';
import Video from 'react-native-video';
import { useTheme } from '../context/ThemeContext';
import { Story } from '../services/firebaseService';
import FirebaseService from '../services/firebaseService';

const { width, height } = Dimensions.get('window');
const STORY_SIZE = 70;

interface UserStoryGroup {
  userId: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    profilePicture?: string;
    isVerified?: boolean;
  };
  stories: Story[];
  hasUnseenStories: boolean;
  lastSeenAt?: Date;
  totalStories: number;
}

interface StoryItemProps {
  storyGroup: UserStoryGroup;
  onPress: (storyGroup: UserStoryGroup) => void;
  isYourStory?: boolean;
  currentUserId: string;
}

interface StoryViewerProps {
  visible: boolean;
  userStories: Story[];
  initialIndex: number;
  onClose: () => void;
  currentUserId: string;
  onLike: (storyId: string) => void;
  onComment: (storyId: string, comment: string) => void;
}

// Enhanced Story Item Component with Rainbow Border
export const EnhancedStoryItem: React.FC<StoryItemProps> = ({
  storyGroup,
  onPress,
  isYourStory = false,
  currentUserId,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (storyGroup.hasUnseenStories && !isYourStory) {
      // Continuous rainbow rotation for unwatched stories
      const rotation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000, // 3 second rotation
          useNativeDriver: true,
        })
      );
      rotation.start();
      return () => rotation.stop();
    } else {
      rotateAnim.setValue(0);
    }
  }, [storyGroup.hasUnseenStories, rotateAnim, isYourStory]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onPress(storyGroup);
    });
  };

  const getBorderColors = () => {
    if (isYourStory) {
      return ['#4CAF50', '#66BB6A']; // Green for your story
    }
    if (storyGroup.hasUnseenStories) {
      // Instagram-style rainbow gradient
      return [
        '#FF6B35', // Orange
        '#F7931E', // Orange-Yellow
        '#FFD23F', // Yellow
        '#06FFA5', // Green
        '#3BF5FF', // Cyan
        '#8E44AD', // Purple
        '#E91E63', // Pink
        '#FF1744', // Red
      ];
    }
    return ['#C0C0C0', '#E0E0E0']; // Grey for watched stories
  };

  const renderBorder = () => {
    const borderColors = getBorderColors();
    
    if (storyGroup.hasUnseenStories && !isYourStory) {
      return (
        <Animated.View
          style={[
            styles.storyBorder,
            {
              transform: [
                {
                  rotate: rotateAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={borderColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBorder}
          />
        </Animated.View>
      );
    }
    
    return (
      <LinearGradient
        colors={borderColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.storyBorder, styles.gradientBorder]}
      />
    );
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.storyContainer} activeOpacity={0.7}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <View style={styles.storyWrapper}>
          {renderBorder()}
          <Image
            source={{
              uri: storyGroup.user.profilePicture || 
                   `https://ui-avatars.com/api/?name=${encodeURIComponent(storyGroup.user.username)}&background=random&color=fff&size=128`,
            }}
            style={styles.storyImage}
          />
          
          {/* Add Story Button for Your Story */}
          {isYourStory && (
            <View style={styles.addStoryButton}>
              <Icon name="add" size={16} color="#fff" />
            </View>
          )}
          
          {/* Story Count Indicator */}
          {storyGroup.totalStories > 1 && (
            <View style={styles.storyCount}>
              <Text style={styles.storyCountText}>{storyGroup.totalStories}</Text>
            </View>
          )}
        </View>
        
        <Text style={[styles.storyUsername, { color: colors.text }]} numberOfLines={1}>
          {isYourStory ? 'Your Story' : storyGroup.user.displayName || storyGroup.user.username}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Enhanced Story Viewer with Like/Comment functionality
export const EnhancedStoryViewer: React.FC<StoryViewerProps> = ({
  visible,
  userStories,
  initialIndex,
  onClose,
  currentUserId,
  onLike,
  onComment,
}) => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [comment, setComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  
  const progressAnim = useRef(new Animated.Value(0)).current;
  const heartAnim = useRef(new Animated.Value(0)).current;
  const commentInputRef = useRef<TextInput>(null);
  
  const currentStory = userStories[currentStoryIndex];
  const storyDuration = currentStory?.duration || 5000; // 5 seconds default

  useEffect(() => {
    if (visible && !isPaused) {
      startProgress();
    }
    return () => {
      progressAnim.stopAnimation();
    };
  }, [visible, currentStoryIndex, isPaused]);

  useEffect(() => {
    if (currentStory) {
      setIsLiked(currentStory.isLiked || false);
      // Mark story as viewed
      FirebaseService.markStoryAsViewed(currentStory.id, currentUserId);
    }
  }, [currentStory, currentUserId]);

  const startProgress = () => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: storyDuration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !isPaused) {
        nextStory();
      }
    });
  };

  const nextStory = () => {
    if (currentStoryIndex < userStories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else {
      onClose();
    }
  };

  const previousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
    }
  };

  const handleLike = async () => {
    if (!currentStory) return;
    
    try {
      setIsLiked(!isLiked);
      onLike(currentStory.id);
      
      // Heart animation
      heartAnim.setValue(0);
      Animated.sequence([
        Animated.timing(heartAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(heartAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      
      Vibration.vibrate(50);
    } catch (error) {
      console.error('Error liking story:', error);
      setIsLiked(isLiked); // Revert on error
    }
  };

  const handleComment = async () => {
    if (!comment.trim() || !currentStory || isSubmittingComment) return;
    
    try {
      setIsSubmittingComment(true);
      await onComment(currentStory.id, comment.trim());
      setComment('');
      setShowCommentInput(false);
      Vibration.vibrate(30);
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Error', 'Failed to add comment. Please try again.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handlePress = (event: any) => {
    const { locationX } = event.nativeEvent;
    const screenWidth = width;
    
    if (locationX < screenWidth / 2) {
      previousStory();
    } else {
      nextStory();
    }
  };

  const handleLongPressIn = () => {
    setIsPaused(true);
    progressAnim.stopAnimation();
  };

  const handleLongPressOut = () => {
    setIsPaused(false);
    startProgress();
  };

  if (!visible || !currentStory) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.storyViewerContainer}>
        {/* Progress Bars */}
        <View style={styles.progressContainer}>
          {userStories.map((_, index) => (
            <View key={index} style={styles.progressBarBackground}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: 
                      index === currentStoryIndex
                        ? progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%'],
                          })
                        : index < currentStoryIndex 
                        ? '100%' 
                        : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <Image
            source={{
              uri: currentStory.user?.profilePicture || 
                   `https://ui-avatars.com/api/?name=${encodeURIComponent(currentStory.user?.username || '')}&background=random&color=fff&size=128`,
            }}
            style={styles.userAvatar}
          />
          <View style={styles.userDetails}>
            <Text style={styles.username}>{currentStory.user?.username}</Text>
            <Text style={styles.timeAgo}>2h ago</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Story Content */}
        <TouchableOpacity
          style={styles.storyContent}
          onPress={handlePress}
          onLongPressIn={handleLongPressIn}
          onLongPressOut={handleLongPressOut}
          activeOpacity={1}
        >
          {currentStory.mediaType === 'video' ? (
            <Video
              source={{ uri: currentStory.mediaUrl }}
              style={styles.storyMedia}
              resizeMode="cover"
              paused={isPaused}
              repeat={false}
            />
          ) : (
            <Image
              source={{ uri: currentStory.mediaUrl }}
              style={styles.storyMedia}
              resizeMode="cover"
            />
          )}
        </TouchableOpacity>

        {/* Story Caption */}
        {currentStory.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.captionText}>{currentStory.caption}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
            <Animated.View
              style={[
                styles.heartContainer,
                {
                  transform: [
                    {
                      scale: heartAnim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [1, 1.5, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              <IconMaterial
                name={isLiked ? "favorite" : "favorite-border"}
                size={28}
                color={isLiked ? "#FF3040" : "#fff"}
              />
            </Animated.View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={() => setShowCommentInput(true)} 
            style={styles.actionButton}
          >
            <Icon name="chatbubble-outline" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Comment Input */}
        {showCommentInput && (
          <View style={styles.commentInputContainer}>
            <TextInput
              ref={commentInputRef}
              style={styles.commentInput}
              placeholder="Add a comment..."
              placeholderTextColor="#999"
              value={comment}
              onChangeText={setComment}
              multiline
              autoFocus
            />
            <TouchableOpacity 
              onPress={handleComment} 
              style={[
                styles.sendButton,
                { opacity: comment.trim() ? 1 : 0.5 }
              ]}
              disabled={!comment.trim() || isSubmittingComment}
            >
              {isSubmittingComment ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="send" size={20} color="#fff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => setShowCommentInput(false)} 
              style={styles.cancelButton}
            >
              <Icon name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Story Item Styles
  storyContainer: {
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 8,
  },
  storyWrapper: {
    position: 'relative',
  },
  storyBorder: {
    width: STORY_SIZE + 6,
    height: STORY_SIZE + 6,
    borderRadius: (STORY_SIZE + 6) / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientBorder: {
    width: STORY_SIZE + 6,
    height: STORY_SIZE + 6,
    borderRadius: (STORY_SIZE + 6) / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyImage: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    borderRadius: STORY_SIZE / 2,
    borderWidth: 3,
    borderColor: '#000',
  },
  addStoryButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#0095f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000',
  },
  storyCount: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3040',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  storyUsername: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 4,
    textAlign: 'center',
    maxWidth: STORY_SIZE + 10,
  },

  // Story Viewer Styles
  storyViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  progressBarBackground: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 1,
    borderRadius: 1,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  userDetails: {
    flex: 1,
    marginLeft: 12,
  },
  username: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  timeAgo: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
  },
  closeButton: {
    padding: 8,
  },
  storyContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyMedia: {
    width: width,
    height: height,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 12,
  },
  captionText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 40,
    right: 16,
    alignItems: 'center',
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  heartContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentInputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
  },
  commentInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0095f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
