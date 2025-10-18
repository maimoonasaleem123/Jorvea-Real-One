import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, NavigationProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import FirebaseService from '../services/firebaseService';
import { Post, User, Reel, Story, RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import { InstagramPostViewer, InstagramReelViewer } from '../components/InstagramViewers';
import { EnhancedFollowButton } from '../components/EnhancedFollowButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_IMAGE_SIZE = (SCREEN_WIDTH - 3) / 3;
const STORY_SIZE = 70;

type UserProfileScreenRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;
type ContentTab = 'posts' | 'reels' | 'tagged';

interface ContentState {
  posts: Post[];
  reels: Reel[];
  postsPage: number;
  reelsPage: number;
  hasMorePosts: boolean;
  hasMoreReels: boolean;
  loadingMorePosts: boolean;
  loadingMoreReels: boolean;
}

const ITEMS_PER_PAGE = 12;

const PerfectUserProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<UserProfileScreenRouteProp>();
  const { user: currentUser } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const { userId } = route.params;

  // Core State
  const [profile, setProfile] = useState<User | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [canView, setCanView] = useState(true);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<ContentTab>('posts');
  
  // Content State with Pagination
  const [content, setContent] = useState<ContentState>({
    posts: [],
    reels: [],
    postsPage: 0,
    reelsPage: 0,
    hasMorePosts: true,
    hasMoreReels: true,
    loadingMorePosts: false,
    loadingMoreReels: false,
  });
  
  // Loading States
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Viewer States
  const [showPostViewer, setShowPostViewer] = useState(false);
  const [showReelViewer, setShowReelViewer] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // INSTANT LOAD: Profile + Stories + First Batch
  const loadProfileData = useCallback(async (isRefresh = false) => {
    if (!currentUser) return;

    try {
      if (!isRefresh) setInitialLoading(true);

      // Load profile data
      const [profileData, followStatus, storiesData] = await Promise.all([
        FirebaseService.getUserProfile(userId),
        FirebaseService.checkIfFollowing(currentUser.uid, userId),
        FirebaseService.getUserStories(userId),
      ]);

      setProfile(profileData);
      setIsFollowing(followStatus);
      setIsPrivate(profileData.isPrivate || false);
      setStories(storiesData.filter(s => !s.isExpired));

      // Check if can view content
      const canViewContent = !profileData.isPrivate || followStatus || userId === currentUser.uid;
      setCanView(canViewContent);

      if (canViewContent) {
        // Load first page of current tab content
        loadInitialContent();
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setInitialLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [userId, currentUser]);

  // Load initial content (first page)
  const loadInitialContent = async () => {
    try {
      const [postsData, reelsData] = await Promise.all([
        FirebaseService.getUserPosts(userId, ITEMS_PER_PAGE, 0),
        FirebaseService.getUserReels(userId, ITEMS_PER_PAGE, 0),
      ]);

      setContent(prev => ({
        ...prev,
        posts: postsData,
        reels: reelsData,
        postsPage: 1,
        reelsPage: 1,
        hasMorePosts: postsData.length === ITEMS_PER_PAGE,
        hasMoreReels: reelsData.length === ITEMS_PER_PAGE,
      }));
    } catch (error) {
      console.error('Error loading initial content:', error);
    }
  };

  // Lazy load more posts (pagination)
  const loadMorePosts = async () => {
    if (content.loadingMorePosts || !content.hasMorePosts) return;

    try {
      setContent(prev => ({ ...prev, loadingMorePosts: true }));

      const newPosts = await FirebaseService.getUserPosts(
        userId,
        ITEMS_PER_PAGE,
        content.postsPage * ITEMS_PER_PAGE
      );

      setContent(prev => ({
        ...prev,
        posts: [...prev.posts, ...newPosts],
        postsPage: prev.postsPage + 1,
        hasMorePosts: newPosts.length === ITEMS_PER_PAGE,
        loadingMorePosts: false,
      }));
    } catch (error) {
      console.error('Error loading more posts:', error);
      setContent(prev => ({ ...prev, loadingMorePosts: false }));
    }
  };

  // Lazy load more reels (pagination)
  const loadMoreReels = async () => {
    if (content.loadingMoreReels || !content.hasMoreReels) return;

    try {
      setContent(prev => ({ ...prev, loadingMoreReels: true }));

      const newReels = await FirebaseService.getUserReels(
        userId,
        ITEMS_PER_PAGE,
        content.reelsPage * ITEMS_PER_PAGE
      );

      setContent(prev => ({
        ...prev,
        reels: [...prev.reels, ...newReels],
        reelsPage: prev.reelsPage + 1,
        hasMoreReels: newReels.length === ITEMS_PER_PAGE,
        loadingMoreReels: false,
      }));
    } catch (error) {
      console.error('Error loading more reels:', error);
      setContent(prev => ({ ...prev, loadingMoreReels: false }));
    }
  };

  // Initial load
  useEffect(() => {
    loadProfileData();
  }, [userId]);

  // Refresh handler
  const handleRefresh = () => {
    setRefreshing(true);
    setContent({
      posts: [],
      reels: [],
      postsPage: 0,
      reelsPage: 0,
      hasMorePosts: true,
      hasMoreReels: true,
      loadingMorePosts: false,
      loadingMoreReels: false,
    });
    loadProfileData(true);
  };

  // Follow/Unfollow handler
  const handleFollowToggle = async () => {
    if (!currentUser || !profile) return;

    try {
      const newFollowStatus = !isFollowing;
      setIsFollowing(newFollowStatus);

      if (newFollowStatus) {
        await FirebaseService.followUser(currentUser.uid, userId);
        setProfile(prev => prev ? { ...prev, followersCount: (prev.followersCount || 0) + 1 } : null);
      } else {
        await FirebaseService.unfollowUser(currentUser.uid, userId);
        setProfile(prev => prev ? { ...prev, followersCount: Math.max(0, (prev.followersCount || 0) - 1) } : null);
      }

      // If account was private and now following, reload content
      if (isPrivate && newFollowStatus) {
        setCanView(true);
        loadInitialContent();
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      setIsFollowing(!isFollowing);
    }
  };

  // Message handler
  const handleMessage = () => {
    if (!profile) return;
    navigation.navigate('ChatScreen', {
      userId: userId,
      otherUserName: profile.displayName || profile.username,
      otherUserAvatar: profile.profilePicture,
    });
  };

  // Story viewer handler
  const handleStoryPress = () => {
    if (stories.length > 0) {
      navigation.navigate('StoryViewer', {
        stories: stories,
        initialIndex: 0,
      });
    }
  };

  // Navigation handlers
  const handleFollowersPress = () => {
    navigation.navigate('FollowersList', {
      userId: userId,
      type: 'followers',
    });
  };

  const handleFollowingPress = () => {
    navigation.navigate('FollowersList', {
      userId: userId,
      type: 'following',
    });
  };

  // Content press handlers
  const handlePostPress = (index: number) => {
    setSelectedIndex(index);
    setShowPostViewer(true);
  };

  const handleReelPress = (index: number) => {
    navigation.navigate('Reels', {
      initialReelId: content.reels[index].id,
      reels: content.reels,
      initialIndex: index,
      returnTo: 'UserProfile', // Mark to return to user profile
    });
  };

  // Render header with profile info
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      {/* Profile Picture & Stories */}
      <View style={styles.profileSection}>
        <TouchableOpacity
          onPress={handleStoryPress}
          disabled={stories.length === 0}
          activeOpacity={0.7}
        >
          <View style={styles.profilePictureContainer}>
            {stories.length > 0 ? (
              <LinearGradient
                colors={['#FD1D1D', '#E1306C', '#C13584', '#833AB4', '#5851DB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.storyGradient}
              >
                <View style={styles.storyInnerBorder}>
                  <Image
                    source={{
                      uri: profile?.profilePicture || profile?.photoURL || 'https://via.placeholder.com/150',
                    }}
                    style={styles.profilePicture}
                  />
                </View>
              </LinearGradient>
            ) : (
              <Image
                source={{
                  uri: profile?.profilePicture || profile?.photoURL || 'https://via.placeholder.com/150',
                }}
                style={styles.profilePictureNoStory}
              />
            )}
          </View>
        </TouchableOpacity>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {FirebaseService.formatNumber(profile?.postsCount || content.posts.length)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Posts</Text>
          </View>

          <TouchableOpacity style={styles.statItem} onPress={handleFollowersPress}>
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {FirebaseService.formatNumber(profile?.followersCount || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Followers</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.statItem} onPress={handleFollowingPress}>
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {FirebaseService.formatNumber(profile?.followingCount || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Following</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Name & Bio */}
      <View style={styles.bioSection}>
        <View style={styles.nameRow}>
          <Text style={[styles.displayName, { color: colors.text }]}>
            {profile?.displayName || profile?.username}
          </Text>
          {profile?.isVerified && (
            <Icon name="checkmark-circle" size={16} color="#1DA1F2" />
          )}
        </View>
        {profile?.bio && (
          <Text style={[styles.bio, { color: colors.text }]}>
            {profile.bio}
          </Text>
        )}
        {profile?.website && (
          <TouchableOpacity>
            <Text style={[styles.website, { color: colors.primary }]}>
              {profile.website}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        {currentUser?.uid === userId ? (
          <>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Text style={[styles.actionButtonText, { color: colors.text }]}>
                Edit Profile
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate('ArchiveScreen')}
            >
              <Text style={[styles.actionButtonText, { color: colors.text }]}>
                Archive
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[
                styles.actionButton,
                {
                  backgroundColor: isFollowing ? colors.surface : colors.primary,
                },
              ]}
              onPress={handleFollowToggle}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  { color: isFollowing ? colors.text : '#fff' },
                ]}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface }]}
              onPress={handleMessage}
            >
              <Text style={[styles.actionButtonText, { color: colors.text }]}>
                Message
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
            >
              <Icon name="person-add-outline" size={20} color={colors.text} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
          onPress={() => setActiveTab('posts')}
        >
          <Icon
            name="grid-outline"
            size={24}
            color={activeTab === 'posts' ? colors.text : colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'reels' && styles.activeTab]}
          onPress={() => setActiveTab('reels')}
        >
          <Icon
            name="play-outline"
            size={24}
            color={activeTab === 'reels' ? colors.text : colors.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'tagged' && styles.activeTab]}
          onPress={() => setActiveTab('tagged')}
        >
          <Icon
            name="person-outline"
            size={24}
            color={activeTab === 'tagged' ? colors.text : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render grid item
  const renderGridItem = ({ item, index }: { item: Post | Reel; index: number }) => {
    const isReel = 'videoUrl' in item;
    const thumbnailUri = isReel
      ? (item as Reel).thumbnailUrl || (item as Reel).videoUrl
      : (item as Post).mediaUrls?.[0];

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => (isReel ? handleReelPress(index) : handlePostPress(index))}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: thumbnailUri || 'https://via.placeholder.com/150' }}
          style={styles.gridImage}
          resizeMode="cover"
        />

        {/* Overlay indicators */}
        {isReel ? (
          <View style={styles.reelOverlay}>
            <Icon name="play" size={16} color="#fff" />
            <Text style={styles.overlayText}>
              {FirebaseService.formatNumber((item as Reel).viewsCount || 0)}
            </Text>
          </View>
        ) : (
          <>
            {(item as Post).mediaUrls && (item as Post).mediaUrls.length > 1 && (
              <View style={styles.carouselIndicator}>
                <Icon name="copy-outline" size={14} color="#fff" />
              </View>
            )}
          </>
        )}
      </TouchableOpacity>
    );
  };

  // Render private account
  const renderPrivateAccount = () => (
    <View style={styles.privateContainer}>
      <Icon name="lock-closed-outline" size={80} color={colors.textSecondary} />
      <Text style={[styles.privateTitle, { color: colors.text }]}>
        This Account is Private
      </Text>
      <Text style={[styles.privateSubtitle, { color: colors.textSecondary }]}>
        Follow this account to see their photos and videos.
      </Text>
    </View>
  );

  // Render empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon
        name={activeTab === 'posts' ? 'camera-outline' : 'play-circle-outline'}
        size={80}
        color={colors.textSecondary}
      />
      <Text style={[styles.emptyText, { color: colors.text }]}>
        No {activeTab} yet
      </Text>
    </View>
  );

  // Render footer loader
  const renderFooter = () => {
    const isLoadingMore =
      activeTab === 'posts' ? content.loadingMorePosts : content.loadingMoreReels;

    if (!isLoadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  // Loading state
  if (initialLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Get current tab data
  const currentData = activeTab === 'posts' ? content.posts : content.reels;
  const showContent = canView && currentData.length > 0;
  const showEmpty = canView && currentData.length === 0;
  const showPrivate = !canView && isPrivate;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        backgroundColor={colors.background}
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      />

      {/* Animated Header */}
      <Animated.View
        style={[
          styles.animatedHeader,
          { backgroundColor: colors.background, opacity: headerOpacity },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {profile?.username || profile?.displayName}
        </Text>
        <TouchableOpacity style={styles.menuButton}>
          <Icon name="ellipsis-vertical" size={24} color={colors.text} />
        </TouchableOpacity>
      </Animated.View>

      {/* Content */}
      <FlatList
        data={showContent ? currentData : []}
        numColumns={3}
        keyExtractor={(item) => item.id}
        renderItem={renderGridItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={showPrivate ? renderPrivateAccount : showEmpty ? renderEmpty : null}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={() => {
          if (activeTab === 'posts') {
            loadMorePosts();
          } else if (activeTab === 'reels') {
            loadMoreReels();
          }
        }}
        onEndReachedThreshold={0.5}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        contentContainerStyle={styles.contentContainer}
      />

      {/* Post Viewer */}
      <InstagramPostViewer
        visible={showPostViewer}
        posts={content.posts}
        initialIndex={selectedIndex}
        onClose={() => setShowPostViewer(false)}
        onUserProfilePress={(uid) => {
          setShowPostViewer(false);
          if (uid !== userId) {
            navigation.push('UserProfile', { userId: uid });
          }
        }}
      />

      {/* Reel Viewer */}
      <InstagramReelViewer
        visible={showReelViewer}
        reels={content.reels}
        initialIndex={selectedIndex}
        onClose={() => setShowReelViewer(false)}
        onUserProfilePress={(uid) => {
          setShowReelViewer(false);
          if (uid !== userId) {
            navigation.push('UserProfile', { userId: uid });
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 100,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  menuButton: {
    padding: 8,
  },
  contentContainer: {
    paddingTop: 56,
  },
  header: {
    padding: 16,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profilePictureContainer: {
    marginRight: 24,
  },
  storyGradient: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyInnerBorder: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicture: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  profilePictureNoStory: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#e0e0e0',
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  bioSection: {
    marginBottom: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '600',
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  website: {
    fontSize: 14,
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
  },
  tab: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#262626',
  },
  gridItem: {
    width: GRID_IMAGE_SIZE,
    height: GRID_IMAGE_SIZE,
    margin: 1,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e0e0e0',
  },
  reelOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  overlayText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  carouselIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  privateContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  privateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  privateSubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default PerfectUserProfileScreen;
