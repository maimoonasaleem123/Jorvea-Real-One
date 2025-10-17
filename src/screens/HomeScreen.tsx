import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Platform,
  StatusBar,
  Share,
  Modal,
  Vibration,
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../context/FastAuthContext';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { InstagramLikeButton } from '../components/InstagramLikeButton';
import { EnhancedDoubleTapLike } from '../components/EnhancedDoubleTapLike';
import { EnhancedMultiPostCarousel } from '../components/EnhancedMultiPostCarousel';
import InstagramLikeLoadingService from '../services/InstagramLikeLoadingService';
import FirebaseService, { Post, Story } from '../services/firebaseService';
import { Post as PostType, Story as StoryType } from '../types';
import SaveButton from '../components/SaveButton';
import { BeautifulCard } from '../components/BeautifulCard';
import { BeautifulHeader } from '../components/BeautifulHeader';
import { BeautifulButton } from '../components/BeautifulButton';
import { EnhancedPostCard } from '../components/EnhancedPostCard';
import { InstagramStoryList, InstagramStoryViewer } from '../components/InstagramStoryComponents';
import { DynamicStoryCollaboration } from '../components/DynamicStoryCollaboration';
import EnhancedStoryList from '../components/EnhancedStoryList';
import { LightningFast } from '../services/LightningFastService';
import HyperSpeedService from '../services/HyperSpeedService';
import DynamicFirebaseService from '../services/DynamicFirebaseService';
import BackgroundProcessingService from '../services/BackgroundProcessingService';
import { SmartAlgorithmService } from '../services/SmartAlgorithmService';
import { DynamicFollowService } from '../services/DynamicFollowService';
import UniversalFollowButton from '../components/UniversalFollowButton';
import { DynamicSocialChallenges } from '../components/DynamicSocialChallenges';
import { EnhancedReactions, useEnhancedReactions } from '../components/EnhancedReactions';
import { SmartFriendDiscovery } from '../components/SmartFriendDiscovery';
import { useTheme } from '../context/ThemeContext';
import DynamicSaveArchiveService from '../services/DynamicSaveArchiveService';
import { LikesList } from '../components/LikesList';
import { CommentsScreen } from '../components/CommentsScreen';
import { IntelligentLazyLoader } from '../services/IntelligentLazyLoader';
import { LazyPostsList } from '../components/LazyInfiniteList';
import { LazyPostImage, LazyProfilePicture } from '../components/LazyMediaComponent';
import { InstagramShareModal } from '../components/InstagramShareModal';
import { RootStackParamList } from '../types';

// NEW PERFECT SERVICES FOR COMPLETE INSTAGRAM FUNCTIONALITY
import UltraFastPostService from '../services/UltraFastPostService';
import PerfectSharePostModal from '../components/PerfectSharePostModal';
import DynamicFirebasePostsService, { SimpleDynamicPost } from '../services/DynamicFirebasePostsService';
import RealTimeLikeSystem from '../services/RealTimeLikeSystem';
import InstagramMessagingService from '../services/InstagramMessagingService';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 350;

const HomeScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  
  // Enhanced reactions hook
  const { addReaction, getReactionCounts, getUserReaction } = useEnhancedReactions();
  
  // DYNAMIC FIREBASE POSTS - Real-time Instagram-style feed
  const [posts, setPosts] = useState<SimpleDynamicPost[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Initialize Intelligent Lazy Loader for memory optimization
  const lazyLoader = React.useMemo(() => new IntelligentLazyLoader(), []);

  // Initialize services and load instant feed - INSTAGRAM-LIKE MODE
  useEffect(() => {
    if (user?.uid) {
      initializeInstagramLikeSystem();
    }
  }, [user?.uid]);

  const initializeInstagramLikeSystem = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);

      console.log('🚀 Loading dynamic posts from Firebase...');

      // Load dynamic posts from Firebase
      const dynamicPosts = await DynamicFirebasePostsService.getInstance().getDynamicPosts(user.uid, 20);
      setPosts(dynamicPosts);
      
      // Load stories normally (they're smaller)
      const instantStories: Story[] = [];  // Placeholder until stories method exists
      setStories(instantStories);
      
      setHasMore(dynamicPosts.length >= 20);

      console.log(`✅ Loaded ${dynamicPosts.length} dynamic posts and ${instantStories.length} stories from Firebase!`);

      // Setup continuous background refresh for Instagram-like experience
      const refreshInterval = setInterval(async () => {
        try {
          console.log('🔄 Background refresh for fresh content...');
          // Background refresh logic can be added here
        } catch (error) {
          console.error('❌ Background refresh failed:', error);
        }
      }, 30000); // Refresh every 30 seconds

      console.log(`⚡ DYNAMIC HOME: Loaded ${dynamicPosts.length} posts from Firebase!`);

    } catch (error) {
      console.error('❌ Error initializing dynamic system:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // Refresh with dynamic Firebase posts
  const refreshFeed = useCallback(async () => {
    if (!user?.uid || refreshing) return;

    try {
      setRefreshing(true);
      console.log('🔄 Refreshing dynamic posts...');

      // Refresh content with dynamic service
      const dynamicPosts = await DynamicFirebasePostsService.getInstance().refreshPosts(user.uid);
      const instantStories: Story[] = [];  // Placeholder until stories method exists

      setPosts(dynamicPosts);
      setStories(instantStories);
      setHasMore(dynamicPosts.length >= 20);

      console.log(`✅ REFRESHED with ${dynamicPosts.length} dynamic posts and ${instantStories.length} stories!`);

    } catch (error) {
      console.error('❌ Error refreshing dynamic feed:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user?.uid, refreshing]);

  // Load more posts dynamically
  const loadMorePosts = useCallback(async () => {
    if (!user?.uid || loading || !hasMore || posts.length === 0) return;

    try {
      setLoading(true);
      console.log('🔄 Loading more dynamic posts...');

      // Load more posts
      const lastPostId = posts[posts.length - 1]?.id;
      if (!lastPostId) return;

      const morePosts = await DynamicFirebasePostsService.getInstance().loadMorePosts(user.uid, lastPostId, 10);

      if (morePosts.length > 0) {
        setPosts(prev => [...prev, ...morePosts]);
        console.log(`✅ Loaded ${morePosts.length} more dynamic posts`);
        
        if (morePosts.length < 10) {
          setHasMore(false);
          console.log('📭 No more posts available');
        }
      } else {
        setHasMore(false);
        console.log('📭 No more posts available');
      }

    } catch (error) {
      console.error('❌ Error loading more posts:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, loading, hasMore, posts]);

  // ❤️ PERFECT LIKE SYSTEM for posts
  const handlePostLike = useCallback(async (postId: string) => {
    if (!user?.uid) return;

    try {
      // Find the current post to get its current state
      const currentPost = posts.find(post => post.id === postId);
      if (!currentPost) return;

      console.log('❤️ PerfectLike: Starting like toggle for post:', postId);

      // Use PerfectLikeSystem for bulletproof like handling
      const result = await RealTimeLikeSystem.getInstance().toggleLike(
        postId,
        user.uid,
        'post',
        currentPost.isLiked || false,
        currentPost.likesCount || 0
      );

      if (result.success) {
        // Update local state with the final result
        setPosts(prev => prev.map(post =>
          post.id === postId
            ? { 
                ...post, 
                isLiked: result.isLiked, 
                likesCount: result.likesCount
              }
            : post
        ));

        console.log(`✅ PerfectLike: Post ${postId} ${result.isLiked ? 'liked' : 'unliked'} successfully. Count: ${result.likesCount}`);
      } else {
        // Show error message if needed
        if (result.error && result.error !== 'Too fast') {
          Alert.alert('❤️ Like Error', 'Unable to update like. Please try again.');
        }
        console.log('⚠️ PerfectLike: Like operation failed:', result.error);
      }

    } catch (error) {
      console.error('❌ PerfectLike: Unexpected error in handlePostLike:', error);
      Alert.alert('❤️ Like Error', 'Something went wrong. Please check your connection and try again.');
    }
  }, [user?.uid, posts]);
  
  // UI State
  const [lastPostId, setLastPostId] = useState<string>();
  const [showLikesList, setShowLikesList] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string>();
  const [showComments, setShowComments] = useState(false);
  const [selectedPostForComments, setSelectedPostForComments] = useState<string>();
  
  // Share modal state - OLD MODAL
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedPostForShare, setSelectedPostForShare] = useState<Post | null>(null);
  
  // PERFECT SHARE MODAL STATE - NEW ENHANCED SHARING
  const [showPerfectShareModal, setShowPerfectShareModal] = useState(false);
  const [selectedPostForPerfectShare, setSelectedPostForPerfectShare] = useState<Post | null>(null);
  
  // Instagram Story Viewer State
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [currentUserStories, setCurrentUserStories] = useState<Story[]>([]);
  const [storyViewerIndex, setStoryViewerIndex] = useState(0);
  
  // Unread counts for badges
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Initialize UltraFastPostService for perfect Instagram-like interactions
  const ultraFastPostService = React.useMemo(() => UltraFastPostService.getInstance(), []);

  // Initialize Lightning Fast Service on mount
  useEffect(() => {
    if (user?.uid) {
      LightningFast.initialize().then(() => {
        // Prefetch content in background for super fast experience
        LightningFast.prefetchUserContent(user.uid);
      });
    }
  }, [user?.uid]);

  // Instant refresh handling - Lightning fast like Instagram
  const handleRefresh = useCallback(async () => {
    await refreshFeed();
  }, [refreshFeed]);

  // Load more posts for infinite scroll
  const handleLoadMore = useCallback(async () => {
    if (!loading && hasMore) {
      await loadMorePosts();
    }
  }, [loading, hasMore, loadMorePosts]);

  // Load unread counts
  const loadUnreadCounts = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      // Get unread notifications count
      const notificationsRef = await firestore()
        .collection('notifications')
        .where('userId', '==', user.uid)
        .where('read', '==', false)
        .get();
      
      setUnreadNotifications(notificationsRef.docs.length);
      
      // Get unread messages count
      const chatsRef = await firestore()
        .collection('chats')
        .where('participants', 'array-contains', user.uid)
        .get();
      
      let totalUnreadMessages = 0;
      for (const chatDoc of chatsRef.docs) {
        const chatData = chatDoc.data();
        const lastReadTimestamp = chatData.lastRead?.[user.uid];
        
        if (lastReadTimestamp) {
          const messagesRef = await firestore()
            .collection(`chats/${chatDoc.id}/messages`)
            .where('timestamp', '>', lastReadTimestamp)
            .where('senderId', '!=', user.uid)
            .get();
          
          totalUnreadMessages += messagesRef.docs.length;
        }
      }
      
      setUnreadMessages(totalUnreadMessages);
    } catch (error) {
      console.error('Error loading unread counts:', error);
    }
  }, [user]);

  useEffect(() => {
    loadUnreadCounts();
  }, [loadUnreadCounts]);

  // Set up real-time listeners for unread counts
  useEffect(() => {
    if (!user?.uid) return;

    // Listen for new notifications
    const unsubscribeNotifications = firestore()
      .collection('notifications')
      .where('userId', '==', user.uid)
      .where('read', '==', false)
      .onSnapshot((snapshot) => {
        setUnreadNotifications(snapshot.docs.length);
      });

    // Listen for new messages (simplified approach)
    const unsubscribeChats = firestore()
      .collection('chats')
      .where('participants', 'array-contains', user.uid)
      .onSnapshot(async (snapshot) => {
        try {
          let totalUnreadMessages = 0;
          for (const chatDoc of snapshot.docs) {
            const chatData = chatDoc.data();
            const unreadCount = chatData.unreadCount?.[user.uid] || 0;
            totalUnreadMessages += unreadCount;
          }
          setUnreadMessages(totalUnreadMessages);
        } catch (error) {
          console.error('Error updating unread messages:', error);
        }
      });

    return () => {
      unsubscribeNotifications();
      unsubscribeChats();
    };
  }, [user]);

  const handleSavePost = async (postId: string) => {
    // Implement save functionality
    Alert.alert('Saved', 'Post saved to your collection');
  };

  const handleCreateStory = () => {
    // Navigate to comprehensive story creation screen
    (navigation as any).navigate('ComprehensiveStoryCreation');
  };

  const handleViewStory = (storyGroup: any, initialIndex: number) => {
    // Open Instagram-style story viewer
    setCurrentUserStories(storyGroup.stories);
    setStoryViewerIndex(initialIndex);
    setShowStoryViewer(true);
  };

  const closeStoryViewer = () => {
    setShowStoryViewer(false);
    setCurrentUserStories([]);
    setStoryViewerIndex(0);
  };

  const handleSharePost = async (post: Post) => {
    setSelectedPostForShare(post);
    setShowShareModal(true);
  };

  // Handle in-app share
  const handleInAppShare = useCallback((post: Post) => {
    // For now, we'll show an alert - this can be enhanced to navigate to chat selection
    Alert.alert(
      'Share to Jorvea Message',
      'Select a friend to share this post with:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Select Friend', 
          onPress: () => {
            // Navigate to chat user selection screen
            navigation.navigate('ChatUserSearch');
            // Store the post to share in a global state or context if needed
          }
        }
      ]
    );
  }, [navigation]);

  const sharePostToExternalApp = async (post: Post) => {
    try {
      const shareOptions = {
        title: 'Check out this post!',
        message: `Check out this post by ${post.user?.displayName || 'Anonymous'}: ${post.caption || 'No caption'}`,
        url: post.mediaUrls?.[0] || '', // Share the first media URL if available
      };

      const result = await Share.share(shareOptions);
      
      if (result.action === Share.sharedAction) {
        // Could implement share count tracking here if needed
        console.log('Post shared successfully');
      }
    } catch (error) {
      console.error('Error sharing post:', error);
      Alert.alert('Error', 'Failed to share post. Please try again.');
    }
  };

  const sharePostToJorveaChat = (post: Post) => {
    // Navigate to chat list to select a chat to share the post
    navigation.navigate('ChatList');
    setShowShareModal(false);
  };

  const handleCommentPost = (post: Post) => {
    setSelectedPostForComments(post.id);
    setShowComments(true);
  };

  const handleCloseComments = () => {
    setShowComments(false);
    setSelectedPostForComments(undefined);
  };

  const handleShowLikes = (postId: string) => {
    setSelectedPostId(postId);
    setShowLikesList(true);
  };

  // 🚀 PERFECT POST INTERACTION HANDLERS - INSTAGRAM-LIKE FUNCTIONALITY
  
  const handlePerfectLike = useCallback(async (post: Post) => {
    if (!user?.uid) return;

    try {
      Vibration.vibrate(30); // Instant haptic feedback
      
      // Optimistic UI update - instantly show like state change
      const isCurrentlyLiked = post.likes?.includes(user.uid) || false;
      const updatedLikes = isCurrentlyLiked 
        ? post.likes?.filter(id => id !== user.uid) || []
        : [...(post.likes || []), user.uid];
      
      // Update local state immediately for instant UI response
      setPosts(prevPosts => 
        prevPosts.map(p => 
          p.id === post.id 
            ? { ...p, likes: updatedLikes, likesCount: updatedLikes.length }
            : p
        )
      );

      // Perform server update in background
      const success = await ultraFastPostService.togglePostLike(user.uid, post.id);
      
      if (!success) {
        // Revert optimistic update if server update failed
        setPosts(prevPosts => 
          prevPosts.map(p => 
            p.id === post.id 
              ? { ...p, likes: post.likes, likesCount: post.likes?.length || 0 }
              : p
          )
        );
        console.warn('Failed to sync like with server');
      }
    } catch (error) {
      console.error('Error handling perfect like:', error);
    }
  }, [user?.uid, ultraFastPostService]);

  const handlePerfectSave = useCallback(async (post: Post) => {
    if (!user?.uid) return;

    try {
      Vibration.vibrate(50); // Different vibration for save
      
      const success = await ultraFastPostService.togglePostSave(user.uid, post.id);
      
      if (success) {
        Alert.alert('✨ Saved!', 'Post saved to your collection', [
          { text: 'View Saved', onPress: () => navigation.navigate('SavedPosts') },
          { text: 'OK', style: 'default' }
        ]);
      } else {
        Alert.alert('❌ Removed', 'Post removed from saved collection');
      }
    } catch (error) {
      console.error('Error handling perfect save:', error);
      Alert.alert('Error', 'Failed to save post. Please try again.');
    }
  }, [user?.uid, ultraFastPostService, navigation]);

  const handlePerfectShare = useCallback((post: Post) => {
    setSelectedPostForPerfectShare(post);
    setShowPerfectShareModal(true);
  }, []);

  const handlePerfectComment = useCallback((post: Post) => {
    setSelectedPostForComments(post.id);
    setShowComments(true);
  }, []);

  const handleCloseLikes = () => {
    setShowLikesList(false);
    setSelectedPostId(undefined);
  };

  const PostItem: React.FC<{ post: Post }> = ({ post }) => {
    // Check if post has enhanced features
    const hasEnhancedFeatures = !!(
      post.filter || 
      post.textElements || 
      post.stickerElements || 
      post.music ||
      (post.type === 'carousel' && post.mediaUrls.length > 1)
    );

    // Use EnhancedPostCard for posts with enhanced features
    if (hasEnhancedFeatures) {
      return (
        <EnhancedPostCard
          post={post as any}
          onLike={async (postId) => {
            if (!user?.uid) return;
            
            try {
              console.log(`🎯 HomeScreen: Starting like toggle for post ${postId}`);
              console.log(`📊 Current post state - isLiked: ${post.isLiked}, likesCount: ${post.likesCount}`);
              
              // Use RealTimeLikeSystem to handle likes with Firebase
              const result = await RealTimeLikeSystem.getInstance().toggleLike(
                postId,
                user.uid,
                'post',
                post.isLiked,
                post.likesCount
              );
              
              console.log(`📥 HomeScreen: Received result from RealTimeLikeSystem:`, result);
              
              if (result.success) {
                // Update local state with new like state
                setPosts(prevPosts =>
                  prevPosts.map(p =>
                    p.id === postId
                      ? { ...p, isLiked: result.isLiked, likesCount: result.likesCount }
                      : p
                  )
                );
                console.log(`✅ HomeScreen: Post ${result.isLiked ? 'liked' : 'unliked'} successfully. New count: ${result.likesCount}`);
              } else {
                console.error(`❌ HomeScreen: Like toggle failed:`, result.error);
              }
            } catch (error) {
              console.error('❌ HomeScreen: Error toggling like:', error);
            }
          }}
          onSave={handleSavePost}
          onComment={handleCommentPost}
          onShare={handleSharePost}
          onUserPress={(userId) => {
            if (userId !== user?.uid) {
              (navigation as any).navigate('UserProfile', { userId });
            }
          }}
          onHashtagPress={(hashtag) => {
            (navigation as any).navigate('Search', { query: `#${hashtag}` });
          }}
          onLocationPress={(location) => {
            (navigation as any).navigate('Search', { query: location });
          }}
        />
      );
    }

    // Original PostItem implementation for regular posts with enhanced video interaction
    const [muted, setMuted] = useState(true); // Videos start muted by default
    const [paused, setPaused] = useState(true); // Videos STOPPED by default - only play on user interaction
    const [showControls, setShowControls] = useState(true); // Show play button initially
    const [hasUserInteracted, setHasUserInteracted] = useState(false); // Track if user has interacted with video
    const videoRef = useRef<VideoRef>(null);

    const toggleMute = () => {
      setMuted(!muted);
    };

    const togglePlayPause = () => {
      setHasUserInteracted(true); // Mark that user has interacted
      setPaused(!paused);
      if (paused) {
        // Starting to play - hide controls after delay
        setShowControls(false);
        setTimeout(() => setShowControls(false), 2000);
      } else {
        // Pausing - show controls
        setShowControls(true);
      }
    };

    // Auto-pause video when user scrolls away or hasn't interacted
    React.useEffect(() => {
      if (!hasUserInteracted) {
        setPaused(true); // Keep videos stopped unless user interacts
      }
    }, [hasUserInteracted]);

    const renderMedia = () => {
      if (post.type === 'video' && post.mediaUrls && post.mediaUrls.length > 0) {
        return (
          <View style={styles.postMediaContainer}>
            <TouchableOpacity 
              style={styles.videoContainer}
              onPress={togglePlayPause}
              activeOpacity={1}
            >
              <Video
                ref={videoRef}
                source={{ uri: post.mediaUrls[0] }}
                style={styles.postMedia}
                resizeMode="cover"
                paused={paused}
                muted={muted}
                repeat={true}
                controls={false}
                playInBackground={false}
                playWhenInactive={false}
              />
              
              {/* Video Controls Overlay */}
              {(showControls && paused) || (!paused && showControls) && (
                <View style={styles.videoOverlay}>
                  <Icon 
                    name={paused ? "play" : "pause"} 
                    size={50} 
                    color="rgba(255,255,255,0.9)" 
                  />
                </View>
              )}

              {/* Initial Play Button Overlay for paused videos */}
              {paused && (
                <View style={styles.playButtonOverlay}>
                  <TouchableOpacity 
                    style={styles.playButton}
                    onPress={togglePlayPause}>
                    <Icon name="play-arrow" size={60} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Mute/Unmute Button */}
              <TouchableOpacity 
                style={styles.muteButton}
                onPress={toggleMute}
              >
                <Icon 
                  name={muted ? "volume-mute" : "volume-high"} 
                  size={20} 
                  color="#fff" 
                />
              </TouchableOpacity>
              
              {/* Music Info */}
              {post.music && (
                <View style={styles.musicInfo}>
                  <Icon name="musical-notes" size={16} color="#fff" />
                  <Text style={styles.musicText} numberOfLines={1}>
                    {post.music.title} • {post.music.artist}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        );
      }

      // Regular image posts with enhanced multi-post carousel
      return (
        <View style={styles.postMediaContainer}>
          <EnhancedMultiPostCarousel
            mediaUrls={post.mediaUrls || []}
            postId={post.id}
            height={350}
            onIndexChange={(index) => {
              console.log('📍 Multi-post carousel index changed:', index);
            }}
          />
        </View>
      );
    };

    return (
      <BeautifulCard style={styles.postCard}>
        {/* Post Header */}
        <View style={styles.postHeader}>
          <TouchableOpacity 
            style={styles.postUserInfo}
            onPress={() => {
              if (post.userId && post.userId !== user?.uid) {
                (navigation as any).navigate('UserProfile', { 
                  userId: post.userId, 
                  user: post.user 
                });
              }
            }}
          >
            {(post.user?.profilePicture || post.user?.photoURL) ? (
              <LazyProfilePicture 
                userId={post.user.id} 
                imageUrl={post.user.profilePicture || post.user.photoURL} 
                size={40} 
              />
            ) : (
              <View style={styles.defaultPostAvatar}>
                <Text style={styles.defaultPostAvatarText}>
                  {post.user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            <View style={styles.postUserDetails}>
              <View style={styles.usernameContainer}>
                <Text style={styles.postUsername}>
                  {post.user?.username || post.user?.displayName || `user_${post.userId?.slice(-6) || 'unknown'}`}
                </Text>
                {post.user?.isVerified && (
                  <Icon name="checkmark-circle" size={14} color="#007AFF" />
                )}
              </View>
              {post.location && (
                <Text style={styles.postLocation}>{post.location.name}</Text>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity>
            <Icon name="ellipsis-horizontal" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {/* Post Media */}
        {post.mediaUrls && post.mediaUrls.length > 0 && renderMedia()}

        {/* 🚀 PERFECT POST ACTIONS - INSTAGRAM-LIKE FUNCTIONALITY */}
      <View style={styles.postActions}>
        <View style={styles.leftActions}>
          {/* Perfect Like Button with Instant Response */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handlePerfectLike(post)}
            activeOpacity={0.6}
          >
            <Icon 
              name={post.likes?.includes(user?.uid || '') ? "heart" : "heart-outline"} 
              size={28} 
              color={post.likes?.includes(user?.uid || '') ? "#ff3040" : "#262626"} 
            />
          </TouchableOpacity>
          
          {/* Perfect Comment Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handlePerfectComment(post)}
            activeOpacity={0.6}
          >
            <Icon name="chatbubble-outline" size={26} color="#262626" />
          </TouchableOpacity>
          
          {/* Perfect Share Button - Opens Perfect Share Modal */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handlePerfectShare(post)}
            activeOpacity={0.6}
          >
            <Icon name="paper-plane-outline" size={26} color="#262626" />
          </TouchableOpacity>
        </View>
        
        {/* Perfect Save Button */}
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handlePerfectSave(post)}
          activeOpacity={0.6}
        >
          <Icon 
            name="bookmark-outline" 
            size={26} 
            color="#262626" 
          />
        </TouchableOpacity>
      </View>

      {/* Post Info */}
      <View style={styles.postInfo}>
        {post.likesCount > 0 && (
          <TouchableOpacity onPress={() => handleShowLikes(post.id)}>
            <Text style={styles.likesCount}>
              {FirebaseService.formatNumber(post.likesCount)} likes
            </Text>
          </TouchableOpacity>
        )}
        
        {post.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.caption}>
              <Text style={styles.captionUsername}>
                {post.user?.username || post.user?.displayName}
              </Text>
              {' '}
              {post.caption}
            </Text>
          </View>
        )}

        {post.hashtags && post.hashtags.length > 0 && (
          <View style={styles.hashtagsContainer}>
            {post.hashtags.map((hashtag, index) => (
              <Text key={index} style={styles.hashtag}>
                #{hashtag}
              </Text>
            ))}
          </View>
        )}

        {post.commentsCount > 0 && (
          <TouchableOpacity onPress={() => handleCommentPost(post)}>
            <Text style={styles.viewComments}>
              View all {post.commentsCount} comments
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.timeAgo}>
          {new Date(post.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </BeautifulCard>
  );
  };

  const renderPost = ({ item }: { item: Post }) => <PostItem post={item} />;

  const { isDarkMode } = useTheme();

  // Show loading for initial load
  if (loading && posts.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>🧠 Loading personalized feed...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Status bar handled by BeautifulHeader */}
      
      {/* Beautiful Header */}
      <BeautifulHeader
        showLogo={true}
        rightIcon="heart-outline"
        rightIcon2="chatbubble-outline"
        rightIconBadge={unreadNotifications}
        rightIcon2Badge={unreadMessages}
        onRightPress={() => {
          console.log('🔔 Notifications icon pressed!');
          Alert.alert('Debug', 'Notifications icon pressed!');
          console.log('Navigation object:', navigation);
          console.log('Navigation state:', navigation.getState?.());
          try {
            navigation.navigate('Notifications');
            console.log('✅ Navigation to Notifications triggered');
          } catch (error) {
            console.error('❌ Navigation error:', error);
            Alert.alert('Navigation Error', error.message);
          }
        }}
        onRightPress2={() => {
          console.log('💬 Chat icon pressed!');
          Alert.alert('Debug', 'Chat icon pressed!');
          console.log('Navigation object:', navigation);
          console.log('Navigation state:', navigation.getState?.());
          try {
            navigation.navigate('ChatList');
            console.log('✅ Navigation to ChatList triggered');
          } catch (error) {
            console.error('❌ Navigation error:', error);
            Alert.alert('Navigation Error', error.message);
          }
        }}
      />

      <LazyPostsList
        items={posts.map(post => ({ id: post.id, type: 'post' as const, data: post }))}
        renderItem={({ item }) => <PostItem post={item.data} />}
        onLoadMore={handleLoadMore}
        loading={loading}
        hasMore={hasMore}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onItemVisible={(item) => {
          console.log(`👀 POST VISIBLE: ${item.id}`);
        }}
        onItemHidden={(item) => {
          console.log(`👁️ POST HIDDEN: ${item.id}`);
        }}
        ListHeaderComponent={
          <View>
            {/* Enhanced Story System with Rainbow Borders */}
            <EnhancedStoryList 
              onAddStory={handleCreateStory}
              style={{ marginBottom: 16 }}
            />
            
            <DynamicStoryCollaboration visible={false} onClose={() => {}} />
            <DynamicSocialChallenges userId={user?.uid || ''} />
            <SmartFriendDiscovery userId={user?.uid || ''} />
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Icon name="feed" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No posts yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Follow users to see their posts here
              </Text>
            </View>
          ) : null
        }
      />

      <LikesList
        visible={showLikesList}
        onClose={handleCloseLikes}
        postId={selectedPostId}
      />

      <CommentsScreen
        visible={showComments}
        onClose={handleCloseComments}
        postId={selectedPostForComments}
        contentType="post"
      />

      {/* Instagram Story Viewer */}
      <InstagramStoryViewer
        visible={showStoryViewer}
        userStories={currentUserStories}
        initialIndex={storyViewerIndex}
        onClose={closeStoryViewer}
        currentUser={user ? {
          username: user.displayName || user.email || 'You',
          profilePicture: user.photoURL || undefined,
        } : undefined}
      />
      
      {/* Instagram Share Modal */}
      {selectedPostForShare && (
        <InstagramShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          content={{
            type: 'post',
            id: selectedPostForShare.id,
            url: `https://jorvea.app/posts/${selectedPostForShare.id}`,
            text: selectedPostForShare.caption,
            title: `Post by @${selectedPostForShare.user?.username || selectedPostForShare.user?.displayName}`,
            mediaUrl: selectedPostForShare.mediaUrls?.[0],
            userName: selectedPostForShare.user?.displayName || selectedPostForShare.user?.username,
            userProfilePicture: selectedPostForShare.user?.profilePicture,
          }}
          onSave={() => {
            refreshFeed(); // Refresh to update save status
          }}
        />
      )}

      {/* 🚀 PERFECT SHARE MODAL - ENHANCED INSTAGRAM-LIKE SHARING */}
      <PerfectSharePostModal
        visible={showPerfectShareModal}
        post={selectedPostForPerfectShare}
        onClose={() => {
          setShowPerfectShareModal(false);
          setSelectedPostForPerfectShare(null);
        }}
      />
      
      {/* Beautiful Floating Action Button */}
      <TouchableOpacity 
        style={[styles.fab, { shadowColor: colors.primary }]}
        onPress={() => navigation.navigate('Create' as never)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Icon name="add" size={28} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: isTablet ? 24 : 16,
    paddingVertical: isTablet ? 16 : 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: isTablet ? 32 : 28,
    fontWeight: 'bold',
    color: '#000',
    marginRight: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff3b30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 4,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTablet ? 20 : 16,
  },
  headerIcon: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  storiesContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  storiesContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  firstStoryItem: {
    // Styles for "Your Story"
  },
  storyImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    marginBottom: 4,
  },
  yourStoryContainer: {
    backgroundColor: '#f0f0f0',
  },
  viewedStoryContainer: {
    opacity: 0.6,
  },
  storyImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  defaultAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultAvatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
  },
  addStoryIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyUsername: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  postCard: {
    marginBottom: isTablet ? 20 : 16,
    backgroundColor: '#fff',
    borderRadius: isTablet ? 12 : 0,
    elevation: isTablet ? 3 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isTablet ? 0.1 : 0,
    shadowRadius: isTablet ? 6 : 0,
    maxWidth: isTablet ? 600 : '100%',
    alignSelf: isTablet ? 'center' : 'stretch',
    width: isTablet ? '90%' : '100%',
    overflow: 'hidden',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  postUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  postUserAvatar: {
    width: isTablet ? 50 : 40,
    height: isTablet ? 50 : 40,
    borderRadius: isTablet ? 25 : 20,
    marginRight: isTablet ? 16 : 12,
  },
  defaultPostAvatar: {
    width: isTablet ? 50 : 40,
    height: isTablet ? 50 : 40,
    borderRadius: isTablet ? 25 : 20,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: isTablet ? 16 : 12,
  },
  defaultPostAvatarText: {
    fontSize: isTablet ? 18 : 16,
    fontWeight: 'bold',
    color: '#666',
  },
  postUserDetails: {
    flex: 1,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postUsername: {
    fontSize: isTablet ? 16 : 14,
    fontWeight: 'bold',
    color: '#000',
    marginRight: 4,
  },
  postLocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  postMediaContainer: {
    position: 'relative',
  },
  mediaScrollView: {
    width: '100%',
  },
  postMedia: {
    width,
    height: width,
  },
  mediaIndicators: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  mediaIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.6)',
    marginHorizontal: 2,
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 18, // Instagram-like spacing
    padding: 4, // Touch target padding for better usability
  },
  postInfo: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  likesCount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  captionContainer: {
    marginBottom: 4,
  },
  caption: {
    fontSize: 14,
    color: '#000',
    lineHeight: 20,
  },
  captionUsername: {
    fontWeight: 'bold',
  },
  hashtagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  hashtag: {
    fontSize: 14,
    color: '#007AFF',
    marginRight: 8,
  },
  viewComments: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: 12,
    color: '#999',
  },
  footerLoader: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    position: 'relative',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  playButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muteButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    padding: 8,
    zIndex: 1,
  },
  musicInfo: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 60,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  musicText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 6,
    flex: 1,
  },
  shareModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  shareModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: '50%',
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  shareOptions: {
    paddingTop: 20,
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  shareOptionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  shareOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  
  // Modern Design Styles
  modernHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 0,
  },
  headerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modernHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  gradientIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10fedb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  
  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  
  // Error placeholder styles
  errorPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    minHeight: 200,
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10fedb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  // New styles for instant loading
  endMessage: {
    padding: 32,
    alignItems: 'center',
  },
  endMessageText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
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

export default HomeScreen;
