import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import FirebaseService from '../services/firebaseService';
import { Post, User, Reel, RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import { InstagramPostViewer, InstagramReelViewer } from '../components/InstagramViewers';
import { EnhancedFollowButton } from '../components/EnhancedFollowButton';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');
const GRID_IMAGE_SIZE = (width - 3) / 3;

type SearchTab = 'all' | 'users' | 'reels' | 'posts';

interface SearchResults {
  users: User[];
  reels: Reel[];
  posts: Post[];
}

const PerfectSearchScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [searchResults, setSearchResults] = useState<SearchResults>({
    users: [],
    reels: [],
    posts: [],
  });
  
  // Loading States
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  // Explore Content (when no search)
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const [exploreReels, setExploreReels] = useState<Reel[]>([]);
  
  // Viewer States
  const [showPostViewer, setShowPostViewer] = useState(false);
  const [showReelViewer, setShowReelViewer] = useState(false);
  const [selectedPostIndex, setSelectedPostIndex] = useState(0);
  const [selectedReelIndex, setSelectedReelIndex] = useState(0);
  
  // Recent Searches (cached)
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load initial explore content
  useEffect(() => {
    loadExploreContent();
  }, []);

  const loadExploreContent = async () => {
    try {
      setInitialLoading(true);
      const [posts, reels] = await Promise.all([
        FirebaseService.getAllPosts(),
        FirebaseService.getAllReels()
      ]);
      
      // Shuffle for variety
      setExplorePosts(shuffleArray(posts).slice(0, 50));
      setExploreReels(shuffleArray(reels).slice(0, 50));
    } catch (error) {
      console.error('Error loading explore content:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  // Comprehensive search function
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults({ users: [], reels: [], posts: [] });
      return;
    }

    try {
      setLoading(true);
      const searchLower = query.toLowerCase().trim();
      
      // Search users
      const usersPromise = FirebaseService.searchUsers(query);
      
      // Search reels (by caption, hashtags, username)
      const reelsPromise = FirebaseService.getAllReels().then(reels =>
        reels.filter(reel => {
          const captionMatch = reel.caption?.toLowerCase().includes(searchLower);
          const hashtagMatch = reel.caption?.match(/#\w+/g)?.some(tag => 
            tag.toLowerCase().includes(searchLower)
          );
          const usernameMatch = reel.userName?.toLowerCase().includes(searchLower);
          return captionMatch || hashtagMatch || usernameMatch;
        })
      );
      
      // Search posts (by caption, hashtags, username)
      const postsPromise = FirebaseService.getAllPosts().then(posts =>
        posts.filter(post => {
          const captionMatch = post.caption?.toLowerCase().includes(searchLower);
          const hashtagMatch = post.caption?.match(/#\w+/g)?.some(tag => 
            tag.toLowerCase().includes(searchLower)
          );
          const usernameMatch = post.userName?.toLowerCase().includes(searchLower);
          return captionMatch || hashtagMatch || usernameMatch;
        })
      );

      const [users, reels, posts] = await Promise.all([
        usersPromise,
        reelsPromise,
        postsPromise
      ]);

      setSearchResults({ users, reels, posts });
      
      // Save to recent searches
      if (query.trim() && !recentSearches.includes(query.trim())) {
        setRecentSearches(prev => [query.trim(), ...prev].slice(0, 10));
      }
    } catch (error) {
      console.error('Error searching:', error);
      Alert.alert('Error', 'Failed to search. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [recentSearches]);

  // Debounced search
  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      if (searchQuery) {
        performSearch(searchQuery);
      } else {
        setSearchResults({ users: [], reels: [], posts: [] });
      }
    }, 300);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery]);

  // Helper: Shuffle array
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  // Navigation Handlers
  const handleUserPress = (selectedUser: User) => {
    navigation.navigate('UserProfile', { userId: selectedUser.uid });
  };

  const handlePostPress = (post: Post, allPosts: Post[]) => {
    const postIndex = allPosts.findIndex(p => p.id === post.id);
    setSelectedPostIndex(postIndex >= 0 ? postIndex : 0);
    setShowPostViewer(true);
  };

  const handleReelPress = (reel: Reel, allReels: Reel[]) => {
    const reelIndex = allReels.findIndex(r => r.id === reel.id);
    navigation.navigate('Reels', { 
      initialReelId: reel.id,
      reelsList: allReels 
    });
  };

  // Get filtered data based on active tab
  const filteredData = useMemo(() => {
    if (!searchQuery) return null;

    switch (activeTab) {
      case 'users':
        return searchResults.users;
      case 'reels':
        return searchResults.reels;
      case 'posts':
        return searchResults.posts;
      case 'all':
      default:
        return null; // Show all tabs
    }
  }, [activeTab, searchResults, searchQuery]);

  // Render Functions
  const renderSearchBar = () => (
    <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
      <Icon name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        placeholder="Search users, posts, reels..."
        placeholderTextColor={colors.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')}>
          <Icon name="close-circle" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTabs = () => {
    if (!searchQuery) return null;

    const tabs: { key: SearchTab; label: string; count?: number }[] = [
      { key: 'all', label: 'All' },
      { key: 'users', label: 'Users', count: searchResults.users.length },
      { key: 'posts', label: 'Posts', count: searchResults.posts.length },
      { key: 'reels', label: 'Reels', count: searchResults.reels.length },
    ];

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && { backgroundColor: colors.primary }
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === tab.key ? '#fff' : colors.text }
            ]}>
              {tab.label}
              {tab.count !== undefined && ` (${tab.count})`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

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
        <View style={styles.userNameRow}>
          <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
            {item.username || item.displayName}
          </Text>
          {item.isVerified && (
            <Icon name="checkmark-circle" size={16} color="#1DA1F2" />
          )}
        </View>
        <Text style={[styles.displayName, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.displayName}
        </Text>
        {item.bio && (
          <Text style={[styles.userBio, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.bio}
          </Text>
        )}
        <Text style={[styles.followStats, { color: colors.textSecondary }]}>
          {FirebaseService.formatNumber(item.followersCount || 0)} followers
        </Text>
      </View>
      {user?.uid !== item.uid && (
        <EnhancedFollowButton
          targetUserId={item.uid}
          targetUserName={item.displayName || item.username}
          size="small"
          variant="filled"
        />
      )}
    </TouchableOpacity>
  );

  const renderGridItem = ({ item, index }: { item: Post | Reel; index: number }) => {
    const isReel = 'videoUrl' in item;
    const thumbnailUri = isReel 
      ? (item as Reel).thumbnailUrl || (item as Reel).videoUrl
      : (item as Post).mediaUrls?.[0];

    return (
      <TouchableOpacity 
        style={styles.gridItem}
        onPress={() => {
          if (isReel) {
            handleReelPress(item as Reel, searchQuery ? searchResults.reels : exploreReels);
          } else {
            handlePostPress(item as Post, searchQuery ? searchResults.posts : explorePosts);
          }
        }}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: thumbnailUri || 'https://via.placeholder.com/150' }}
          style={styles.gridImage}
          resizeMode="cover"
        />
        
        {/* Overlay Indicators */}
        {isReel ? (
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)']}
            style={styles.reelOverlay}
          >
            <View style={styles.reelIndicator}>
              <Icon name="play" size={14} color="#fff" />
              <Text style={styles.reelViewsText}>
                {FirebaseService.formatNumber((item as Reel).viewsCount || 0)}
              </Text>
            </View>
          </LinearGradient>
        ) : (
          <>
            {(item as Post).mediaUrls && (item as Post).mediaUrls.length > 1 && (
              <View style={styles.carouselIndicator}>
                <Icon name="copy-outline" size={14} color="#fff" />
              </View>
            )}
            <View style={styles.postStatsOverlay}>
              <Icon name="heart" size={14} color="#fff" />
              <Text style={styles.postLikesText}>
                {FirebaseService.formatNumber((item as Post).likesCount || 0)}
              </Text>
            </View>
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderRecentSearches = () => {
    if (searchQuery || recentSearches.length === 0) return null;

    return (
      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={[styles.recentTitle, { color: colors.text }]}>Recent</Text>
          <TouchableOpacity onPress={() => setRecentSearches([])}>
            <Text style={[styles.clearText, { color: colors.primary }]}>Clear All</Text>
          </TouchableOpacity>
        </View>
        {recentSearches.map((search, index) => (
          <TouchableOpacity
            key={index}
            style={styles.recentItem}
            onPress={() => setSearchQuery(search)}
          >
            <Icon name="time-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.recentText, { color: colors.text }]}>{search}</Text>
            <TouchableOpacity
              onPress={() => setRecentSearches(prev => prev.filter((_, i) => i !== index))}
            >
              <Icon name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderAllResults = () => {
    const hasUsers = searchResults.users.length > 0;
    const hasPosts = searchResults.posts.length > 0;
    const hasReels = searchResults.reels.length > 0;
    const hasResults = hasUsers || hasPosts || hasReels;

    if (!hasResults) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="search-outline" size={80} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.text }]}>
            No results found
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Try searching for users, posts, or reels
          </Text>
        </View>
      );
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Users Section */}
        {hasUsers && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Users
              </Text>
              {searchResults.users.length > 3 && (
                <TouchableOpacity onPress={() => setActiveTab('users')}>
                  <Text style={[styles.seeAllText, { color: colors.primary }]}>
                    See All ({searchResults.users.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {searchResults.users.slice(0, 3).map(user => (
              <View key={user.uid}>
                {renderUserItem({ item: user })}
              </View>
            ))}
          </View>
        )}

        {/* Posts Section */}
        {hasPosts && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Posts
              </Text>
              {searchResults.posts.length > 9 && (
                <TouchableOpacity onPress={() => setActiveTab('posts')}>
                  <Text style={[styles.seeAllText, { color: colors.primary }]}>
                    See All ({searchResults.posts.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={searchResults.posts.slice(0, 9)}
              numColumns={3}
              keyExtractor={(item) => item.id}
              renderItem={renderGridItem}
              scrollEnabled={false}
              contentContainerStyle={styles.gridContainer}
            />
          </View>
        )}

        {/* Reels Section */}
        {hasReels && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Reels
              </Text>
              {searchResults.reels.length > 9 && (
                <TouchableOpacity onPress={() => setActiveTab('reels')}>
                  <Text style={[styles.seeAllText, { color: colors.primary }]}>
                    See All ({searchResults.reels.length})
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={searchResults.reels.slice(0, 9)}
              numColumns={3}
              keyExtractor={(item) => item.id}
              renderItem={renderGridItem}
              scrollEnabled={false}
              contentContainerStyle={styles.gridContainer}
            />
          </View>
        )}
      </ScrollView>
    );
  };

  const renderContent = () => {
    if (loading && searchQuery) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Searching...
          </Text>
        </View>
      );
    }

    // No search query - show explore
    if (!searchQuery) {
      const mixedContent = shuffleArray([...explorePosts, ...exploreReels]).slice(0, 30);
      
      return (
        <>
          {renderRecentSearches()}
          <FlatList
            data={mixedContent}
            numColumns={3}
            keyExtractor={(item) => item.id}
            renderItem={renderGridItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContainer}
            ListHeaderComponent={() => (
              <Text style={[styles.exploreTitle, { color: colors.text }]}>
                Explore
              </Text>
            )}
          />
        </>
      );
    }

    // Search results - show based on active tab
    if (activeTab === 'all') {
      return renderAllResults();
    }

    if (activeTab === 'users') {
      return (
        <FlatList
          data={searchResults.users}
          keyExtractor={(item) => item.uid}
          renderItem={renderUserItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Icon name="people-outline" size={80} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.text }]}>
                No users found
              </Text>
            </View>
          )}
        />
      );
    }

    if (activeTab === 'posts' || activeTab === 'reels') {
      const data = activeTab === 'posts' ? searchResults.posts : searchResults.reels;
      
      return (
        <FlatList
          data={data}
          numColumns={3}
          keyExtractor={(item) => item.id}
          renderItem={renderGridItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContainer}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Icon 
                name={activeTab === 'posts' ? "images-outline" : "play-outline"} 
                size={80} 
                color={colors.textSecondary} 
              />
              <Text style={[styles.emptyText, { color: colors.text }]}>
                No {activeTab} found
              </Text>
            </View>
          )}
        />
      );
    }

    return null;
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar backgroundColor={colors.background} barStyle={isDarkMode ? "light-content" : "dark-content"} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor={colors.background} barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Search</Text>
      </View>

      {/* Search Bar */}
      {renderSearchBar()}

      {/* Tabs */}
      {renderTabs()}

      {/* Content */}
      {renderContent()}

      {/* Post Viewer Modal */}
      <InstagramPostViewer
        visible={showPostViewer}
        posts={searchQuery ? searchResults.posts : explorePosts}
        initialIndex={selectedPostIndex}
        onClose={() => setShowPostViewer(false)}
        onUserProfilePress={(userId) => {
          setShowPostViewer(false);
          navigation.navigate('UserProfile', { userId });
        }}
      />

      {/* Reel Viewer Modal */}
      <InstagramReelViewer
        visible={showReelViewer}
        reels={searchQuery ? searchResults.reels : exploreReels}
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
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  tabsContainer: {
    maxHeight: 50,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
  },
  recentSection: {
    padding: 16,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  recentText: {
    flex: 1,
    fontSize: 15,
  },
  exploreTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  section: {
    marginVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    padding: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0e0e0',
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
  },
  displayName: {
    fontSize: 14,
    marginTop: 2,
  },
  userBio: {
    fontSize: 13,
    marginTop: 4,
  },
  followStats: {
    fontSize: 12,
    marginTop: 4,
  },
  gridContainer: {
    paddingHorizontal: 1,
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
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    justifyContent: 'flex-end',
    padding: 6,
  },
  reelIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reelViewsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  carouselIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  postStatsOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  postLikesText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
});

export default PerfectSearchScreen;
