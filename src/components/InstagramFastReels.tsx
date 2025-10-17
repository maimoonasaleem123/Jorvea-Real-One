import React, { memo, useCallback, useMemo, useState, useRef } from 'react';
import {
  View,
  FlatList,
  Dimensions,
  StatusBar,
  Platform,
  RefreshControl,
  Text,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Reel as TypesReel } from '../types';
import { Reel as FirebaseReel } from '../services/firebaseService';
import FirebaseService from '../services/firebaseService';

const { width, height } = Dimensions.get('window');

// Convert Firebase Reel to Types Reel
const convertToTypesReel = (firebaseReel: FirebaseReel): TypesReel => {
  return {
    id: firebaseReel.id,
    userId: firebaseReel.userId,
    user: firebaseReel.user || {
      uid: firebaseReel.userId,
      email: '',
      username: 'Unknown',
      displayName: 'Unknown User',
      isPrivate: false,
      isVerified: false,
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
          showActivity: true,
          showOnlineStatus: true,
          allowMessages: 'everyone',
        },
        theme: 'auto',
      },
    },
    videoUrl: firebaseReel.videoUrl,
    thumbnailUrl: firebaseReel.thumbnailUrl,
    caption: firebaseReel.caption,
    musicId: firebaseReel.music?.id,
    music: firebaseReel.music ? {
      id: firebaseReel.music.id,
      title: firebaseReel.music.title,
      artist: firebaseReel.music.artist,
      url: firebaseReel.music.audioUrl,
      duration: firebaseReel.music.duration,
      isPopular: false,
      usageCount: 0,
      createdAt: new Date(),
    } : undefined,
    effects: [],
    likes: [],
    comments: [],
    shares: firebaseReel.sharesCount,
    saves: [],
    views: firebaseReel.viewsCount,
    duration: firebaseReel.duration,
    isArchived: false,
    isSaved: false,
    createdAt: new Date(firebaseReel.createdAt),
  };
};

// Fast Reels Context (similar to FastPosts but for reels)
interface FastReelsContextType {
  reels: TypesReel[];
  hasMore: boolean;
  loadNextPage: () => void;
  refreshReels: () => void;
  isRefreshing: boolean;
  error: string | null;
}

// Memoized Reel Item for maximum performance
const ReelItem = memo<{ reel: TypesReel; index: number; isVisible: boolean }>(({ reel, index, isVisible }) => {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.reelContainer, { backgroundColor: colors.background }]}>
      <View style={styles.reelContent}>
        <View style={styles.reelInfo}>
          <Text style={[styles.username, { color: colors.text }]}>
            @{reel.user.username}
          </Text>
          <Text style={[styles.caption, { color: colors.text }]}>
            {reel.caption}
          </Text>
        </View>
        
        <View style={styles.reelActions}>
          <Text style={[styles.likes, { color: colors.textSecondary }]}>
            {reel.likes.length} likes
          </Text>
          <Text style={[styles.views, { color: colors.textSecondary }]}>
            {reel.views} views
          </Text>
        </View>
      </View>
    </View>
  );
});

// Main Fast Reels Component
export const InstagramFastReels: React.FC = () => {
  const { colors } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  
  const [reels, setReels] = useState<TypesReel[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const lastReelIdRef = useRef<string | undefined>(undefined);
  const loadingRef = useRef(false);
  const PAGE_SIZE = 10;

  // Instagram-like instant loading without loading states
  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    try {
      loadingRef.current = true;
      setError(null);

      const fetchedReels = await FirebaseService.getReels(lastReelIdRef.current, PAGE_SIZE);
      
      if (fetchedReels.length === 0) {
        setHasMore(false);
        return;
      }

      const convertedReels = fetchedReels.map(convertToTypesReel);

      setReels(prevReels => {
        const existingIds = new Set(prevReels.map(r => r.id));
        const newReels = convertedReels.filter(r => !existingIds.has(r.id));
        return [...prevReels, ...newReels];
      });

      lastReelIdRef.current = fetchedReels[fetchedReels.length - 1]?.id;
      
      if (fetchedReels.length < PAGE_SIZE) {
        setHasMore(false);
      }

    } catch (err) {
      console.error('Error loading reels:', err);
      setError('Failed to load reels');
    } finally {
      loadingRef.current = false;
    }
  }, [hasMore]);

  // Instagram-style pull-to-refresh
  const refreshReels = useCallback(async () => {
    if (isRefreshing) return;

    try {
      setIsRefreshing(true);
      setError(null);
      lastReelIdRef.current = undefined;

      const fetchedReels = await FirebaseService.getReels(undefined, PAGE_SIZE);
      const convertedReels = fetchedReels.map(convertToTypesReel);
      
      setReels(convertedReels);
      lastReelIdRef.current = convertedReels[convertedReels.length - 1]?.id;
      setHasMore(fetchedReels.length === PAGE_SIZE);
      setCurrentIndex(0);

    } catch (err) {
      console.error('Error refreshing reels:', err);
      setError('Failed to refresh reels');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  // Instagram-like optimized renderItem
  const renderItem = useCallback(({ item, index }: { item: TypesReel; index: number }) => {
    const isVisible = Math.abs(index - currentIndex) <= 1; // Preload adjacent reels
    return <ReelItem reel={item} index={index} isVisible={isVisible} />;
  }, [currentIndex]);

  // Instagram-like keyExtractor
  const keyExtractor = useCallback((item: TypesReel) => item.id, []);

  // Instagram-like getItemLayout for better performance
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: height,
    offset: height * index,
    index,
  }), []);

  // Viewability config for reel switching
  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
    waitForInteraction: false,
  }), []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }, []);

  // Instagram-like end reached with preloading
  const onEndReached = useCallback(() => {
    if (hasMore) {
      loadNextPage();
    }
  }, [hasMore, loadNextPage]);

  // Custom refresh control
  const refreshControl = useMemo(() => (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={refreshReels}
      tintColor={colors.primary}
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
    />
  ), [isRefreshing, refreshReels, colors]);

  // Load initial reels
  React.useEffect(() => {
    if (reels.length === 0) {
      loadNextPage();
    }
  }, [loadNextPage, reels.length]);

  // Error state
  if (error && reels.length === 0) {
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
        data={reels}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={50}
        initialNumToRender={2}
        windowSize={5}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        pagingEnabled={true}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        style={[styles.flatList, { backgroundColor: colors.background }]}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flatList: {
    flex: 1,
  },
  reelContainer: {
    width: width,
    height: height,
    position: 'relative',
  },
  reelContent: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 80,
    zIndex: 2,
  },
  reelActions: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    alignItems: 'center',
    zIndex: 2,
  },
  reelInfo: {
    marginBottom: 16,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  likes: {
    fontSize: 12,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  views: {
    fontSize: 12,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
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
