import React, { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  Dimensions,
  StatusBar,
  Platform,
  RefreshControl,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useInstagramFastPosts } from '../context/InstagramFastPostsContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import { useNavigation } from '@react-navigation/native';
import { Post as TypesPost } from '../types';
import { Post as FirebasePost, Story as FirebaseStory } from '../services/firebaseService';
import FirebaseService from '../services/firebaseService';
import UltraFastPostService from '../services/UltraFastPostService';
import RealTimeLikeSystem from '../services/RealTimeLikeSystem';
import { EnhancedPostCard } from '../components/EnhancedPostCard';
import StoryViewer from '../components/StoryViewer';
import StoryCreator from '../components/StoryCreator';
import { InstantCache } from '../services/InstantCacheService';

const { width, height } = Dimensions.get('window');

// Interface for grouped stories (multiple stories from same user)
interface GroupedStory {
  id: string;
  userId: string;
  user?: any;
  stories: FirebaseStory[];
  storyCount: number;
  isViewed: boolean;
  mediaUrl: string | null;
  mediaType: 'profile';
  createdAt: string;
  expiresAt: string;
  viewsCount: number;
  viewers: string[];
  viewedBy: string[];
}

// Convert types Post to Firebase Post format
const convertToFirebasePost = (post: TypesPost): FirebasePost => {
  return {
    id: post.id,
    userId: post.userId,
    user: post.user ? {
      uid: post.user.uid,
      email: '',
      username: post.user.username,
      displayName: post.user.displayName,
      profilePicture: post.user.profilePicture,
      isPrivate: false,
      isVerified: post.user.isVerified || false,
      followers: [],
      following: [],
      blockedUsers: [],
      postsCount: 0,
      storiesCount: 0,
      reelsCount: 0,
      createdAt: new Date(),
      lastActive: new Date(),
      settings: {
        notifications: {
          likes: true,
          comments: true,
          follows: true,
          messages: true,
          mentions: true,
          stories: true,
        },
        privacy: {
          isPrivate: false,
          privateAccount: false,
          showActivity: true,
          showOnlineStatus: true,
          allowMessages: 'everyone' as 'everyone',
        },
        theme: 'auto',
      },
    } : undefined,
    mediaUrls: post.mediaUrls,
    mediaType: post.type === 'photo' ? 'image' : post.type === 'video' ? 'video' : 'carousel',
    type: post.type,
    caption: post.caption,
    location: post.location ? {
      name: post.location.name || '',
      coordinates: {
        latitude: post.location.latitude || 0,
        longitude: post.location.longitude || 0,
      }
    } : undefined,
    hashtags: post.tags || [],
    mentions: post.mentions || [],
    tags: post.tags,
    likes: post.likes,
    comments: post.comments?.map(c => c.id) || [],
    likesCount: post.likes?.length || 0,
    commentsCount: post.comments?.length || 0,
    sharesCount: post.shares || 0,
    shares: post.shares || 0,
    saves: post.saves || [],
    isArchived: post.isArchived || false,
    isHidden: post.isHidden || false,
    isPrivate: false,
    viewsCount: 0,
    isLiked: false,
    isSaved: false,
    commentsDisabled: false,
    hideLikeCounts: false,
    music: post.music,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
};

// Memoized Post Item for maximum performance
const PostItem = memo<{ post: TypesPost; index: number }>(({ post, index }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const firebasePost = convertToFirebasePost(post);
  
  const handleShare = useCallback((post: FirebasePost) => {
    // Navigate to user search screen for sharing
    (navigation as any).navigate('UserSearchScreen', {
      mode: 'share',
      title: 'Share Post',
      shareContent: {
        type: 'post',
        data: post,
      },
      multiSelect: true,
    });
  }, [navigation]);

  const handleLike = useCallback(async (postId: string) => {
    if (!user?.uid) return;
    
    try {
      console.log('❤️ RealTimeLike: Starting like toggle for post:', postId);
      
      // Use RealTimeLikeSystem for perfect like handling (same as ReelsScreen)
      const result = await RealTimeLikeSystem.getInstance().toggleLike(
        postId,
        user.uid,
        'post',
        false, // We'll let the system determine current state
        0      // We'll let the system fetch current count
      );

      if (result.success) {
        console.log(`✅ RealTimeLike: Post ${postId} ${result.isLiked ? 'liked' : 'unliked'}. Count: ${result.likesCount}`);
      } else {
        console.log('⚠️ RealTimeLike: Like operation failed:', result.error);
      }
    } catch (error) {
      console.error('❌ RealTimeLike: Error liking post:', error);
    }
  }, [user?.uid]);

  const handleSave = useCallback(async (postId: string) => {
    if (!user?.uid) return;
    
    try {
      const ultraFastPostService = UltraFastPostService.getInstance();
      await ultraFastPostService.togglePostSave(postId, user.uid);
      console.log('Post save toggled');
    } catch (error) {
      console.error('Error saving post:', error);
    }
  }, [user?.uid]);

  const handleComment = useCallback((post: FirebasePost) => {
    (navigation as any).navigate('Comments', { 
      postId: post.id,
      post: post
    });
  }, [navigation]);
  
  return (
    <View style={styles.postContainer}>
      <EnhancedPostCard 
        post={firebasePost} 
        onLike={handleLike}
        onSave={handleSave}
        onComment={handleComment} 
        onShare={handleShare}
      />
    </View>
  );
});

// Memoized Story List Placeholder
const StoryListHeader = memo(({ 
  stories, 
  storiesLoading, 
  colors, 
  onCreateStory, 
  onViewStory 
}: { 
  stories: GroupedStory[]; 
  storiesLoading: boolean; 
  colors: any;
  onCreateStory: () => void;
  onViewStory: (index: number) => void;
}) => {
  
  return (
    <View style={[styles.storyContainer]}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.storyScrollView}
        contentContainerStyle={styles.storyContentContainer}
        decelerationRate="fast"
        snapToInterval={82}
        snapToAlignment="start"
      >
        {/* Your Story Creator */}
        <TouchableOpacity 
          style={styles.storyItem} 
          onPress={onCreateStory}
          activeOpacity={0.7}
        >
          <View style={[styles.storyAvatarContainer, { borderColor: 'transparent' }]}>
            <LinearGradient
              colors={[colors.primary + '20', colors.primary + '40', colors.primary]}
              style={styles.createStoryGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={[styles.storyAvatar, { backgroundColor: colors.background }]}>
                <Icon name="add" size={28} color={colors.primary} />
              </View>
            </LinearGradient>
            <View style={[styles.addStoryButton, { backgroundColor: colors.primary }]}>
              <Icon name="camera" size={12} color="#FFFFFF" />
            </View>
          </View>
          <Text style={[styles.storyUsername, { color: colors.primary, fontWeight: '600' }]}>Your Story</Text>
        </TouchableOpacity>

        {/* Dynamic Stories */}
        {storiesLoading ? (
          // Loading placeholder with shimmer effect
          Array.from({ length: 4 }, (_, index) => (
            <View key={`loading-${index}`} style={styles.storyItem}>
              <View style={[styles.storyAvatarContainer, { borderColor: colors.border, opacity: 0.6 }]}>
                <View style={[styles.storyAvatarInner, { backgroundColor: colors.surface }]}>
                  <View style={[styles.storyAvatar, { backgroundColor: colors.surface }]}>
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                  </View>
                </View>
              </View>
              <View style={[styles.loadingTextPlaceholder, { backgroundColor: colors.surface }]} />
            </View>
          ))
        ) : (
          stories.map((story, index) => (
            <TouchableOpacity 
              key={story.id} 
              style={styles.storyItem}
              onPress={() => onViewStory(index)}
              activeOpacity={0.8}
            >
              {/* Rainbow border container for unviewed stories */}
              {!story.isViewed ? (
                <LinearGradient
                  colors={colors.storyBorder || ['#10fedb', '#ff6b9d', '#8b5cf6', '#34C759', '#FF9500']}
                  style={styles.rainbowBorder}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.storyAvatarInner}>
                    {/* Always show user profile picture, not story media */}
                    {story.user?.profilePicture ? (
                      <Image 
                        source={{ uri: story.user.profilePicture }} 
                        style={styles.storyAvatar}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.storyAvatar, { backgroundColor: colors.surface }]}>
                        <Icon name="person" size={24} color={colors.text} />
                      </View>
                    )}
                    {/* Show count indicator if user has multiple stories */}
                    {story.storyCount && story.storyCount > 1 && (
                      <View style={styles.storyCountIndicator}>
                        <Text style={styles.storyCountText}>{story.storyCount}</Text>
                      </View>
                    )}
                  </View>
                </LinearGradient>
              ) : (
                <View style={[
                  styles.storyAvatarContainer, 
                  { 
                    borderColor: '#c0c0c0',
                    borderWidth: 2,
                  }
                ]}>
                  <View style={styles.storyAvatarInner}>
                    {/* Always show user profile picture, not story media */}
                    {story.user?.profilePicture ? (
                      <Image 
                        source={{ uri: story.user.profilePicture }} 
                        style={styles.storyAvatar}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.storyAvatar, { backgroundColor: colors.surface }]}>
                        <Icon name="person" size={24} color={colors.text} />
                      </View>
                    )}
                    {/* Show count indicator if user has multiple stories */}
                    {story.storyCount && story.storyCount > 1 && (
                      <View style={styles.storyCountIndicator}>
                        <Text style={styles.storyCountText}>{story.storyCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
              <Text 
                style={[
                  styles.storyUsername, 
                  { 
                    color: story.isViewed ? colors.textSecondary : colors.text,
                    fontWeight: story.isViewed ? '400' : '500'
                  }
                ]} 
                numberOfLines={1}
              >
                {story.user?.username || story.user?.displayName || `user${story.userId.slice(-4)}`}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
});

// Main Fast Feed Component
export const InstagramFastFeed: React.FC = () => {
  const { 
    posts, 
    hasMore, 
    loadNextPage, 
    refreshPosts, 
    isRefreshing,
    error 
  } = useInstagramFastPosts();
  
  const { colors } = useTheme();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  const [viewableItems, setViewableItems] = useState<string[]>([]);
  const [stories, setStories] = useState<GroupedStory[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  
  // Story viewer state
  const [storyViewerVisible, setStoryViewerVisible] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState(0);
  const [viewerStories, setViewerStories] = useState<FirebaseStory[]>([]);
  
  // Story creator state
  const [storyCreatorVisible, setStoryCreatorVisible] = useState(false);

  // Load stories from Firebase with proper viewing state and grouping
  const loadStories = useCallback(async () => {
    try {
      setStoriesLoading(true);
      const fetchedStories = await FirebaseService.getStories();
      
      // Group stories by userId to show one avatar per user
      const userStoriesMap = new Map();
      
      fetchedStories.forEach(story => {
        if (!userStoriesMap.has(story.userId)) {
          userStoriesMap.set(story.userId, {
            userId: story.userId,
            user: story.user,
            stories: [],
            isViewed: true, // Will be updated based on individual stories
            latestStory: story // Use latest story for timestamps, etc.
          });
        }
        
        const userGroup = userStoriesMap.get(story.userId);
        userGroup.stories.push(story);
        
        // If any story is unviewed, mark the group as unviewed
        if (!story.isViewed) {
          userGroup.isViewed = false;
        }
        
        // Keep the latest story for metadata
        if (new Date(story.createdAt) > new Date(userGroup.latestStory.createdAt)) {
          userGroup.latestStory = story;
        }
      });
      
      // Convert map to array and sort
      const groupedStories = Array.from(userStoriesMap.values()).map(group => ({
        id: `group-${group.userId}`,
        userId: group.userId,
        user: group.user,
        stories: group.stories.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
        isViewed: group.isViewed,
        storyCount: group.stories.length,
        // Use user profile picture instead of story media
        mediaUrl: group.user?.profilePicture || null,
        mediaType: 'profile' as const,
        createdAt: group.latestStory.createdAt,
        expiresAt: group.latestStory.expiresAt,
        viewsCount: group.latestStory.viewsCount || 0,
        viewers: group.latestStory.viewers || [],
        viewedBy: group.latestStory.viewedBy || []
      })) as GroupedStory[];
      
      // Sort grouped stories: unviewed first, then by latest story creation time
      const sortedStories = groupedStories.sort((a, b) => {
        // Unviewed stories first
        if (a.isViewed !== b.isViewed) {
          return a.isViewed ? 1 : -1;
        }
        // Then by latest story creation time (newest first)
        const aLatest = Math.max(...a.stories.map(s => new Date(s.createdAt).getTime()));
        const bLatest = Math.max(...b.stories.map(s => new Date(s.createdAt).getTime()));
        return bLatest - aLatest;
      });
      
      setStories(sortedStories);
      console.log(`Loaded ${sortedStories.length} grouped stories from ${fetchedStories.length} individual stories`);
    } catch (error) {
      console.error('Error loading stories:', error);
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  // Load stories on mount
  useEffect(() => {
    loadStories();
  }, [loadStories]);

  // Combined refresh function for posts and stories
  const handleRefresh = useCallback(() => {
    refreshPosts();
    loadStories();
  }, [refreshPosts, loadStories]);

  // Story handlers
  const handleCreateStory = useCallback(() => {
    setStoryCreatorVisible(true);
  }, []);

  const handleViewStory = useCallback((index: number) => {
    console.log(`Opening story viewer for story group at index ${index}`);
    const selectedStoryGroup = stories[index];
    console.log('Story group data:', selectedStoryGroup);
    
    // Always pass the individual stories from the group to the viewer
    setViewerStories(selectedStoryGroup.stories);
    setSelectedStoryIndex(0); // Start with the first story in the group
    
    setStoryViewerVisible(true);
  }, [stories]);

  const handleStoryCreated = useCallback(() => {
    loadStories(); // Refresh stories after creation
  }, [loadStories]);

  const handleCloseStoryViewer = useCallback(() => {
    setStoryViewerVisible(false);
    // Refresh stories to update viewed state
    loadStories();
  }, [loadStories]);

  const handleCloseStoryCreator = useCallback(() => {
    setStoryCreatorVisible(false);
  }, []);

  // Instagram-like optimized renderItem
  const renderItem = useCallback(({ item, index }: { item: TypesPost; index: number }) => {
    return <PostItem post={item} index={index} />;
  }, []);

  // Instagram-like keyExtractor
  const keyExtractor = useCallback((item: TypesPost) => item.id, []);

  // Instagram-like getItemLayout for better performance
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 600, // Estimated post height
    offset: 600 * index,
    index,
  }), []);

  // Viewability config for video pausing (Instagram-like)
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
    waitForInteraction: false,
  }), []);

  const onViewableItemsChanged = useCallback(({ viewableItems: visible }: any) => {
    const visibleIds = visible.map((item: any) => item.item.id);
    setViewableItems(visibleIds);
    
    // Preload next posts for instant loading experience
    if (visible.length > 0) {
      const currentIndex = visible[visible.length - 1].index;
      const nextPost = posts[currentIndex + 1];
      if (nextPost && nextPost.mediaUrls?.length > 0) {
        // Preload the next post's media using the public method
        InstantCache.preloadMedia(nextPost.mediaUrls).catch(() => {});
      }
    }
  }, [posts]);

  // Instagram-like end reached with preloading
  const onEndReached = useCallback(() => {
    if (hasMore) {
      loadNextPage();
    }
  }, [hasMore, loadNextPage]);

  // Custom refresh control
  const refreshControl = useMemo(() => (
    <RefreshControl
      refreshing={isRefreshing || storiesLoading}
      onRefresh={handleRefresh}
      tintColor={colors.primary}
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
    />
  ), [isRefreshing, storiesLoading, handleRefresh, colors]);

  // List header with stories
  const ListHeaderComponent = useMemo(() => (
    <StoryListHeader 
      stories={stories} 
      storiesLoading={storiesLoading} 
      colors={colors}
      onCreateStory={handleCreateStory}
      onViewStory={handleViewStory}
    />
  ), [stories, storiesLoading, colors, handleCreateStory, handleViewStory]);

  // Error state
  if (error && posts.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar 
        barStyle={colors.background === '#FFFFFF' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />
      
      <FlatList
        ref={flatListRef}
        data={posts}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        ListHeaderComponent={ListHeaderComponent}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3} // Load when 30% from end
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={1} // Render only 1 post at a time
        updateCellsBatchingPeriod={50} // Faster updates
        initialNumToRender={2} // Only render first 2 posts instantly
        windowSize={2} // Keep only 2 posts in memory (ultra lazy)
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        style={[styles.flatList, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.contentContainer}
      />

      {/* Story Viewer Modal */}
      <StoryViewer
        visible={storyViewerVisible}
        stories={viewerStories}
        initialStoryIndex={selectedStoryIndex}
        onClose={handleCloseStoryViewer}
      />

      {/* Story Creator Modal */}
      <StoryCreator
        visible={storyCreatorVisible}
        onClose={handleCloseStoryCreator}
        onStoryCreated={handleStoryCreated}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight || 0,
  },
  storyContainer: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'transparent', // Remove background for clean look
  },
  storySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  storySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  storySectionSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.7,
  },
  storyScrollView: {
    flexGrow: 0,
  },
  storyContentContainer: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 6,
    width: 70,
    position: 'relative',
    paddingVertical: 8,
  },
  rainbowBorder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    padding: 4, // Increased from 2 to 4 for thicker border
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  storyAvatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    padding: 2, // Reduced padding for tighter circle
    marginBottom: 6,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    zIndex: 2,
    backgroundColor: 'transparent', // Remove background
  },
  storyAvatarInner: {
    width: 62, // Reduced from 66 to accommodate thicker border
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFFFFF',
    padding: 2, // Tighter padding for clean circle
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  storyAvatar: {
    width: 58, // Adjusted to fit with thicker border
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  createStoryGradient: {
    width: 62, // Match updated inner dimensions
    height: 62,
    borderRadius: 31,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyItemPressed: {
    transform: [{ scale: 0.95 }],
  },
  addStoryButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 10,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  storyCountIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  storyCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  storyUsername: {
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 70,
    fontWeight: '500',
    lineHeight: 14,
  },
  loadingTextPlaceholder: {
    width: 50,
    height: 10,
    borderRadius: 5,
    opacity: 0.6,
    marginTop: 4,
  },
  storyText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  postContainer: {
    marginBottom: 0,
  },
  flatList: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
