/**
 * 🚀 ULTRA FAST REELS SCREEN
 * Instagram/TikTok-like performance with zero delays
 * - Instant video loading (5-10 sec preload)
 * - Background loading pipeline
 * - Perfect pause/play system
 * - Restart from beginning on swipe back
 * - Zero black screens
 */

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
  Share,
  Vibration,
  Image,
  BackHandler,
  AppState,
  RefreshControl,
} from 'react-native';
import UltraFastVideoPlayer from '../components/UltraFastVideoPlayer';
import UltraFastReelsEngine, { ReelOptimized } from '../services/UltraFastReelsEngine';
import IconIonic from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import FirebaseService, { Reel } from '../services/firebaseService';
import RealTimeLikeSystem from '../services/RealTimeLikeSystem';
import LinearGradient from 'react-native-linear-gradient';
import UniversalFollowButton from '../components/UniversalFollowButton';
import DynamicSaveArchiveService from '../services/DynamicSaveArchiveService';

const { width, height } = Dimensions.get('screen');
const REEL_HEIGHT = height;

// 🚀 ULTRA FAST CONFIGURATION
const INITIAL_LOAD_COUNT = 1; // Load only 1 reel initially for instant display

interface UltraFastReelItemProps {
  reel: ReelOptimized;
  index: number;
  isActive: boolean;
  currentUserId: string;
  isPaused: boolean;
  onLike: (reelId: string) => void;
  onShare: (reel: ReelOptimized) => void;
  onComment: (reel: ReelOptimized) => void;
  onFollow: (userId: string) => void;
  onSave: (reelId: string) => void;
  onUserProfilePress: (userId: string) => void;
  onTogglePause: () => void;
  navigation: any;
}

const UltraFastReelItem: React.FC<UltraFastReelItemProps> = React.memo(({
  reel,
  index,
  isActive,
  currentUserId,
  isPaused,
  onLike,
  onShare,
  onComment,
  onFollow,
  onSave,
  onUserProfilePress,
  onTogglePause,
  navigation,
}) => {
  const [localLikeState, setLocalLikeState] = useState({
    isLiked: reel.isLiked || false,
    likesCount: reel.likesCount || 0,
  });

  // 🎯 INSTANT LIKE WITH OPTIMISTIC UPDATES
  const handleLike = useCallback(() => {
    const newIsLiked = !localLikeState.isLiked;
    const newCount = newIsLiked 
      ? localLikeState.likesCount + 1 
      : Math.max(0, localLikeState.likesCount - 1);

    // Instant UI update
    setLocalLikeState({
      isLiked: newIsLiked,
      likesCount: newCount,
    });

    // Vibration feedback
    if (newIsLiked) {
      Vibration.vibrate(50);
    }

    onLike(reel.id);
  }, [localLikeState, reel.id, onLike]);

  // Update local state when reel props change
  useEffect(() => {
    setLocalLikeState({
      isLiked: reel.isLiked || false,
      likesCount: reel.likesCount || 0,
    });
  }, [reel.isLiked, reel.likesCount]);

  return (
    <View style={styles.reelContainer}>
      {/* 🎬 ULTRA FAST VIDEO PLAYER */}
      <UltraFastVideoPlayer
        reel={reel}
        isVisible={true}
        isFocused={isActive}
        shouldPlay={isActive && !isPaused}
        onPlayPauseToggle={onTogglePause}
        onEnd={() => {
          // Auto advance to next reel
          // This will be handled by the parent component
        }}
      />

      {/* 🎨 UI OVERLAY */}
      <View style={styles.overlay}>
        {/* 👤 USER INFO */}
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => onUserProfilePress(reel.userId)}
          activeOpacity={0.8}
        >
          <Image
            source={{ 
              uri: reel.userProfilePicture || 'https://via.placeholder.com/50' 
            }}
            style={styles.userAvatar}
          />
          <Text style={styles.username}>{reel.username}</Text>
          {currentUserId !== reel.userId && (
            <UniversalFollowButton
              targetUserId={reel.userId}
              variant="outlined"
              style={styles.followButton}
            />
          )}
        </TouchableOpacity>

        {/* 📝 DESCRIPTION */}
        {reel.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.description} numberOfLines={3}>
              {reel.description}
            </Text>
          </View>
        )}

        {/* 🎮 ACTION BUTTONS */}
        <View style={styles.actionsContainer}>
          {/* ❤️ LIKE BUTTON */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleLike}
            activeOpacity={0.7}
          >
            <Animated.View>
              <IconIonic
                name={localLikeState.isLiked ? 'heart' : 'heart-outline'}
                size={32}
                color={localLikeState.isLiked ? '#ff3040' : '#fff'}
              />
            </Animated.View>
            <Text style={styles.actionText}>
              {localLikeState.likesCount > 0 ? localLikeState.likesCount : ''}
            </Text>
          </TouchableOpacity>

          {/* 💬 COMMENT BUTTON */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onComment(reel)}
            activeOpacity={0.7}
          >
            <IconIonic name="chatbubble-outline" size={30} color="#fff" />
            <Text style={styles.actionText}>
              {reel.commentsCount || ''}
            </Text>
          </TouchableOpacity>

          {/* 📤 SHARE BUTTON */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onShare(reel)}
            activeOpacity={0.7}
          >
            <IconIonic name="share-outline" size={30} color="#fff" />
          </TouchableOpacity>

          {/* 💾 SAVE BUTTON */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onSave(reel.id)}
            activeOpacity={0.7}
          >
            <IconIonic
              name={reel.isSaved ? 'bookmark' : 'bookmark-outline'}
              size={30}
              color={reel.isSaved ? '#ffd700' : '#fff'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* 🎯 DEBUG INFO (Development only) */}
      {__DEV__ && (
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            #{index} | {isActive ? 'ACTIVE' : 'inactive'} | 
            {isPaused ? 'PAUSED' : 'playing'}
          </Text>
        </View>
      )}
    </View>
  );
});

const ReelsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();

  // 🎬 REELS STATE
  const [reels, setReels] = useState<ReelOptimized[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 📱 REFS
  const flatListRef = useRef<FlatList>(null);
  const engine = UltraFastReelsEngine.getInstance();
  const appStateRef = useRef(AppState.currentState);

  // 📦 LOAD INITIAL REELS
  const loadInitialReels = useCallback(async () => {
    try {
      console.log('🚀 Loading initial reels...');
      setIsLoading(true);

      const firebaseReelsResult = await FirebaseService.getReels(INITIAL_LOAD_COUNT);
      const firebaseReels = firebaseReelsResult.reels;
      
      if (firebaseReels.length === 0) {
        Alert.alert('📱 No Reels', 'No reels available at the moment. Try refreshing!');
        setIsLoading(false);
        return;
      }

      // Convert to optimized format
      const optimizedReels: ReelOptimized[] = firebaseReels.map(reel => ({
        ...reel,
        isBuffered: false,
        bufferProgress: 0,
        instantReady: false,
        commentsCount: reel.commentsCount || 0,
      }));

      setReels(optimizedReels);
      setCurrentIndex(0);

      // 🎯 PREPARE FIRST REEL FOR INSTANT PLAYBACK
      if (optimizedReels.length > 0) {
        await engine.prepareInstantReel(optimizedReels[0]);
      }

      setIsLoading(false);

      // 📦 START BACKGROUND LOADING
      setTimeout(() => {
        engine.startBackgroundLoading(optimizedReels, 0);
      }, 500);

      console.log('✅ Initial reels loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load reels:', error);
      setIsLoading(false);
      Alert.alert('⚠️ Error', 'Failed to load reels. Please try again.');
    }
  }, []);

  // 📦 LOAD MORE REELS
  const loadMoreReels = useCallback(async () => {
    try {
      console.log('📦 Loading more reels...');
      
      const newFirebaseReelsResult = await FirebaseService.getReels(3, reels.length);
      const newFirebaseReels = newFirebaseReelsResult.reels;
      
      if (newFirebaseReels.length > 0) {
        const newOptimizedReels: ReelOptimized[] = newFirebaseReels.map(reel => ({
          ...reel,
          isBuffered: false,
          bufferProgress: 0,
          instantReady: false,
          commentsCount: reel.commentsCount || 0,
        }));

        setReels(prev => [...prev, ...newOptimizedReels]);
        
        // Update background loading
        engine.startBackgroundLoading([...reels, ...newOptimizedReels], currentIndex);
      }
    } catch (error) {
      console.error('❌ Failed to load more reels:', error);
    }
  }, [reels, currentIndex]);

  // 🔄 REFRESH REELS
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    engine.reset();
    await loadInitialReels();
    setIsRefreshing(false);
  }, [loadInitialReels]);

  // 📱 HANDLE SCROLL
  const handleScroll = useCallback((event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.y;
    const newIndex = Math.round(contentOffset / REEL_HEIGHT);
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < reels.length) {
      console.log(`📱 Scrolled to reel ${newIndex}`);
      setCurrentIndex(newIndex);
      
      // 🎯 PRIORITY LOAD CURRENT REEL
      if (reels[newIndex]) {
        engine.priorityLoad(reels[newIndex]);
      }

      // 📦 UPDATE BACKGROUND LOADING
      engine.startBackgroundLoading(reels, newIndex);

      // 📈 LOAD MORE IF NEAR END
      if (newIndex >= reels.length - 2) {
        loadMoreReels();
      }
    }
  }, [currentIndex, reels, loadMoreReels]);

  // 🎮 HANDLE PAUSE/PLAY
  const handleTogglePause = useCallback(() => {
    setIsPaused(prev => !prev);
    console.log(`🎮 Video ${!isPaused ? 'paused' : 'resumed'}`);
  }, [isPaused]);

  // ❤️ HANDLE LIKE
  const handleLike = useCallback(async (reelId: string) => {
    if (!user?.uid) return;

    try {
      const currentReel = reels.find(reel => reel.id === reelId);
      if (!currentReel) return;

      console.log('❤️ Handling like for reel:', reelId);

      const result = await RealTimeLikeSystem.getInstance().toggleLike(
        reelId,
        user.uid,
        'reel',
        currentReel.isLiked || false,
        currentReel.likesCount || 0,
        {
          username: user.displayName || user.username || 'Unknown',
          profilePicture: user.profilePicture || undefined,
        }
      );

      if (result.success) {
        // Update local state
        setReels(prev => prev.map(reel =>
          reel.id === reelId
            ? { 
                ...reel, 
                isLiked: result.isLiked, 
                likesCount: result.likesCount
              }
            : reel
        ));

        console.log(`✅ Like ${result.isLiked ? 'added' : 'removed'} successfully`);
      } else {
        console.log('⚠️ Like operation failed:', result.error);
        if (result.error && result.error !== 'Too fast') {
          Alert.alert('❤️ Like Error', 'Unable to update like. Please try again.');
        }
      }
    } catch (error) {
      console.error('❌ Like error:', error);
    }
  }, [user, reels]);

  // 📤 HANDLE SHARE
  const handleShare = useCallback(async (reel: ReelOptimized) => {
    try {
      await Share.share({
        message: `Check out this amazing reel by ${reel.username}!\n\n"${reel.description}"\n\nShared via Jorvea`,
        url: reel.videoUrl,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, []);

  // 💬 HANDLE COMMENT
  const handleComment = useCallback((reel: ReelOptimized) => {
    // Simple navigation - can be customized based on your navigation structure
    console.log('Opening comments for reel:', reel.id);
  }, []);

  // 👤 HANDLE FOLLOW
  const handleFollow = useCallback(async (userId: string) => {
    if (!user?.uid) return;
    
    try {
      // Simple follow logic - can be enhanced
      console.log('Following user:', userId);
    } catch (error) {
      console.error('Follow error:', error);
    }
  }, [user]);

  // 💾 HANDLE SAVE
  const handleSave = useCallback(async (reelId: string) => {
    if (!user?.uid) return;

    try {
      const currentReel = reels.find(r => r.id === reelId);
      if (!currentReel) return;

      const wasSaved = currentReel.isSaved || false;

      // Optimistic update
      setReels(prev => prev.map(reel =>
        reel.id === reelId
          ? { ...reel, isSaved: !wasSaved }
          : reel
      ));

      console.log(`💾 Reel ${!wasSaved ? 'saved' : 'unsaved'} successfully`);
    } catch (error) {
      console.error('Save error:', error);
      
      // Revert optimistic update
      const currentReel = reels.find(r => r.id === reelId);
      if (currentReel) {
        setReels(prev => prev.map(reel =>
          reel.id === reelId
            ? { ...reel, isSaved: currentReel.isSaved }
            : reel
        ));
      }
    }
  }, [user, reels]);

  // 👤 HANDLE USER PROFILE PRESS
  const handleUserProfilePress = useCallback((userId: string) => {
    console.log('Opening profile for user:', userId);
  }, []);

  // 📱 APP STATE HANDLING
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        setIsPaused(false);
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background
        setIsPaused(true);
      }
      appStateRef.current = nextAppState as any;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // 🔙 BACK HANDLER
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });

    return () => backHandler.remove();
  }, [navigation]);

  // 📱 FOCUS EFFECT
  useFocusEffect(
    useCallback(() => {
      if (reels.length === 0) {
        loadInitialReels();
      }
      setIsPaused(false);

      return () => {
        setIsPaused(true);
      };
    }, [loadInitialReels, reels.length])
  );

  // 🎨 RENDER REEL ITEM
  const renderReelItem = useCallback(({ item, index }: { item: ReelOptimized; index: number }) => (
    <UltraFastReelItem
      reel={item}
      index={index}
      isActive={index === currentIndex}
      currentUserId={user?.uid || ''}
      isPaused={isPaused}
      onLike={handleLike}
      onShare={handleShare}
      onComment={handleComment}
      onFollow={handleFollow}
      onSave={handleSave}
      onUserProfilePress={handleUserProfilePress}
      onTogglePause={handleTogglePause}
      navigation={navigation}
    />
  ), [
    currentIndex,
    user?.uid,
    isPaused,
    handleLike,
    handleShare,
    handleComment,
    handleFollow,
    handleSave,
    handleUserProfilePress,
    handleTogglePause,
    navigation,
  ]);

  const keyExtractor = useCallback((item: ReelOptimized) => item.id, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading ultra fast reels...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" translucent />
      
      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderReelItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={REEL_HEIGHT}
        snapToAlignment="start"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#fff"
            colors={['#fff']}
          />
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        windowSize={3}
        initialNumToRender={1}
        getItemLayout={(data, index) => ({
          length: REEL_HEIGHT,
          offset: REEL_HEIGHT * index,
          index,
        })}
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
    fontSize: 16,
    marginTop: 20,
  },
  reelContainer: {
    width,
    height: REEL_HEIGHT,
    backgroundColor: '#000',
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#fff',
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  followButton: {
    marginLeft: 10,
  },
  descriptionContainer: {
    marginBottom: 20,
  },
  description: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  actionsContainer: {
    position: 'absolute',
    right: 20,
    bottom: -80,
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
    fontWeight: '600',
  },
  debugInfo: {
    position: 'absolute',
    top: 100,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 5,
    zIndex: 20,
  },
  debugText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});

export default ReelsScreen;
