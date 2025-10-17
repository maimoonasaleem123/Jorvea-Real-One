import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Story } from '../services/firebaseService';
import FirebaseService from '../services/firebaseService';
import { 
  EnhancedStoryItem, 
  EnhancedStoryViewer,
  UserStoryGroup 
} from './PerfectStoryComponents';
import Icon from 'react-native-vector-icons/Ionicons';

interface EnhancedStoryListProps {
  onAddStory?: () => void;
  style?: any;
}

export const EnhancedStoryList: React.FC<EnhancedStoryListProps> = ({
  onAddStory,
  style,
}) => {
  const [storyGroups, setStoryGroups] = useState<UserStoryGroup[]>([]);
  const [userOwnStories, setUserOwnStories] = useState<Story[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStoryGroup, setSelectedStoryGroup] = useState<UserStoryGroup | null>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  
  const { user } = useAuth();
  const { colors } = useTheme();
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load stories on component mount and set up cleanup interval
  useEffect(() => {
    if (user) {
      loadStories();
      
      // Set up automatic cleanup of expired stories every 5 minutes
      cleanupIntervalRef.current = setInterval(() => {
        FirebaseService.deleteExpiredStories();
      }, 5 * 60 * 1000); // 5 minutes
    }

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
      }
    };
  }, [user]);

  const loadStories = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // Load following users' stories
      const followingStories = await FirebaseService.getFollowingUsersStories(user.uid);
      
      // Load user's own stories
      const ownStories = await FirebaseService.getAllUserStoriesForProfile(user.uid);
      
      // Group stories by user
      const groupedStories = groupStoriesByUser(followingStories, user.uid);
      
      setStoryGroups(groupedStories);
      setUserOwnStories(ownStories);
    } catch (error) {
      console.error('Error loading stories:', error);
      Alert.alert('Error', 'Failed to load stories. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const groupStoriesByUser = (stories: Story[], currentUserId: string): UserStoryGroup[] => {
    const grouped = new Map<string, UserStoryGroup>();

    stories.forEach(story => {
      if (!story.user) return;

      const userId = story.user.id;
      
      if (!grouped.has(userId)) {
        grouped.set(userId, {
          userId,
          user: story.user,
          stories: [],
          hasUnseenStories: false,
          totalStories: 0,
        });
      }

      const group = grouped.get(userId)!;
      group.stories.push(story);
      group.totalStories = group.stories.length;

      // Check if user has unseen stories
      if (!story.viewedBy?.includes(currentUserId)) {
        group.hasUnseenStories = true;
      }
    });

    // Sort groups: unseen first, then by most recent story
    return Array.from(grouped.values()).sort((a, b) => {
      if (a.hasUnseenStories && !b.hasUnseenStories) return -1;
      if (!a.hasUnseenStories && b.hasUnseenStories) return 1;
      
      const aLatest = Math.max(...a.stories.map(s => s.createdAt.getTime()));
      const bLatest = Math.max(...b.stories.map(s => s.createdAt.getTime()));
      
      return bLatest - aLatest;
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadStories();
    setIsRefreshing(false);
  };

  const handleStoryPress = (storyGroup: UserStoryGroup) => {
    if (storyGroup.stories.length === 0) return;

    setSelectedStoryGroup(storyGroup);
    
    // Find first unseen story or start from beginning
    const firstUnseenIndex = storyGroup.stories.findIndex(
      story => !story.viewedBy?.includes(user!.uid)
    );
    
    setViewerInitialIndex(firstUnseenIndex >= 0 ? firstUnseenIndex : 0);
    setViewerVisible(true);
  };

  const handleOwnStoryPress = () => {
    if (userOwnStories.length === 0) {
      onAddStory?.();
      return;
    }

    const ownStoryGroup: UserStoryGroup = {
      userId: user!.uid,
      user: {
        id: user!.uid,
        username: user!.username || 'You',
        displayName: user!.displayName || user!.username || 'You',
        profilePicture: user!.profilePicture,
      },
      stories: userOwnStories,
      hasUnseenStories: false,
      totalStories: userOwnStories.length,
    };

    handleStoryPress(ownStoryGroup);
  };

  const handleStoryLike = async (storyId: string) => {
    if (!user) return;
    
    try {
      await FirebaseService.likeStory(storyId, user.uid);
      // Optionally update local state or reload stories
    } catch (error) {
      console.error('Error liking story:', error);
      Alert.alert('Error', 'Failed to like story. Please try again.');
    }
  };

  const handleStoryComment = async (storyId: string, comment: string) => {
    if (!user) return;
    
    try {
      await FirebaseService.addStoryComment(storyId, user.uid, comment);
      // Optionally update local state or reload stories
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error; // Re-throw to handle in component
    }
  };

  const handleViewerClose = () => {
    setViewerVisible(false);
    setSelectedStoryGroup(null);
    
    // Refresh stories to update viewed status
    setTimeout(() => {
      loadStories();
    }, 500);
  };

  const renderStoryItem = ({ item }: { item: UserStoryGroup }) => (
    <EnhancedStoryItem
      storyGroup={item}
      onPress={handleStoryPress}
      currentUserId={user!.uid}
    />
  );

  const renderYourStory = () => {
    if (!user) return null;

    const hasStories = userOwnStories.length > 0;

    return (
      <TouchableOpacity onPress={handleOwnStoryPress} style={styles.yourStoryContainer}>
        <EnhancedStoryItem
          storyGroup={{
            userId: user.uid,
            user: {
              id: user.uid,
              username: user.username || 'You',
              displayName: 'Your Story',
              profilePicture: user.profilePicture,
            },
            stories: userOwnStories,
            hasUnseenStories: false,
            totalStories: userOwnStories.length,
          }}
          onPress={handleOwnStoryPress}
          isYourStory={true}
          currentUserId={user.uid}
        />
      </TouchableOpacity>
    );
  };

  if (isLoading && !isRefreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading stories...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={storyGroups}
        renderItem={renderStoryItem}
        keyExtractor={(item) => item.userId}
        ListHeaderComponent={renderYourStory}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Icon name="camera-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No stories yet
            </Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
              Follow users to see their stories here
            </Text>
          </View>
        )}
      />

      {/* Story Viewer */}
      {selectedStoryGroup && (
        <EnhancedStoryViewer
          visible={viewerVisible}
          userStories={selectedStoryGroup.stories}
          initialIndex={viewerInitialIndex}
          onClose={handleViewerClose}
          currentUserId={user!.uid}
          onLike={handleStoryLike}
          onComment={handleStoryComment}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
  listContainer: {
    paddingHorizontal: 8,
  },
  yourStoryContainer: {
    marginRight: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default EnhancedStoryList;
