import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import FirebaseService from '../services/firebaseService';
import { Post, User, Reel, RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import { BeautifulHeader } from '../components/BeautifulHeader';
import { BeautifulInput } from '../components/BeautifulInput';
import { EnhancedFollowButton } from '../components/EnhancedFollowButton';
import { InstagramPostViewer, InstagramReelViewer } from '../components/InstagramViewers';
import RealTimeLikeSystem from '../services/RealTimeLikeSystem';

const { width } = Dimensions.get('window');
const imageSize = (width - 3) / 3;

const SearchScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const [exploreReels, setExploreReels] = useState<Reel[]>([]);
  const [exploreContent, setExploreContent] = useState<(Post | Reel)[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'explore' | 'users'>('explore');
  const [contentFilter, setContentFilter] = useState<'all' | 'posts' | 'reels'>('all');
  const [showPostViewer, setShowPostViewer] = useState(false);
  const [showReelViewer, setShowReelViewer] = useState(false);
  const [selectedPostIndex, setSelectedPostIndex] = useState(0);
  const [selectedReelIndex, setSelectedReelIndex] = useState(0);

  // Load explore content on mount
  useEffect(() => {
    loadExploreContent();
  }, [contentFilter]);

  const loadExploreContent = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load both posts and reels
      const [posts, reels] = await Promise.all([
        FirebaseService.getAllPosts(),
        FirebaseService.getAllReels()
      ]);
      
      setExplorePosts(posts);
      setExploreReels(reels);
      
      // Mix posts and reels for explore feed
      let mixedContent: (Post | Reel)[] = [];
      
      if (contentFilter === 'all') {
        // Instagram-style mixing: 2 posts, 1 reel pattern
        const maxLength = Math.max(posts.length, reels.length);
        for (let i = 0; i < maxLength; i++) {
          if (posts[i * 2]) mixedContent.push(posts[i * 2]);
          if (posts[i * 2 + 1]) mixedContent.push(posts[i * 2 + 1]);
          if (reels[i]) mixedContent.push(reels[i]);
        }
      } else if (contentFilter === 'posts') {
        mixedContent = posts;
      } else if (contentFilter === 'reels') {
        mixedContent = reels;
      }
      
      setExploreContent(mixedContent);
    } catch (error) {
      console.error('Error loading explore content:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const users = await FirebaseService.searchUsers(query);
      setSearchResults(users);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      if (searchQuery) {
        searchUsers(searchQuery);
        setActiveTab('users');
      } else {
        setSearchResults([]);
        setActiveTab('explore');
      }
    }, 300);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery, searchUsers]);

  const handleUserPress = useCallback((selectedUser: User) => {
    navigation.navigate('UserProfile', { userId: selectedUser.uid });
  }, [navigation]);

  const handlePostPress = useCallback((post: Post, index: number) => {
    // Instagram-style: Open post detail OR navigate to Posts viewer
    console.log('🖼️ Opening post from search:', post.id);
    
    // Option 1: Navigate to PostDetail (single post view)
    navigation.navigate('PostDetail', { 
      postId: post.id, 
      post: post 
    });
    
    // Option 2: Use Instagram-style viewer (uncomment if preferred)
    // const postIndex = explorePosts.findIndex(p => p.id === post.id);
    // setSelectedPostIndex(postIndex >= 0 ? postIndex : index);
    // setShowPostViewer(true);
  }, [navigation, explorePosts]);

  const handleReelPress = useCallback((reel: Reel, index: number) => {
    console.log('🎬 Opening reel from search:', reel.id);
    
    // Instagram-style: Navigate to Reels with specific reel
    // Filter reels for Instagram-like experience
    const searchReels = exploreReels.filter(r => r.id === reel.id || true); // Start with current reel
    
    navigation.navigate('Reels', { 
      initialReelId: reel.id,
      reelsList: searchReels 
    });
  }, [navigation, exploreReels]);

  // Perfect like handler for search posts
  const handlePostLike = useCallback(async (post: Post) => {
    if (!user?.uid) return;

    try {
      const result = await RealTimeLikeSystem.getInstance().toggleLike(
        post.id,
        user.uid,
        'post',
        post.likes?.includes(user.uid) || false,
        post.likesCount || 0
      );

      if (result.success) {
        // Update local state
        setExplorePosts(prev => prev.map(p =>
          p.id === post.id
            ? { 
                ...p, 
                likes: result.isLiked 
                  ? [...(p.likes || []), user.uid]
                  : (p.likes || []).filter(id => id !== user.uid),
                likesCount: result.likesCount
              }
            : p
        ));
        
        // Also update mixed content
        setExploreContent(prev => prev.map(item =>
          isPost(item) && item.id === post.id
            ? { 
                ...item, 
                likes: result.isLiked 
                  ? [...(item.likes || []), user.uid]
                  : (item.likes || []).filter(id => id !== user.uid),
                likesCount: result.likesCount
              }
            : item
        ));
      }
    } catch (error) {
      console.error('Error liking post from search:', error);
      Alert.alert('Error', 'Unable to like post. Please try again.');
    }
  }, [user?.uid]);

  const isPost = (item: Post | Reel): item is Post => {
    return 'mediaUrls' in item;
  };

  const isReel = (item: Post | Reel): item is Reel => {
    return 'videoUrl' in item;
  };

  const renderSearchBar = () => (
    <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
      <Icon name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        placeholder="Search users, hashtags..."
        placeholderTextColor={colors.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')}>
          <Icon name="close-circle" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity 
      style={[styles.userItem, { backgroundColor: colors.surface }]} 
      onPress={() => handleUserPress(item)}
      activeOpacity={0.7}
    >
      <Image
        source={{
          uri: item.profilePicture || item.photoURL || 'https://via.placeholder.com/50'
        }}
        style={styles.userAvatar}
      />
      <View style={styles.userInfo}>
        <View style={styles.userNameContainer}>
          <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
            {item.username || item.displayName}
          </Text>
          {item.isVerified && (
            <Icon name="checkmark-circle" size={16} color="#1DA1F2" style={styles.verifiedIcon} />
          )}
        </View>
        <Text style={[styles.displayName, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.displayName}
        </Text>
        {(item.followersCount !== undefined || item.followingCount !== undefined) && (
          <Text style={[styles.followStats, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.followersCount || 0} followers • {item.followingCount || 0} following
          </Text>
        )}
      </View>
      <EnhancedFollowButton
        targetUserId={item.uid}
        targetUserName={item.displayName || item.username}
        size="small"
        variant="filled"
        onFollowChange={(isFollowing) => {
          console.log(`${isFollowing ? 'Followed' : 'Unfollowed'} ${item.displayName}`);
        }}
      />
    </TouchableOpacity>
  );

  const renderContentItem = ({ item, index }: { item: Post | Reel; index: number }) => {
    if (isPost(item)) {
      return (
        <TouchableOpacity 
          style={styles.contentItem}
          onPress={() => handlePostPress(item, index)}
        >
          <Image
            source={{ uri: item.mediaUrls?.[0] || 'https://via.placeholder.com/150' }}
            style={styles.contentImage}
            resizeMode="cover"
          />
          
          {/* Post Indicators */}
          {item.mediaUrls && item.mediaUrls.length > 1 && (
            <View style={styles.carouselIndicator}>
              <Icon name="copy-outline" size={16} color="#fff" />
            </View>
          )}
          
          {item.mediaType === 'video' && (
            <View style={styles.videoIndicator}>
              <Icon name="play" size={16} color="#fff" />
            </View>
          )}

          {/* Post Stats Overlay */}
          <View style={styles.contentStatsOverlay}>
            <View style={styles.contentStat}>
              <Icon name="heart" size={14} color="#fff" />
              <Text style={styles.contentStatText}>
                {FirebaseService.formatNumber(item.likesCount || 0)}
              </Text>
            </View>
            <View style={styles.contentStat}>
              <Icon name="chatbubble" size={14} color="#fff" />
              <Text style={styles.contentStatText}>
                {FirebaseService.formatNumber(item.commentsCount || 0)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    } else if (isReel(item)) {
      return (
        <TouchableOpacity 
          style={styles.contentItem}
          onPress={() => handleReelPress(item, index)}
        >
          <Image
            source={{ uri: item.thumbnailUrl || item.videoUrl || 'https://via.placeholder.com/150' }}
            style={styles.contentImage}
            resizeMode="cover"
          />
          
          {/* Reel Indicators */}
          <View style={styles.reelIndicator}>
            <Icon name="play" size={16} color="#fff" />
            <Text style={styles.reelDurationText}>
              {Math.round(item.duration || 0)}s
            </Text>
          </View>
          
          {/* Reel Stats Overlay */}
          <View style={styles.contentStatsOverlay}>
            <View style={styles.contentStat}>
              <Icon name="eye" size={14} color="#fff" />
              <Text style={styles.contentStatText}>
                {FirebaseService.formatNumber(item.viewsCount || 0)}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    }
    return null;
  };

  const renderFilterTabs = () => (
    <View style={styles.filterTabsContainer}>
      <TouchableOpacity
        style={[styles.filterTab, contentFilter === 'all' && styles.activeFilterTab]}
        onPress={() => setContentFilter('all')}
      >
        <Icon name="grid-outline" size={20} color={contentFilter === 'all' ? '#E1306C' : '#666'} />
        <Text style={[styles.filterTabText, contentFilter === 'all' && styles.activeFilterTabText]}>
          All
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.filterTab, contentFilter === 'posts' && styles.activeFilterTab]}
        onPress={() => setContentFilter('posts')}
      >
        <Icon name="image-outline" size={20} color={contentFilter === 'posts' ? '#E1306C' : '#666'} />
        <Text style={[styles.filterTabText, contentFilter === 'posts' && styles.activeFilterTabText]}>
          Posts
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.filterTab, contentFilter === 'reels' && styles.activeFilterTab]}
        onPress={() => setContentFilter('reels')}
      >
        <Icon name="play-outline" size={20} color={contentFilter === 'reels' ? '#E1306C' : '#666'} />
        <Text style={[styles.filterTabText, contentFilter === 'reels' && styles.activeFilterTabText]}>
          Reels
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderExplorePost = ({ item, index }: { item: Post; index: number }) => (
    <TouchableOpacity
      style={styles.exploreItem}
      onPress={() => handlePostPress(item, index)}
    >
      <Image
        source={{ uri: item.mediaUrls[0] || 'https://via.placeholder.com/300' }}
        style={styles.exploreImage}
      />
      {item.type === 'carousel' && (
        <View style={styles.carouselIndicator}>
          <Icon name="copy-outline" size={16} color="white" />
        </View>
      )}
      {item.type === 'video' && (
        <View style={styles.videoIndicator}>
          <Icon name="play" size={16} color="white" />
        </View>
      )}
      <View style={styles.postOverlay}>
        <View style={styles.postStats}>
          <Icon name="heart" size={16} color="white" />
          <Text style={styles.statText}>{item.likes.length}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (activeTab === 'users' && searchResults.length > 0) {
      return (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.uid}
          renderItem={renderUserItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.usersList}
        />
      );
    }

    if (activeTab === 'explore' && exploreContent.length > 0) {
      return (
        <FlatList
          data={exploreContent}
          numColumns={3}
          keyExtractor={(item) => item.id}
          renderItem={renderContentItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.exploreGrid}
        />
      );
    }

    return (
      <View style={styles.emptyState}>
        <Icon 
          name={activeTab === 'users' ? "people-outline" : "search-outline"} 
          size={64} 
          color={colors.textSecondary} 
        />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {activeTab === 'users' 
            ? 'No users found' 
            : searchQuery 
              ? 'No results found' 
              : 'Discover amazing content'
          }
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor={colors.background} barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      {/* Beautiful Header */}
      <BeautifulHeader
        title="Search"
      />

      {/* Search Bar */}
      {renderSearchBar()}

      {/* Filter Tabs */}
      {activeTab === 'explore' && renderFilterTabs()}

      {/* Content */}
      {renderContent()}

      {/* Instagram Post Viewer */}
      <InstagramPostViewer
        visible={showPostViewer}
        posts={explorePosts}
        initialIndex={selectedPostIndex}
        onClose={() => setShowPostViewer(false)}
        onUserProfilePress={(userId) => {
          setShowPostViewer(false);
          navigation.navigate('UserProfile', { userId });
        }}
      />

      {/* Instagram Reel Viewer */}
      <InstagramReelViewer
        visible={showReelViewer}
        reels={exploreReels}
        initialIndex={selectedReelIndex}
        onClose={() => setShowReelViewer(false)}
        onUserProfilePress={(userId) => {
          setShowReelViewer(false);
          navigation.navigate('UserProfile', { userId });
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  usersList: {
    paddingHorizontal: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  displayName: {
    fontSize: 14,
    marginBottom: 2,
  },
  followStats: {
    fontSize: 12,
    marginTop: 2,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  followButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  exploreGrid: {
    paddingTop: 1,
  },
  exploreItem: {
    width: imageSize,
    height: imageSize,
    marginRight: 1,
    marginBottom: 1,
    position: 'relative',
  },
  exploreImage: {
    width: '100%',
    height: '100%',
  },
  carouselIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  postOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 8,
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  filterTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    paddingHorizontal: 16,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeFilterTab: {
    borderBottomColor: '#E1306C',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginLeft: 4,
  },
  activeFilterTabText: {
    color: '#E1306C',
  },
  contentItem: {
    width: imageSize,
    height: imageSize,
    margin: 1,
    position: 'relative',
  },
  contentImage: {
    width: '100%',
    height: '100%',
  },
  contentStatsOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  contentStat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  contentStatText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 2,
  },
  reelIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  reelDurationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 2,
  },
});

export default SearchScreen;
