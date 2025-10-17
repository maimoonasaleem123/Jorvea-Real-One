import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { useTheme } from '../context/ThemeContext';
import { Story } from '../services/firebaseService';

const { width } = Dimensions.get('window');
const STORY_SIZE = 64;
const STORY_MARGIN = 8;

interface UserStoryGroup {
  userId: string;
  user: {
    username: string;
    displayName: string;
    profilePicture?: string;
  };
  stories: Story[];
  hasNewStory: boolean;
  latestStoryTime: Date;
}

interface EnhancedStoryItemProps {
  storyGroup: UserStoryGroup;
  onPress: (storyGroup: UserStoryGroup) => void;
  isYourStory?: boolean;
}

interface StoryListProps {
  stories: Story[];
  onViewStory: (storyGroup: UserStoryGroup) => void;
  onCreateStory: () => void;
  currentUserId?: string;
}

const EnhancedStoryItem: React.FC<EnhancedStoryItemProps> = ({
  storyGroup,
  onPress,
  isYourStory = false,
}) => {
  const { colors } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Continuous rainbow rotation animation for new stories
    if (storyGroup.hasNewStory) {
      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      );
      rotateAnimation.start();
      return () => rotateAnimation.stop();
    }
  }, [storyGroup.hasNewStory, rotateAnim]);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    onPress(storyGroup);
  };

  const generateRainbowColors = () => {
    return [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#96CEB4',
      '#FECA57',
      '#FF9FF3',
      '#54A0FF',
      '#FF6B6B',
    ];
  };

  const borderElement = storyGroup.hasNewStory ? (
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
        colors={generateRainbowColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      />
    </Animated.View>
  ) : (
    <View style={[styles.storyBorder, { backgroundColor: colors.border }]} />
  );

  return (
    <TouchableOpacity onPress={handlePress} style={styles.storyItemContainer}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <View style={styles.storyImageContainer}>
          {borderElement}
          <Image
            source={{
              uri: storyGroup.user.profilePicture || 'https://via.placeholder.com/64/cccccc/666666?text=👤',
            }}
            style={[styles.storyImage, { borderColor: colors.background }]}
          />
          {isYourStory && (
            <View style={styles.addStoryButton}>
              <Icon name="add" size={16} color="#fff" />
            </View>
          )}
          {storyGroup.stories.length > 1 && (
            <View style={styles.storyCountBadge}>
              <Text style={styles.storyCountText}>{storyGroup.stories.length}</Text>
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

// Helper function to group stories by user
const groupStoriesByUser = (stories: Story[], currentUserId?: string): UserStoryGroup[] => {
  const userGroups: { [userId: string]: UserStoryGroup } = {};
  const now = new Date();

  stories.forEach(story => {
    const userId = story.userId;
    
    if (!userGroups[userId]) {
      userGroups[userId] = {
        userId,
        user: {
          username: story.user?.username || 'Unknown',
          displayName: story.user?.displayName || 'Unknown',
          profilePicture: story.user?.profilePicture,
        },
        stories: [],
        hasNewStory: false,
        latestStoryTime: new Date(0),
      };
    }

    userGroups[userId].stories.push(story);
    
    // Check if story is new (less than 24 hours)
    const storyTime = typeof story.createdAt === 'string' ? new Date(story.createdAt) : new Date(story.createdAt);
    const hoursDiff = (now.getTime() - storyTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff < 24) {
      userGroups[userId].hasNewStory = true;
    }
    
    if (storyTime > userGroups[userId].latestStoryTime) {
      userGroups[userId].latestStoryTime = storyTime;
    }
  });

  // Sort stories within each group by creation time
  Object.values(userGroups).forEach(group => {
    group.stories.sort((a, b) => {
      const timeA = typeof a.createdAt === 'string' ? new Date(a.createdAt) : new Date(a.createdAt);
      const timeB = typeof b.createdAt === 'string' ? new Date(b.createdAt) : new Date(b.createdAt);
      return timeA.getTime() - timeB.getTime();
    });
  });

  const groupsArray = Object.values(userGroups);

  // Sort groups: current user first, then by latest story time
  return groupsArray.sort((a, b) => {
    if (currentUserId) {
      if (a.userId === currentUserId) return -1;
      if (b.userId === currentUserId) return 1;
    }
    return b.latestStoryTime.getTime() - a.latestStoryTime.getTime();
  });
};

export const EnhancedStoryList: React.FC<StoryListProps> = ({
  stories,
  onViewStory,
  onCreateStory,
  currentUserId,
}) => {
  const { colors } = useTheme();
  const [storyGroups, setStoryGroups] = useState<UserStoryGroup[]>([]);

  useEffect(() => {
    const groups = groupStoriesByUser(stories, currentUserId);
    
    // Add "Your story" option if user has stories or can create one
    const yourStoryGroup = groups.find(group => group.userId === currentUserId);
    const finalGroups = [...groups];
    
    if (currentUserId && !yourStoryGroup) {
      // Add empty "Your story" option for creating first story
      finalGroups.unshift({
        userId: 'your-story',
        user: {
          username: 'Your story',
          displayName: 'Your story',
          profilePicture: undefined,
        },
        stories: [],
        hasNewStory: false,
        latestStoryTime: new Date(),
      });
    }
    
    setStoryGroups(finalGroups);
  }, [stories, currentUserId]);

  const renderStoryItem = ({ item }: { item: UserStoryGroup }) => {
    const isYourStory = item.userId === currentUserId || item.userId === 'your-story';

    return (
      <EnhancedStoryItem
        storyGroup={item}
        onPress={isYourStory && item.stories.length === 0 ? () => onCreateStory() : onViewStory}
        isYourStory={isYourStory}
      />
    );
  };

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

interface StoryViewerProps {
  userStories: Story[]; // Only stories from one specific user
  initialIndex: number;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export const EnhancedStoryViewer: React.FC<StoryViewerProps> = ({
  userStories,
  initialIndex,
  onClose,
  onNext,
  onPrevious,
}) => {
  const { colors } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<any>(null);

  const currentStory = userStories[currentIndex];

  useEffect(() => {
    startStoryTimer();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentIndex]);

  const startStoryTimer = () => {
    progressAnim.setValue(0);
    setProgress(0);
    
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000, // 5 seconds per story
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        handleNext();
      }
    });
  };

  const handleNext = () => {
    if (currentIndex < userStories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      if (onNext) onNext();
    } else {
      onClose();
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      if (onPrevious) onPrevious();
    }
  };

  const handleTapLeft = () => {
    progressAnim.stopAnimation();
    handlePrevious();
  };

  const handleTapRight = () => {
    progressAnim.stopAnimation();
    handleNext();
  };

  return (
    <View style={styles.storyViewerContainer}>
      {/* Progress Bars - Only for this specific user's stories */}
      <View style={styles.progressContainer}>
        {userStories.map((_, index) => (
          <View key={index} style={styles.progressBarBackground}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: index === currentIndex 
                    ? progressAnim.interpolate({
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

      {/* Story Header */}
      <View style={styles.storyHeader}>
        <View style={styles.storyUserInfo}>
          <Image
            source={{ 
              uri: currentStory.user?.profilePicture || 'https://via.placeholder.com/32/cccccc/666666?text=👤'
            }}
            style={styles.storyHeaderAvatar}
          />
          <View>
            <Text style={styles.storyHeaderUsername}>
              {currentStory.user?.username || 'Unknown'}
            </Text>
            <Text style={styles.storyHeaderTime}>
              {formatStoryTime(typeof currentStory.createdAt === 'string' ? new Date(currentStory.createdAt) : new Date(currentStory.createdAt))}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Icon name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Story Content */}
      <View style={styles.storyContent}>
        {currentStory.mediaType === 'image' ? (
          <Image
            source={{ uri: currentStory.mediaUrl }}
            style={styles.storyMedia}
            resizeMode="contain"
          />
        ) : (
          <Video
            source={{ uri: currentStory.mediaUrl }}
            style={styles.storyMedia}
            resizeMode="contain"
            paused={false}
            repeat={false}
          />
        )}
      </View>

      {/* Tap Areas */}
      <TouchableOpacity
        style={styles.tapAreaLeft}
        onPress={handleTapLeft}
        activeOpacity={1}
      />
      <TouchableOpacity
        style={styles.tapAreaRight}
        onPress={handleTapRight}
        activeOpacity={1}
      />

      {/* Story Info - Show which story number out of total */}
      <View style={styles.storyInfoContainer}>
        <Text style={styles.storyInfoText}>
          {currentIndex + 1} of {userStories.length}
        </Text>
      </View>
    </View>
  );
};

const formatStoryTime = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffHours < 1) {
    return 'now';
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else {
    return `${Math.floor(diffHours / 24)}d`;
  }
};

const styles = StyleSheet.create({
  // Story List Styles
  storyListContainer: {
    paddingVertical: 8,
  },
  storyListContent: {
    paddingHorizontal: 12,
  },
  storyItemContainer: {
    alignItems: 'center',
    width: STORY_SIZE + 8,
  },
  storyImageContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  storyBorder: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: (STORY_SIZE + 6) / 2,
    zIndex: 1,
  },
  gradientBorder: {
    flex: 1,
    borderRadius: (STORY_SIZE + 6) / 2,
  },
  storyImage: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    borderRadius: STORY_SIZE / 2,
    borderWidth: 3,
    zIndex: 2,
  },
  addStoryButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
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
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 3,
  },
  storyCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  storyUsername: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: STORY_SIZE + 8,
  },

  // Story Viewer Styles
  storyViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 44,
    paddingBottom: 8,
    gap: 4,
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
    paddingVertical: 8,
  },
  storyUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  storyHeaderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  storyHeaderUsername: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  storyHeaderTime: {
    color: 'rgba(255, 255, 255, 0.7)',
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
    height: '100%',
  },
  tapAreaLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: width * 0.3,
  },
  tapAreaRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: width * 0.7,
  },
  storyInfoContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  storyInfoText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
