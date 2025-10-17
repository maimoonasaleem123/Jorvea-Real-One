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
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconIonic from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import FirebaseService, { Reel } from '../services/firebaseService';
import ShareReelModal from '../components/ShareReelModal';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');
const REEL_HEIGHT = height;

// Configuration for instant loading and better UX
const INITIAL_LOAD_COUNT = 10; // Load more reels instantly for smooth scrolling
const BATCH_SIZE = 15; // Larger batches for better performance
const PRELOAD_THRESHOLD = 2; // Load earlier for seamless experience
const BACKGROUND_TIMEOUT = 5000; // 5 seconds timeout for background return

interface ReelItemProps {
  reel: Reel;
  isActive: boolean;
  currentUserId: string;
  isPaused: boolean; // Add isPaused prop
  onLike: (reelId: string) => void;
  onShare: (reel: Reel) => void;
  onInAppShare: (reel: Reel) => void;
  onComment: (reel: Reel) => void;
  onFollow: (userId: string) => void;
  onSave: (reelId: string) => void;
  onViewCountUpdate: (reelId: string) => void;
  onUserProfilePress: (userId: string) => void;
  onViewUserStory: (userId: string) => void;
  navigation: any;
}

const OptimizedReelItem: React.FC<ReelItemProps> = React.memo(({
  reel,
  isActive,
  currentUserId,
  isPaused,
  onLike,
  onShare,
  onInAppShare,
  onComment,
  onFollow,
  onSave,
  onViewCountUpdate,
  onUserProfilePress,
  onViewUserStory,
  navigation,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false); // Default UNMUTED as requested
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [liked, setLiked] = useState(reel.isLiked || false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(reel.user?.isFollowing || false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  const videoRef = useRef<VideoRef>(null);
  const heartAnimation = useRef(new Animated.Value(0)).current;
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastTapTime = useRef(0);

  // Auto-play when reel becomes active (UNMUTED by default) and handle pause state
  useEffect(() => {
    if (isActive && !isPaused) {
      setIsPlaying(true);
      onViewCountUpdate(reel.id);
      // Show controls briefly when video starts
      setShowControls(true);
      setTimeout(() => setShowControls(false), 2000);
    } else {
      setIsPlaying(false);
      if (isActive && currentTime > 0) {
        // If user scrolled back to this video, restart from beginning
        videoRef.current?.seek(0);
        setCurrentTime(0);
      }
    }
  }, [isActive, isPaused, onViewCountUpdate, reel.id, currentTime]);

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const handleVideoLoad = useCallback((data: any) => {
    setDuration(data.duration);
  }, []);

  const handleVideoProgress = useCallback((data: any) => {
    setCurrentTime(data.currentTime);
  }, []);

  const handleSingleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime.current;
    lastTapTime.current = now;

    if (timeSinceLastTap < 300) {
      // Double tap detected
      handleDoubleTap();
      return;
    }

    // Single tap - toggle play/pause
    setTimeout(() => {
      if (Date.now() - lastTapTime.current >= 300) {
        setIsPlaying(!isPlaying);
        setShowControls(true);
        
        if (controlsTimeout.current) {
          clearTimeout(controlsTimeout.current);
        }
        controlsTimeout.current = setTimeout(() => {
          setShowControls(false);
        }, 3000);
      }
    }, 300);
  }, [isPlaying]);

  const handleDoubleTap = useCallback(() => {
    // Double tap to like
    if (!liked) {
      setLiked(true);
      onLike(reel.id);
    }
    
    // Heart animation
    setShowHeartAnimation(true);
    heartAnimation.setValue(0);
    Animated.sequence([
      Animated.timing(heartAnimation, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(heartAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setShowHeartAnimation(false));
    
    Vibration.vibrate([50, 100, 50]);
  }, [liked, onLike, reel.id, heartAnimation]);

  const handleLikePress = useCallback(async () => {
    try {
      setLiked(!liked);
      onLike(reel.id);
      Vibration.vibrate(30);
    } catch (error) {
      console.error('Error liking reel:', error);
    }
  }, [liked, onLike, reel.id]);

  const handleSavePress = useCallback(() => {
    setSaved(!saved);
    onSave(reel.id);
    Vibration.vibrate(30);
  }, [saved, onSave, reel.id]);

  const handleFollowPress = useCallback(async () => {
    try {
      setFollowing(!following);
      await onFollow(reel.user?.id || '');
      Vibration.vibrate(50);
    } catch (error) {
      console.error('Error following user:', error);
      setFollowing(following); // Revert on error
    }
  }, [following, onFollow, reel.user?.id]);

  const handleMuteToggle = useCallback(() => {
    setMuted(!muted);
    setShowControls(true);
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 2000);
  }, [muted]);

  // Cleanup timeouts on unmount
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
      <TouchableWithoutFeedback
        onPress={handleSingleTap}
        style={styles.videoContainer}>
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={{ uri: reel.videoUrl }}
            style={styles.video}
            resizeMode="cover"
            repeat
            paused={!isPlaying}
            muted={muted}
            onLoad={handleVideoLoad}
            onProgress={handleVideoProgress}
            poster={reel.thumbnailUrl}
            posterResizeMode="cover"
            playInBackground={false}
            playWhenInactive={false}
            progressUpdateInterval={250}
          />

          {/* Enhanced Video Controls */}
          {showControls && (
            <View style={styles.videoControlsOverlay}>
              {/* Play/Pause Indicator */}
              <View style={styles.playPauseIndicator}>
                <Icon 
                  name={isPlaying ? "pause" : "play-arrow"} 
                  size={60} 
                  color="rgba(255,255,255,0.9)" 
                />
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill,
                      { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.timeText}>
                  {Math.floor(currentTime)}s / {Math.floor(duration)}s
                </Text>
              </View>

              {/* Mute/Unmute Button */}
              <TouchableOpacity 
                style={styles.muteButton}
                onPress={handleMuteToggle}>
                <Icon 
                  name={muted ? "volume-off" : "volume-up"} 
                  size={24} 
                  color="rgba(255,255,255,0.9)" 
                />
              </TouchableOpacity>
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
                        inputRange: [0, 1],
                        outputRange: [0, 1.2],
                      }),
                    },
                  ],
                  opacity: heartAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1, 0],
                  }),
                },
              ]}>
              <Icon name="favorite" size={100} color="#ff3040" />
            </Animated.View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Gradient Overlays */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />

      {/* Content Info */}
      <View style={styles.contentInfo}>
        <Text style={styles.description} numberOfLines={2}>
          {reel.caption || 'Amazing reel! 🔥'}
        </Text>
        
        <View style={styles.statsContainer}>
          <Text style={styles.statText}>
            {formatCount(reel.views || 0)} views • {reel.timeAgo}
          </Text>
        </View>

        {/* User Info - Moved to Bottom */}
        <View style={styles.userInfoBottom}>
          <TouchableOpacity
            style={styles.userAvatar}
            onPress={() => onUserProfilePress(reel.user?.id || '')}
            onLongPress={() => onViewUserStory(reel.user?.id || '')}>
            <Image
              source={{ uri: reel.user?.profilePicture || 'https://via.placeholder.com/40' }}
              style={styles.avatarImage}
            />
          </TouchableOpacity>
          
          <View style={styles.userDetails}>
            <TouchableOpacity onPress={() => onUserProfilePress(reel.user?.id || '')}>
              <Text style={styles.username}>@{reel.user?.username}</Text>
            </TouchableOpacity>
            {reel.user?.verified && (
              <Icon name="verified" size={16} color="#1DA1F2" style={styles.verifiedIcon} />
            )}
          </View>

          {reel.user?.id !== currentUserId && (
            <TouchableOpacity 
              style={[
                styles.followButton,
                following ? styles.followingButton : styles.notFollowingButton
              ]}
              onPress={handleFollowPress}>
              <Text style={[
                styles.followButtonText,
                following ? styles.followingText : styles.notFollowingText
              ]}>
                {following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Enhanced Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Like Button with Animation */}
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleLikePress}
          activeOpacity={0.7}>
          <Icon
            name={liked ? "favorite" : "favorite-border"}
            size={32}
            color={liked ? "#ff3040" : "#fff"}
          />
          <Text style={styles.actionText}>{formatCount((reel.likesCount || 0) + (liked ? 1 : 0))}</Text>
        </TouchableOpacity>

        {/* Comment Button */}
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => onComment(reel)}
          activeOpacity={0.7}>
          <IconIonic name="chatbubble-outline" size={30} color="#fff" />
          <Text style={styles.actionText}>{formatCount(reel.commentsCount || 0)}</Text>
        </TouchableOpacity>

        {/* External Share Button */}
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => onShare(reel)}
          activeOpacity={0.7}>
          <IconIonic name="paper-plane-outline" size={30} color="#fff" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>

        {/* In-App Share Button (Airplane Style) */}
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => onInAppShare(reel)}
          activeOpacity={0.7}>
          <Icon name="send" size={30} color="#1DA1F2" />
          <Text style={styles.actionText}>Send</Text>
        </TouchableOpacity>

        {/* Save Button */}
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleSavePress}
          activeOpacity={0.7}>
          <Icon
            name={saved ? "bookmark" : "bookmark-border"}
            size={30}
            color={saved ? "#ffd700" : "#fff"}
          />
        </TouchableOpacity>

        {/* More Options */}
        <TouchableOpacity 
          style={styles.actionButton} 
          activeOpacity={0.7}>
          <Icon name="more-vert" size={30} color="#fff" />
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
  const { colors } = useTheme();
  const navigation = useNavigation();
  
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(false); // Changed to false for instant loading
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedReelForShare, setSelectedReelForShare] = useState<Reel | null>(null);
  const [appState, setAppState] = useState(AppState.currentState);
  const [backgroundTime, setBackgroundTime] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const backgroundTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle app state changes for background timeout feature
  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App came back to foreground
        const now = Date.now();
        if (backgroundTime && (now - backgroundTime) > BACKGROUND_TIMEOUT) {
          // More than 5 seconds in background - refresh reels
          console.log('App returned after 5+ seconds, refreshing reels');
          loadReels(true);
        } else {
          // Less than 5 seconds - resume current reel
          console.log('App returned within 5 seconds, resuming');
          setIsPaused(false);
        }
        setBackgroundTime(null);
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background
        setBackgroundTime(Date.now());
        setIsPaused(true);
      }
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [appState, backgroundTime]);

  // Handle screen focus for proper video management
  useFocusEffect(
    useCallback(() => {
      // Screen is focused
      setIsPaused(false);
      
      return () => {
        // Screen is unfocused - pause all videos
        setIsPaused(true);
      };
    }, [])
  );

  // Load reels on mount with instant loading
  useEffect(() => {
    loadReels();
  }, []);

  // Enhanced reel loading with INSTANT loading (no loading states)
  const loadReels = useCallback(async (isRefresh = false, loadMore = false) => {
    try {
      // NO loading states for instant experience
      const limit = isRefresh || !loadMore ? INITIAL_LOAD_COUNT : BATCH_SIZE;
      const excludeUserId = user?.uid;
      
      // Use recommendation algorithm for personalized content
      const fetchedReels = await FirebaseService.getRecommendedReels(user?.uid, limit * 3);
      
      // Filter out user's own reels
      const filteredReels = fetchedReels.filter(reel => reel.userId !== excludeUserId);
      
      // Take only the requested number of reels
      const finalReels = filteredReels.slice(0, limit);
      
      if (finalReels.length === 0) {
        setHasMore(false);
        if (isRefresh || (!loadMore && reels.length === 0)) {
          setError('No reels available');
        }
        return;
      }

      if (isRefresh) {
        setReels(finalReels);
        setCurrentIndex(0);
        setHasMore(filteredReels.length >= limit);
      } else if (loadMore) {
        // For load more, get next batch from recommendation algorithm
        const currentReelIds = new Set(reels.map(r => r.id));
        const newReels = finalReels.filter(reel => !currentReelIds.has(reel.id));
        
        setReels(prev => [...prev, ...newReels]);
        setHasMore(newReels.length >= Math.floor(limit * 0.7));
      } else {
        setReels(finalReels);
        setHasMore(filteredReels.length >= limit);
      }

    } catch (error) {
      console.error('Error loading reels:', error);
      const errorMessage = 'Failed to load reels. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [user?.uid, reels.length]);

  // Load more when reaching end
  const loadMoreReels = useCallback(() => {
    if (hasMore && !loadingMore && reels.length >= PRELOAD_THRESHOLD) {
      loadReels(false, true);
    }
  }, [hasMore, loadingMore, loadReels, reels.length]);

  const refreshReels = useCallback(() => {
    loadReels(true);
  }, [loadReels]);

  // Handle like
  const handleLike = useCallback(async (reelId: string) => {
    try {
      // Optimistic update
      setReels(prev => prev.map(reel => 
        reel.id === reelId 
          ? { ...reel, likesCount: (reel.likesCount || 0) + 1, isLiked: !reel.isLiked }
          : reel
      ));

      await FirebaseService.likeReel(reelId, user?.uid || '');
    } catch (error) {
      console.error('Error liking reel:', error);
    }
  }, [user?.uid]);

  // Handle save
  const handleSave = useCallback(async (reelId: string) => {
    try {
      await FirebaseService.saveReel(reelId, user?.uid || '');
    } catch (error) {
      console.error('Error saving reel:', error);
    }
  }, [user?.uid]);

  // Handle follow
  const handleFollow = useCallback(async (userId: string) => {
    try {
      // Optimistic update
      setReels(prev => prev.map(reel => 
        reel.userId === userId 
          ? { ...reel, user: { ...reel.user!, isFollowing: !reel.user?.isFollowing } }
          : reel
      ));

      await FirebaseService.followUser(user?.uid || '', userId);
    } catch (error) {
      console.error('Error following user:', error);
    }
  }, [user?.uid]);

  // Handle share
  const handleShare = useCallback(async (reel: Reel) => {
    try {
      const shareOptions = {
        title: 'Check out this amazing reel!',
        message: `${reel.caption || 'Amazing reel!'}\n\nWatch on Jorvea App`,
        url: reel.videoUrl,
      };
      await Share.share(shareOptions);
    } catch (error) {
      console.error('Error sharing reel:', error);
    }
  }, []);

  // Handle in-app share
  const handleInAppShare = useCallback((reel: Reel) => {
    setSelectedReelForShare(reel);
    setShowShareModal(true);
  }, []);

  // Handle comment
  const handleComment = useCallback((reel: Reel) => {
    (navigation as any).navigate('Comments', { contentId: reel.id, contentType: 'reel' });
  }, [navigation]);

  // Handle view count update
  const handleViewCountUpdate = useCallback(async (reelId: string) => {
    try {
      await FirebaseService.incrementReelViews(reelId);
      // Update local state
      setReels(prev => prev.map(reel => 
        reel.id === reelId 
          ? { ...reel, viewsCount: (reel.viewsCount || 0) + 1 }
          : reel
      ));
    } catch (error) {
      console.error('Error updating view count:', error);
    }
  }, []);

  // Handle user profile press
  const handleUserProfilePress = useCallback((userId: string) => {
    if (userId) {
      (navigation as any).navigate('UserProfile', { userId });
    }
  }, [navigation]);

  // Handle view user story
  const handleViewUserStory = useCallback(async (userId: string) => {
    if (!userId) return;
    
    try {
      // Check if user has active stories
      const userStories = await FirebaseService.getUserStories(userId);
      
      if (userStories.length > 0) {
        (navigation as any).navigate('StoryViewer', { 
          userStories, 
          initialIndex: 0
        });
      } else {
        Alert.alert('No Stories', "This user doesn't have any active stories.");
      }
    } catch (error) {
      console.error('Error loading user stories:', error);
      Alert.alert('Error', 'Failed to load stories');
    }
  }, [navigation]);

  // Handle scroll for current index
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }, []);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 80,
  };

  const renderItem = useCallback(({ item, index }: { item: Reel; index: number }) => (
    <OptimizedReelItem
      reel={item}
      isActive={index === currentIndex}
      currentUserId={user?.uid || ''}
      isPaused={isPaused}
      onLike={handleLike}
      onShare={handleShare}
      onInAppShare={handleInAppShare}
      onComment={handleComment}
      onFollow={handleFollow}
      onSave={handleSave}
      onViewCountUpdate={handleViewCountUpdate}
      onUserProfilePress={handleUserProfilePress}
      onViewUserStory={handleViewUserStory}
      navigation={navigation}
    />
  ), [currentIndex, user?.uid, isPaused, handleLike, handleShare, handleInAppShare, handleComment, handleFollow, handleSave, handleViewCountUpdate, handleUserProfilePress, handleViewUserStory, navigation]);

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  };

  if (error && reels.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={64} color="rgba(255,255,255,0.7)" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadReels()}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        onEndReached={loadMoreReels}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshReels}
            tintColor="#fff"
            colors={['#fff']}
          />
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={2}
        maxToRenderPerBatch={3}
        windowSize={5}
        getItemLayout={(data, index) => ({
          length: REEL_HEIGHT,
          offset: REEL_HEIGHT * index,
          index,
        })}
        style={styles.flatList}
      />

      <ShareReelModal
        visible={showShareModal}
        reel={selectedReelForShare}
        onClose={() => {
          setShowShareModal(false);
          setSelectedReelForShare(null);
        }}
      />
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
  heartAnimation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -50,
    marginLeft: -50,
    zIndex: 1000,
  },
  actionsContainer: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 8,
  },
  contentInfo: {
    position: 'absolute',
    bottom: 50,
    left: 16,
    right: 80,
    maxHeight: 200,
  },
  description: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  statsContainer: {
    marginBottom: 12,
  },
  statText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  userInfo: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 80,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userInfoBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
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
  followingButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  notFollowingButton: {
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
  followingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  notFollowingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  videoControlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playPauseIndicator: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 40,
    padding: 20,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff3040',
    borderRadius: 2,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  muteButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 20,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#ff3040',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ReelsScreen;
