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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { useTheme } from '../context/ThemeContext';
import { Story } from '../types';

const { width, height } = Dimensions.get('window');
const STORY_SIZE = 70;
const STORY_MARGIN = 10;

interface UserStoryGroup {
  userId: string;
  user: {
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

interface InstagramStoryItemProps {
  storyGroup: UserStoryGroup;
  onPress: (storyGroup: UserStoryGroup) => void;
  isYourStory?: boolean;
  index: number;
}

interface StoryListProps {
  stories: Story[];
  onViewStory: (storyGroup: UserStoryGroup, initialIndex: number) => void;
  onCreateStory: () => void;
  currentUserId?: string;
}

interface StoryViewerProps {
  visible: boolean;
  userStories: Story[];
  initialIndex: number;
  onClose: () => void;
  currentUser?: {
    username: string;
    profilePicture?: string;
  };
}

const InstagramStoryItem: React.FC<InstagramStoryItemProps> = ({
  storyGroup,
  onPress,
  isYourStory = false,
  index,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (storyGroup.hasUnseenStories) {
      // Enhanced continuous rotation for unseen stories with smoother animation
      const rotation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 4000, // Slower rotation for better visual appeal
          useNativeDriver: true,
        })
      );
      rotation.start();
      return () => rotation.stop();
    } else {
      // Reset rotation for watched stories
      rotateAnim.setValue(0);
    }
  }, [storyGroup.hasUnseenStories, rotateAnim]);

  const handlePress = () => {
    // Scale animation on press
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
      return ['#4CAF50', '#66BB6A']; // Enhanced green gradient for your story
    }
    if (storyGroup.hasUnseenStories) {
      // Enhanced vibrant rainbow gradient for unwatched stories - More Instagram-like
      return [
        '#FF6B35', // Vibrant orange
        '#F7931E', // Bright orange
        '#FFD23F', // Golden yellow
        '#06FFA5', // Neon green
        '#3BF5FF', // Electric cyan
        '#8E44AD', // Purple
        '#E91E63', // Pink
        '#FF1744', // Red
        '#FF9800', // Orange
        '#FFEB3B', // Yellow
        '#4CAF50', // Green
        '#2196F3', // Blue
        '#9C27B0', // Purple
        '#E91E63', // Pink again for smooth loop
      ];
    }
    return ['#C7C7CC', '#E0E0E0']; // Lighter gray gradient for watched stories
  };

  const renderBorder = () => {
    const colors = getBorderColors();
    
    if (storyGroup.hasUnseenStories) {
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
            colors={colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.07, 0.14, 0.21, 0.28, 0.35, 0.42, 0.49, 0.56, 0.63, 0.7, 0.77, 0.84, 0.91]} // Smooth rainbow transitions
            style={styles.gradientBorder}
          />
        </Animated.View>
      );
    }
    
    // Enhanced border for watched stories and your story
    return (
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.storyBorder, styles.gradientBorder]}
      />
    );
  };

  return (
    <TouchableOpacity 
      onPress={handlePress} 
      style={styles.storyItemContainer}
      activeOpacity={0.7}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <View style={styles.storyImageContainer}>
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
              <Icon name="add" size={18} color="#fff" />
            </View>
          )}
          
          {/* Story Count Badge */}
          {storyGroup.totalStories > 1 && (
            <View style={styles.storyCountBadge}>
              <Text style={styles.storyCountText}>{storyGroup.totalStories}</Text>
            </View>
          )}
          
          {/* Verified Badge */}
          {storyGroup.user.isVerified && (
            <View style={styles.verifiedBadge}>
              <Icon name="checkmark-circle" size={16} color="#1DA1F2" />
            </View>
          )}
        </View>
        
        <Text
          style={[styles.storyUsername, { color: colors.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {isYourStory ? 'Your story' : storyGroup.user.username}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Simple viewed stories tracking (in memory for demo)
let viewedStoriesCache: string[] = [];

// Function to mark stories as viewed
export const markStoriesAsViewed = (storyIds: string[]): void => {
  storyIds.forEach(id => {
    if (!viewedStoriesCache.includes(id)) {
      viewedStoriesCache.push(id);
    }
  });
};

// Function to mark a single story as viewed
export const markStoryAsViewed = (storyId: string): void => {
  if (!viewedStoriesCache.includes(storyId)) {
    viewedStoriesCache.push(storyId);
  }
};

// Helper function to group stories by user with proper view tracking
const groupStoriesByUser = (stories: Story[], currentUserId?: string): UserStoryGroup[] => {
  const userGroups: { [userId: string]: UserStoryGroup } = {};
  const now = new Date();

  // Get viewed stories from cache
  const getViewedStories = (): string[] => {
    return viewedStoriesCache;
  };

  const viewedStoryIds = getViewedStories();

  // Group stories by user
  stories.forEach(story => {
    const userId = story.userId;
    
    if (!userGroups[userId]) {
      userGroups[userId] = {
        userId,
        user: {
          username: story.user?.username || 'Unknown',
          displayName: story.user?.displayName || 'Unknown',
          profilePicture: story.user?.profilePicture,
          isVerified: story.user?.isVerified || false,
        },
        stories: [],
        hasUnseenStories: false,
        totalStories: 0,
      };
    }

    userGroups[userId].stories.push(story);
    userGroups[userId].totalStories += 1;
    
    // Check if story is unseen - if any story in the group hasn't been viewed
    const storyTime = new Date(story.createdAt);
    const hoursDiff = (now.getTime() - storyTime.getTime()) / (1000 * 60 * 60);
    
    // Story is considered "unseen" if:
    // 1. It's less than 24 hours old AND
    // 2. The user hasn't viewed it yet
    if (hoursDiff < 24 && !viewedStoryIds.includes(story.id)) {
      userGroups[userId].hasUnseenStories = true;
    }
  });

  // Sort stories within each group by creation time
  Object.values(userGroups).forEach(group => {
    group.stories.sort((a, b) => {
      const timeA = new Date(a.createdAt);
      const timeB = new Date(b.createdAt);
      return timeA.getTime() - timeB.getTime();
    });
  });

  const groupsArray = Object.values(userGroups);

  // Sort groups: current user first, then by unseen stories, then by latest story
  return groupsArray.sort((a, b) => {
    // Current user always first
    if (currentUserId) {
      if (a.userId === currentUserId) return -1;
      if (b.userId === currentUserId) return 1;
    }
    
    // Unseen stories before seen stories
    if (a.hasUnseenStories && !b.hasUnseenStories) return -1;
    if (!a.hasUnseenStories && b.hasUnseenStories) return 1;
    
    // Sort by latest story time
    const latestA = Math.max(...a.stories.map(s => new Date(s.createdAt).getTime()));
    const latestB = Math.max(...b.stories.map(s => new Date(s.createdAt).getTime()));
    return latestB - latestA;
  });
};

export const InstagramStoryList: React.FC<StoryListProps> = ({
  stories,
  onViewStory,
  onCreateStory,
  currentUserId,
}) => {
  const { colors } = useTheme();
  const [storyGroups, setStoryGroups] = useState<UserStoryGroup[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const groups = groupStoriesByUser(stories, currentUserId);
    
    // Add "Your story" option if user can create stories
    if (currentUserId) {
      const yourStoryGroup = groups.find(group => group.userId === currentUserId);
      
      if (!yourStoryGroup) {
        // Add empty "Your story" option for creating first story
        groups.unshift({
          userId: 'your-story',
          user: {
            username: 'Your story',
            displayName: 'Your story',
            profilePicture: undefined,
          },
          stories: [],
          hasUnseenStories: false,
          totalStories: 0,
        });
      }
    }
    
    setStoryGroups(groups);
  }, [stories, currentUserId, refreshKey]);

  const handleViewStory = (storyGroup: UserStoryGroup, initialIndex: number) => {
    // Mark all stories in the group as viewed
    const storyIds = storyGroup.stories.map(story => story.id);
    markStoriesAsViewed(storyIds);
    
    // Trigger re-render to update borders
    setRefreshKey(prev => prev + 1);
    
    // Call the original onViewStory
    onViewStory(storyGroup, initialIndex);
  };

  const renderStoryItem = ({ item, index }: { item: UserStoryGroup; index: number }) => {
    const isYourStory = item.userId === currentUserId || item.userId === 'your-story';

    return (
      <InstagramStoryItem
        storyGroup={item}
        onPress={(storyGroup) => {
          if (isYourStory && storyGroup.stories.length === 0) {
            onCreateStory();
          } else {
            handleViewStory(storyGroup, 0);
          }
        }}
        isYourStory={isYourStory}
        index={index}
      />
    );
  };

  if (storyGroups.length === 0) {
    return null;
  }

  return (
    <View style={[styles.storyListContainer, { backgroundColor: colors.background }]}>
      <FlatList
        data={storyGroups}
        renderItem={renderStoryItem}
        keyExtractor={(item) => item.userId}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storyListContent}
        ItemSeparatorComponent={() => <View style={{ width: STORY_MARGIN }} />}
      />
    </View>
  );
};

export const InstagramStoryViewer: React.FC<StoryViewerProps> = ({
  visible,
  userStories,
  initialIndex = 0,
  onClose,
  currentUser,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showActions, setShowActions] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<any>(null);
  const longPressTimer = useRef<any>(null);

  const currentStory = userStories && userStories[currentIndex];

  // Reset to initial index when stories change
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setIsLoading(true);
    }
  }, [visible, initialIndex, userStories]);

  useEffect(() => {
    if (visible && currentStory && !isPaused && !isLoading) {
      startStoryTimer();
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, [currentIndex, visible, isPaused, isLoading]);

  const startStoryTimer = useCallback(() => {
    if (!currentStory) return;
    
    progressAnim.setValue(0);
    setProgress(0);
    
    const duration = currentStory.mediaType === 'video' ? 15000 : 7000; // 15s for video, 7s for image
    
    Animated.timing(progressAnim, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && !isPaused) {
        handleNext();
      }
    });
  }, [currentStory, isPaused]);

  const pauseStory = useCallback(() => {
    setIsPaused(true);
    progressAnim.stopAnimation();
  }, [progressAnim]);

  const resumeStory = useCallback(() => {
    setIsPaused(false);
    if (!isLoading) {
      startStoryTimer();
    }
  }, [isLoading, startStoryTimer]);

  const handleNext = useCallback(() => {
    if (!userStories) return;
    
    Animated.timing(fadeAnim, {
      toValue: 0.5,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      if (currentIndex < userStories.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsLoading(true);
      } else {
        onClose();
      }
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
  }, [currentIndex, userStories, onClose, fadeAnim]);

  const handlePrevious = useCallback(() => {
    if (!userStories) return;
    
    Animated.timing(fadeAnim, {
      toValue: 0.5,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      if (currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
        setIsLoading(true);
      } else {
        onClose();
      }
      
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    });
  }, [currentIndex, userStories, onClose, fadeAnim]);

  const handleTapLeft = useCallback(() => {
    progressAnim.stopAnimation();
    handlePrevious();
  }, [progressAnim, handlePrevious]);

  const handleTapRight = useCallback(() => {
    progressAnim.stopAnimation();
    handleNext();
  }, [progressAnim, handleNext]);

  const handleLongPressStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      pauseStory();
      setShowActions(true);
    }, 200);
  }, [pauseStory]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    if (showActions) {
      setShowActions(false);
      resumeStory();
    }
  }, [showActions, resumeStory]);

  const handleMediaLoad = useCallback(() => {
    setIsLoading(false);
    if (!isPaused) {
      startStoryTimer();
    }
  }, [isPaused, startStoryTimer]);

  // Mark story as viewed and implement all interactions
  useEffect(() => {
    if (currentStory) {
      // Mark story as viewed after 1 second
      const viewTimer = setTimeout(() => {
        // markStoryAsViewed(currentStory.id);
      }, 1000);
      
      return () => clearTimeout(viewTimer);
    }
  }, [currentStory]);

  // Handle like functionality
  const handleLike = useCallback(async () => {
    if (!currentStory) return;
    try {
      // Toggle like status
      const isLiked = currentStory.isLiked || false;
      // Update Firebase
      // await toggleStoryLike(currentStory.id, !isLiked);
      Alert.alert('Liked!', 'Story liked successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to like story');
    }
  }, [currentStory]);

  // Handle send/share functionality
  const handleSend = useCallback(() => {
    if (!currentStory) return;
    Alert.alert('Share Story', 'Share functionality coming soon!');
  }, [currentStory]);

  // Handle save functionality
  const handleSave = useCallback(async () => {
    if (!currentStory) return;
    try {
      Alert.alert('Saved!', 'Story saved to your collection');
    } catch (error) {
      Alert.alert('Error', 'Failed to save story');
    }
  }, [currentStory]);

  // Handle more options
  const handleMore = useCallback(() => {
    Alert.alert(
      'Story Options',
      'Choose an action',
      [
        { text: 'Report', onPress: () => Alert.alert('Reported', 'Story reported successfully') },
        { text: 'Copy Link', onPress: () => Alert.alert('Copied', 'Link copied to clipboard') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, []);

  if (!visible || !currentStory || !userStories) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      hardwareAccelerated
      onRequestClose={onClose}
      presentationStyle="fullScreen"
    >
      <StatusBar backgroundColor="#000000" barStyle="light-content" hidden />
      <View style={styles.storyViewerContainer}>
        <Animated.View style={[styles.storyWrapper, { opacity: fadeAnim }]}>
          
          {/* Progress Bars Container */}
          <SafeAreaView style={styles.progressSafeArea}>
            <View style={styles.progressContainer}>
              {userStories.map((_, index) => (
                <View key={`progress-${index}`} style={styles.progressBarBackground}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      {
                        width: index === currentIndex 
                          ? progressAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%'],
                              extrapolate: 'clamp',
                            })
                          : index < currentIndex ? '100%' : '0%',
                      },
                    ]}
                  />
                </View>
              ))}
            </View>

            {/* Enhanced Story Header */}
            <View style={styles.storyHeader}>
              <View style={styles.storyUserInfo}>
                <View style={styles.avatarContainer}>
                  <Image
                    source={{
                      uri: currentStory.user?.profilePicture || 
                           `https://ui-avatars.com/api/?name=${encodeURIComponent(currentStory.user?.username || 'User')}&background=random&color=fff&size=128`,
                    }}
                    style={styles.storyHeaderAvatar}
                  />
                  {currentStory.user?.isOnline && (
                    <View style={styles.onlineIndicator} />
                  )}
                </View>
                
                <View style={styles.storyUserDetails}>
                  <View style={styles.usernameContainer}>
                    <Text style={styles.storyHeaderUsername}>
                      {currentStory.user?.username || 'Unknown'}
                    </Text>
                    {currentStory.user?.isVerified && (
                      <Icon name="checkmark-circle" size={16} color="#1DA1F2" style={styles.verifiedIcon} />
                    )}
                  </View>
                  <Text style={styles.storyHeaderTime}>
                    {formatStoryTime(new Date(currentStory.createdAt))}
                  </Text>
                </View>
              </View>
              
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={pauseStory} style={styles.headerButton}>
                  <Icon name={isPaused ? "play" : "pause"} size={20} color="#fff" />
                </TouchableOpacity>
                
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Icon name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>

          {/* Loading Indicator */}
          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}

          {/* Enhanced Story Content */}
          <View style={styles.storyContent}>
            {currentStory.mediaType === 'image' ? (
              <Image
                source={{ uri: currentStory.mediaUrl }}
                style={styles.storyMedia}
                resizeMode="contain"
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={handleMediaLoad}
                onError={() => setIsLoading(false)}
              />
            ) : currentStory.mediaType === 'video' ? (
              <Video
                source={{ uri: currentStory.mediaUrl }}
                style={styles.storyMedia}
                resizeMode="contain"
                paused={isPaused || isLoading}
                repeat={false}
                onLoad={handleMediaLoad}
                onEnd={handleNext}
                onError={() => setIsLoading(false)}
                muted={false}
                controls={false}
                playWhenInactive={false}
                playInBackground={false}
              />
            ) : (
              <View style={styles.unsupportedContent}>
                <Icon name="alert-circle-outline" size={48} color="#fff" />
                <Text style={styles.unsupportedText}>Unsupported media type</Text>
              </View>
            )}

            {/* Story Caption */}
            {currentStory.caption && (
              <View style={styles.captionContainer}>
                <Text style={styles.captionText}>{currentStory.caption}</Text>
              </View>
            )}
          </View>

          {/* Enhanced Tap Areas with Visual Feedback */}
          <TouchableOpacity
            style={styles.tapAreaLeft}
            onPress={handleTapLeft}
            onPressIn={handleLongPressStart}
            onPressOut={handleLongPressEnd}
            activeOpacity={0.9}
          >
            <View style={[styles.tapIndicator, styles.tapIndicatorLeft]} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.tapAreaRight}
            onPress={handleTapRight}
            onPressIn={handleLongPressStart}
            onPressOut={handleLongPressEnd}
            activeOpacity={0.9}
          >
            <View style={[styles.tapIndicator, styles.tapIndicatorRight]} />
          </TouchableOpacity>

          {/* Enhanced Story Actions with Full Functionality */}
          <Animated.View 
            style={[
              styles.storyActions,
              {
                opacity: showActions ? 1 : 0,
                transform: [{
                  translateY: showActions ? 0 : 50
                }]
              }
            ]}
          >
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <Icon 
                name={currentStory?.isLiked ? "heart" : "heart-outline"} 
                size={28} 
                color={currentStory?.isLiked ? "#FF3040" : "#fff"} 
              />
              <Text style={styles.actionText}>Like</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleSend}>
              <Icon name="paper-plane-outline" size={28} color="#fff" />
              <Text style={styles.actionText}>Send</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
              <Icon 
                name={currentStory?.isSaved ? "bookmark" : "bookmark-outline"} 
                size={28} 
                color={currentStory?.isSaved ? "#FFC107" : "#fff"} 
              />
              <Text style={styles.actionText}>Save</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={handleMore}>
              <Icon name="ellipsis-horizontal" size={28} color="#fff" />
              <Text style={styles.actionText}>More</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Story Counter */}
          <View style={styles.storyCounter}>
            <Text style={styles.storyCounterText}>
              {currentIndex + 1} of {userStories.length}
            </Text>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
};

const formatStoryTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 1) {
    return 'now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else {
    return `${Math.floor(diffHours / 24)}d`;
  }
};

const styles = StyleSheet.create({
  // Story List Styles
  storyListContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  storyListContent: {
    paddingHorizontal: 16,
  },
  storyItemContainer: {
    alignItems: 'center',
    width: STORY_SIZE + 16,
  },
  storyImageContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  storyBorder: {
    position: 'absolute',
    top: -4, // Slightly larger border for better visibility
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: (STORY_SIZE + 8) / 2, // Adjusted for larger border
    zIndex: 1,
  },
  gradientBorder: {
    flex: 1,
    borderRadius: (STORY_SIZE + 8) / 2,
    padding: 1, // Inner padding for smoother gradient
  },
  storyImage: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    borderRadius: STORY_SIZE / 2,
    borderWidth: 3,
    borderColor: '#fff',
    zIndex: 2,
  },
  addStoryButton: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 3,
  },
  storyCountBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF3040',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 3,
  },
  storyCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    zIndex: 3,
  },
  storyUsername: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: STORY_SIZE + 16,
  },

  // Story Viewer Styles
  storyViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  storyWrapper: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 2,
  },
  progressBarBackground: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1,
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  storyUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  storyHeaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  storyUserDetails: {
    flex: 1,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyHeaderUsername: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  storyHeaderTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
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
    height: '100%',
  },
  captionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 12,
    borderRadius: 8,
  },
  captionText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  tapAreaLeft: {
    position: 'absolute',
    left: 0,
    top: 100,
    bottom: 100,
    width: width * 0.3,
  },
  tapAreaRight: {
    position: 'absolute',
    right: 0,
    top: 100,
    bottom: 100,
    width: width * 0.7,
  },
  storyActions: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  tapIndicator: {
    position: 'absolute',
    top: '50%',
    width: 4,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  tapIndicatorLeft: {
    left: 10,
  },
  tapIndicatorRight: {
    right: 10,
  },
  storyCounter: {
    position: 'absolute',
    top: 120,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  storyCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
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
    zIndex: 10,
  },
  progressSafeArea: {
    backgroundColor: 'transparent',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: 8,
    marginRight: 12,
  },
  avatarContainer: {
    position: 'relative',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  unsupportedContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unsupportedText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});
