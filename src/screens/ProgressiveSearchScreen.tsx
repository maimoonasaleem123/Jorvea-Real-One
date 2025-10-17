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
  InteractionManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import FirebaseService from '../services/firebaseService';
import { Post, User, Reel, RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import { InstagramPostViewer, InstagramReelViewer } from '../components/InstagramViewers';

const { width } = Dimensions.get('window');
const GRID_SIZE = 3;
const ITEM_SIZE = (width - 4) / GRID_SIZE;

interface ContentItem {
  id: string;
  type: 'post' | 'reel' | 'user';
  data: Post | Reel | User;
  index: number;
  loaded?: boolean;
  loading?: boolean;
}

interface ProgressiveLoadingState {
  items: ContentItem[];
  loadedCount: number;
  isLoading: boolean;
  batchSize: number;
  loadDelay: number;
}

const ProgressiveSearchScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  
  // Progressive loading state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [progressiveState, setProgressiveState] = useState<ProgressiveLoadingState>({
    items: [],
    loadedCount: 0,
    isLoading: false,
    batchSize: 6, // Load 6 items at a time (Instagram-like)
    loadDelay: 150, // 150ms delay between batches
  });
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'explore' | 'users'>('explore');
  const [showPostViewer, setShowPostViewer] = useState(false);
  const [showReelViewer, setShowReelViewer] = useState(false);
  const [selectedContent, setSelectedContent] = useState<ContentItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Performance optimization refs
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const contentCache = useRef<Map<string, ContentItem[]>>(new Map());

  // Progressive content loading - Instagram style
  const loadContentProgressively = useCallback(async (allContent: ContentItem[]) => {
    console.log(`📱 ProgressiveSearch: Starting progressive loading of ${allContent.length} items`);
    
    // Initialize all items as not loaded
    const initialItems: ContentItem[] = allContent.map(item => ({
      ...item,
      loaded: false,
      loading: false,
    }));
    
    setProgressiveState(prev => ({
      ...prev,
      items: initialItems,
      loadedCount: 0,
      isLoading: true,
    }));

    // Load in batches with delays
    const { batchSize, loadDelay } = progressiveState;
    const totalBatches = Math.ceil(allContent.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, allContent.length);
      
      // Mark batch as loading
      setProgressiveState(prev => ({
        ...prev,
        items: prev.items.map((item, index) => 
          index >= startIndex && index < endIndex
            ? { ...item, loading: true }
            : item
        ),
      }));

      // Wait for delay (Instagram-like staggered loading)
      if (batchIndex > 0) {
        await new Promise(resolve => {
          loadingTimeoutRef.current = setTimeout(resolve, loadDelay);
        });
      }

      // Mark batch as loaded
      setProgressiveState(prev => ({
        ...prev,
        items: prev.items.map((item, index) => 
          index >= startIndex && index < endIndex
            ? { ...item, loaded: true, loading: false }
            : item
        ),
        loadedCount: endIndex,
      }));

      console.log(`📦 ProgressiveSearch: Loaded batch ${batchIndex + 1}/${totalBatches} (${endIndex}/${allContent.length} items)`);
    }

    setProgressiveState(prev => ({ ...prev, isLoading: false }));
    console.log(`✅ ProgressiveSearch: Completed progressive loading`);
  }, [progressiveState.batchSize, progressiveState.loadDelay]);

  // Fast content loading with intelligent caching
  const loadExploreContent = useCallback(async (useCache = true) => {
    const cacheKey = 'explore_mixed';
    
    // Check cache first for instant loading
    if (useCache && contentCache.current.has(cacheKey)) {
      const cachedContent = contentCache.current.get(cacheKey) || [];
      await loadContentProgressively(cachedContent);
      return;
    }

    try {
      // Load data in parallel for maximum speed
      const [posts, reels] = await Promise.all([
        FirebaseService.getMorePosts(20),
        FirebaseService.getMoreReels(20),
      ]);

      // Intelligent content mixing (Instagram algorithm style)
      const mixedContent: ContentItem[] = [];
      let postIndex = 0;
      let reelIndex = 0;
      let contentIndex = 0;

      // Instagram-like mixing pattern: 2 posts, 1 reel, 3 posts, 1 reel, etc.
      const mixingPattern = [2, 1, 3, 1, 2, 1, 4, 1]; // posts, reels, posts, reels...
      let patternIndex = 0;
      let isPostsTurn = true;

      while (postIndex < posts.length || reelIndex < reels.length) {
        const currentPatternCount = mixingPattern[patternIndex % mixingPattern.length];
        
        if (isPostsTurn && postIndex < posts.length) {
          // Add posts
          for (let i = 0; i < currentPatternCount && postIndex < posts.length; i++) {
            mixedContent.push({
              id: `post_${posts[postIndex].id}`,
              type: 'post',
              data: posts[postIndex],
              index: contentIndex++,
            });
            postIndex++;
          }
        } else if (!isPostsTurn && reelIndex < reels.length) {
          // Add reels
          for (let i = 0; i < currentPatternCount && reelIndex < reels.length; i++) {
            mixedContent.push({
              id: `reel_${reels[reelIndex].id}`,
              type: 'reel',
              data: reels[reelIndex],
              index: contentIndex++,
            });
            reelIndex++;
          }
        }
        
        isPostsTurn = !isPostsTurn;
        patternIndex++;
        
        // Fallback: if one type is exhausted, add the rest of the other type
        if (postIndex >= posts.length && reelIndex < reels.length) {
          while (reelIndex < reels.length) {
            mixedContent.push({
              id: `reel_${reels[reelIndex].id}`,
              type: 'reel',
              data: reels[reelIndex],
              index: contentIndex++,
            });
            reelIndex++;
          }
          break;
        } else if (reelIndex >= reels.length && postIndex < posts.length) {
          while (postIndex < posts.length) {
            mixedContent.push({
              id: `post_${posts[postIndex].id}`,
              type: 'post',
              data: posts[postIndex],
              index: contentIndex++,
            });
            postIndex++;
          }
          break;
        }
      }

      // Cache for instant future loads
      contentCache.current.set(cacheKey, mixedContent);
      
      // Start progressive loading
      await loadContentProgressively(mixedContent);
      
    } catch (error) {
      console.error('❌ ProgressiveSearch: Error loading explore content:', error);
      setProgressiveState(prev => ({ ...prev, isLoading: false }));
    }
  }, [loadContentProgressively]);

  // Search with debouncing
  const performSearch = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await FirebaseService.searchUsers(query, 20);
      setSearchResults(results);
    } catch (error) {
      console.error('❌ ProgressiveSearch: Search error:', error);
      setSearchResults([]);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  // Load content on mount
  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      loadExploreContent(true);
    });
  }, []);

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    contentCache.current.clear();
    await loadExploreContent(false);
    setRefreshing(false);
  }, [loadExploreContent]);

  // Tab change handler
  const handleTabChange = useCallback((tab: 'explore' | 'users') => {
    setActiveTab(tab);
  }, []);

  // Content item press handlers
  const handleContentPress = useCallback((item: ContentItem) => {
    if (item.type === 'post') {
      const posts = progressiveState.items
        .filter(i => i.type === 'post' && i.loaded)
        .map(i => i.data as Post);
      const index = posts.findIndex(p => p.id === (item.data as Post).id);
      
      setSelectedContent(progressiveState.items.filter(i => i.type === 'post' && i.loaded));
      setSelectedIndex(index);
      setShowPostViewer(true);
    } else if (item.type === 'reel') {
      const reels = progressiveState.items
        .filter(i => i.type === 'reel' && i.loaded)
        .map(i => i.data as Reel);
      const index = reels.findIndex(r => r.id === (item.data as Reel).id);
      
      setSelectedContent(progressiveState.items.filter(i => i.type === 'reel' && i.loaded));
      setSelectedIndex(index);
      setShowReelViewer(true);
    }
  }, [progressiveState.items]);

  const handleUserPress = useCallback((user: User) => {
    navigation.navigate('UserProfile', { userId: user.uid });
  }, [navigation]);

  // Render progressive content item
  const renderContentItem = useCallback(({ item }: { item: ContentItem }) => {
    if (!item.loaded) {
      return (
        <View style={[styles.contentItem, { backgroundColor: colors.surface }]}>
          <View style={styles.placeholderContainer}>
            {item.loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View style={styles.placeholderBox} />
            )}
          </View>
        </View>
      );
    }

    const data = item.data as Post | Reel;
    
    return (
      <TouchableOpacity
        style={styles.contentItem}
        onPress={() => handleContentPress(item)}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: (data as any).imageUrl || (data as any).thumbnailUrl }}
          style={styles.contentImage}
          resizeMode="cover"
        />
        
        {/* Type indicator */}
        {item.type === 'reel' && (
          <View style={styles.reelIndicator}>
            <Icon name="play" size={12} color="#fff" />
          </View>
        )}
        
        {/* Multi-post indicator */}
        {item.type === 'post' && 'images' in data && (data as any).images && Array.isArray((data as any).images) && (data as any).images.length > 1 && (
          <View style={styles.multiPostIndicator}>
            <Icon name="copy-outline" size={12} color="#fff" />
          </View>
        )}
        
        {/* Stats */}
        <View style={styles.statsOverlay}>
          <View style={styles.stat}>
            <Icon name="heart" size={10} color="#fff" />
            <Text style={styles.statText}>{(data as any).likesCount || 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [colors, handleContentPress]);

  const renderUserItem = useCallback(({ item }: { item: User }) => (
    <TouchableOpacity
      style={[styles.userItem, { borderBottomColor: colors.border }]}
      onPress={() => handleUserPress(item)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.profilePicture || item.photoURL }}
        style={styles.userAvatar}
      />
      <View style={styles.userInfo}>
        <Text style={[styles.userName, { color: colors.text }]}>
          {item.displayName || item.username}
        </Text>
        <Text style={[styles.userUsername, { color: colors.textSecondary }]}>
          @{item.username}
        </Text>
      </View>
      {item.isVerified && (
        <Icon name="checkmark-circle" size={16} color="#0095F6" />
      )}
    </TouchableOpacity>
  ), [colors, handleUserPress]);

  const keyExtractor = useCallback((item: ContentItem | User, index: number) => {
    if ('type' in item) {
      return item.id;
    }
    return item.uid || item.id || index.toString();
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
          <Icon name="search-outline" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search users..."
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
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'explore' && { borderBottomColor: colors.primary }
          ]}
          onPress={() => handleTabChange('explore')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'explore' ? colors.primary : colors.textSecondary }
          ]}>
            Explore
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'users' && { borderBottomColor: colors.primary }
          ]}
          onPress={() => handleTabChange('users')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'users' ? colors.primary : colors.textSecondary }
          ]}>
            Users {searchResults.length > 0 && `(${searchResults.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Loading Progress Indicator */}
      {progressiveState.isLoading && progressiveState.items.length > 0 && (
        <View style={[styles.progressContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            Loading content... {progressiveState.loadedCount}/{progressiveState.items.length}
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${(progressiveState.loadedCount / progressiveState.items.length) * 100}%`,
                  backgroundColor: colors.primary 
                }
              ]} 
            />
          </View>
        </View>
      )}

      {/* Content */}
      <View style={styles.contentContainer}>
        {activeTab === 'explore' ? (
          <FlatList
            key="explore-progressive-grid"
            data={progressiveState.items}
            renderItem={renderContentItem}
            keyExtractor={keyExtractor}
            numColumns={3}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={12}
            initialNumToRender={6}
            windowSize={10}
            contentContainerStyle={styles.grid}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              !progressiveState.isLoading ? (
                <View style={styles.emptyContainer}>
                  <Icon name="images-outline" size={64} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No content available
                  </Text>
                  <TouchableOpacity style={styles.retryButton} onPress={() => loadExploreContent(false)}>
                    <Text style={[styles.retryText, { color: colors.primary }]}>
                      Retry
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null
            }
          />
        ) : (
          <FlatList
            key="users-search-list"
            data={searchResults}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.uid || item.id || 'unknown'}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            initialNumToRender={8}
            windowSize={5}
            style={styles.usersList}
            ListEmptyComponent={
              searchQuery.length > 1 ? (
                <View style={styles.emptyContainer}>
                  <Icon name="person-outline" size={64} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No users found for "{searchQuery}"
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Icon name="search-outline" size={64} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Start typing to search for users
                  </Text>
                </View>
              )
            }
          />
        )}
      </View>

      {/* Post Viewer */}
      <InstagramPostViewer
        visible={showPostViewer}
        posts={selectedContent.filter(item => item.type === 'post').map(item => item.data) as any}
        initialIndex={selectedIndex}
        onClose={() => setShowPostViewer(false)}
        onUserProfilePress={(userId: string) => handleUserPress({ uid: userId } as User)}
      />

      {/* Reel Viewer */}
      <InstagramReelViewer
        visible={showReelViewer}
        reels={selectedContent.filter(item => item.type === 'reel').map(item => item.data) as any}
        initialIndex={selectedIndex}
        onClose={() => setShowReelViewer(false)}
        onUserProfilePress={(userId: string) => handleUserPress({ uid: userId } as User)}
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
    borderBottomWidth: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '400',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  progressBar: {
    height: 2,
    backgroundColor: '#eee',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
  contentContainer: {
    flex: 1,
  },
  grid: {
    padding: 1,
  },
  contentItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: 1,
    position: 'relative',
  },
  contentImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderBox: {
    width: 30,
    height: 30,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  reelIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  multiPostIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statText: {
    color: '#fff',
    fontSize: 9,
    marginLeft: 2,
    fontWeight: '500',
  },
  usersList: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
  },
  userUsername: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ProgressiveSearchScreen;
