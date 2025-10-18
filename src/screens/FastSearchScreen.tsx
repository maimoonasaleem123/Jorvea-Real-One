import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  RefreshControl,
  VirtualizedList,
  InteractionManager,
  Animated,
  Keyboard,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import FirebaseService, { Post, Reel } from '../services/firebaseService';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import { InstagramPostViewer, InstagramReelViewer } from '../components/InstagramViewers';
import { EnhancedMultiPostCarousel } from '../components/EnhancedMultiPostCarousel';
import VideoThumbnailService from '../services/VideoThumbnailService';

const { width } = Dimensions.get('window');
const GRID_SIZE = 3;
const ITEM_SIZE = (width - 4) / GRID_SIZE;

// User interface for local use
interface User {
  uid: string;
  username: string;
  displayName: string;
  profilePicture?: string;
  bio?: string;
  followersCount: number;
  followingCount: number;
  followers?: string[];
  following?: string[];
  isVerified?: boolean;
  isPrivate?: boolean;
}

interface ContentItem {
  id: string;
  type: 'post' | 'reel' | 'user';
  data: Post | Reel | User;
  index: number;
}

const FastSearchScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation();
  
  // Instagram/TikTok-like state management
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingHashtags, setTrendingHashtags] = useState<string[]>([]);
  const [exploreContent, setExploreContent] = useState<ContentItem[]>([]);
  const [trendingContent, setTrendingContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'explore' | 'search'>('explore');
  const [contentFilter, setContentFilter] = useState<'top' | 'people' | 'tags' | 'places'>('top');
  const [showPostViewer, setShowPostViewer] = useState(false);
  const [showReelViewer, setShowReelViewer] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Performance optimization refs
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const loadedIndices = useRef(new Set<number>());
  const contentCache = useRef<Map<string, ContentItem[]>>(new Map());
  const searchCache = useRef<Map<string, User[]>>(new Map());
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = useRef(new Animated.Value(1)).current;

  // Instagram/TikTok-like fast explore content loading
  const loadExploreContent = useCallback(async (refresh = false) => {
    const cacheKey = 'explore_mixed';
    
    // Check cache first for instant loading
    if (!refresh && contentCache.current.has(cacheKey)) {
      setExploreContent(contentCache.current.get(cacheKey) || []);
      return;
    }

    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      // Parallel loading for maximum speed (Instagram/TikTok strategy)
      const [posts, reels] = await Promise.all([
        FirebaseService.getMorePosts(30), // More content like Instagram
        FirebaseService.getMoreReels(30),
      ]);

      // Advanced Instagram/TikTok algorithm: Smart content mixing
      const mixedContent: ContentItem[] = [];
      let postIndex = 0;
      let reelIndex = 0;
      let globalIndex = 0;

      // Perfect Instagram grid pattern: 6 posts, 3 reels, repeat
      const pattern = [
        'post', 'post', 'reel',
        'post', 'post', 'post', 
        'reel', 'post', 'reel'
      ];
      
      let patternIndex = 0;
      const maxItems = Math.max(posts.length, reels.length) * 2;

      for (let i = 0; i < maxItems && (postIndex < posts.length || reelIndex < reels.length); i++) {
        const currentType = pattern[patternIndex % pattern.length];
        
        if (currentType === 'post' && postIndex < posts.length) {
          mixedContent.push({
            id: posts[postIndex].id,
            type: 'post',
            data: posts[postIndex],
            index: globalIndex,
          });
          postIndex++;
        } else if (currentType === 'reel' && reelIndex < reels.length) {
          mixedContent.push({
            id: reels[reelIndex].id,
            type: 'reel',
            data: reels[reelIndex],
            index: globalIndex,
          });
          reelIndex++;
        } else {
          // Fallback: add whatever is available
          if (postIndex < posts.length) {
            mixedContent.push({
              id: posts[postIndex].id,
              type: 'post',
              data: posts[postIndex],
              index: globalIndex,
            });
            postIndex++;
          } else if (reelIndex < reels.length) {
            mixedContent.push({
              id: reels[reelIndex].id,
              type: 'reel',
              data: reels[reelIndex],
              index: globalIndex,
            });
            reelIndex++;
          }
        }
        
        patternIndex++;
        globalIndex++;
      }

      // Cache results for instant loading
      contentCache.current.set(cacheKey, mixedContent);
      setExploreContent(mixedContent);
      
      // Preload first batch of images for smooth scrolling
      InteractionManager.runAfterInteractions(() => {
        mixedContent.slice(0, 12).forEach((item, index) => {
          if (item.type === 'reel') {
            // Generate thumbnails for reels without them
            const reel = item.data as Reel;
            if (!reel.thumbnailUrl) {
              VideoThumbnailService.generateGridThumbnail(reel.videoUrl)
                .then(thumbnailUrl => {
                  if (thumbnailUrl !== reel.videoUrl) {
                    FirebaseService.updateReel(reel.id, { thumbnailUrl });
                  }
                });
            }
          }
          loadedIndices.current.add(index);
        });
      });
      
    } catch (error) {
      console.error('Error loading explore content:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Lightning-fast live search like Instagram/TikTok
  const performLiveSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setActiveTab('explore');
      return;
    }

    // Check cache for instant results
    const cacheKey = query.toLowerCase().trim();
    if (searchCache.current.has(cacheKey)) {
      setSearchResults(searchCache.current.get(cacheKey) || []);
      setActiveTab('search');
      return;
    }

    try {
      setLoading(true);
      
      // Advanced search: users, hashtags, and content
      const [users, hashtagPosts, hashtagReels] = await Promise.all([
        FirebaseService.searchUsers(query),
        FirebaseService.searchPosts(query, 20),
        FirebaseService.searchReels(query, 20),
      ]);
      
      // Cache results for instant re-access
      searchCache.current.set(cacheKey, users);
      setSearchResults(users);
      setActiveTab('search');
      
      // Update trending if this is a popular search
      if (users.length > 3) {
        setTrendingHashtags(prev => {
          const updated = [query, ...prev.filter(tag => tag !== query)].slice(0, 10);
          return updated;
        });
      }
      
    } catch (error) {
      console.error('Error in live search:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Instagram-style debounced search with instant feedback
  const handleSearchInput = useCallback((query: string) => {
    setSearchQuery(query);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Instant feedback for empty search
    if (!query.trim()) {
      setSearchResults([]);
      setActiveTab('explore');
      return;
    }
    
    // Show search tab immediately for better UX
    setActiveTab('search');
    
    // Debounced search (200ms for snappy feeling)
    searchTimeoutRef.current = setTimeout(() => {
      performLiveSearch(query);
    }, 200);
  }, [performLiveSearch]);

  // Save recent searches (Instagram feature)
  const saveRecentSearch = useCallback((query: string) => {
    if (query.trim()) {
      setRecentSearches(prev => {
        const updated = [query, ...prev.filter(q => q !== query)].slice(0, 10);
        return updated;
      });
    }
  }, []);

  // Load trending hashtags and recent searches
  const loadTrendingData = useCallback(async () => {
    try {
      // Set default trending hashtags
      setTrendingHashtags(['#trending', '#photography', '#art', '#music', '#travel']);
      
      // Set default recent searches
      setRecentSearches(['recent_search_1', 'recent_search_2']);
    } catch (error) {
      console.error('Error loading trending data:', error);
    }
  }, [user?.uid]);

  // Instagram-style content press handler
  const handleContentPress = useCallback((item: ContentItem, itemIndex: number) => {
    if (item.type === 'post') {
      // Navigate to PostDetail like Instagram
      const post = item.data as Post;
      (navigation as any).navigate('PostDetail', {
        postId: post.id,
        post,
        fromSearch: true,
      });
    } else if (item.type === 'reel') {
      // Navigate to Reels tab (Instagram-like) with return to search
      const reel = item.data as Reel;
      const allReels = exploreContent.filter(c => c.type === 'reel').map(c => c.data as Reel);
      const reelIndex = allReels.findIndex(r => r.id === reel.id);
      
      (navigation as any).navigate('Reels', {
        initialReelId: reel.id,
        reels: allReels,
        initialIndex: reelIndex >= 0 ? reelIndex : 0,
        returnTo: 'Search', // Mark to return to search screen
      });
    }
  }, [navigation, exploreContent]);

  // Enhanced user press handler
  const handleUserPress = useCallback((selectedUser: User) => {
    // Save to recent searches
    saveRecentSearch(selectedUser.username);
    
    // Navigate to user profile
    if (selectedUser.uid !== user?.uid) {
      (navigation as any).navigate('UserProfile', { 
        userId: selectedUser.uid, 
        user: selectedUser,
        fromSearch: true,
      });
    } else {
      (navigation as any).navigate('Profile');
    }
  }, [navigation, user, saveRecentSearch]);

  // Instagram-style grid item renderer with perfect thumbnails
  const renderExploreItem = useCallback(({ item, index }: { item: ContentItem; index: number }) => {
    // Type guard to ensure we have a ContentItem
    if (!item || typeof item !== 'object' || !('type' in item)) {
      return null;
    }
    
    const isReel = item.type === 'reel';
    const data = item.data as Post | Reel;
    const thumbnailUrl = isReel 
      ? (data as Reel).thumbnailUrl || (data as Reel).videoUrl
      : (data as Post).mediaUrls?.[0];

    // For multi-post, show a perfect grid preview
    const isMultiPost = !isReel && (data as Post).mediaUrls?.length > 1;
    const mediaUrls = !isReel ? (data as Post).mediaUrls || [] : [];

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => handleContentPress(item, index)}
        activeOpacity={0.8}
      >
        {/* Main thumbnail */}
        <Image
          source={{ 
            uri: thumbnailUrl || 'https://via.placeholder.com/300x300/f0f0f0/ccc?text=Loading',
          }}
          style={styles.gridImage}
          resizeMode="cover"
          onLoad={() => loadedIndices.current.add(index)}
        />
        
        {/* Multi-post preview overlay - show 4 mini thumbnails */}
        {isMultiPost && mediaUrls.length > 1 && (
          <View style={styles.multiPostPreview}>
            {mediaUrls.slice(0, 4).map((url, idx) => (
              <Image
                key={idx}
                source={{ uri: url }}
                style={[
                  styles.miniThumbnail,
                  idx === 0 && styles.miniThumbnailFirst,
                  idx === 1 && styles.miniThumbnailSecond,
                  idx === 2 && styles.miniThumbnailThird,
                  idx === 3 && styles.miniThumbnailFourth,
                ]}
                resizeMode="cover"
              />
            ))}
            {mediaUrls.length > 4 && (
              <View style={styles.moreIndicator}>
                <Text style={styles.moreText}>+{mediaUrls.length - 4}</Text>
              </View>
            )}
          </View>
        )}
        
        {/* Reel play indicator */}
        {isReel && (
          <View style={styles.reelIndicator}>
            <Icon name="play" size={18} color="#fff" />
          </View>
        )}
        
        {/* Multi-post indicator */}
        {isMultiPost && (
          <View style={styles.multiPostIndicator}>
            <Icon name="copy" size={16} color="#fff" />
            <Text style={styles.multiPostCount}>{mediaUrls.length}</Text>
          </View>
        )}
        
        {/* Video duration for reels */}
        {isReel && (data as Reel).duration && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>
              {Math.floor((data as Reel).duration / 60)}:{((data as Reel).duration % 60).toString().padStart(2, '0')}
            </Text>
          </View>
        )}
        
        {/* Engagement stats overlay */}
        <View style={styles.statsOverlay}>
          <View style={styles.stat}>
            <Icon name="heart" size={14} color="#fff" />
            <Text style={styles.statText}>
              {FirebaseService.formatNumber(
                isReel 
                  ? (data as Reel).likesCount || 0
                  : (data as Post).likesCount || 0
              )}
            </Text>
          </View>
          {isReel && (
            <View style={styles.stat}>
              <Icon name="eye" size={14} color="#fff" />
              <Text style={styles.statText}>
                {FirebaseService.formatNumber((data as Reel).viewsCount || 0)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }, [handleContentPress]);

  // Enhanced user item renderer for search results
  const renderUserItem = useCallback(({ item: user }: { item: User }) => (
    <TouchableOpacity
      style={[styles.userItem, { borderBottomColor: colors.border }]}
      onPress={() => handleUserPress(user)}
      activeOpacity={0.8}
    >
      <Image
        source={{ 
          uri: user.profilePicture || `https://ui-avatars.com/api/?name=${user.displayName}&background=gradient&color=fff`,
        }}
        style={styles.userAvatar}
        resizeMode="cover"
      />
      <View style={styles.userInfo}>
        <Text style={[styles.username, { color: colors.text }]}>
          {user.username}
        </Text>
        <Text style={[styles.displayName, { color: colors.textSecondary }]}>
          {user.displayName}
        </Text>
        {user.bio && (
          <Text style={[styles.userBio, { color: colors.textSecondary }]} numberOfLines={1}>
            {user.bio}
          </Text>
        )}
        <View style={styles.userStats}>
          <Text style={[styles.userStat, { color: colors.textSecondary }]}>
            {user.followers?.length || 0} followers
          </Text>
          {user.isVerified && (
            <Icon name="checkmark-circle" size={16} color="#1DA1F2" style={{ marginLeft: 8 }} />
          )}
        </View>
      </View>
      {user.uid !== user?.uid && (
        <TouchableOpacity style={[styles.followButton, { borderColor: colors.primary }]}>
          <Text style={[styles.followButtonText, { color: colors.primary }]}>Follow</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  ), [colors, user, handleUserPress]);

  // Recent searches and trending hashtags renderer
  const renderSearchSuggestions = useCallback(() => (
    <View style={styles.suggestionsContainer}>
      {/* Recent searches */}
      {recentSearches.length > 0 && (
        <View style={styles.suggestionSection}>
          <View style={styles.suggestionHeader}>
            <Text style={[styles.suggestionTitle, { color: colors.text }]}>Recent</Text>
            <TouchableOpacity onPress={() => setRecentSearches([])}>
              <Text style={[styles.clearText, { color: colors.primary }]}>Clear all</Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map((search, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => {
                setSearchQuery(search);
                performLiveSearch(search);
              }}
            >
              <Icon name="time-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.suggestionText, { color: colors.text }]}>{search}</Text>
              <TouchableOpacity
                onPress={() => setRecentSearches(prev => prev.filter(s => s !== search))}
              >
                <Icon name="close" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      {/* Trending hashtags */}
      {trendingHashtags.length > 0 && (
        <View style={styles.suggestionSection}>
          <Text style={[styles.suggestionTitle, { color: colors.text }]}>Trending</Text>
          {trendingHashtags.map((hashtag, index) => (
            <TouchableOpacity
              key={index}
              style={styles.suggestionItem}
              onPress={() => {
                setSearchQuery(`#${hashtag}`);
                performLiveSearch(hashtag);
              }}
            >
              <Icon name="trending-up" size={20} color={colors.primary} />
              <Text style={[styles.suggestionText, { color: colors.text }]}>#{hashtag}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  ), [recentSearches, trendingHashtags, colors, performLiveSearch]);

  // Search filter tabs (Top, People, Tags, Places)
  const renderSearchFilterTabs = useCallback(() => (
    <View style={[styles.filterTabs, { borderBottomColor: colors.border }]}>
      {[
        { key: 'top', label: 'Top' },
        { key: 'people', label: 'People' },
        { key: 'tags', label: 'Tags' },
        { key: 'places', label: 'Places' },
      ].map((filter) => (
        <TouchableOpacity
          key={filter.key}
          style={[
            styles.filterTab,
            contentFilter === filter.key && [styles.activeFilterTab, { borderBottomColor: colors.text }],
          ]}
          onPress={() => setContentFilter(filter.key as 'top' | 'people' | 'tags' | 'places')}
        >
          <Text
            style={[
              styles.filterTabText,
              { color: contentFilter === filter.key ? colors.text : colors.textSecondary },
            ]}
          >
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  ), [contentFilter, colors]);

  // Refresh handler with cache clearing
  const onRefresh = useCallback(async () => {
    contentCache.current.clear();
    searchCache.current.clear();
    loadedIndices.current.clear();
    await loadExploreContent(true);
    await loadTrendingData();
  }, [loadExploreContent, loadTrendingData]);

  // Initialize on mount and focus
  useEffect(() => {
    loadExploreContent();
    loadTrendingData();
  }, [loadExploreContent, loadTrendingData]);

  // Focus effect for real-time updates
  useFocusEffect(
    useCallback(() => {
      // Refresh content when screen is focused
      if (activeTab === 'explore') {
        loadExploreContent();
      }
    }, [activeTab, loadExploreContent])
  );

  // Scroll handler for header animation
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  // Search input focus handlers
  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
    if (!searchQuery.trim()) {
      setActiveTab('search');
    }
  }, [searchQuery]);

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
    if (!searchQuery.trim()) {
      setActiveTab('explore');
    }
  }, [searchQuery]);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setActiveTab('explore');
    Keyboard.dismiss();
    searchInputRef.current?.blur();
  }, []);

  // Key extractors for performance
  const keyExtractor = useCallback((item: ContentItem | User) => {
    return 'id' in item ? item.id : (item as User).uid;
  }, []);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: ITEM_SIZE,
    offset: Math.floor(index / 3) * ITEM_SIZE,
    index,
  }), []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      
      {/* Instagram-style Header with Search */}
      <Animated.View style={[
        styles.header, 
        { 
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          opacity: headerOpacity,
        }
      ]}>
        <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
          <Icon name="search" size={20} color={colors.textSecondary} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearchInput}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Icon name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Search filter tabs (shown when searching) */}
        {activeTab === 'search' && searchQuery.trim() && renderSearchFilterTabs()}
      </Animated.View>

      {/* Main Content */}
      {activeTab === 'explore' ? (
        // Instagram-style Explore Grid
        <FlatList<ContentItem>
          data={exploreContent}
          renderItem={renderExploreItem as any}
          keyExtractor={keyExtractor}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.exploreGrid}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          onScroll={handleScroll}
          scrollEventThrottle={16}
          getItemLayout={getItemLayout}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={21}
          removeClippedSubviews={true}
          ListHeaderComponent={() => (
            <View style={styles.exploreHeader}>
              <Text style={[styles.exploreTitle, { color: colors.text }]}>
                Explore
              </Text>
              <Text style={[styles.exploreSubtitle, { color: colors.textSecondary }]}>
                Discover amazing content
              </Text>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Icon name="grid-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                No content available
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                Try refreshing or check your connection
              </Text>
            </View>
          )}
        />
      ) : (
        // Search Results or Suggestions
        <View style={styles.searchContent}>
          {!searchQuery.trim() ? (
            // Show recent searches and trending when no query
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsScrollContent}
            >
              {renderSearchSuggestions()}
            </ScrollView>
          ) : searchResults.length > 0 ? (
            // Show search results
            <FlatList<User>
              data={searchResults}
              renderItem={renderUserItem as any}
              keyExtractor={keyExtractor}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.searchResults}
              ListHeaderComponent={() => (
                <Text style={[styles.searchResultsHeader, { color: colors.textSecondary }]}>
                  {searchResults.length} results for "{searchQuery}"
                </Text>
              )}
            />
          ) : loading ? (
            // Loading state
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Searching...
              </Text>
            </View>
          ) : (
            // No results state
            <View style={styles.emptyState}>
              <Icon name="search-outline" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.text }]}>
                No results found
              </Text>
              <Text style={[styles.emptyStateSubtext, { color: colors.textSecondary }]}>
                Try searching for something else
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Loading overlay */}
      {loading && activeTab === 'explore' && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '400',
  },
  clearButton: {
    padding: 4,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginRight: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeFilterTab: {
    borderBottomColor: '#000',
  },
  filterTabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  exploreGrid: {
    padding: 1,
  },
  exploreHeader: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  exploreTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  exploreSubtitle: {
    fontSize: 16,
    fontWeight: '400',
  },
  searchContent: {
    flex: 1,
  },
  suggestionsScrollContent: {
    paddingVertical: 16,
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
  },
  suggestionSection: {
    marginBottom: 24,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  suggestionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  clearText: {
    fontSize: 14,
    fontWeight: '500',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  suggestionText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '400',
  },
  searchResults: {
    paddingTop: 8,
  },
  searchResultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: 1,
    position: 'relative',
    backgroundColor: '#f8f8f8',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  reelIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 6,
  },
  multiPostIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 6,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  statText: {
    color: '#fff',
    fontSize: 11,
    marginLeft: 4,
    fontWeight: '600',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  userAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '400',
    marginBottom: 2,
  },
  userBio: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 4,
  },
  userStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userStat: {
    fontSize: 12,
    fontWeight: '400',
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  // Multi-post preview styles
  multiPostPreview: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 32,
    height: 32,
  },
  miniThumbnail: {
    width: 15,
    height: 15,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: '#fff',
  },
  miniThumbnailFirst: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  miniThumbnailSecond: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
  miniThumbnailThird: {
    position: 'absolute',
    bottom: 0,
    left: 0,
  },
  miniThumbnailFourth: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  moreIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  moreText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '600',
  },
  multiPostCount: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
});

export default FastSearchScreen;
