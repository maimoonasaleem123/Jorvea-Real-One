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
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconIonic from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import FirebaseService, { Reel } from '../services/firebaseService';
import { DynamicFollowButton } from '../components/DynamicFollowButton';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');
const REEL_HEIGHT = height;

// Optimized loading configuration
const INITIAL_LOAD_COUNT = 2; // Load first 2 reels instantly
const BATCH_SIZE = 10; // Load reels in batches
const PRELOAD_THRESHOLD = 3; // Start loading when 3 items away from end

interface ReelItemProps {
  reel: Reel;
  isActive: boolean;
  currentUserId: string;
  onLike: (reelId: string) => void;
  onShare: (reel: Reel) => void;
  onInAppShare: (reel: Reel) => void;
  onComment: (reel: Reel) => void;
  onFollow: (userId: string) => void;
  onSave: (reelId: string) => void;
  onViewCountUpdate: (reelId: string) => void;
  navigation: any;
}

const OptimizedReelItem: React.FC<ReelItemProps> = React.memo(({
  reel,
  isActive,
  currentUserId,
  onLike,
  onShare,
  onInAppShare,
  onComment,
  onFollow,
  onSave,
  onViewCountUpdate,
  navigation,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  const videoRef = useRef<VideoRef>(null);
  const heartAnimation = useRef(new Animated.Value(0)).current;
  const controlsTimeout = useRef<NodeJS.Timeout>();

  // Auto-play when reel becomes active
  useEffect(() => {
    if (isActive && !loading && !error) {
      setIsPlaying(true);
      onViewCountUpdate(reel.id);
    } else {
      setIsPlaying(false);
    }
  }, [isActive, loading, error, onViewCountUpdate, reel.id]);

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const handleVideoLoad = useCallback(() => {
    setLoading(false);
    setError(false);
  }, []);

  const handleVideoError = useCallback(() => {
    setLoading(false);
    setError(true);
  }, []);

  const handleSingleTap = useCallback(() => {
    setIsPlaying(!isPlaying);
    setShowControls(true);
    
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 2000);
  }, [isPlaying]);

  const handleDoubleTap = useCallback(() => {
    if (!liked) {
      setLiked(true);
      onLike(reel.id);
      
      // Heart animation
      setShowHeartAnimation(true);
      heartAnimation.setValue(0);
      Animated.sequence([
        Animated.timing(heartAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(heartAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => setShowHeartAnimation(false));
      
      Vibration.vibrate(50);
    }
  }, [liked, onLike, reel.id, heartAnimation]);

  const handleLikePress = useCallback(() => {
    setLiked(!liked);
    onLike(reel.id);
  }, [liked, onLike, reel.id]);

  const handleSavePress = useCallback(() => {
    setSaved(!saved);
    onSave(reel.id);
  }, [saved, onSave, reel.id]);

  const handleMuteToggle = useCallback(() => {
    setMuted(!muted);
  }, [muted]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, []);

  return (
    <View style={styles.reelContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Video Player */}
      <TouchableOpacity
        style={styles.videoContainer}
        onPress={handleSingleTap}
        onLongPress={handleDoubleTap}
        activeOpacity={1}>
        <Video
          ref={videoRef}
          source={{ uri: reel.videoUrl }}
          style={styles.video}
          resizeMode="cover"
          repeat
          paused={!isPlaying}
          muted={muted}
          onLoad={handleVideoLoad}
          onError={handleVideoError}
          poster={reel.thumbnailUrl}
          posterResizeMode="cover"
          playInBackground={false}
          playWhenInactive={false}
        />
      </TouchableOpacity>

      {/* Loading State */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {/* Error State */}
      {error && (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color="rgba(255,255,255,0.7)" />
          <Text style={styles.errorText}>Failed to load video</Text>
        </View>
      )}

      {/* Play/Pause Indicator */}
      {showControls && (
        <View style={styles.controlsOverlay}>
          <Icon 
            name={isPlaying ? "pause" : "play-arrow"} 
            size={80} 
            color="rgba(255,255,255,0.8)" 
          />
        </View>
      )}

      {/* Double Tap Heart Animation */}
      {showHeartAnimation && (
        <Animated.View
          style={[
            styles.heartAnimation,
            {
              transform: [
                {
                  scale: heartAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1.2, 1],
                  }),
                },
              ],
              opacity: heartAnimation.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, 1, 0],
              }),
            },
          ]}>
          <Icon name="favorite" size={80} color="#ff3040" />
        </Animated.View>
      )}

      {/* Gradient Overlays */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />

      {/* User Info */}
      <View style={styles.userInfo}>
        <TouchableOpacity
          style={styles.userAvatar}
          onPress={() => navigation.navigate('Profile', { userId: reel.user?.id })}>
          <Image
            source={{ uri: reel.user?.profilePicture || 'https://via.placeholder.com/40' }}
            style={styles.avatarImage}
          />
        </TouchableOpacity>
        
        <View style={styles.userDetails}>
          <Text style={styles.username}>@{reel.user?.username}</Text>
          {reel.user?.verified && (
            <Icon name="verified" size={16} color="#1DA1F2" style={styles.verifiedIcon} />
          )}
        </View>

        {reel.user?.id !== currentUserId && (
          <DynamicFollowButton
            targetUserId={reel.user?.id || ''}
            size="small"
            variant="primary"
            style={styles.followButton}
          />
        )}
      </View>

      {/* Content Info */}
      <View style={styles.contentInfo}>
        {reel.caption && (
          <Text style={styles.caption} numberOfLines={2}>
            {reel.caption}
          </Text>
        )}

        {reel.tags && reel.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {reel.tags.slice(0, 3).map((tag, index) => (
              <Text key={index} style={styles.tag}>
                #{tag}
              </Text>
            ))}
          </View>
        )}

        {/* Music Info */}
        {reel.musicTitle && (
          <View style={styles.musicContainer}>
            <Icon name="music-note" size={14} color="#fff" />
            <Text style={styles.musicText} numberOfLines={1}>
              {reel.musicTitle}
            </Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statText}>
            {formatCount(reel.views || 0)} views • {reel.timeAgo}
          </Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Like Button */}
        <TouchableOpacity style={styles.actionButton} onPress={handleLikePress}>
          <Icon
            name={liked ? "favorite" : "favorite-border"}
            size={28}
            color={liked ? "#ff3040" : "#fff"}
          />
          <Text style={styles.actionText}>{formatCount(reel.likes || 0)}</Text>
        </TouchableOpacity>

        {/* Comment Button */}
        <TouchableOpacity style={styles.actionButton} onPress={() => onComment(reel)}>
          <IconIonic name="chatbubble-outline" size={26} color="#fff" />
          <Text style={styles.actionText}>{formatCount(reel.commentsCount || 0)}</Text>
        </TouchableOpacity>

        {/* External Share Button */}
        <TouchableOpacity style={styles.actionButton} onPress={() => onShare(reel)}>
          <IconIonic name="paper-plane-outline" size={26} color="#fff" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>

        {/* In-App Share Button */}
        <TouchableOpacity style={styles.actionButton} onPress={() => onInAppShare(reel)}>
          <IconIonic name="paper-plane" size={26} color="#1DA1F2" />
          <Text style={styles.actionText}>Send</Text>
        </TouchableOpacity>

        {/* Save Button */}
        <TouchableOpacity style={styles.actionButton} onPress={handleSavePress}>
          <Icon
            name={saved ? "bookmark" : "bookmark-border"}
            size={26}
            color={saved ? "#ffd700" : "#fff"}
          />
        </TouchableOpacity>

        {/* Mute Button */}
        <TouchableOpacity style={styles.muteButton} onPress={handleMuteToggle}>
          <Icon
            name={muted ? "volume-off" : "volume-up"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const ReelsScreen: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigation = useNavigation();
  
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInAppShareModal, setShowInAppShareModal] = useState(false);
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);

  const flatListRef = useRef<FlatList>(null);

  // Optimized reel loading with lazy loading
  const loadReels = useCallback(async (isRefresh = false, loadMore = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      } else if (loadMore) {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }

      const limit = isRefresh || !loadMore ? INITIAL_LOAD_COUNT : BATCH_SIZE;
      const docToUse = isRefresh ? null : (loadMore ? lastDoc : null);
      const excludeUserId = user?.uid;
      
      const fetchedReels = await FirebaseService.getReels(limit, docToUse, excludeUserId);
      
      if (fetchedReels.length === 0) {
        setHasMore(false);
        if (isRefresh || (!loadMore && reels.length === 0)) {
          setError('No reels available');
        }
        return;
      }

      if (isRefresh) {
        setReels(fetchedReels);
        setCurrentIndex(0);
        setHasMore(fetchedReels.length === limit);
      } else if (loadMore) {
        setReels(prev => [...prev, ...fetchedReels]);
        setHasMore(fetchedReels.length === BATCH_SIZE);
      } else {
        setReels(fetchedReels);
        setHasMore(fetchedReels.length === limit);
      }

      // Set last document for pagination
      if (fetchedReels.length > 0) {
        setLastDoc(fetchedReels[fetchedReels.length - 1].id);
      }

    } catch (error) {
      console.error('Error loading reels:', error);
      const errorMessage = 'Failed to load reels. Please try again.';
      setError(errorMessage);
      
      if (!isRefresh && !loadMore) {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [lastDoc, hasMore, loadingMore, user?.uid, reels.length]);

  // Handle like
  const handleLike = useCallback(async (reelId: string) => {
    try {
      // Optimistic update
      setReels(prev => prev.map(reel => 
        reel.id === reelId 
          ? { ...reel, likes: (reel.likes || 0) + 1 }
          : reel
      ));

      // TODO: Implement Firebase like functionality
      // await FirebaseService.toggleReelLike(reelId, true);
    } catch (error) {
      console.error('Error liking reel:', error);
    }
  }, []);

  // Handle save
  const handleSave = useCallback(async (reelId: string) => {
    try {
      // TODO: Implement Firebase save functionality
      // await FirebaseService.toggleReelSave(reelId, true);
    } catch (error) {
      console.error('Error saving reel:', error);
    }
  }, []);

  // Handle follow
  const handleFollow = useCallback(async (userId: string) => {
    try {
      // Optimistic update
      setReels(prev => prev.map(reel => 
        reel.user?.id === userId 
          ? { ...reel, user: { ...reel.user, isFollowing: true } }
          : reel
      ));
    } catch (error) {
      console.error('Error following user:', error);
    }
  }, []);

  // Handle external share
  const handleShare = useCallback(async (reel: Reel) => {
    try {
      await Share.share({
        message: `Check out this amazing reel by ${reel.user?.username || 'a user'}! 🎥\n\n"${reel.caption}"\n\nWatch on Jorvea App`,
        url: reel.videoUrl,
      });
    } catch (error) {
      console.error('Error sharing reel:', error);
    }
  }, []);

  // Handle in-app share
  const handleInAppShare = useCallback((reel: Reel) => {
    setSelectedReel(reel);
    setShowInAppShareModal(true);
  }, []);

  // Handle comment
  const handleComment = useCallback((reel: Reel) => {
    navigation.navigate('Comments', { reelId: reel.id, postType: 'reel' });
  }, [navigation]);

  // Handle view count update
  const handleViewCountUpdate = useCallback(async (reelId: string) => {
    try {
      // Optimistic update
      setReels(prev => prev.map(reel => 
        reel.id === reelId 
          ? { ...reel, views: (reel.views || 0) + 1 }
          : reel
      ));

      // TODO: Implement Firebase view count update
      // await FirebaseService.incrementReelViews(reelId);
    } catch (error) {
      console.error('Error updating view count:', error);
    }
  }, []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }, []);

  const onEndReached = useCallback(() => {
    if (hasMore && !loadingMore && reels.length >= INITIAL_LOAD_COUNT) {
      loadReels(false, true);
    }
  }, [hasMore, loadingMore, loadReels, reels.length]);

  const onRefresh = useCallback(() => {
    loadReels(true);
  }, [loadReels]);

  // Load initial reels
  useEffect(() => {
    loadReels();
  }, []);

  // Handle back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        navigation.goBack();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [navigation])
  );

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 80,
  };

  const renderItem = useCallback(({ item, index }: { item: Reel; index: number }) => (
    <OptimizedReelItem
      reel={item}
      isActive={index === currentIndex}
      currentUserId={user?.uid || ''}
      onLike={handleLike}
      onShare={handleShare}
      onInAppShare={handleInAppShare}
      onComment={handleComment}
      onFollow={handleFollow}
      onSave={handleSave}
      onViewCountUpdate={handleViewCountUpdate}
      navigation={navigation}
    />
  ), [currentIndex, user?.uid, handleLike, handleShare, handleInAppShare, handleComment, handleFollow, handleSave, handleViewCountUpdate, navigation]);

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  };

  // In-App Share Modal
  const InAppShareModal = () => (
    <Modal
      visible={showInAppShareModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowInAppShareModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.shareModal}>
          <View style={styles.shareModalHeader}>
            <Text style={styles.shareModalTitle}>Send to</Text>
            <TouchableOpacity onPress={() => setShowInAppShareModal(false)}>
              <Icon name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={styles.shareOption}
            onPress={() => {
              setShowInAppShareModal(false);
              navigation.navigate('ChatUserSearch', { 
                shareContent: {
                  type: 'reel',
                  data: selectedReel
                }
              });
            }}>
            <IconIonic name="paper-plane" size={24} color="#1DA1F2" />
            <Text style={styles.shareOptionText}>Send as Message</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading && reels.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading Amazing Reels...</Text>
      </View>
    );
  }

  if (error && reels.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="video-library" size={64} color="rgba(255,255,255,0.7)" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadReels()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" hidden />
      
      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={REEL_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
        ListFooterComponent={renderFooter}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={INITIAL_LOAD_COUNT}
        maxToRenderPerBatch={BATCH_SIZE}
        windowSize={5}
        getItemLayout={(data, index) => ({
          length: REEL_HEIGHT,
          offset: REEL_HEIGHT * index,
          index,
        })}
        style={styles.flatList}
      />

      <InAppShareModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  flatList: {
    flex: 1,
  },
  reelContainer: {
    width,
    height: REEL_HEIGHT,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  controlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartAnimation: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  userInfo: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 80,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  userDetails: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  verifiedIcon: {
    marginLeft: 2,
  },
  followButton: {
    backgroundColor: '#ff3040',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  contentInfo: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 80,
  },
  caption: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tag: {
    color: '#1DA1F2',
    fontSize: 14,
    marginRight: 8,
    marginBottom: 4,
  },
  musicContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  musicText: {
    color: '#fff',
    fontSize: 13,
    marginLeft: 6,
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  actionsContainer: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  muteButton: {
    alignItems: 'center',
    marginTop: 10,
    padding: 8,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginTop: 12,
  },
  errorText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  retryButton: {
    backgroundColor: '#ff3040',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  shareModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  shareModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  shareOptionText: {
    fontSize: 16,
    color: '#000',
    marginLeft: 12,
  },
});

export default ReelsScreen;
