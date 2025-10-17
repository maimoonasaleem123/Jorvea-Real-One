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
  Modal,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';
import { useTheme } from '../context/ThemeContext';
import { Story } from '../services/firebaseService';

const { width, height } = Dimensions.get('window');
const STORY_SIZE = 75;
const STORY_MARGIN = 12;

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

interface ProfessionalStoryItemProps {
  storyGroup: UserStoryGroup;
  onPress: (storyGroup: UserStoryGroup) => void;
  isYourStory?: boolean;
  index: number;
}

interface ProfessionalStoryListProps {
  stories: Story[];
  onViewStory: (storyGroup: UserStoryGroup, initialIndex: number) => void;
  onCreateStory: () => void;
  currentUserId?: string;
}

// Professional Story Item Component
const ProfessionalStoryItem: React.FC<ProfessionalStoryItemProps> = ({
  storyGroup,
  onPress,
  isYourStory = false,
  index,
}) => {
  const { colors } = useTheme();
  const scaleValue = useRef(new Animated.Value(1)).current;
  const glowValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate entry
    Animated.spring(scaleValue, {
      toValue: 1,
      delay: index * 100,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();

    // Glow animation for unseen stories
    if (storyGroup.hasUnseenStories) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowValue, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(glowValue, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    }
  }, []);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onPress(storyGroup);
    });
  };

  const getBorderGradient = () => {
    if (storyGroup.hasUnseenStories) {
      return [colors.primary, colors.accent, colors.secondary];
    }
    // Gray border for watched stories
    return [colors.textMuted, colors.border, colors.textMuted];
  };

  const glowOpacity = glowValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <Animated.View 
      style={[
        styles.storyContainer, 
        { transform: [{ scale: scaleValue }] }
      ]}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        {/* Glow effect for unseen stories */}
        {storyGroup.hasUnseenStories && (
          <Animated.View
            style={[
              styles.glowEffect,
              {
                opacity: glowOpacity,
                shadowColor: colors.primary,
              },
            ]}
          />
        )}
        
        {/* Story border gradient */}
        <LinearGradient
          colors={getBorderGradient()}
          style={styles.storyBorder}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={[styles.storyImageContainer, { backgroundColor: colors.background }]}>
            <Image
              source={{
                uri: storyGroup.user.profilePicture || 'https://via.placeholder.com/100x100?text=User',
              }}
              style={styles.storyImage}
              resizeMode="cover"
            />
            
            {/* Your story add button */}
            {isYourStory && (
              <View style={[styles.addStoryButton, { backgroundColor: colors.primary }]}>
                <Icon name="add" size={16} color="#FFFFFF" />
              </View>
            )}
            
            {/* Verified badge */}
            {storyGroup.user.isVerified && (
              <View style={[styles.verifiedBadge, { backgroundColor: colors.primary }]}>
                <Icon name="checkmark" size={12} color="#FFFFFF" />
              </View>
            )}
            
            {/* Story count indicator */}
            {storyGroup.totalStories > 1 && (
              <View style={[styles.storyCountBadge, { backgroundColor: colors.accent }]}>
                <Text style={styles.storyCountText}>{storyGroup.totalStories}</Text>
              </View>
            )}
          </View>
        </LinearGradient>
        
        {/* Username */}
        <Text 
          style={[styles.storyUsername, { color: colors.text }]} 
          numberOfLines={1}
        >
          {isYourStory ? 'Your story' : storyGroup.user.displayName || storyGroup.user.username}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Professional Story List Component
export const ProfessionalStoryList: React.FC<ProfessionalStoryListProps> = ({
  stories,
  onViewStory,
  onCreateStory,
  currentUserId,
}) => {
  const { colors } = useTheme();
  const [storyGroups, setStoryGroups] = useState<UserStoryGroup[]>([]);

  useEffect(() => {
    // Group stories by user
    const grouped = stories.reduce((acc, story) => {
      const userId = story.userId;
      if (!acc[userId]) {
        acc[userId] = {
          userId,
          user: {
            username: story.user.username,
            displayName: story.user.displayName || story.user.username,
            profilePicture: story.user.profilePicture,
            isVerified: story.user.isVerified || false,
          },
          stories: [],
          hasUnseenStories: !story.viewers.includes(currentUserId), // Check if current user has viewed stories
          totalStories: 0,
        };
      }
      acc[userId].stories.push(story);
      acc[userId].totalStories = acc[userId].stories.length;
      
      // Check if all stories have been viewed by current user
      const allStoriesSeen = acc[userId].stories.every(s => s.viewers.includes(currentUserId));
      acc[userId].hasUnseenStories = !allStoriesSeen;
      
      return acc;
    }, {} as Record<string, UserStoryGroup>);

    const groupedArray = Object.values(grouped);
    
    // Sort: Your story first, then by most recent
    groupedArray.sort((a, b) => {
      if (a.userId === currentUserId) return -1;
      if (b.userId === currentUserId) return 1;
      return new Date(b.stories[0].createdAt).getTime() - new Date(a.stories[0].createdAt).getTime();
    });

    setStoryGroups(groupedArray);
  }, [stories, currentUserId]);

  const handleStoryPress = (storyGroup: UserStoryGroup) => {
    onViewStory(storyGroup, 0);
  };

  const renderStoryItem = ({ item, index }: { item: UserStoryGroup; index: number }) => (
    <ProfessionalStoryItem
      storyGroup={item}
      onPress={handleStoryPress}
      isYourStory={item.userId === currentUserId}
      index={index}
    />
  );

  const renderYourStoryPlaceholder = () => (
    <View style={styles.storyContainer}>
      <TouchableOpacity onPress={onCreateStory} activeOpacity={0.8}>
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={styles.storyBorder}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={[styles.storyImageContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.createStoryPlaceholder}>
              <LinearGradient
                colors={[colors.primary, colors.accent]}
                style={styles.createStoryGradient}
              >
                <Icon name="add" size={28} color="#FFFFFF" />
              </LinearGradient>
            </View>
          </View>
        </LinearGradient>
        <Text style={[styles.storyUsername, { color: colors.text }]}>Your story</Text>
      </TouchableOpacity>
    </View>
  );

  // Check if current user has stories
  const hasYourStory = storyGroups.some(group => group.userId === currentUserId);

  return (
    <View style={[styles.storyListContainer, { backgroundColor: colors.background }]}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={storyGroups}
        renderItem={renderStoryItem}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={styles.storyListContent}
        ListHeaderComponent={!hasYourStory ? renderYourStoryPlaceholder : null}
        ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  storyListContainer: {
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  storyListContent: {
    paddingHorizontal: 16,
  },
  storyContainer: {
    alignItems: 'center',
    marginRight: 12,
    width: STORY_SIZE + 8,
  },
  glowEffect: {
    position: 'absolute',
    width: STORY_SIZE + 16,
    height: STORY_SIZE + 16,
    borderRadius: (STORY_SIZE + 16) / 2,
    top: -8,
    left: -8,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 8,
  },
  storyBorder: {
    width: STORY_SIZE + 6,
    height: STORY_SIZE + 6,
    borderRadius: (STORY_SIZE + 6) / 2,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyImageContainer: {
    width: STORY_SIZE,
    height: STORY_SIZE,
    borderRadius: STORY_SIZE / 2,
    overflow: 'hidden',
    position: 'relative',
  },
  storyImage: {
    width: '100%',
    height: '100%',
    borderRadius: STORY_SIZE / 2,
  },
  addStoryButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  verifiedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  storyCountBadge: {
    position: 'absolute',
    top: -2,
    left: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  storyCountText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  storyUsername: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
    maxWidth: STORY_SIZE + 8,
  },
  createStoryPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createStoryGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ProfessionalStoryList;
