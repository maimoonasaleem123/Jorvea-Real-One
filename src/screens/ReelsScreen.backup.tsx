import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Clipboard,
} from 'react-native';
import type { AppStateStatus } from 'react-native';
import { PanGestureHandler, TapGestureHandler, State } from 'react-native-gesture-handler';
import Video, { VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconIonic from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import { InstagramLikeButton } from '../components/InstagramLikeButton';
import { EnhancedDoubleTapLike } from '../components/EnhancedDoubleTapLike';
import FirebaseService, { Reel } from '../services/firebaseService';
import SaveButton from '../components/SaveButton';
import { BeautifulCard } from '../components/BeautifulCard';
import { CommentsScreen } from '../components/CommentsScreen';
import { ReelsEnhancements } from '../components/ReelsEnhancements';
import { ShareSheet } from '../components/ShareSheet';
import { InstagramShareModal } from '../components/InstagramShareModal';
import VideoPlayer from '../components/VideoPlayer';

const { width, height } = Dimensions.get('window');
const REEL_HEIGHT = height;
const isTablet = width > 768;

interface ReelItemProps {
  reel: Reel;
  isActive: boolean;
  currentUserId: string;
  onLike: (reelId: string) => void;
  onShare: (reel: Reel) => void;
  onComment: (reel: Reel) => void;
  onFollow: (userId: string) => void;
  onSave: (reelId: string) => void;
  navigation: any;
}

const ReelItem: React.FC<ReelItemProps> = ({
  reel,
  isActive,
  currentUserId,
  onLike,
  onShare,
  onComment,
  onFollow,
  onSave,
  navigation,
}) => {
  const [paused, setPaused] = useState(!isActive);
  const [muted, setMuted] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [liked, setLiked] = useState(reel.isLiked || false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [viewCount, setViewCount] = useState(reel.viewsCount || 0);
  const [hasViewed, setHasViewed] = useState(false);
  const [seeking, setSeeking] = useState(false);
  
  const videoRef = useRef<VideoRef>(null);
  const singleTapGestureRef = useRef(null);
  const doubleTapGestureRef = useRef(null);
  const heartAnimation = useRef<Animated.Value>(new Animated.Value(0)).current;
  const controlsTimer = useRef<any>(null);
  const progressAnim = useRef<Animated.Value>(new Animated.Value(0)).current;
  const scaleAnim = useRef<Animated.Value>(new Animated.Value(1)).current;
  const pauseIconAnim = useRef<Animated.Value>(new Animated.Value(0)).current;

  // Update pause state when isActive changes
  useEffect(() => {
    setPaused(!isActive);
    
    // Track view when reel becomes active and hasn't been viewed yet
    if (isActive && !hasViewed) {
      const viewTimer = setTimeout(() => {
        handleViewCount();
        setHasViewed(true);
      }, 3000); // Count as viewed after 3 seconds

      return () => clearTimeout(viewTimer);
    }
  }, [isActive, hasViewed]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (controlsTimer.current) {
        clearTimeout(controlsTimer.current);
      }
    };
  }, []);

  const handleViewCount = async () => {
    try {
      await FirebaseService.incrementReelViews(reel.id);
      setViewCount(prev => prev + 1);
    } catch (error) {
      console.error('Error incrementing view count:', error);
    }
  };

  const handleVideoLoad = (data: any) => {
    setVideoLoading(false);
    setDuration(data.duration);
  };

  const handleVideoError = (error: any) => {
    console.error('Video error:', error);
    setVideoLoading(false);
  };

  // Enhanced double tap to like functionality
  const handleDoubleTap = () => {
    if (!liked) {
      setLiked(true);
      onLike(reel.id);
      
      // Heart animation
      Animated.sequence([
        Animated.timing(heartAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(heartAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Haptic feedback
      Vibration.vibrate(50);
    }
  };

  // Enhanced single tap with pause icon animation
  const handleSingleTap = () => {
    const newPausedState = !paused;
    setPaused(newPausedState);
    
    // Animate pause icon
    if (newPausedState) {
      Animated.sequence([
        Animated.timing(pauseIconAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pauseIconAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
    
    setShowControls(true);
    
    // Hide controls after 3 seconds
    if (controlsTimer.current) {
      clearTimeout(controlsTimer.current);
    }
    controlsTimer.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  // Enhanced progress tracking
  const handleProgress = (data: any) => {
    if (!seeking) {
      const progressPercent = data.currentTime / data.seekableDuration;
      setProgress(progressPercent);
      setCurrentTime(data.currentTime);
      
      Animated.timing(progressAnim, {
        toValue: progressPercent,
        duration: 100,
        useNativeDriver: false,
      }).start();
    }
  };

  // Save functionality
  const handleSave = () => {
    setSaved(!saved);
    onSave(reel.id);
    Vibration.vibrate(30);
  };

  const togglePlayPause = () => {
    setPaused(!paused);
  };

  const toggleMute = () => {
    setMuted(!muted);
  };

  const handleFollow = () => {
    setFollowing(!following);
    onFollow(reel.userId);
    Vibration.vibrate(50);
  };

  const handleComment = () => {
    setShowComments(true);
    onComment(reel);
  };

  const handleShare = () => {
    setShowShareMenu(true);
    onShare(reel);
  };

  const navigateToProfile = () => {
    navigation.navigate('UserProfile', { userId: reel.userId });
  };

  // Enhanced seek functionality
  const seekToPosition = (position: number) => {
    if (videoRef.current && duration > 0) {
      setSeeking(true);
      const seekTime = position * duration;
      videoRef.current.seek(seekTime);
      setCurrentTime(seekTime);
      setProgress(position);
      
      // Reset seeking state after a delay
      setTimeout(() => setSeeking(false), 500);
    }
  };

  const formatTime = (timeInSeconds: number): string => {
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViewCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M views`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K views`;
    }
    return `${count} views`;
  };

  return (
    <View style={styles.reelContainer}>
      {/* Enhanced Double Tap Like with Video Controls */}
      <EnhancedDoubleTapLike
        contentId={reel.id}
        contentType="reel"
        onSingleTap={handleSingleTap}
        onDoubleTap={handleDoubleTap}
        style={styles.videoContainer}
      >
        <Animated.View style={styles.videoContainer}>
          <VideoPlayer
            source={{ uri: reel.videoUrl }}
            style={styles.video}
            resizeMode="cover"
            paused={paused}
            muted={muted}
            repeat={true}
            onLoad={handleVideoLoad}
            onProgress={handleProgress}
            showControls={true}
          />
            
            {/* Loading indicator */}
            {videoLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}

            {/* Pause icon animation */}
            <Animated.View
              style={[
                styles.pauseIconContainer,
                {
                  opacity: pauseIconAnim,
                  transform: [{ scale: pauseIconAnim }],
                }
              ]}
            >
              <View style={styles.pauseIconBackground}>
                <Icon name="pause" size={80} color="rgba(255,255,255,1)" />
              </View>
            </Animated.View>

            {/* Heart animation for likes */}
            <Animated.View
              style={[
                styles.heartContainer,
                {
                  opacity: heartAnimation,
                  transform: [
                    {
                      scale: heartAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 1.2],
                      }),
                    },
                  ],
                }
              ]}
            >
              <Icon name="favorite" size={80} color="#ff3040" />
            </Animated.View>

            {/* Enhanced video controls overlay */}
            {showControls && (
              <View style={styles.videoControlsOverlay}>
                {/* Time display */}
                <View style={styles.timeContainer}>
                  <Text style={styles.timeText}>
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </Text>
                </View>

                {/* Center play/pause button */}
                <TouchableOpacity
                  style={styles.centerPlayButton}
                  onPress={handleSingleTap}
                  activeOpacity={0.7}
                >
                  <View style={styles.centerControlButton}>
                    <Icon
                      name={paused ? "play-arrow" : "pause"}
                      size={40}
                      color="#fff"
                    />
                  </View>
                </TouchableOpacity>

                {/* Mute button */}
                <TouchableOpacity
                  style={styles.muteButton}
                  onPress={toggleMute}
                  activeOpacity={0.7}
                >
                  <View style={styles.controlButton}>
                    <Icon
                      name={muted ? "volume-off" : "volume-up"}
                      size={24}
                      color="#fff"
                    />
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </EnhancedDoubleTapLike>

      {/* Enhanced Reels Features */}
      <ReelsEnhancements
        videoId={reel.id}
        userId={reel.userId}
        onLike={() => onLike(reel.id)}
        onComment={() => onComment(reel)}
        onShare={() => onShare(reel)}
        onSave={handleSave}
        onFollow={() => onFollow(reel.user!.uid)}
        isLiked={reel.isLiked || false}
        isSaved={saved}
        isFollowing={following}
        likesCount={reel.likesCount || 0}
        commentsCount={reel.commentsCount || 0}
        userName={reel.user?.username || reel.user?.displayName || 'User'}
        description={reel.caption}
        audioName={reel.music?.title || 'Original Audio'}
      />

      {/* Enhanced Progress Bar */}
      <View style={styles.progressContainer}>
        <TouchableOpacity 
          style={styles.progressBarTouch}
          onPress={(e) => {
            const touchX = e.nativeEvent.locationX;
            const progressBarWidth = width - 40;
            const position = touchX / progressBarWidth;
            seekToPosition(position);
          }}
        >
          <View style={styles.progressBar}>
            <Animated.View 
              style={[
                styles.progressFill, 
                { 
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  })
                }
              ]} 
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* Bottom content */}
      <View style={styles.bottomContent}>
        {/* User info */}
        <View style={styles.userInfo}>
          <TouchableOpacity 
            onPress={() => {
              if (reel.userId && reel.userId !== currentUserId) {
                navigation.navigate('UserProfile', { 
                  userId: reel.userId, 
                  user: reel.user 
                });
              }
            }}
          >
            <Text style={styles.username}>@{reel.user?.username || reel.user?.displayName}</Text>
          </TouchableOpacity>
          <Text style={styles.caption}>{reel.caption}</Text>
          
          {/* Hashtags */}
          {reel.hashtags && reel.hashtags.length > 0 && (
            <View style={styles.hashtagsContainer}>
              {reel.hashtags.map((hashtag, index) => (
                <Text key={index} style={styles.hashtag}>
                  #{hashtag}
                </Text>
              ))}
            </View>
          )}

          {/* Music info */}
          {reel.music && (
            <View style={styles.musicContainer}>
              <Icon name="music-note" size={16} color="#fff" />
              <Text style={styles.musicText}>
                {reel.music.title} - {reel.music.artist}
              </Text>
            </View>
          )}
        </View>

        {/* Sound toggle */}
        <TouchableOpacity
          style={styles.soundToggle}
          onPress={toggleMute}
        >
          <Icon
            name={muted ? "volume-off" : "volume-up"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ReelsScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lastReelId, setLastReelId] = useState<string>();
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [appState, setAppState] = useState(AppState.currentState);
  const flatListRef = useRef<FlatList>(null);

  // Comments modal state
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [selectedReelForComments, setSelectedReelForComments] = useState<Reel | null>(null);
  
  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedReelForShare, setSelectedReelForShare] = useState<Reel | null>(null);

  // Enhanced load reels with proper refresh mechanism
  const loadReels = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
        setLastReelId(undefined);
      }

      // Use the new Instagram-like recommendation system
      const newReels = await FirebaseService.getRecommendedReels(user?.uid, 20);

      if (refresh) {
        setReels(newReels);
        setCurrentIndex(0); // Reset to first reel on refresh
      } else {
        setReels(prev => [...prev, ...newReels]);
      }

      if (newReels.length > 0) {
        setLastReelId(newReels[newReels.length - 1].id);
      }
    } catch (error) {
      console.error('Error loading reels:', error);
      Alert.alert('Error', 'Failed to load reels. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid, lastReelId]);

  useEffect(() => {
    loadReels(true);
  }, []);

  // Handle app state changes (pause videos when app goes to background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Handle back button (exit reels screen)
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });

    return () => backHandler.remove();
  }, [navigation]);

  // Enhanced focus effect with proper video pause/resume
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      
      return () => {
        setIsScreenFocused(false);
        // Pause all videos when screen loses focus
        setReels(prev => prev.map(reel => ({ ...reel, paused: true })));
      };
    }, [])
  );

  const handleLike = async (reelId: string) => {
    if (!user) return;

    try {
      const result = await FirebaseService.likeReel(reelId, user.uid);
      
      // Update local state with the actual result from Firebase
      setReels(prev =>
        prev.map(reel =>
          reel.id === reelId
            ? {
                ...reel,
                isLiked: result.isLiked,
                likesCount: result.likesCount,
              }
            : reel
        )
      );
    } catch (error) {
      console.error('Error liking reel:', error);
      Alert.alert('Error', 'Failed to like reel. Please try again.');
    }
  };

  const handleFollow = async (userId: string) => {
    if (!user) return;

    try {
      const isFollowing = await FirebaseService.checkIfFollowing(user.uid, userId);
      
      if (isFollowing) {
        await FirebaseService.unfollowUser(user.uid, userId);
      } else {
        await FirebaseService.followUser(user.uid, userId);
      }

      // Refresh reels to update follow status
      loadReels(true);
    } catch (error) {
      console.error('Error following/unfollowing user:', error);
    }
  };

  const handleShare = async (reel: Reel) => {
    setSelectedReelForShare(reel);
    setShowShareModal(true);
  };

  const shareToExternalApp = async (reel: Reel) => {
    try {
      const shareOptions = {
        title: 'Check out this reel!',
        message: `Check out this amazing reel by ${reel.user?.displayName || 'Anonymous'}: ${reel.caption || 'No caption'}`,
        url: reel.videoUrl,
      };

      const result = await Share.share(shareOptions);
      
      if (result.action === Share.sharedAction) {
        // Increment shares count in Firebase
        await FirebaseService.incrementReelShares(reel.id);
        
        // Update local state
        setReels(prev => 
          prev.map(r => 
            r.id === reel.id 
              ? { ...r, sharesCount: (r.sharesCount || 0) + 1 }
              : r
          )
        );
      }
    } catch (error) {
      console.error('Error sharing reel:', error);
      Alert.alert('Error', 'Failed to share reel. Please try again.');
    }
  };

  const shareToJorveaChat = (reel: Reel) => {
    // Navigate to chat list with reel data to share
    try {
      (navigation as any).navigate('ChatList', { 
        shareContent: {
          type: 'reel',
          id: reel.id,
          videoUrl: reel.videoUrl,
          caption: reel.caption,
          userName: reel.user?.displayName || 'Anonymous',
          userProfilePicture: reel.user?.profilePicture,
          thumbnailUrl: reel.thumbnailUrl
        }
      });
      setShowShareModal(false);
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Share', 'Unable to open chat. Please try again.');
      setShowShareModal(false);
    }
  };

  const handleComment = (reel: Reel) => {
    setSelectedReelForComments(reel);
    setShowCommentsModal(true);
  };

  const handleSave = async (reelId: string) => {
    if (!user) return;

    try {
      const result = await FirebaseService.saveReel(reelId, user.uid);
      
      // Update local state
      setReels(prev =>
        prev.map(reel =>
          reel.id === reelId
            ? { ...reel, isSaved: result.isSaved }
            : reel
        )
      );
    } catch (error) {
      console.error('Error saving reel:', error);
      Alert.alert('Error', 'Failed to save reel. Please try again.');
    }
  };

  // Enhanced viewable items changed with proper video control
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && isScreenFocused && appState === 'active') {
      const newIndex = viewableItems[0].index;
      setCurrentIndex(newIndex);
      
      // Pause all videos except the current one
      setReels(prev => prev.map((reel, index) => ({
        ...reel,
        paused: index !== newIndex
      })));
    }
  }, [isScreenFocused, appState]);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  const renderReel = ({ item, index }: { item: Reel; index: number }) => (
    <ReelItem
      reel={item}
      isActive={index === currentIndex && isScreenFocused && appState === 'active'}
      currentUserId={user?.uid || ''}
      onLike={handleLike}
      onShare={handleShare}
      onComment={handleComment}
      onSave={handleSave}
      onFollow={handleFollow}
      navigation={navigation}
    />
  );

  const handleEndReached = () => {
    if (!loading && !refreshing) {
      loadReels(false);
    }
  };

  // Enhanced refresh with haptic feedback
  const handleRefresh = () => {
    Vibration.vibrate(50);
    loadReels(true);
  };

  const { colors, isDarkMode } = useTheme();

  if (loading && reels.length === 0) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading reels...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent"
        translucent
        hidden={false}
      />

      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderReel}
        keyExtractor={(item, index) => `${item.id}_${index}`}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={REEL_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        ListFooterComponent={
          loading ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.loadingText}>Loading more reels...</Text>
            </View>
          ) : null
        }
      />
      
      {/* Comments Modal */}
      {showCommentsModal && selectedReelForComments && (
        <CommentsScreen
          reelId={selectedReelForComments.id}
          contentType="reel"
          visible={showCommentsModal}
          onClose={() => {
            setShowCommentsModal(false);
            setSelectedReelForComments(null);
          }}
        />
      )}
      
      {/* Instagram Share Modal */}
      {selectedReelForShare && (
        <InstagramShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          content={{
            type: 'reel',
            id: selectedReelForShare.id,
            url: `https://jorvea.app/reels/${selectedReelForShare.id}`,
            text: selectedReelForShare.caption,
            title: `Reel by @${selectedReelForShare.user?.username || selectedReelForShare.user?.displayName}`,
            mediaUrl: selectedReelForShare.videoUrl,
            userName: selectedReelForShare.user?.displayName || selectedReelForShare.user?.username,
            userProfilePicture: selectedReelForShare.user?.profilePicture,
          }}
          onSave={() => {
            loadReels(true); // Refresh to update save status
          }}
        />
      )}
      
      {/* Floating Action Button for Create Reel */}
      <TouchableOpacity
        style={styles.createReelButton}
        onPress={() => navigation.navigate('CreateReel' as never)}
        activeOpacity={0.8}
      >
        <Icon name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 16,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  reelContainer: {
    width,
    height: REEL_HEIGHT,
    position: 'relative',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
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
  // Enhanced pause icon
  pauseIconContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: 100,
  },
  pauseIconBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  // Heart animation container
  heartContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  // Enhanced video controls
  videoControlsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  timeContainer: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  centerPlayButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
    zIndex: 1000,
  },
  centerControlButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  muteButton: {
    position: 'absolute',
    top: 60,
    right: 20,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightActions: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    alignItems: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  followButton: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF3040',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionItem: {
    alignItems: 'center',
    marginBottom: 20,
  },
  actionCount: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 80,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  userInfo: {
    marginBottom: 8,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  hashtagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  hashtag: {
    color: '#fff',
    fontSize: 14,
    marginRight: 8,
    fontWeight: '500',
  },
  musicContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  musicText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    opacity: 0.8,
  },
  soundToggle: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewCount: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    height: 20,
    justifyContent: 'center',
  },
  progressBarTouch: {
    height: 20,
    justifyContent: 'center',
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 1.5,
  },
  playPauseButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  createReelButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
});

export default ReelsScreen;
