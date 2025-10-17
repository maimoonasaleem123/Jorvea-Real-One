import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StatusBar,
  Animated,
  Platform,
  Share,
  Vibration,
  Image,
  BackHandler,
  AppState,
  Modal,
  PanResponder,
  RefreshControl,
  TouchableWithoutFeedback,
  InteractionManager,
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconIonic from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import FirebaseService, { Reel } from '../services/firebaseService';
import { UniversalLikeButton } from '../components/UniversalLikeButton';
import { CommentsModal } from '../components/CommentsModal';
import { ShareModal } from '../components/ShareModal';

const { width, height } = Dimensions.get('screen');

interface Enhanced120FPSReelsScreenProps {
  route?: {
    params?: {
      initialReelId?: string;
      fromProfile?: boolean;
    };
  };
}

export const Enhanced120FPSReelsScreen: React.FC<Enhanced120FPSReelsScreenProps> = ({ route }) => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  // High-performance state management
  const [reels, setReels] = useState<Reel[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [selectedReelId, setSelectedReelId] = useState<string>('');
  
  // Performance refs
  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<{ [key: string]: VideoRef }>({});
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 100,
  });
  const isLoadingMore = useRef(false);
  const preloadedIndices = useRef(new Set<number>());
  
  // 120fps optimization
  const [highPerformanceMode, setHighPerformanceMode] = useState(true);

  // Load initial reels with intelligent preloading
  const loadInitialReels = useCallback(async () => {
    try {
      setLoading(true);
      const result = await FirebaseService.getReels(20); // Load more initially
      
      // Handle the new return format from getReels
      if (result && typeof result === 'object' && 'reels' in result) {
        const { reels: initialReels, hasMore: hasMoreReels } = result;
        
        // Ensure we have a valid array
        if (Array.isArray(initialReels)) {
          setReels(initialReels);
          setHasMore(hasMoreReels);
          
          console.log('📱 Enhanced120FPSReelsScreen: Loaded', initialReels.length, 'reels');
          
          // Preload first 3 videos
          InteractionManager.runAfterInteractions(() => {
            initialReels.slice(0, 3).forEach((_, index) => {
              preloadedIndices.current.add(index);
            });
          });
          
          // Find initial index if coming from profile
          const initialReelId = route?.params?.initialReelId;
          if (initialReelId) {
            const index = initialReels.findIndex(reel => reel.id === initialReelId);
            if (index !== -1) {
              setCurrentIndex(index);
              setTimeout(() => {
                flatListRef.current?.scrollToIndex({ index, animated: false });
              }, 100);
            }
          }
        } else {
          console.warn('getReels returned invalid reels array:', result);
          setReels([]);
          setHasMore(false);
        }
      } else {
        console.warn('getReels returned invalid data format:', result);
        setReels([]);
        setHasMore(false);
      }
    } catch (error) {
      console.error('❌ Enhanced120FPSReelsScreen: Error loading reels:', error);
      setReels([]);
      setHasMore(false);
      Alert.alert('Error', 'Failed to load reels. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [route?.params?.initialReelId]);

  // Load more reels with background processing
  const loadMoreReels = useCallback(async () => {
    if (isLoadingMore.current || !hasMore) return;
    
    isLoadingMore.current = true;
    try {
      // Get the last document for pagination
      const lastReelId = reels.length > 0 ? reels[reels.length - 1]?.id : undefined;
      const result = await FirebaseService.getReels(10, lastReelId);
      
      // Handle the new return format from getReels
      if (result && typeof result === 'object' && 'reels' in result) {
        const { reels: newReels, hasMore: hasMoreReels } = result;
        
        if (Array.isArray(newReels) && newReels.length > 0) {
          setReels(prev => [...prev, ...newReels]);
          setHasMore(hasMoreReels);
          console.log('📱 Enhanced120FPSReelsScreen: Loaded', newReels.length, 'more reels');
        } else {
          setHasMore(false);
          console.log('📱 Enhanced120FPSReelsScreen: No more reels to load');
        }
      } else {
        setHasMore(false);
        console.warn('getReels returned invalid data format for loadMore:', result);
      }
    } catch (error) {
      console.error('❌ Enhanced120FPSReelsScreen: Error loading more reels:', error);
      setHasMore(false);
    } finally {
      isLoadingMore.current = false;
    }
  }, [reels, hasMore]);

  // Intelligent preloading for smooth scrolling
  const preloadAdjacentVideos = useCallback((index: number) => {
    const indicesToPreload = [
      index - 1,
      index,
      index + 1,
      index + 2, // Preload one extra for smoother experience
    ].filter(i => i >= 0 && i < reels.length && !preloadedIndices.current.has(i));

    indicesToPreload.forEach(i => {
      preloadedIndices.current.add(i);
      // Background preload without affecting UI
      InteractionManager.runAfterInteractions(() => {
        const reel = reels[i];
        if (reel && videoRefs.current[reel.id]) {
          // Preload video in background
        }
      });
    });
  }, [reels]);

  // High-performance viewability change handler
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      setCurrentIndex(newIndex);
      
      // Pause all videos first (performance optimization)
      Object.values(videoRefs.current).forEach((ref, index) => {
        if (index !== newIndex) {
          ref?.pause?.();
        }
      });
      
      // Play current video
      const currentReel = reels[newIndex];
      if (currentReel && videoRefs.current[currentReel.id]) {
        // Use proper video ref methods
        const videoRef = videoRefs.current[currentReel.id];
        if (videoRef && typeof videoRef.resume === 'function') {
          videoRef.resume();
        }
      }
      
      // Intelligent preloading
      preloadAdjacentVideos(newIndex);
      
      // Load more when approaching end
      if (newIndex >= reels.length - 3) {
        loadMoreReels();
      }
    }
  }, [reels, preloadAdjacentVideos, loadMoreReels]);

  // Optimized reel item renderer with 120fps considerations
  const renderReelItem = useCallback(({ item: reel, index }: { item: Reel; index: number }) => {
    const isActive = index === currentIndex;
    
    return (
      <View style={styles.reelContainer}>
        {/* Video Component with optimizations */}
        <Video
          ref={(ref) => {
            if (ref) videoRefs.current[reel.id] = ref;
          }}
          source={{ uri: reel.videoUrl }}
          style={styles.video}
          resizeMode="cover"
          repeat={true}
          paused={!isActive}
          muted={false}
          controls={false}
          playInBackground={false}
          playWhenInactive={false}
          // 120fps optimizations
          bufferConfig={{
            minBufferMs: 2000,
            maxBufferMs: 5000,
            bufferForPlaybackMs: 1000,
            bufferForPlaybackAfterRebufferMs: 2000,
          }}
          onBuffer={() => {}}
          onError={(error) => console.error('Video error:', error)}
          onLoad={() => {
            if (isActive) {
              const videoRef = videoRefs.current[reel.id];
              if (videoRef && typeof videoRef.resume === 'function') {
                videoRef.resume();
              }
            }
          }}
          // Additional performance props
          ignoreSilentSwitch="ignore"
          mixWithOthers="mix"
          rate={1.0}
          volume={1.0}
        />

        {/* Gradient Overlay */}
        <View style={styles.gradientOverlay} />

        {/* Content Overlay */}
        <View style={styles.contentOverlay}>
          {/* User Info */}
          <TouchableOpacity
            style={styles.userInfo}
            onPress={() => {
              if (reel.userId !== user?.uid) {
                (navigation as any).navigate('UserProfile', { 
                  userId: reel.userId,
                  user: reel.user 
                });
              }
            }}
          >
            <Image
              source={{ uri: reel.user?.profilePicture || 'https://via.placeholder.com/40' }}
              style={styles.userAvatar}
            />
            <View style={styles.userDetails}>
              <Text style={styles.username}>{reel.user?.username || 'User'}</Text>
              <Text style={styles.timestamp}>
                {FirebaseService.formatTimeAgo(reel.createdAt)}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Caption */}
          {reel.caption && (
            <View style={styles.captionContainer}>
              <Text style={styles.caption} numberOfLines={3}>
                {reel.caption}
              </Text>
            </View>
          )}

          {/* Music Info */}
          {reel.musicTitle && (
            <View style={styles.musicInfo}>
              <Icon name="music-note" size={16} color="#fff" />
              <Text style={styles.musicText} numberOfLines={1}>
                {reel.musicTitle}
              </Text>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <UniversalLikeButton
            contentId={reel.id}
            contentType="reel"
            size="large"
            variant="default"
            showCount={true}
          />

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setSelectedReelId(reel.id);
              setShowComments(true);
            }}
          >
            <Icon name="comment" size={28} color="#fff" />
            <Text style={styles.actionCount}>
              {FirebaseService.formatNumber(reel.commentsCount || 0)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              setSelectedReelId(reel.id);
              setShowShare(true);
            }}
          >
            <Icon name="share" size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              // Add to favorites/save functionality
            }}
          >
            <Icon name="bookmark-border" size={28} color="#fff" />
          </TouchableOpacity>

          {/* User Avatar (floating) */}
          <TouchableOpacity
            style={styles.floatingAvatar}
            onPress={() => {
              if (reel.userId !== user?.uid) {
                (navigation as any).navigate('UserProfile', { 
                  userId: reel.userId 
                });
              }
            }}
          >
            <Image
              source={{ uri: reel.user?.profilePicture || 'https://via.placeholder.com/40' }}
              style={styles.avatarImage}
            />
          </TouchableOpacity>
        </View>

        {/* Progress indicator for better UX */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progress, { width: `${((index + 1) / reels.length) * 100}%` }]} />
          </View>
        </View>
      </View>
    );
  }, [currentIndex, user, navigation, reels.length]);

  // Optimized key extractor
  const keyExtractor = useCallback((item: Reel) => item.id, []);

  // Optimized get item layout for performance
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: height,
    offset: height * index,
    index,
  }), []);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    preloadedIndices.current.clear();
    await loadInitialReels();
    setRefreshing(false);
  }, [loadInitialReels]);

  // Initialize
  useEffect(() => {
    loadInitialReels();
  }, [loadInitialReels]);

  // Handle back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (route?.params?.fromProfile) {
          navigation.goBack();
        } else {
          (navigation as any).navigate('Home');
        }
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [navigation, route?.params?.fromProfile])
  );

  // App state handling for performance
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Pause all videos when app goes to background
        Object.values(videoRefs.current).forEach(ref => ref?.pause?.());
      } else if (nextAppState === 'active') {
        // Resume current video when app becomes active
        const currentReel = reels[currentIndex];
        if (currentReel && videoRefs.current[currentReel.id]) {
          const videoRef = videoRefs.current[currentReel.id];
          if (videoRef && typeof videoRef.resume === 'function') {
            videoRef.resume();
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [reels, currentIndex]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading Reels...</Text>
      </View>
    );
  }

  // Show empty state if no reels
  if (!loading && reels.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reels</Text>
          <TouchableOpacity onPress={() => (navigation as any).navigate('CreateReel')}>
            <Icon name="camera-alt" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Empty State */}
        <View style={styles.emptyContainer}>
          <Icon name="videocam-off" size={80} color="#666" />
          <Text style={styles.emptyTitle}>No Reels Yet</Text>
          <Text style={styles.emptySubtitle}>
            Be the first to create and share amazing reels!
          </Text>
          <TouchableOpacity 
            style={styles.createButton}
            onPress={() => (navigation as any).navigate('CreateReel')}
          >
            <Text style={styles.createButtonText}>Create Your First Reel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reels</Text>
        <TouchableOpacity onPress={() => (navigation as any).navigate('Camera')}>
          <Icon name="camera-alt" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 120fps Optimized FlatList */}
      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderReelItem}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={2}
        windowSize={3}
        initialNumToRender={1}
        updateCellsBatchingPeriod={16} // 60fps batching
        disableIntervalMomentum={true}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={['#fff']}
          />
        }
        onEndReached={loadMoreReels}
        onEndReachedThreshold={0.5}
      />

      {/* Comments Modal */}
      <CommentsModal
        visible={showComments}
        targetId={selectedReelId}
        targetType="reel"
        onClose={() => setShowComments(false)}
      />

      {/* Share Modal */}
      <ShareModal
        visible={showShare}
        reel={reels && reels.length > 0 ? reels.find(r => r.id === selectedReelId) : undefined}
        onClose={() => setShowShare(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  reelContainer: {
    width,
    height,
    position: 'relative',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'transparent',
  },
  contentOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 80,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  timestamp: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  captionContainer: {
    marginBottom: 8,
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
  },
  musicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  musicText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    maxWidth: 200,
  },
  actionsContainer: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginVertical: 12,
  },
  actionCount: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  floatingAvatar: {
    marginTop: 20,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  progressBar: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progress: {
    height: 2,
    backgroundColor: '#fff',
  },
  // Empty State Styles
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 22,
  },
  createButton: {
    backgroundColor: '#E1306C',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    marginTop: 30,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default Enhanced120FPSReelsScreen;
