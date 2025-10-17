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
  PanResponder,
} from 'react-native';
import { PanGestureHandler, TapGestureHandler, State } from 'react-native-gesture-handler';
import Video, { VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconIonic from 'react-native-vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import FirebaseService, { Reel } from '../services/firebaseService';
import LinearGradient from 'react-native-linear-gradient';

const { width, height } = Dimensions.get('window');
const REEL_HEIGHT = height;

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

const ProfessionalReelItem: React.FC<ReelItemProps> = ({
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
  const { colors } = useTheme();
  const [paused, setPaused] = useState(!isActive);
  const [muted, setMuted] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [liked, setLiked] = useState(reel.isLiked || false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [viewCount, setViewCount] = useState(reel.viewsCount || 0);
  const [hasViewed, setHasViewed] = useState(false);
  const [showUserInfo, setShowUserInfo] = useState(true);
  
  const videoRef = useRef<VideoRef>(null);
  const heartAnimation = useRef<Animated.Value>(new Animated.Value(0)).current;
  const progressAnim = useRef<Animated.Value>(new Animated.Value(0)).current;
  const userInfoOpacity = useRef<Animated.Value>(new Animated.Value(1)).current;
  const actionButtonsScale = useRef<Animated.Value>(new Animated.Value(1)).current;

  // Auto-hide user info after 3 seconds, then show again on interaction
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(userInfoOpacity, {
        toValue: 0.7,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Update pause state when isActive changes
  useEffect(() => {
    setPaused(!isActive);
    
    // Track view when reel becomes active
    if (isActive && !hasViewed) {
      const viewTimer = setTimeout(() => {
        handleViewCount();
        setHasViewed(true);
      }, 2000);

      return () => clearTimeout(viewTimer);
    }
  }, [isActive, hasViewed]);

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

  const handleProgress = (data: any) => {
    setCurrentTime(data.currentTime);
    const progressValue = data.currentTime / duration;
    setProgress(progressValue);
    
    Animated.timing(progressAnim, {
      toValue: progressValue,
      duration: 100,
      useNativeDriver: false,
    }).start();
  };

  const handleSingleTap = () => {
    setPaused(!paused);
    
    // Show user info on interaction
    Animated.timing(userInfoOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Hide again after 3 seconds
    setTimeout(() => {
      Animated.timing(userInfoOpacity, {
        toValue: 0.7,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 3000);
  };

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

      // Action buttons scale animation
      Animated.sequence([
        Animated.timing(actionButtonsScale, {
          toValue: 1.1,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(actionButtonsScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      Vibration.vibrate(50);
    }
  };

  const handleLike = () => {
    setLiked(!liked);
    onLike(reel.id);
    
    if (!liked) {
      // Heart animation for manual like
      Animated.sequence([
        Animated.timing(heartAnimation, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(heartAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleSave = () => {
    setSaved(!saved);
    onSave(reel.id);
  };

  const handleFollow = () => {
    if (reel.userId !== currentUserId) {
      setFollowing(!following);
      onFollow(reel.userId);
    }
  };

  const formatViewCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const formatTime = (timeInSeconds: number): string => {
    const mins = Math.floor(timeInSeconds / 60);
    const secs = Math.floor(timeInSeconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Create pan responder for single and double tap
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const now = Date.now();
      const { locationX, locationY } = evt.nativeEvent;
      
      // Check if it's a double tap (within 300ms and same location)
      if (panResponder.lastTap && (now - panResponder.lastTap) < 300) {
        handleDoubleTap();
        panResponder.lastTap = null;
      } else {
        panResponder.lastTap = now;
        setTimeout(() => {
          if (panResponder.lastTap === now) {
            handleSingleTap();
          }
        }, 300);
      }
    },
  });

  return (
    <View style={styles.reelContainer}>
      {/* Video Player */}
      <View style={styles.videoContainer} {...panResponder.panHandlers}>
        <Video
          ref={videoRef}
          source={{ uri: reel.videoUrl }}
          style={styles.video}
          resizeMode="cover"
          paused={paused}
          muted={muted}
          repeat={true}
          onLoad={handleVideoLoad}
          onProgress={handleProgress}
          onError={(error) => console.error('Video error:', error)}
        />
        
        {/* Loading indicator */}
        {videoLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

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
                    outputRange: [0, 1.3],
                  }),
                },
              ],
            }
          ]}
        >
          <Icon name="favorite" size={100} color="#ff3040" />
        </Animated.View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Animated.View 
          style={[
            styles.progressBar,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              })
            }
          ]} 
        />
      </View>

      {/* Right Side Actions */}
      <Animated.View 
        style={[
          styles.rightActions,
          { transform: [{ scale: actionButtonsScale }] }
        ]}
      >
        {/* Profile Picture */}
        <TouchableOpacity 
          style={styles.profileContainer}
          onPress={() => {
            if (reel.userId !== currentUserId) {
              navigation.navigate('UserProfile', { 
                userId: reel.userId, 
                user: reel.user 
              });
            }
          }}
        >
          {reel.user?.profilePicture ? (
            <Image 
              source={{ uri: reel.user.profilePicture }} 
              style={styles.profileImage}
            />
          ) : (
            <View style={[styles.profileImage, styles.defaultProfile]}>
              <Icon name="person" size={24} color="#fff" />
            </View>
          )}
          {reel.userId !== currentUserId && (
            <TouchableOpacity 
              style={[styles.followButton, following && styles.followingButton]}
              onPress={handleFollow}
            >
              <Icon 
                name={following ? "check" : "add"} 
                size={16} 
                color={following ? "#000" : "#fff"} 
              />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Like Button */}
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Icon 
            name={liked ? "favorite" : "favorite-border"} 
            size={32} 
            color={liked ? "#ff3040" : "#fff"} 
          />
          <Text style={styles.actionText}>
            {formatViewCount(reel.likesCount || 0)}
          </Text>
        </TouchableOpacity>

        {/* Comment Button */}
        <TouchableOpacity style={styles.actionButton} onPress={() => onComment(reel)}>
          <Icon name="chat-bubble-outline" size={32} color="#fff" />
          <Text style={styles.actionText}>
            {formatViewCount(reel.commentsCount || 0)}
          </Text>
        </TouchableOpacity>

        {/* Share Button */}
        <TouchableOpacity style={styles.actionButton} onPress={() => onShare(reel)}>
          <Icon name="share" size={32} color="#fff" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>

        {/* Save Button */}
        <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
          <Icon 
            name={saved ? "bookmark" : "bookmark-border"} 
            size={32} 
            color={saved ? "#ffd700" : "#fff"} 
          />
        </TouchableOpacity>

        {/* More Options */}
        <TouchableOpacity style={styles.actionButton}>
          <Icon name="more-vert" size={32} color="#fff" />
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom User Info */}
      <Animated.View 
        style={[
          styles.bottomInfo,
          { opacity: userInfoOpacity }
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
          style={styles.gradientOverlay}
        />
        
        <View style={styles.userInfoContainer}>
          {/* Username and Verification */}
          <TouchableOpacity 
            style={styles.userNameContainer}
            onPress={() => {
              if (reel.userId !== currentUserId) {
                navigation.navigate('UserProfile', { 
                  userId: reel.userId, 
                  user: reel.user 
                });
              }
            }}
          >
            <Text style={styles.userName}>
              @{reel.user?.username || reel.user?.displayName || 'user'}
            </Text>
            {reel.user?.isVerified && (
              <Icon name="verified" size={16} color="#1DA1F2" />
            )}
          </TouchableOpacity>

          {/* Description */}
          {reel.caption && (
            <Text style={styles.description} numberOfLines={2}>
              {reel.caption}
            </Text>
          )}

          {/* Hashtags */}
          {reel.hashtags && reel.hashtags.length > 0 && (
            <View style={styles.hashtagsContainer}>
              {reel.hashtags.slice(0, 3).map((hashtag, index) => (
                <Text key={index} style={styles.hashtag}>
                  #{hashtag}
                </Text>
              ))}
              {reel.hashtags.length > 3 && (
                <Text style={styles.moreHashtags}>
                  +{reel.hashtags.length - 3} more
                </Text>
              )}
            </View>
          )}

          {/* Music Info */}
          {reel.music && (
            <View style={styles.musicContainer}>
              <Icon name="music-note" size={14} color="#fff" />
              <Text style={styles.musicText} numberOfLines={1}>
                {reel.music.title} - {reel.music.artist}
              </Text>
            </View>
          )}

          {/* Video Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Icon name="visibility" size={14} color="#fff" />
              <Text style={styles.statText}>{formatViewCount(viewCount)} views</Text>
            </View>
            
            <View style={styles.statItem}>
              <Icon name="schedule" size={14} color="#fff" />
              <Text style={styles.statText}>{formatTime(duration)}</Text>
            </View>
          </View>
        </View>

        {/* Mute/Unmute Button */}
        <TouchableOpacity
          style={styles.muteButton}
          onPress={() => setMuted(!muted)}
        >
          <Icon
            name={muted ? "volume-off" : "volume-up"}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const ProfessionalReelsScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Load reels
  const loadReels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedReels = await FirebaseService.getReels();
      setReels(fetchedReels);
    } catch (error) {
      console.error('Error loading reels:', error);
      setError('Failed to load reels. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh reels
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadReels();
    setRefreshing(false);
  }, [loadReels]);

  // Initial load
  useEffect(() => {
    loadReels();
  }, [loadReels]);

  // Handle like
  const handleLike = useCallback(async (reelId: string) => {
    try {
      await FirebaseService.toggleReelLike(reelId, user?.uid || '');
      // Update local state
      setReels(prev => prev.map(reel => 
        reel.id === reelId 
          ? { 
              ...reel, 
              isLiked: !reel.isLiked,
              likesCount: reel.isLiked 
                ? (reel.likesCount || 1) - 1 
                : (reel.likesCount || 0) + 1
            }
          : reel
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  }, [user?.uid]);

  // Handle save
  const handleSave = useCallback(async (reelId: string) => {
    try {
      await FirebaseService.toggleReelSave(reelId, user?.uid || '');
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  }, [user?.uid]);

  // Handle follow
  const handleFollow = useCallback(async (userId: string) => {
    try {
      await FirebaseService.toggleFollow(user?.uid || '', userId);
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  }, [user?.uid]);

  // Handle share
  const handleShare = useCallback(async (reel: Reel) => {
    try {
      await Share.share({
        message: `Check out this reel by ${reel.user?.username}: ${reel.caption}`,
        url: reel.videoUrl,
      });
    } catch (error) {
      console.error('Error sharing reel:', error);
    }
  }, []);

  // Handle comment
  const handleComment = useCallback((reel: Reel) => {
    // Navigate to comments screen or open comments modal
    navigation.navigate('Comments', { reelId: reel.id, contentType: 'reel' });
  }, [navigation]);

  // Handle scroll to track current reel
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 50,
  };

  const renderReel = useCallback(({ item, index }: { item: Reel; index: number }) => (
    <ProfessionalReelItem
      reel={item}
      isActive={index === currentIndex}
      currentUserId={user?.uid || ''}
      onLike={handleLike}
      onShare={handleShare}
      onComment={handleComment}
      onFollow={handleFollow}
      onSave={handleSave}
      navigation={navigation}
    />
  ), [currentIndex, user?.uid, handleLike, handleShare, handleComment, handleFollow, handleSave, navigation]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading Reels...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={48} color={colors.error} />
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadReels}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="video-library" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No reels available
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadReels}>
          <Text style={styles.retryButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <FlatList
        ref={flatListRef}
        data={reels}
        renderItem={renderReel}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={REEL_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(data, index) => ({
          length: REEL_HEIGHT,
          offset: REEL_HEIGHT * index,
          index,
        })}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        removeClippedSubviews={true}
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  reelContainer: {
    width,
    height: REEL_HEIGHT,
    backgroundColor: '#000',
    position: 'relative',
  },
  videoContainer: {
    width,
    height: REEL_HEIGHT,
    position: 'relative',
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
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
  },
  heartContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -50,
    marginLeft: -50,
    zIndex: 1000,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#fff',
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    alignItems: 'center',
  },
  profileContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
  },
  defaultProfile: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  followButton: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff3040',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  followingButton: {
    backgroundColor: '#fff',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 16,
    padding: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 80,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: -1,
  },
  userInfoContainer: {
    flex: 1,
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 6,
  },
  description: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  hashtagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  hashtag: {
    color: '#1DA1F2',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
    marginBottom: 4,
  },
  moreHashtags: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  musicContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  musicText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    maxWidth: 200,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  statText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginLeft: 4,
  },
  muteButton: {
    position: 'absolute',
    bottom: 20,
    right: -64,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#ff3040',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ProfessionalReelsScreen;
