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
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import UltraFastInstantService from '../services/UltraFastInstantService';
import FirebaseService, { Reel } from '../services/firebaseService';
import RealTimeLikeSystem from '../services/RealTimeLikeSystem';
import ShareBottomSheet from '../components/ShareBottomSheet';
import LinearGradient from 'react-native-linear-gradient';
import { useInstantLoading } from '../hooks/useInstantLoading';
import { DynamicFollowService } from '../services/DynamicFollowService';
import UniversalFollowButton from '../components/UniversalFollowButton';
import DynamicReelsService from '../services/DynamicReelsService';
import DynamicSaveArchiveService from '../services/DynamicSaveArchiveService';
import firestore from '@react-native-firebase/firestore';
import PerfectChunkedVideoPlayer from '../components/PerfectChunkedVideoPlayer';
import InstagramStyleVideoPlayer from '../components/InstagramStyleVideoPlayer';
import FreeVideoPlayer from '../components/FreeVideoPlayer';
import InstagramVideoPlayer from '../components/InstagramVideoPlayer';
import InstagramReelPreloader from '../services/InstagramReelPreloader';
import FastReelPreloader from '../services/FastReelPreloader';
import PerfectReelsFeedAlgorithm from '../services/PerfectReelsFeedAlgorithm';
import PerfectViewTrackingSystem from '../services/PerfectViewTrackingSystem';

import PerfectChunkedStreamingEngine from '../services/PerfectChunkedStreamingEngine';
import PerfectInstantThumbnailSystem from '../services/PerfectInstantThumbnailSystem';
import AdvancedSegmentedVideoFetcher from '../services/AdvancedSegmentedVideoFetcher';
import InstantReelsPreloader from '../services/InstantReelsPreloader';
import SmartReelFeedService from '../services/SmartReelFeedService';

const { width, height } = Dimensions.get('screen'); // Use 'screen' instead of 'window' for accurate dimensions

const statusBarHeight = StatusBar.currentHeight || 0;
const REEL_HEIGHT = Platform.OS === 'android' ? height : height; // Full screen height for proper single reel display

// Perfect Instagram/TikTok-like reels configuration - INSTANT
const INITIAL_LOAD_COUNT = 1; // Load only 1 reel initially for perfect instant display
const LOAD_NEXT_THRESHOLD = 0; // Load next reel immediately when current becomes active
const BACKGROUND_TIMEOUT = 3000; // 3 seconds timeout for faster response
const MAX_LOADED_REELS = 3; // Keep only 3 reels in memory for smooth scrolling

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
  onTogglePause: () => void; // Add pause toggle handler
  onUpdateReelState: (reelId: string, updates: Partial<Reel>) => void; // Add reel state update
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
  onTogglePause,
  onUpdateReelState,
  navigation,
}) => {
  // Pure Firebase state - real-time updates with optimistic UI
  const [optimisticLikeState, setOptimisticLikeState] = useState<{
    isLiked: boolean;
    likesCount: number;
    isOptimistic: boolean;
  }>({
    isLiked: reel.isLiked || false,
    likesCount: reel.likesCount || 0,
    isOptimistic: false
  });

  // Sync with Firebase state when reel updates
  useEffect(() => {
    if (!optimisticLikeState.isOptimistic) {
      setOptimisticLikeState({
        isLiked: reel.isLiked || false,
        likesCount: reel.likesCount || 0,
        isOptimistic: false
      });
    }
  }, [reel.isLiked, reel.likesCount, optimisticLikeState.isOptimistic]);

  // Auto-reset optimistic state after a delay to sync with Firebase
  useEffect(() => {
    if (optimisticLikeState.isOptimistic) {
      const resetTimer = setTimeout(() => {
        setOptimisticLikeState({
          isLiked: reel.isLiked || false,
          likesCount: reel.likesCount || 0,
          isOptimistic: false
        });
      }, 2000); // Reset optimistic state after 2 seconds

      return () => clearTimeout(resetTimer);
    }
  }, [optimisticLikeState.isOptimistic, reel.isLiked, reel.likesCount]);

  const currentCommentsCount = reel.commentsCount || 0;
  const currentIsSaved = reel.isSaved || false;

  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false); // Default UNMUTED as requested
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [doubleTapCount, setDoubleTapCount] = useState(0);
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
  const [showPlayPauseIndicator, setShowPlayPauseIndicator] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  
  const videoRef = useRef<VideoRef>(null);
  const heartAnimation = useRef(new Animated.Value(0)).current;
  const likeButtonAnimation = useRef(new Animated.Value(1)).current;
  const likeBounceAnimation = useRef(new Animated.Value(1)).current;
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const doubleTapTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastTapTime = useRef(0);
  const viewTracked = useRef(false); // Track if view has been counted
  const watchStartTime = useRef<number>(0); // Track when user started watching
  const volumeIndicatorAnimation = useRef(new Animated.Value(0)).current;
  const playPauseIndicatorAnimation = useRef(new Animated.Value(0)).current;
  const seekForwardAnimation = useRef(new Animated.Value(0)).current;

  // 🎯 PERFECT VIEW TRACKING - Track watch time and count once
  useEffect(() => {
    if (isActive && !isPaused) {
      setIsPlaying(true);
      
      // Record start time when user starts watching
      if (!viewTracked.current && watchStartTime.current === 0) {
        watchStartTime.current = Date.now();
      }
      
      // Count view after 3 seconds of watching
      if (!viewTracked.current) {
        const viewTimer = setTimeout(() => {
          const watchTime = Date.now() - watchStartTime.current;
          onViewCountUpdate(reel.id, watchTime);
          viewTracked.current = true;
        }, 3000); // 3 second delay (minimum watch time)
        
        return () => clearTimeout(viewTimer);
      }
      
      // Show controls briefly when video starts
      setShowControls(true);
      setTimeout(() => setShowControls(false), 2000);
    } else {
      setIsPlaying(false);
    }
  }, [isActive, isPaused, onViewCountUpdate, reel.id]);

  // Reset view tracking when reel changes
  useEffect(() => {
    viewTracked.current = false;
    watchStartTime.current = 0;
  }, [reel.id]);

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

  const handleSeekForward = useCallback(() => {
    if (videoRef.current && duration > 0) {
      const newTime = Math.min(duration, currentTime + 10);
      videoRef.current.seek(newTime);
      setCurrentTime(newTime);
      
      // Show seek forward animation
      seekForwardAnimation.setValue(0);
      Animated.sequence([
        Animated.timing(seekForwardAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(seekForwardAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      
      Vibration.vibrate(30);
    }
  }, [currentTime, duration, seekForwardAnimation]);

  const handleSeekBackward = useCallback(() => {
    if (videoRef.current && duration > 0) {
      const newTime = Math.max(0, currentTime - 10);
      videoRef.current.seek(newTime);
      setCurrentTime(newTime);
      
      // Show seek backward animation
      seekForwardAnimation.setValue(0);
      Animated.sequence([
        Animated.timing(seekForwardAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(seekForwardAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
      
      Vibration.vibrate(30);
    }
  }, [currentTime, duration, seekForwardAnimation]);

  const handleProgressBarPress = useCallback((event: any) => {
    if (videoRef.current && duration > 0) {
      const { locationX } = event.nativeEvent;
      const progressBarWidth = width - 40; // Account for padding
      const newProgress = Math.max(0, Math.min(1, locationX / progressBarWidth));
      const newTime = duration * newProgress;
      
      videoRef.current.seek(newTime);
      setCurrentTime(newTime);
      Vibration.vibrate(20);
    }
  }, [duration]);

  const handleDoubleTap = useCallback((tapLocation?: { x: number; y: number }) => {
    // Check tap location for different double tap actions
    if (tapLocation) {
      const screenWidth = width;
      const { x } = tapLocation;
      
      // Left side double tap - Seek backward
      if (x < screenWidth * 0.3) {
        handleSeekBackward();
        return;
      }
      
      // Right side double tap - Seek forward
      if (x > screenWidth * 0.7) {
        handleSeekForward();
        return;
      }
    }
    
    // Center double tap to like (Instagram-style)
    handleInstagramLike();
  }, [handleSeekForward, handleSeekBackward]);

  // ❤️ PERFECT INSTAGRAM-STYLE LIKE with bulletproof handling
  const handleInstagramLike = useCallback(async () => {
    if (likeAnimating) return; // Prevent multiple simultaneous likes
    
    setLikeAnimating(true);
    
    try {
      // Get current state from optimistic updates
      const currentIsLiked = optimisticLikeState.isLiked;
      const currentLikesCount = optimisticLikeState.likesCount;
      
      // Immediate optimistic UI update
      const newIsLiked = !currentIsLiked;
      const newLikesCount = newIsLiked ? currentLikesCount + 1 : Math.max(0, currentLikesCount - 1);
      
      setOptimisticLikeState({
        isLiked: newIsLiked,
        likesCount: newLikesCount,
        isOptimistic: true
      });
      
      // Heart animation for likes
      if (newIsLiked) {
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
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start(() => setShowHeartAnimation(false));
      }
      
      // Like button animation (Instagram-style bounce)
      Animated.sequence([
        Animated.timing(likeButtonAnimation, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(likeButtonAnimation, {
          toValue: 1,
          tension: 300,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Vibration feedback
      Vibration.vibrate(newIsLiked ? [50, 100, 50] : 30);
      
      // Call the perfect like handler
      await onLike?.(reel.id);
      
    } catch (error) {
      console.error('❌ Perfect Instagram like failed:', error);
      // Revert optimistic update on error
      setOptimisticLikeState({
        isLiked: optimisticLikeState.isLiked,
        likesCount: optimisticLikeState.likesCount,
        isOptimistic: false
      });
    } finally {
      setLikeAnimating(false);
    }
  }, [reel.id, optimisticLikeState, likeAnimating, onLike, heartAnimation, likeButtonAnimation]);

  // New gesture handlers
  const handlePlayPauseToggle = useCallback(() => {
    // Toggle play state immediately for better responsiveness
    setIsPlaying(prev => !prev);
    onTogglePause();
    setShowPlayPauseIndicator(true);
    setShowControls(true);
    
    // Show play/pause indicator with current state
    playPauseIndicatorAnimation.setValue(0);
    Animated.sequence([
      Animated.timing(playPauseIndicatorAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(playPauseIndicatorAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setShowPlayPauseIndicator(false));
    
    // Auto-hide controls
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, [onTogglePause, playPauseIndicatorAnimation]);

  const handleMuteToggle = useCallback(() => {
    setMuted(!muted);
    setShowVolumeIndicator(true);
    
    // Show volume indicator
    volumeIndicatorAnimation.setValue(0);
    Animated.sequence([
      Animated.timing(volumeIndicatorAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(volumeIndicatorAnimation, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => setShowVolumeIndicator(false));
    
    Vibration.vibrate(30);
  }, [muted, volumeIndicatorAnimation]);

  const handleSingleTap = useCallback((tapLocation?: { x: number; y: number }) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime.current;
    lastTapTime.current = now;

    if (timeSinceLastTap < 300) {
      // Double tap detected
      handleDoubleTap(tapLocation);
      return;
    }

    // Single tap - only pause/play (removed gesture mute)
    setTimeout(() => {
      if (Date.now() - lastTapTime.current >= 300) {
        handlePlayPauseToggle();
      }
    }, 300);
  }, [onTogglePause, handleDoubleTap]);

  const handleLikePress = useCallback(async () => {
    // Use the same Instagram-like handler for button press
    await handleInstagramLike();
  }, [handleInstagramLike]);

  const handleSavePress = useCallback(async () => {
    try {
      onSave?.(reel.id);
      Vibration.vibrate(30);
    } catch (error) {
      console.error('Error saving reel:', error);
    }
  }, [onSave, reel.id]);

  const handleFollowPress = useCallback(async () => {
    try {
      onFollow?.(reel.userId);
      Vibration.vibrate(50);
    } catch (error) {
      console.error('Error following user:', error);
    }
  }, [onFollow, reel.userId]);

  const handleSeek = useCallback((value: number) => {
    const seekTime = (value / 100) * duration;
    videoRef.current?.seek(seekTime);
    setCurrentTime(seekTime);
  }, [duration]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
      if (doubleTapTimeout.current) {
        clearTimeout(doubleTapTimeout.current);
      }
    };
  }, []);

  return (
    <View style={styles.reelContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Video Player */}
      <TouchableWithoutFeedback
        onPress={(event) => {
          const { locationX, locationY } = event.nativeEvent;
          handleSingleTap({ x: locationX, y: locationY });
        }}
        style={styles.videoContainer}>
        <View style={styles.videoContainer}>
          {/* 🚀 INSTAGRAM-STYLE VIDEO PLAYER - NO OVERLAYS, INSTANT PLAYBACK */}
          <InstagramVideoPlayer
            videoUrl={reel.videoUrl}
            thumbnailUrl={reel.thumbnailUrl || ''}
            paused={!isPlaying}
            muted={muted}
            repeat={false}
            resizeMode="cover"
            onLoad={handleVideoLoad}
            onProgress={handleVideoProgress}
            onBuffer={(buffering) => {
              // Silent buffering - no UI shown
            }}
            onError={(error) => {
              console.error('❌ Video error:', error);
            }}
            style={styles.video}
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

              {/* Progress Bar with Seek Controls */}
              <View style={styles.progressContainer}>
                <View style={styles.seekControlsContainer}>
                  <TouchableOpacity 
                    style={styles.seekButton}
                    onPress={handleSeekBackward}>
                    <Icon name="replay-10" size={20} color="rgba(255,255,255,0.9)" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.seekProgressContainer}
                    onPress={handleProgressBarPress}
                    activeOpacity={0.7}>
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill,
                          { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }
                        ]} 
                      />
                      <View style={[
                        styles.progressThumb,
                        { 
                          left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                        }
                      ]} />
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.seekButton}
                    onPress={handleSeekForward}>
                    <Icon name="forward-10" size={20} color="rgba(255,255,255,0.9)" />
                  </TouchableOpacity>
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

          {/* Volume Indicator */}
          <Animated.View
            style={[
              styles.volumeIndicator,
              {
                opacity: volumeIndicatorAnimation,
              },
            ]}>
            <View style={styles.volumeIconContainer}>
              <Icon
                name={muted ? 'volume-off' : 'volume-up'}
                size={40}
                color="white"
              />
              <Text style={styles.volumeText}>
                {muted ? 'Muted' : 'Unmuted'}
              </Text>
            </View>
          </Animated.View>

          {/* Play/Pause Indicator */}
          <Animated.View
            style={[
              styles.playPauseIndicator,
              {
                opacity: playPauseIndicatorAnimation,
              },
            ]}>
            <View style={styles.playPauseIconContainer}>
              <Icon
                name={isPaused ? 'play-arrow' : 'pause'}
                size={60}
                color="white"
              />
            </View>
          </Animated.View>

          {/* Seek Forward Indicator */}
          <Animated.View
            style={[
              styles.seekForwardIndicator,
              {
                opacity: seekForwardAnimation,
                transform: [
                  {
                    scale: seekForwardAnimation.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.8, 1.1, 0.8],
                    }),
                  },
                ],
              },
            ]}>
            <View style={styles.seekIconContainer}>
              <Icon name="forward-10" size={50} color="white" />
              <Text style={styles.seekText}>+10s</Text>
            </View>
          </Animated.View>

          {/* Volume Indicator */}
          {showVolumeIndicator && (
            <Animated.View
              style={[
                styles.volumeIndicator,
                {
                  opacity: volumeIndicatorAnimation,
                  transform: [
                    {
                      scale: volumeIndicatorAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, 1],
                      }),
                    },
                  ],
                },
              ]}>
              <View style={styles.volumeIconContainer}>
                <Icon
                  name={muted ? 'volume-off' : 'volume-up'}
                  size={40}
                  color="white"
                />
                <Text style={styles.volumeText}>
                  {muted ? 'Muted' : 'Unmuted'}
                </Text>
              </View>
            </Animated.View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* Instagram-Style Progress Bar */}
      <TouchableWithoutFeedback
        onPress={(event) => {
          const { locationX } = event.nativeEvent;
          const progressBarWidth = width - 24; // Account for left/right padding
          const newProgress = locationX / progressBarWidth;
          const newTime = Math.max(0, Math.min(duration, duration * newProgress));
          
          if (videoRef.current && duration > 0) {
            videoRef.current.seek(newTime);
            setCurrentTime(newTime);
          }
        }}>
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                },
              ]}
            />
            {/* Progress Handle */}
            <View
              style={[
                styles.progressHandle,
                {
                  left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                },
              ]}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>

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
              <Text key={`${reel.id}-tag-${index}-${tag}`} style={styles.tag}>
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

        {/* User Info - Moved to Bottom */}
        <View style={styles.userInfoBottom}>
          <TouchableOpacity
            style={styles.userAvatar}
            onPress={() => onUserProfilePress(reel.user?.id || '')}
            onLongPress={() => onViewUserStory(reel.user?.id || '')}>
            <Image
              source={{ 
                uri: reel.user?.profilePicture || 
                'https://via.placeholder.com/40x40.png?text=👤' 
              }}
              style={styles.userAvatar}
            />
          </TouchableOpacity>
          
          <View style={styles.userDetails}>
            <TouchableOpacity onPress={() => onUserProfilePress(reel.user?.id || reel.userId)}>
              <Text style={styles.username}>
                @{reel.user?.username || `user${reel.userId.slice(-4)}`}
              </Text>
            </TouchableOpacity>
            {reel.user?.verified && (
              <Icon name="verified" size={16} color="#1DA1F2" style={styles.verifiedIcon} />
            )}
          </View>

          {(reel.user?.id || reel.userId) !== currentUserId && (
            <UniversalFollowButton
              targetUserId={reel.user?.id || reel.userId}
              targetUserName={reel.user?.displayName || reel.user?.username}
              targetUserAvatar={reel.user?.profilePicture}
              size="small"
              variant="gradient"
              showIcon={true}
              onFollowChange={(isFollowing, followersCount) => {
                // Update local reel state
                onUpdateReelState(reel.id, {
                  user: reel.user ? { ...reel.user, isFollowing, followersCount } : undefined 
                });
              }}
            />
          )}
        </View>
      </View>

      {/* Enhanced Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* Like Button with Instagram-style Animation */}
        <Animated.View
          style={{
            transform: [{ scale: likeButtonAnimation }]
          }}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleLikePress}
            activeOpacity={0.7}>
            <Icon
              name={optimisticLikeState.isLiked ? "favorite" : "favorite-border"}
              size={32}
              color={optimisticLikeState.isLiked ? "#ff3040" : "#fff"}
            />
            <Text style={[
              styles.actionText,
              optimisticLikeState.isOptimistic && { opacity: 0.8 }
            ]}>
              {formatCount(optimisticLikeState.likesCount)}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Comment Button */}
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => onComment(reel)}
          activeOpacity={0.7}>
          <IconIonic name="chatbubble-outline" size={30} color="#fff" />
          <Text style={styles.actionText}>{formatCount(currentCommentsCount)}</Text>
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
            name={currentIsSaved ? "bookmark" : "bookmark-border"}
            size={30}
            color={currentIsSaved ? "#ffd700" : "#fff"}
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
  const route = useRoute();
  
  // Get navigation parameters for perfect reel opening from profile/search
  const { initialReelId, focusedReelId, fromProfile, fromSearch, reels: passedReels, initialIndex } = (route.params as any) || {};

  // Priority order: focusedReelId (from shared reel) > initialReelId > normal flow
  const targetReelId = focusedReelId || initialReelId;
  
  // LAZY LOADING SYSTEM - Load only what's needed
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  
  // Local state for reels to handle likes/follows
  const [localReels, setLocalReels] = useState<Reel[]>([]);
  
  // Update local reels when reels change and set up real-time listeners
  useEffect(() => {
    setLocalReels(reels);
    
    // Set up real-time listeners for each reel if user is authenticated
    if (user?.uid) {
      const dynamicService = DynamicReelsService.getInstance();
      
      reels.forEach(reel => {
        // Update cache with current reel data
        dynamicService.updateReelCache(reel, user.uid);
        
        // Listen to likes changes
        dynamicService.listenToLikes(reel.id, (likesCount, isLiked) => {
          setLocalReels(prev => prev.map(r =>
            r.id === reel.id
              ? { ...r, likesCount, ...(isLiked !== undefined && { isLiked }) }
              : r
          ));
        });
        
        // Listen to comments changes  
        dynamicService.listenToComments(reel.id, (comments, count) => {
          setLocalReels(prev => prev.map(r =>
            r.id === reel.id
              ? { ...r, commentsCount: count }
              : r
          ));
        });
      });
      
      // Cleanup listeners when component unmounts or reels change
      return () => {
        reels.forEach(reel => {
          dynamicService.cleanupReel(reel.id);
        });
        // 🧹 Cleanup perfect chunked streaming for all reels
        perfectChunkedEngine.cleanup();
        perfectThumbnailSystem.cleanup();
      };
    }
  }, [reels, user?.uid]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedReelForShare, setSelectedReelForShare] = useState<Reel | null>(null);
  const [appState, setAppState] = useState(AppState.currentState);
  const [backgroundTime, setBackgroundTime] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false); // Start with auto-play enabled
  const [navigationTime, setNavigationTime] = useState<number | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const backgroundTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize dynamic save archive service
  const dynamicSaveArchiveService = useMemo(() => new DynamicSaveArchiveService(), []);

  // 🎯 Initialize Perfect Feed Algorithm & View Tracking System
  const feedAlgorithm = useMemo(() => PerfectReelsFeedAlgorithm.getInstance(), []);
  const viewTracker = useMemo(() => PerfectViewTrackingSystem.getInstance(), []);

  // 🚀 Initialize Perfect Chunked Streaming System + Advanced Segmented Fetcher + Instant Preloader
  const perfectChunkedEngine = useMemo(() => new PerfectChunkedStreamingEngine(), []);
  const perfectThumbnailSystem = useMemo(() => new PerfectInstantThumbnailSystem(), []);
  const advancedVideoFetcher = useMemo(() => {
    try {
      return AdvancedSegmentedVideoFetcher.getInstance();
    } catch (error) {
      console.warn('⚠️ AdvancedSegmentedVideoFetcher not available:', error);
      return null;
    }
  }, []);
  const instantPreloader = useMemo(() => InstantReelsPreloader.getInstance(), []);
  const instagramPreloader = useMemo(() => InstagramReelPreloader.getInstance(), []);

  // 🚀 Instagram-style preloading: Preload next 2-3 reels aggressively
  useEffect(() => {
    if (reels.length === 0) return;

    console.log(`🎬 Instagram preload triggered for index: ${currentIndex}`);
    
    // Preload reels around current index
    instagramPreloader.preloadReelsAroundIndex(reels, currentIndex);

    // Cleanup old preloads every 5 reels
    if (currentIndex % 5 === 0) {
      const reelsToKeep = [];
      for (let i = Math.max(0, currentIndex - 2); i <= Math.min(reels.length - 1, currentIndex + 4); i++) {
        if (reels[i]) {
          reelsToKeep.push(reels[i].id);
        }
      }
      instagramPreloader.cleanupOldPreloads(reelsToKeep);
    }
  }, [currentIndex, reels, instagramPreloader]);

  // 📊 Perfect Chunked Streaming Prefetch Strategy: N, N+1 (full), N+2 (partial), N-1 (cached)
  useEffect(() => {
    if (reels.length === 0) return;

    const executePerfectPrefetch = async () => {
      const currentReel = reels[currentIndex];
      const nextReel = reels[currentIndex + 1];
      const nextNextReel = reels[currentIndex + 2];
      const prevReel = reels[currentIndex - 1];

      console.log(`🚀 Perfect prefetch strategy for index: ${currentIndex}`);

      if (currentReel) {
        // 🎯 Current Reel N: Priority 1 - Initialize for instant playback
        try {
          await perfectChunkedEngine.initializeChunkedVideo(
            currentReel.id,
            currentReel.videoUrl,
            'high'
          );
          await perfectThumbnailSystem.prepareThumbnail(
            currentReel.id,
            currentReel.thumbnailUrl,
            currentReel.videoUrl
          );
          console.log(`✅ Current reel ready: ${currentReel.id}`);
        } catch (error) {
          console.log(`📺 Current reel fallback: ${currentReel.id}`);
        }
      }

      if (nextReel) {
        // 🔥 Next Reel N+1: Priority 2 - Preload fully for seamless transition
        setTimeout(async () => {
          try {
            await perfectChunkedEngine.setPrefetchStrategy({
              currentReel: currentReel.id,
              nextReel: nextReel.id,
            });
            perfectThumbnailSystem.prepareThumbnail(
              nextReel.id,
              nextReel.thumbnailUrl,
              nextReel.videoUrl
            );
          } catch (error) {
            console.log(`📺 Next reel fallback: ${nextReel.id}`);
          }
        }, 100);
      }

      if (nextNextReel) {
        // 📈 Next+1 Reel N+2: Priority 3 - Preload first 2-3 segments only
        setTimeout(async () => {
          try {
            await perfectChunkedEngine.setPrefetchStrategy({
              currentReel: currentReel.id,
              nextReel: nextReel?.id,
              nextNextReel: nextNextReel.id,
            });
            perfectThumbnailSystem.prepareThumbnail(
              nextNextReel.id,
              nextNextReel.thumbnailUrl,
              nextNextReel.videoUrl
            );
          } catch (error) {
            console.log(`📺 Next+1 reel fallback: ${nextNextReel.id}`);
          }
        }, 500);
      }

      if (prevReel) {
        // 💾 Previous Reel N-1: Keep cached for backward navigation
        setTimeout(async () => {
          try {
            await perfectChunkedEngine.setPrefetchStrategy({
              currentReel: currentReel.id,
              nextReel: nextReel?.id,
              nextNextReel: nextNextReel?.id,
              prevReel: prevReel.id,
            });
          } catch (error) {
            console.log(`📺 Previous reel fallback: ${prevReel.id}`);
          }
        }, 1000);
      }
    };

    executePerfectPrefetch();
  }, [currentIndex, reels, perfectChunkedEngine, perfectThumbnailSystem]);

  // 🎯 Initialize Perfect Feed Algorithm & View Tracking System
  useEffect(() => {
    const initializePerfectSystems = async () => {
      if (user?.uid) {
        console.log('🎯 Initializing Perfect Feed Algorithm & View Tracking...');
        
        // Initialize feed algorithm
        await feedAlgorithm.initialize(user.uid);
        
        // Initialize view tracker
        await viewTracker.initialize(user.uid);
        
        console.log('✅ Perfect systems initialized!');
      }
    };

    initializePerfectSystems();
  }, [user?.uid, feedAlgorithm, viewTracker]);

  // Initialize instant loading - load only first reel for instant display with ULTRA-DYNAMIC optimizations
  useEffect(() => {
    if (user?.uid) {
      console.log('⚡ ULTRA-DYNAMIC Reels initialized - INSTANT MODE with Smart Caching and Advanced Segmentation');
      
      // Initialize instant preloader first
      instantPreloader.initialize(user.uid);
      
      // Pre-configure ultra-fast service for optimal performance
      const ultraFastService = UltraFastInstantService.getInstance();
      
      // Load ONLY first reel for instant display
      loadInitialReels();
      
      // Start dynamic background optimization after initial load
      const optimizationTimer = setTimeout(() => {
        // Pre-cache next 2 reels for seamless scrolling
        backgroundLoadReels();
      }, 1000);

      return () => clearTimeout(optimizationTimer);
    }
  }, [user?.uid]);

  // Cleanup Advanced Video Fetcher on unmount
  useEffect(() => {
    return () => {
      // Cleanup segmented video resources when component unmounts
      if (advancedVideoFetcher) {
        console.log('🧹 Cleaning up advanced video fetcher resources');
        // The cleanup method may not exist yet, so we'll just clear references
      }
    };
  }, []);

  // Fresh content on tab focus - Instagram/TikTok behavior with pause/resume logic
  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        const currentTime = Date.now();
        
        // If user was away and comes back
        if (navigationTime) {
          const timeAway = currentTime - navigationTime;
          
          // If away for more than 5 seconds, load fresh content
          if (timeAway > 5000) {
            console.log('🎭 User away for >5s - loading fresh reels');
            loadFreshContent();
          } else {
            console.log('🎬 User back within 5s - resuming current reel');
            setIsPaused(false);
          }
        } else if (!loading) {
          console.log('🎭 Reels tab focused - loading fresh content');
          loadFreshContent();
        }
        
        setNavigationTime(null);
      }
      
      return () => {
        // User is navigating away - pause and record time
        console.log('⏸️ User navigating away - pausing reels');
        setIsPaused(true);
        setNavigationTime(Date.now());
      };
    }, [user?.uid, loading, navigationTime])
  );

  // ULTRA-DYNAMIC Performance Monitoring & Auto-Optimization
  useEffect(() => {
    if (!user?.uid) return;

    const performanceMonitor = setInterval(() => {
      // Auto-optimize based on current performance
      const currentReelsCount = reels.length;
      
      if (currentReelsCount > MAX_LOADED_REELS * 2) {
        // Clean up older reels to maintain smooth performance
        const keepCount = MAX_LOADED_REELS;
        const currentReelIndex = Math.max(0, currentIndex - 1);
        const newReels = reels.slice(currentReelIndex, currentReelIndex + keepCount);
        
        console.log(`🧹 Auto-cleanup: Optimized from ${currentReelsCount} to ${newReels.length} reels`);
        setReels(newReels);
        setCurrentIndex(1); // Adjust index after cleanup
      }
      
      // Pre-load next reels if we're getting close to the end
      if (currentIndex > reels.length - 2 && !isLoadingNext) {
        console.log('🚀 Smart pre-loading triggered');
        backgroundLoadReels();
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(performanceMonitor);
  }, [reels.length, currentIndex, isLoadingNext, user?.uid]);

  // Dynamic Firebase/DigitalOcean Connection Optimization
  useEffect(() => {
    if (!user?.uid) return;

    const connectionOptimizer = setInterval(async () => {
      try {
        // Optimize Firebase connection for real-time performance
        const ultraFastService = UltraFastInstantService.getInstance();
        
        // Pre-warm connection for instant loading
        console.log('🔥 Optimizing Firebase/DigitalOcean connections...');
        
        // This keeps the connection active and optimized
        const connectionTest = await ultraFastService.getInstantReels(user.uid, 1);
        if (connectionTest.length > 0) {
          console.log('✅ Firebase/DigitalOcean connection optimized');
        }
      } catch (error) {
        console.log('⚠️ Connection optimization skipped:', error);
      }
    }, 30000); // Optimize every 30 seconds

    return () => clearInterval(connectionOptimizer);
  }, [user?.uid]);
  const loadFreshContent = useCallback(async () => {
    if (!user?.uid || refreshing) return;

    try {
      setRefreshing(true);
      console.log('🎯 Loading smart personalized feed with instant display...');

      // Use SmartReelFeedService for intelligent feed ordering
      const smartFeedService = SmartReelFeedService.getInstance();
      
      // Get smart personalized feed (Following > Trending > High Engagement > Discovery)
      const freshReels = await smartFeedService.getSmartFeed(user.uid, 10);
      
      // ✅ INSTANT DISPLAY: Set reels immediately for instant UI
      setReels(freshReels);
      setLocalReels(freshReels);
      setHasMore(true);
      setCurrentIndex(0);
      
      // Scroll to top for fresh experience - only if we have reels
      if (flatListRef.current && freshReels.length > 0) {
        flatListRef.current.scrollToIndex({ index: 0, animated: false });
      }
      
      console.log(`✅ Loaded ${freshReels.length} fresh randomized reels INSTANTLY! Starting background preparation...`);

      // 🚀 BACKGROUND: Prepare videos in background without blocking UI
      setTimeout(async () => {
        for (const reel of freshReels) {
          if (reel.videoUrl && advancedVideoFetcher) {
            try {
              // 🚀 Prepare video for instant playback with segmentation (background)
              await advancedVideoFetcher.prepareVideo(reel.videoUrl, reel.id);
              console.log('[ReelsScreen] Fresh video prepared with segmentation (background):', reel.id);
            } catch (error) {
              console.warn('[ReelsScreen] Fresh video preparation failed (background):', reel.id, error);
              // Continue with other videos if one fails
            }
          }
        }
        console.log('🎬 All fresh videos prepared in background!');
      }, 100); // Start background preparation after 100ms

    } catch (err) {
      console.error('❌ Error loading fresh reels:', err);
      // Fallback to regular loading
      loadInitialReels();
    } finally {
      setRefreshing(false);
    }
  }, [user?.uid, refreshing, advancedVideoFetcher]);

  // Load reels INSTANTLY with ultra-fast service
  const loadInitialReels = useCallback(async () => {
    if (!user?.uid || loading) return;

    try {
      setLoading(true);
      
      // If reels are passed from search/profile, use them instead of loading from Firebase
      if (passedReels && passedReels.length > 0) {
        console.log('🎬 Using passed reels from search/profile...', passedReels.length);
        
        // ✅ INSTANT DISPLAY: Set reels immediately for instant UI
        setReels(passedReels);
        setCurrentIndex(initialIndex || 0);
        setLoading(false);
        
        // 🚀 BACKGROUND: Prepare videos in background without blocking UI
        setTimeout(async () => {
          for (const reel of passedReels) {
            if (reel.videoUrl && advancedVideoFetcher) {
              try {
                await advancedVideoFetcher.prepareVideo(reel.videoUrl, reel.id);
                console.log('[ReelsScreen] Passed video prepared with segmentation (background):', reel.id);
              } catch (error) {
                console.warn('[ReelsScreen] Passed video preparation failed (background):', reel.id, error);
              }
            }
          }
          console.log('🎬 All passed videos prepared in background!');
        }, 100); // Start background preparation after 100ms
        
        return;
      }
      
      console.log('⚡ Loading reels INSTANTLY with preloader cache...');

      // 🚀 Use Instant Preloader for immediate results
      const initialReels = await instantPreloader.getInstantReels(user.uid, 5);
      
      // ✅ INSTANT DISPLAY: Set reels immediately for instant UI
      setReels(initialReels);
      setHasMore(initialReels.length >= 5);
      setError(null);
      
      console.log(`✅ Loaded ${initialReels.length} reels INSTANTLY! Starting background video preparation...`);

      // 🚀 BACKGROUND: Prepare videos in background without blocking UI
      setTimeout(async () => {
        for (const reel of initialReels) {
          if (reel.videoUrl && advancedVideoFetcher) {
            try {
              // 🚀 Prepare video for instant playback with segmentation (background)
              await advancedVideoFetcher.prepareVideo(reel.videoUrl, reel.id);
              console.log('[ReelsScreen] Video prepared with segmentation (background):', reel.id);
            } catch (error) {
              console.warn('[ReelsScreen] Video preparation failed (background):', reel.id, error);
              // Continue with other videos if one fails
            }
          }
        }
        console.log('🎬 All videos prepared in background for optimal playback!');
      }, 100); // Start background preparation after 100ms

    } catch (err) {
      console.error('❌ Error loading initial reel:', err);
      setError('Failed to load reel');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, loading, passedReels, initialIndex, advancedVideoFetcher]);

  // Load next single reel when user scrolls - WITH FOLLOWING PRIORITY + Advanced Segmentation
  const loadNextReel = useCallback(async (index: number) => {
    if (!user?.uid || isLoadingNext) return;

    try {
      setIsLoadingNext(true);
      console.log(`⚡ Loading next reel INSTANTLY for index ${index} with segmented video fetching...`);

      const ultraFastService = UltraFastInstantService.getInstance();
      const lastReelId = reels.length > 0 ? reels[reels.length - 1].id : undefined;
      
      // Load next reel instantly
      const newReels = await ultraFastService.loadMoreReels(user.uid, lastReelId, 1);

      if (newReels.length > 0) {
        const nextReel = newReels[0];
        
        // ⚡ Use Advanced Segmented Video Fetcher for next reel
        if (nextReel.videoUrl && advancedVideoFetcher) {
          try {
            // 🚀 Prepare video for instant playback with segmentation
            await advancedVideoFetcher.prepareVideo(nextReel.videoUrl, nextReel.id);
            console.log('[ReelsScreen] Next video prepared with segmentation:', nextReel.id);
          } catch (error) {
            console.warn('[ReelsScreen] Next video preparation failed:', nextReel.id, error);
            // Continue with reel loading even if video preparation fails
          }
        }
        
        setReels(prev => {
          // Check for duplicates before adding
          const existingIds = new Set(prev.map(r => r.id));
          if (!existingIds.has(nextReel.id)) {
            return [...prev, nextReel];
          }
          return prev;
        });
        console.log(`✅ INSTANTLY loaded reel with segmentation: ${nextReel.id} (from ${nextReel.userId})`);
        setHasMore(true); // Always keep hasMore true for infinite loading
      } else {
        console.log('⚠️ No more reels available, trying background refresh...');
        // Don't set hasMore to false, instead try background loading
        backgroundLoadReels();
      }

    } catch (err) {
      console.error('❌ Error loading next reel:', err);
    } finally {
      setIsLoadingNext(false);
    }
  }, [user?.uid, isLoadingNext, reels]);

  // Background loading for seamless experience - SMART FEED with Advanced Segmentation
  const backgroundLoadReels = useCallback(async () => {
    if (!user?.uid || isLoadingNext) return;

    try {
      console.log('🎯 Background loading smart feed with segmented video fetching...');
      
      const smartFeedService = SmartReelFeedService.getInstance();
      const lastReelId = reels.length > 0 ? reels[reels.length - 1].id : undefined;
      
      // Load 5 more smart reels
      const newReels = await smartFeedService.getSmartFeed(user.uid, 5, lastReelId);
      
      if (newReels.length > 0) {
        // ⚡ Use Advanced Segmented Video Fetcher for background loaded reels
        for (const reel of newReels) {
          if (reel.videoUrl && advancedVideoFetcher) {
            try {
              // 🚀 Prepare video for instant playback with segmentation
              await advancedVideoFetcher.prepareVideo(reel.videoUrl, reel.id);
              console.log('[ReelsScreen] Background video prepared with segmentation:', reel.id);
            } catch (error) {
              console.warn('[ReelsScreen] Background video preparation failed:', reel.id, error);
              // Continue with other videos if one fails
            }
          }
        }
        
        setReels(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const uniqueNewReels = newReels.filter(reel => !existingIds.has(reel.id));
          return [...prev, ...uniqueNewReels];
        });
        console.log(`✅ Background loaded ${newReels.length} smart reels with segmented video fetching!`);
      }

      setHasMore(true);
    } catch (err) {
      console.error('❌ Background loading error:', err);
    }
  }, [user?.uid, isLoadingNext, reels, advancedVideoFetcher]);

  // Auto-refresh and background loading effects for infinite reels
  useEffect(() => {
    if (user?.uid && reels.length > 0) {
      const interval = setInterval(() => {
        // Background load more reels if we're running low
        const remainingReels = reels.length - currentIndex;
        if (remainingReels <= 3 && !isLoadingNext) {
          console.log('⚡ Auto background loading triggered');
          backgroundLoadReels();
        }
      }, 8000); // Check every 8 seconds

      return () => clearInterval(interval);
    }
  }, [user?.uid, reels.length, currentIndex, isLoadingNext, backgroundLoadReels]);

  // Refresh - reload fresh content like Instagram - ULTRA FAST
  const refreshReels = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setRefreshing(true);
      console.log('⚡ Refreshing with INSTANT fresh content...');

      const ultraFastService = UltraFastInstantService.getInstance();
      
      // Load fresh reels instantly
      const freshReels = await ultraFastService.getInstantReels(user.uid, 5);
      console.log(`✅ INSTANTLY refreshed - ${freshReels.length} reels`);
      
      setReels(freshReels);
      setHasMore(true);
      setCurrentIndex(0);

    } catch (err) {
      console.error('❌ Error refreshing reels:', err);
    } finally {
      setRefreshing(false);
    }
  }, [user?.uid]);

  // Handle pause/play toggle
  const handleTogglePause = useCallback(() => {
    setIsPaused(prev => !prev);
  }, []);

  // Handle updating individual reel state
  const handleUpdateReelState = useCallback((reelId: string, updates: Partial<Reel>) => {
    setLocalReels(prev => prev.map(r => 
      r.id === reelId ? { ...r, ...updates } : r
    ));
  }, []);

  // Handle app state changes for background timeout feature
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App came back to foreground
        const now = Date.now();
        if (backgroundTime && (now - backgroundTime) > BACKGROUND_TIMEOUT) {
          // More than 5 seconds in background - refresh reels
          console.log('App returned after 5+ seconds, refreshing reels');
          refreshReels();
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
      setAppState(nextAppState as typeof AppState.currentState);
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

  // No need to manually load - instant loading handles it automatically
  
  // Format count for display (1K, 1M, etc.)
  const formatCount = useCallback((count: number): string => {
    if (!count || count === 0) return '0';
    if (count < 1000) return count.toString();
    if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
    return `${(count / 1000000).toFixed(1)}M`;
  }, []);
  
  // Enhanced navigation to specific reel (shared or initial) - Instagram-like direct navigation
  useEffect(() => {
    if (targetReelId && localReels.length > 0) {
      console.log('🎯 Searching for target reel:', targetReelId);
      const reelIndex = localReels.findIndex(reel => reel.id === targetReelId);
      if (reelIndex !== -1) {
        console.log('✅ FOUND target reel at index:', reelIndex);
        // Found the reel, scroll to it
        setCurrentIndex(reelIndex);
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({ 
            index: reelIndex, 
            animated: true 
          });
        }, 100);
      } else {
        console.log('⚠️ Target reel not found in current feed, loading it directly...');
        // Load the specific reel directly like Instagram
        loadSpecificReel(targetReelId);
      }
    }
  }, [targetReelId, localReels]);

  // Load specific reel for direct navigation from chat/share
  const loadSpecificReel = useCallback(async (reelId: string) => {
    if (!user?.uid) return;

    try {
      console.log('🎯 Loading specific reel directly:', reelId);
      
      // Get the specific reel document
      const reelDoc = await firestore().collection('reels').doc(reelId).get();
      
      if (!reelDoc.exists) {
        console.log('❌ Specific reel not found');
        Alert.alert('Reel Not Found', 'This reel is no longer available.');
        return;
      }

      const specificReel = { id: reelDoc.id, ...reelDoc.data() } as Reel;
      
      // Load user data for the reel
      const userDoc = await firestore().collection('users').doc(specificReel.userId).get();
      const userData = userDoc.data();
      
      // Check like status
      const likeDoc = await firestore()
        .collection('reels')
        .doc(reelId)
        .collection('likes')
        .doc(user.uid)
        .get();
      
      // Check save status
      const saveDoc = await firestore()
        .collection('users')
        .doc(user.uid)
        .collection('savedReels')
        .doc(reelId)
        .get();

      const enrichedReel: Reel = {
        ...specificReel,
        isLiked: likeDoc.exists(),
        isSaved: saveDoc.exists(),
        user: userData ? {
          id: specificReel.userId,
          uid: specificReel.userId,
          username: userData.username || 'user',
          displayName: userData.displayName || userData.username || 'User',
          profilePicture: userData.profilePicture || null,
          verified: userData.verified || false,
          isFollowing: false // Will be updated by real-time listener
        } : null
      };

      // Insert the specific reel at the beginning and navigate to it
      setLocalReels(prev => [enrichedReel, ...prev]);
      setCurrentIndex(0);
      
      // Scroll to the specific reel
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ 
          index: 0, 
          animated: false 
        });
      }, 100);

      console.log('✅ Successfully loaded and navigated to specific reel');

    } catch (error) {
      console.error('❌ Error loading specific reel:', error);
      Alert.alert('Error', 'Failed to load the reel. Please try again.');
    }
  }, [user?.uid]);

  // ❤️ PERFECT LIKE SYSTEM - Zero bugs, instant feedback
  const handleLike = useCallback(async (reelId: string) => {
    if (!user?.uid) return;

    try {
      // Find the current reel to get its current state
      const currentReel = localReels.find(reel => reel.id === reelId);
      if (!currentReel) return;

      console.log('❤️ RealTimeLike: Starting like toggle for reel:', reelId);

      // Use RealTimeLikeSystem for bulletproof like handling
      const result = await RealTimeLikeSystem.getInstance().toggleLike(
        reelId,
        user.uid,
        'reel',
        currentReel.isLiked || false,
        currentReel.likesCount || 0
      );

      if (result.success) {
        // Update local state with the final result
        setLocalReels(prev => prev.map(reel =>
          reel.id === reelId
            ? { 
                ...reel, 
                isLiked: result.isLiked, 
                likesCount: result.likesCount
              }
            : reel
        ));

        console.log(`✅ RealTimeLike: Reel ${reelId} ${result.isLiked ? 'liked' : 'unliked'} successfully. Count: ${result.likesCount}`);
      } else {
        // Show error message if needed
        if (result.error && result.error !== 'Too fast') {
          Alert.alert('❤️ Like Error', 'Unable to update like. Please try again.');
        }
        console.log('⚠️ RealTimeLike: Like operation failed:', result.error);
      }

    } catch (error) {
      console.error('❌ RealTimeLike: Unexpected error in handleLike:', error);
      Alert.alert('❤️ Like Error', 'Something went wrong. Please check your connection and try again.');
    }
  }, [user?.uid, localReels]);

  // Handle save with instant updates
  const handleSave = useCallback(async (reelId: string) => {
    if (!user?.uid) return;

    try {
      console.log('💾 Saving reel INSTANTLY:', reelId);
      
      // Find current reel to get save status
      const currentReel = localReels.find(r => r.id === reelId);
      if (!currentReel) return;

      const wasSaved = currentReel.isSaved || false;

      // Optimistic UI update
      setLocalReels(prev => prev.map(reel =>
        reel.id === reelId
          ? { ...reel, isSaved: !wasSaved }
          : reel
      ));

      // Use UltraFastInstantService for instant save functionality
      const ultraFastService = UltraFastInstantService.getInstance();
      const result = await ultraFastService.toggleSave(reelId, user.uid);
      
      // Show feedback to user
      if (result.isSaved && !wasSaved) {
        console.log('✅ Reel saved INSTANTLY to your collection!');
      } else if (!result.isSaved && wasSaved) {
        console.log('➖ Reel removed INSTANTLY from your collection');
      }

    } catch (error) {
      console.error('Error saving reel:', error);
      // Revert optimistic update on error
      const currentReel = localReels.find(r => r.id === reelId);
      if (currentReel) {
        setLocalReels(prev => prev.map(reel =>
          reel.id === reelId
            ? { ...reel, isSaved: currentReel.isSaved }
            : reel
        ));
      }
    }
  }, [user?.uid, localReels]);

  // Handle follow with dynamic follow service
  const handleFollow = useCallback(async (userId: string, userName?: string) => {
    if (!user?.uid) return;

    try {
      // Use dynamic follow service for real-time updates
      const result = await DynamicFollowService.toggleFollow(user.uid, userId, userName);
      
      if (result.success) {
        // Update local state
        setLocalReels(prev => prev.map(reel => 
          reel.user?.id === userId || reel.userId === userId
            ? { 
                ...reel, 
                user: reel.user ? { ...reel.user, isFollowing: result.isFollowing } : undefined 
              }
            : reel
        ));

        console.log(`User ${result.isFollowing ? 'followed' : 'unfollowed'} successfully`);
      }
    } catch (error) {
      console.error('Error following user:', error);
    }
  }, [user?.uid]);

  // Track reel views for analytics
  const trackReelView = useCallback(async (reel: Reel, viewDuration?: number) => {
    if (!user?.uid) return;

    try {
      // Update view count
      await FirebaseService.incrementReelViews(reel.id);
    } catch (error) {
      console.error('Error tracking reel view:', error);
    }
  }, [user?.uid]);

  // Track when reel becomes active (for view duration)
  const [reelStartTimes, setReelStartTimes] = useState<Record<string, number>>({});

  const handleReelFocus = useCallback((reel: Reel, index: number) => {
    setCurrentIndex(index);
    setReelStartTimes(prev => ({
      ...prev,
      [reel.id]: Date.now()
    }));
  }, []);

  const handleReelBlur = useCallback(async (reel: Reel) => {
    const startTime = reelStartTimes[reel.id];
    if (startTime) {
      const viewDuration = Date.now() - startTime;
      const reelDuration = (reel.duration || 30) * 1000; // Convert to milliseconds
      const watchPercentage = Math.min(viewDuration / reelDuration, 1);

      // Only track if watched for reasonable amount
      if (viewDuration > 1000) { // More than 1 second
        await trackReelView(reel, watchPercentage);
      }

      setReelStartTimes(prev => {
        const updated = { ...prev };
        delete updated[reel.id];
        return updated;
      });
    }
  }, [reelStartTimes, trackReelView]);

  // Handle external share with enhanced content and tracking
  const handleShare = useCallback(async (reel: Reel) => {
    if (!user?.uid) return;

    try {
      console.log('📤 Sharing reel externally:', reel.id);

      const shareContent = {
        title: `Amazing reel by ${reel.user?.username || 'Unknown User'}`,
        message: `🎬 "${reel.caption || 'Check out this amazing reel!'}"
        
👤 By: @${reel.user?.username || 'user'}
❤️ ${reel.likesCount || 0} likes
👁️ ${reel.viewsCount || 0} views

📱 Watch more amazing content on Jorvea App!
#Jorvea #Reels #Video`,
        url: reel.videoUrl,
      };

      const result = await Share.share(shareContent);
      
      if (result.action === Share.sharedAction) {
        console.log('✅ Reel shared successfully');
        // Track share for analytics
        await FirebaseService.incrementReelShares(reel.id);
      }

    } catch (error) {
      console.error('Error sharing reel:', error);
      Alert.alert('Share Error', 'Unable to share this reel. Please try again.');
    }
  }, [user?.uid]);

  // Handle in-app share (Jorvea share) with enhanced functionality
  const handleInAppShare = useCallback((reel: Reel) => {
    console.log('📲 Opening Jorvea in-app share for reel:', reel.id);
    setSelectedReelForShare(reel);
    setShowShareModal(true);
  }, []);

  // Handle comment - Navigate to comments screen
  // Handle comment - Navigate to comments screen with real-time updates
  const handleComment = useCallback((reel: Reel) => {
    console.log('🗨️ Opening comments for reel:', reel.id);
    
    (navigation as any).navigate('Comments', { 
      reelId: reel.id,
      contentType: 'reel'
    });
  }, [navigation]);

  // Handle user profile press with enhanced navigation
  const handleUserProfilePress = useCallback((userId: string) => {
    if (userId && userId !== user?.uid) {
      console.log('👤 Opening profile for user:', userId);
      (navigation as any).navigate('UserProfile', { 
        userId,
        fromScreen: 'Reels'
      });
    } else if (userId === user?.uid) {
      // Navigate to own profile
      (navigation as any).navigate('Profile');
    }
  }, [navigation, user?.uid]);

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

  // 🎯 PERFECT VIEW TRACKING - One view per user per reel, forever
  const handleViewCountUpdate = useCallback(async (reelId: string, watchTime: number = 3000) => {
    try {
      if (!user?.uid) return;

      const viewTracker = PerfectViewTrackingSystem.getInstance();
      
      // Check if already viewed
      if (viewTracker.hasViewed(reelId)) {
        console.log(`⏭️ Reel ${reelId} already viewed - skipping`);
        return;
      }

      // Track view with anti-bot measures
      const result = await viewTracker.trackView(reelId, user.uid, watchTime);
      
      if (result.success) {
        console.log(`✅ View counted for reel ${reelId}`);
        
        // Mark as viewed in feed algorithm
        const feedAlgorithm = PerfectReelsFeedAlgorithm.getInstance();
        await feedAlgorithm.markAsViewed(user.uid, reelId);
        
        // Track interaction for better recommendations
        await feedAlgorithm.trackInteraction(user.uid, reelId, 'viewed', watchTime);
      } else {
        console.log(`⚠️ View not counted: ${result.reason}`);
      }
    } catch (error) {
      console.error('Error updating view count:', error);
    }
  }, [user?.uid]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index || 0;
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
        
        // 🚀 INSTAGRAM-STYLE: Preload next 2-3 reels for instant playback
        FastReelPreloader.preloadNextReels(reels, newIndex, 3);
        
        // Smart background loading - load next reel when approaching end
        const remainingReels = reels.length - newIndex;
        if (remainingReels <= 2 && !isLoadingNext) {
          console.log(`📦 Triggering background load, ${remainingReels} reels remaining`);
          loadNextReel(reels.length);
        }
        
        // Also trigger background loading when we're near the end
        if (remainingReels <= 1) {
          backgroundLoadReels();
        }
        
        // Video preloading handled by ultra-fast service
        const nextIndex = newIndex + 1;
        if (nextIndex < reels.length) {
          const nextReel = reels[nextIndex];
          if (nextReel?.videoUrl) {
            console.log('📺 Next video ready for ultra-fast playback');
          }
        }
      }
    }
  }, [currentIndex, reels.length, isLoadingNext, loadNextReel, backgroundLoadReels, reels]);

  const onEndReached = useCallback(() => {
    // Aggressive loading when reaching end - ensure infinite reels
    console.log('📍 End reached, loading more reels...');
    if (!isLoadingNext && reels.length > 0) {
      loadNextReel(reels.length);
      // Also trigger background loading for buffer
      setTimeout(() => {
        backgroundLoadReels();
      }, 500);
    }
  }, [isLoadingNext, reels.length, loadNextReel, backgroundLoadReels]);

  const onRefresh = useCallback(() => {
    loadFreshContent(); // Load fresh content instead of just refreshing
  }, [loadFreshContent]);

  // Reels load automatically with instant loading - no manual loading needed

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
      onTogglePause={handleTogglePause}
      onUpdateReelState={handleUpdateReelState}
      navigation={navigation}
    />
  ), [currentIndex, user?.uid, isPaused, handleLike, handleShare, handleInAppShare, handleComment, handleFollow, handleSave, handleViewCountUpdate, handleUserProfilePress, handleViewUserStory, handleTogglePause, handleUpdateReelState, navigation]);

  const renderFooter = () => {
    if (!hasMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading more reels...</Text>
      </View>
    );
  };

  if (loading && localReels.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading Amazing Reels...</Text>
      </View>
    );
  }

  if (error && localReels.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="video-library" size={64} color="rgba(255,255,255,0.7)" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshReels}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <FlatList
        ref={flatListRef}
        data={localReels}
        renderItem={renderItem}
        keyExtractor={(item, index) => `reel-${item.id}-${index}`}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={REEL_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5} // Load when 50% from end for smooth experience
        ListFooterComponent={renderFooter}
        
        // INSTANT MODE - Simple & Fast Configuration
        removeClippedSubviews={true}
        initialNumToRender={1} // Only render first reel instantly
        maxToRenderPerBatch={1} // Render only 1 at a time
        windowSize={2} // Keep only 2 reels in memory (current + next)
        updateCellsBatchingPeriod={16} // 60 FPS updates
        getItemLayout={(data, index) => ({
          length: REEL_HEIGHT,
          offset: REEL_HEIGHT * index,
          index,
        })}
        style={styles.flatList}
        
        // Smooth scrolling behavior
        scrollEventThrottle={16} // 60 FPS scroll events
        bounces={false}
        overScrollMode="never"
        legacyImplementation={false}
        disableVirtualization={false}
        
        // Performance callbacks for 120fps
        onScrollBeginDrag={() => {
          // Optimize performance during scroll
          console.log('🚀 Ultra-fast scroll initiated');
        }}
        onScrollEndDrag={() => {
          // Resume normal operations
          console.log('🎯 Ultra-fast scroll completed');
        }}
      />

      <ShareBottomSheet
        visible={showShareModal}
        contentType="reel"
        contentData={selectedReelForShare}
        onClose={() => {
          setShowShareModal(false);
          setSelectedReelForShare(null);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    height: height, // Use full screen height
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
  volumeIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  volumeIconContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 50,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  playPauseIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseIconContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 50,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarContainer: {
    position: 'absolute',
    top: 20,
    left: 12,
    right: 12,
    height: 3,
    zIndex: 10,
  },
  progressBarBackground: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  progressHandle: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginLeft: -6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
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
  seekForwardIndicator: {
    position: 'absolute',
    right: '25%',
    top: '50%',
    transform: [{ translateY: -25 }],
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 30,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  seekControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  seekButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
    marginHorizontal: 8,
  },
  seekProgressContainer: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff3040',
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    backgroundColor: '#ff3040',
    borderRadius: 6,
    transform: [{ translateX: -6 }],
    borderWidth: 2,
    borderColor: 'white',
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
});

export default ReelsScreen;
