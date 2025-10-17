import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../context/FastAuthContext';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import RealTimeLikeSystem from '../services/RealTimeLikeSystem';
import { StoryList } from '../components/StoryComponents';
import { InstagramStoryViewer } from '../components/InstagramStoryViewer';
import FirebaseService, { Story } from '../services/firebaseService';

const { width } = Dimensions.get('window');

interface Post {
  id: string;
  userId: string;
  caption: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaUrls?: string[];
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  user?: {
    username: string;
    profilePicture: string;
    displayName?: string;
  };
  createdAt: any;
  timeAgo?: string;
}

/**
 * 🚀 INSTAGRAM-LIKE HOME SCREEN
 * - Instant loading with cache
 * - Paginated posts (10 at a time)
 * - Working like button with optimistic UI
 * - Smooth scrolling
 * - No lag, no delays
 */
const FastHomeScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [storyViewerData, setStoryViewerData] = useState<any>(null);

  const lastPostRef = useRef<any>(null);
  const PAGE_SIZE = 10;
  const CACHE_KEY = 'home_posts_cache';
  const STORIES_CACHE_KEY = 'home_stories_cache';

  // Initialize - load from cache first, then fetch fresh
  useEffect(() => {
    if (user?.uid) {
      loadFromCacheFirst();
      loadStories();
    }
  }, [user?.uid]);

  /**
   * Load from cache INSTANTLY, then fetch fresh in background
   */
  const loadFromCacheFirst = async () => {
    try {
      // 1. Load cached posts INSTANTLY
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const cachedPosts = JSON.parse(cached);
        setPosts(cachedPosts);
        console.log(`✅ Loaded ${cachedPosts.length} cached posts instantly`);
      }

      // 2. Fetch fresh posts in background
      await loadPosts(true);
    } catch (error) {
      console.error('Error loading from cache:', error);
      await loadPosts(true);
    }
  };

  /**
   * Load stories - Only from followed users
   */
  const loadStories = async () => {
    try {
      // Load from cache first
      const cachedStories = await AsyncStorage.getItem(STORIES_CACHE_KEY);
      if (cachedStories) {
        setStories(JSON.parse(cachedStories));
        console.log('⚡ Loaded stories from cache');
      }

      // Get user's following list (FIXED: use correct field names)
      const followingSnapshot = await firestore()
        .collection('followers')
        .where('followerId', '==', user?.uid)
        .get();
      
      const followingIds = followingSnapshot.docs.map(doc => doc.data().followedUserId);
      
      // Include user's own stories
      followingIds.push(user?.uid);
      
      console.log(`👥 Loading stories from ${followingIds.length} users`);

      // Fetch stories from followed users only
      const allStories = await FirebaseService.getStories(user?.uid);
      
      // Filter to only show stories from followed users + own stories
      const filteredStories = allStories.filter(story => 
        followingIds.includes(story.userId || story.user?.uid)
      );
      
      setStories(filteredStories);
      
      // Update cache
      await AsyncStorage.setItem(STORIES_CACHE_KEY, JSON.stringify(filteredStories));
      console.log(`✅ Loaded ${filteredStories.length} stories from followed users`);
    } catch (error) {
      console.error('Error loading stories:', error);
    }
  };

  /**
   * Handle story view
   */
  const handleViewStory = (story: Story, groupedStories?: Story[]) => {
    try {
      // Prepare story viewer data
      const userStories: { [userId: string]: Story[] } = {};
      
      // Group all stories by user
      stories.forEach(s => {
        const userId = s.user?.uid || s.id;
        if (!userStories[userId]) {
          userStories[userId] = [];
        }
        userStories[userId].push(s);
      });

      // Find the user and story index
      const userId = story.user?.uid || story.id;
      const userStoriesList = userStories[userId] || [story];
      const storyIndex = userStoriesList.findIndex(s => s.id === story.id);

      setStoryViewerData({
        stories: userStoriesList,
        userStories,
        initialUserIndex: Object.keys(userStories).indexOf(userId),
        initialStoryIndex: storyIndex >= 0 ? storyIndex : 0,
      });
      
      setShowStoryViewer(true);
    } catch (error) {
      console.error('Error opening story viewer:', error);
      Alert.alert('Error', 'Failed to open story');
    }
  };

  /**
   * Handle create story
   */
  const handleCreateStory = () => {
    (navigation as any).navigate('ComprehensiveStoryCreation');
  };

  /**
   * Load posts with pagination - Instagram-style feed
   * Priority: Latest posts from followed users first, then discover posts
   */
  const loadPosts = async (refresh: boolean = false) => {
    if (!user?.uid) return;
    if (loading || loadingMore) return;
    if (!refresh && !hasMore) return;

    try {
      if (refresh) {
        setRefreshing(true);
        lastPostRef.current = null;
      } else {
        setLoadingMore(true);
      }

      // Get user's following list (FIXED: use correct field names)
      const followingSnapshot = await firestore()
        .collection('followers')
        .where('followerId', '==', user.uid)
        .get();
      
      const followingIds = followingSnapshot.docs.map(doc => doc.data().followedUserId);
      console.log(`👥 Following ${followingIds.length} users`);

      // Fetch posts from followed users first (if any)
      let followedPosts: any[] = [];
      if (followingIds.length > 0) {
        // Firebase 'in' query supports max 10 items, so chunk if needed
        const chunks = [];
        for (let i = 0; i < followingIds.length; i += 10) {
          chunks.push(followingIds.slice(i, i + 10));
        }

        for (const chunk of chunks) {
          const followedQuery = await firestore()
            .collection('posts')
            .where('userId', 'in', chunk)
            .orderBy('createdAt', 'desc')
            .limit(PAGE_SIZE)
            .get();
          
          followedPosts = [...followedPosts, ...followedQuery.docs];
        }
      }

      // Fetch discover posts (not from followed users)
      let discoverQuery = firestore()
        .collection('posts')
        .orderBy('createdAt', 'desc')
        .limit(PAGE_SIZE);

      // Pagination for discover posts
      if (!refresh && lastPostRef.current) {
        discoverQuery = discoverQuery.startAfter(lastPostRef.current);
      }

      const discoverSnapshot = await discoverQuery.get();
      const discoverPosts = discoverSnapshot.docs.filter(
        doc => !followingIds.includes(doc.data().userId)
      );

      // Combine: followed posts first, then discover
      const allDocs = [...followedPosts, ...discoverPosts].slice(0, PAGE_SIZE);

      if (allDocs.length === 0) {
        setHasMore(false);
        return;
      }

      // Save last document for pagination
      lastPostRef.current = allDocs[allDocs.length - 1];

      // Fetch user data, like status, and save status for each post
      const postsData = await Promise.all(
        allDocs.map(async (doc) => {
          const data = doc.data();
          
          // Get user data
          const userDoc = await firestore()
            .collection('users')
            .doc(data.userId)
            .get();
          
          const userData = userDoc.data();

          // Check if current user liked this post
          const likeDoc = await firestore()
            .collection('posts')
            .doc(doc.id)
            .collection('likes')
            .doc(user.uid)
            .get();

          // Check if current user saved this post
          const savedDoc = await firestore()
            .collection('savedPosts')
            .doc(`${user.uid}_${doc.id}`)
            .get();

          // Handle different field names (imageUrl, imageUrls, mediaUrls, etc.)
          const getImageUrl = () => {
            if (data.imageUrl) return data.imageUrl;
            if (data.imageUrls && data.imageUrls[0]) return data.imageUrls[0];
            if (data.mediaUrls && data.mediaUrls[0]) return data.mediaUrls[0];
            if (data.mediaUrl) return data.mediaUrl;
            return null;
          };

          const post: Post = {
            id: doc.id,
            userId: data.userId || '',
            caption: data.caption || data.text || '',
            imageUrl: getImageUrl(),
            videoUrl: data.videoUrl,
            mediaUrls: data.mediaUrls || data.imageUrls,
            likesCount: data.likesCount || 0,
            commentsCount: data.commentsCount || 0,
            createdAt: data.createdAt,
            isLiked: likeDoc.exists(),
            isSaved: savedDoc.exists(),
            user: userData ? {
              username: userData.username || userData.displayName || 'user',
              profilePicture: userData.profilePicture || userData.photoURL || '',
              displayName: userData.displayName || userData.username,
            } : undefined,
            timeAgo: getTimeAgo(data.createdAt),
          };
          
          return post;
        })
      );

      // Update posts
      if (refresh) {
        setPosts(postsData);
        // Cache new posts
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(postsData));
      } else {
        setPosts((prev) => [...prev, ...postsData]);
      }

      setHasMore(allDocs.length === PAGE_SIZE);
      console.log(`✅ Loaded ${postsData.length} posts (${followedPosts.length} from followed users)`);
    } catch (error) {
      console.error('Error loading posts:', error);
      Alert.alert('Error', 'Failed to load posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  /**
   * Handle like/unlike with optimistic UI
   */
  const handleLike = async (postId: string) => {
    if (!user?.uid) return;

    try {
      // Find post
      const postIndex = posts.findIndex((p) => p.id === postId);
      if (postIndex === -1) return;

      const post = posts[postIndex];
      const wasLiked = post.isLiked || false;

      // Optimistic UI update
      const updatedPosts = [...posts];
      updatedPosts[postIndex] = {
        ...post,
        isLiked: !wasLiked,
        likesCount: wasLiked ? post.likesCount - 1 : post.likesCount + 1,
      };
      setPosts(updatedPosts);

      // Update Firebase
      const likeSystem = RealTimeLikeSystem.getInstance();
      await likeSystem.toggleLike(
        postId,
        user.uid,
        'post',
        wasLiked,
        post.likesCount
      );

      console.log(`✅ ${wasLiked ? 'Unliked' : 'Liked'} post ${postId}`);
    } catch (error) {
      console.error('Error liking post:', error);
      // Revert optimistic update
      await loadPosts(true);
    }
  };

  /**
   * Delete post
   */
  const handleDelete = async (postId: string) => {
    if (!user?.uid) return;

    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from Firestore
              await firestore().collection('posts').doc(postId).delete();

              // Remove from UI
              setPosts((prev) => prev.filter((p) => p.id !== postId));

              Alert.alert('Success', 'Post deleted successfully');
            } catch (error) {
              console.error('Error deleting post:', error);
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  /**
   * Navigate to comments
   */
  const handleComments = (postId: string) => {
    (navigation as any).navigate('Comments', { postId, type: 'post' });
  };

  /**
   * Handle save/unsave post
   */
  const handleSave = async (postId: string) => {
    if (!user?.uid) return;

    try {
      // Find post
      const postIndex = posts.findIndex((p) => p.id === postId);
      if (postIndex === -1) return;

      const post = posts[postIndex];
      const wasSaved = post.isSaved || false;

      // Optimistic UI update
      const updatedPosts = [...posts];
      updatedPosts[postIndex] = {
        ...post,
        isSaved: !wasSaved,
      };
      setPosts(updatedPosts);

      // Update Firebase
      const savedPostRef = firestore()
        .collection('savedPosts')
        .doc(`${user.uid}_${postId}`);

      if (wasSaved) {
        // Unsave
        await savedPostRef.delete();
        console.log(`✅ Unsaved post ${postId}`);
      } else {
        // Save
        await savedPostRef.set({
          userId: user.uid,
          postId: postId,
          savedAt: firestore.FieldValue.serverTimestamp(),
        });
        console.log(`✅ Saved post ${postId}`);
      }
    } catch (error) {
      console.error('Error saving post:', error);
      // Revert optimistic update
      await loadPosts(true);
    }
  };

  /**
   * Navigate to profile
   */
  const handleProfile = (userId: string) => {
    (navigation as any).navigate('Profile', { userId });
  };

  /**
   * Render single post
   */
  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postContainer}>
      {/* Header */}
      <View style={styles.postHeader}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => item.userId && handleProfile(item.userId)}
        >
          <Image
            source={{
              uri: item.user?.profilePicture || 'https://via.placeholder.com/40',
            }}
            style={styles.avatar}
          />
          <Text style={styles.username}>
            {item.user?.username || 'user'}
          </Text>
        </TouchableOpacity>

        {item.userId === user?.uid && (
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <Icon name="trash-outline" size={24} color="#ff3b30" />
          </TouchableOpacity>
        )}
      </View>

      {/* Media */}
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.postImage}
          resizeMode="cover"
          onError={(error) => {
            console.log('❌ Image load error:', item.imageUrl, error);
          }}
        />
      ) : (
        <View style={[styles.postImage, styles.noImagePlaceholder]}>
          <Icon name="image-outline" size={64} color="#ccc" />
          <Text style={styles.noImageText}>No image</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleLike(item.id)}
          >
            <Icon
              name={item.isLiked ? 'heart' : 'heart-outline'}
              size={28}
              color={item.isLiked ? '#ff3b30' : '#000'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleComments(item.id)}
          >
            <Icon name="chatbubble-outline" size={26} color="#000" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton}>
            <Icon name="paper-plane-outline" size={26} color="#000" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleSave(item.id)}
        >
          <Icon
            name={item.isSaved ? 'bookmark' : 'bookmark-outline'}
            size={26}
            color="#000"
          />
        </TouchableOpacity>
      </View>

      {/* Likes count */}
      <Text style={styles.likesCount}>
        {item.likesCount} {item.likesCount === 1 ? 'like' : 'likes'}
      </Text>

      {/* Caption */}
      {item.caption && (
        <View style={styles.captionContainer}>
          <Text style={styles.captionUsername}>{item.user?.username}</Text>
          <Text style={styles.captionText}> {item.caption}</Text>
        </View>
      )}

      {/* Comments count */}
      {item.commentsCount > 0 && (
        <TouchableOpacity onPress={() => handleComments(item.id)}>
          <Text style={styles.commentsLink}>
            View all {item.commentsCount} comments
          </Text>
        </TouchableOpacity>
      )}

      {/* Time ago */}
      <Text style={styles.timeAgo}>{item.timeAgo}</Text>
    </View>
  );

  /**
   * Load more when reaching end
   */
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadPosts(false);
    }
  };

  /**
   * Pull to refresh
   */
  const handleRefresh = () => {
    loadPosts(true);
  };

  /**
   * Empty state
   */
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="images-outline" size={64} color="#ccc" />
      <Text style={styles.emptyText}>No posts yet</Text>
      <Text style={styles.emptySubtext}>Follow users to see their posts</Text>
    </View>
  );

  /**
   * Footer loading indicator
   */
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#0095f6" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jorvea</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => (navigation as any).navigate('Notifications')}
          >
            <Icon name="heart-outline" size={28} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => (navigation as any).navigate('Messages')}
          >
            <Icon name="paper-plane-outline" size={28} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Posts List */}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          stories.length > 0 ? (
            <View style={styles.storiesContainer}>
              <StoryList
                stories={stories}
                currentUserId={user?.uid}
                onCreateStory={handleCreateStory}
                onViewStory={handleViewStory}
                showCreateButton={true}
              />
            </View>
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => {
              handleRefresh();
              loadStories(); // Also refresh stories
            }} 
          />
        }
        ListEmptyComponent={!loading ? renderEmpty : null}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={10}
      />

      {/* Story Viewer Modal */}
      {showStoryViewer && storyViewerData && (
        <InstagramStoryViewer
          visible={showStoryViewer}
          stories={storyViewerData.stories}
          userStories={storyViewerData.userStories}
          initialUserIndex={storyViewerData.initialUserIndex}
          initialStoryIndex={storyViewerData.initialStoryIndex}
          onClose={() => {
            setShowStoryViewer(false);
            setStoryViewerData(null);
            loadStories(); // Refresh stories after viewing
          }}
          currentUserId={user?.uid}
        />
      )}
    </View>
  );
};

/**
 * Helper: Get time ago string
 */
const getTimeAgo = (timestamp: any): string => {
  if (!timestamp) return '';

  const now = Date.now();
  const then = timestamp.toMillis ? timestamp.toMillis() : timestamp;
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) return new Date(then).toLocaleDateString();
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Billabong' : 'sans-serif',
  },
  headerRight: {
    flexDirection: 'row',
  },
  headerIcon: {
    marginLeft: 20,
  },
  postContainer: {
    marginBottom: 16,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
  },
  postImage: {
    width: width,
    height: width,
    backgroundColor: '#f0f0f0',
  },
  noImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 16,
  },
  likesCount: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  captionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  captionUsername: {
    fontSize: 14,
    fontWeight: '600',
  },
  captionText: {
    fontSize: 14,
  },
  commentsLink: {
    fontSize: 14,
    color: '#737373',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: 12,
    color: '#737373',
    paddingHorizontal: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#737373',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  storiesContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
    paddingVertical: 8,
  },
});

export default FastHomeScreen;
