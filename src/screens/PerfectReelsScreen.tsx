import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  FlatList,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Text,
  Image,
  ActivityIndicator,
  Share,
  Animated,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import PerfectVideoPlayer from '../components/PerfectVideoPlayer';
import FirebaseService, { Reel } from '../services/firebaseService';

const { width, height } = Dimensions.get('window');
const REEL_HEIGHT = height;

interface ReelItemProps {
  reel: Reel;
  isActive: boolean;
  currentUserId: string;
  onLike: (reelId: string) => void;
  onSave: (reelId: string) => void;
  onShare: (reel: Reel) => void;
  onComment: (reel: Reel) => void;
  onFollow: (userId: string) => void;
}

const PerfectReelItem: React.FC<ReelItemProps> = memo(({
  reel,
  isActive,
  currentUserId,
  onLike,
  onSave,
  onShare,
  onComment,
  onFollow,
}) => {
  const { colors } = useTheme();
  
  // State
  const [liked, setLiked] = useState(reel.isLiked || false);
  const [saved, setSaved] = useState(reel.isSaved || false);
  const [following, setFollowing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [likesCount, setLikesCount] = useState(reel.likesCount || 0);
  const [viewsCount, setViewsCount] = useState(reel.viewsCount || 0);
  
  // Animations
  const userInfoOpacity = useRef(new Animated.Value(1)).current;
  const actionButtonsScale = useRef(new Animated.Value(1)).current;

  // Auto-hide user info
  useEffect(() => {
    if (isActive) {
      const timer = setTimeout(() => {
        Animated.timing(userInfoOpacity, {
          toValue: 0.7,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isActive, userInfoOpacity]);

  // Handle view increment
  const handleViewIncrement = useCallback(() => {
    setViewsCount(prev => prev + 1);
    FirebaseService.incrementReelViews(reel.id).catch(console.error);
  }, [reel.id]);

  // Handle single tap (show user info)
  const handleSingleTap = useCallback(() => {
    Animated.timing(userInfoOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      Animated.timing(userInfoOpacity, {
        toValue: 0.7,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }, 3000);
  }, [userInfoOpacity]);

  // Handle double tap (like)
  const handleDoubleTap = useCallback(() => {
    if (!liked) {
      setLiked(true);
      setLikesCount(prev => prev + 1);
      onLike(reel.id);

      // Button scale animation
      Animated.sequence([
        Animated.timing(actionButtonsScale, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(actionButtonsScale, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [liked, onLike, reel.id, actionButtonsScale]);

  // Handle like button press
  const handleLikePress = useCallback(() => {
    setLiked(!liked);
    setLikesCount(prev => liked ? Math.max(0, prev - 1) : prev + 1);
    onLike(reel.id);
  }, [liked, onLike, reel.id]);

  // Handle save button press
  const handleSavePress = useCallback(() => {
    setSaved(!saved);
    onSave(reel.id);
  }, [saved, onSave, reel.id]);

  // Format numbers
  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return (count / 1000000).toFixed(1) + 'M';
    }
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'K';
    }
    return count.toString();
  };

  return (
    <View style={styles.reelContainer}>
      {/* Perfect Video Player */}
      <PerfectVideoPlayer
        videoUrl={reel.videoUrl}
        isActive={isActive}
        onViewIncrement={handleViewIncrement}
        onSingleTap={handleSingleTap}
        onDoubleTap={handleDoubleTap}
        muted={muted}
        onMuteToggle={setMuted}
        poster={reel.thumbnailUrl}
      />

      {/* Bottom Gradient Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.gradientOverlay}
        pointerEvents="none"
      />

      {/* User Info */}
      <Animated.View 
        style={[
          styles.userInfo,
          { opacity: userInfoOpacity }
        ]}
      >
        <View style={styles.userHeader}>
          <TouchableOpacity style={styles.userProfileContainer}>
            {reel.user?.profilePicture ? (
              <Image 
                source={{ uri: reel.user.profilePicture }} 
                style={styles.userProfileImage}
              />
            ) : (
              <View style={[styles.userProfileImage, styles.defaultProfile]}>
                <Icon name="person" size={24} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.userDetails}>
            <Text style={styles.userName}>@{reel.user?.username || 'unknown'}</Text>
            <Text style={styles.userDescription}>{reel.caption}</Text>
            
            {reel.music && (
              <View style={styles.musicContainer}>
                <Icon name="music-note" size={12} color="#fff" />
                <Text style={styles.musicText}>{reel.music}</Text>
              </View>
            )}
            
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Icon name="visibility" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.statText}>{formatCount(viewsCount)}</Text>
              </View>
              <View style={styles.statItem}>
                <Icon name="favorite" size={16} color="rgba(255,255,255,0.8)" />
                <Text style={styles.statText}>{formatCount(likesCount)}</Text>
              </View>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Action Buttons */}
      <Animated.View 
        style={[
          styles.actionButtons,
          { transform: [{ scale: actionButtonsScale }] }
        ]}
      >
        {/* Profile */}
        <TouchableOpacity style={styles.actionButton}>
          <View style={styles.profileContainer}>
            {reel.user?.profilePicture ? (
              <Image 
                source={{ uri: reel.user.profilePicture }} 
                style={styles.profileImage}
              />
            ) : (
              <View style={[styles.profileImage, styles.defaultProfile]}>
                <Icon name="person" size={20} color="#fff" />
              </View>
            )}
            {currentUserId !== reel.user?.id && !following && (
              <TouchableOpacity 
                style={styles.followButton}
                onPress={() => {
                  setFollowing(true);
                  onFollow(reel.user?.id || '');
                }}
              >
                <Icon name="add" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>

        {/* Like */}
        <TouchableOpacity style={styles.actionButton} onPress={handleLikePress}>
          <Icon 
            name={liked ? "favorite" : "favorite-border"} 
            size={28} 
            color={liked ? "#ff3040" : "#fff"} 
          />
          <Text style={styles.actionText}>{formatCount(likesCount)}</Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity style={styles.actionButton} onPress={() => onComment(reel)}>
          <Icon name="chat-bubble-outline" size={28} color="#fff" />
          <Text style={styles.actionText}>{formatCount(reel.commentsCount || 0)}</Text>
        </TouchableOpacity>

        {/* Save */}
        <TouchableOpacity style={styles.actionButton} onPress={handleSavePress}>
          <Icon 
            name={saved ? "bookmark" : "bookmark-border"} 
            size={28} 
            color={saved ? "#fff" : "#fff"} 
          />
          <Text style={styles.actionText}>Save</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity style={styles.actionButton} onPress={() => onShare(reel)}>
          <Icon name="share" size={28} color="#fff" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.reel.id === nextProps.reel.id &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.currentUserId === nextProps.currentUserId
  );
});

const PerfectReelsScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation();
  
  // State
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Refs
  const flatListRef = useRef<FlatList>(null);

  // Load reels
  const loadReels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const fetchedData = await FirebaseService.getReels();
      const reelsArray = Array.isArray(fetchedData) ? fetchedData : (fetchedData.reels || []);
      setReels(reelsArray);
    } catch (error) {
      console.error('Error loading reels:', error);
      setError('Failed to load reels. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh handler
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
      const result = await FirebaseService.likeReel(reelId, user?.uid || '');
      setReels(prev => prev.map(reel => 
        reel.id === reelId 
          ? { ...reel, isLiked: result.isLiked, likesCount: result.likesCount }
          : reel
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
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

  // Handle share
  const handleShare = useCallback(async (reel: Reel) => {
    try {
      await Share.share({
        message: `Check out this amazing reel by @${reel.user?.username}: ${reel.caption}`,
        url: reel.videoUrl,
      });
    } catch (error) {
      console.error('Error sharing reel:', error);
    }
  }, []);

  // Handle comment
  const handleComment = useCallback((reel: Reel) => {
    console.log('Opening comments for reel:', reel.id);
    // TODO: Implement comments modal or screen
  }, []);

  // Handle follow
  const handleFollow = useCallback(async (userId: string) => {
    try {
      await FirebaseService.toggleFollowUser(user?.uid || '', userId);
    } catch (error) {
      console.error('Error following user:', error);
    }
  }, [user?.uid]);

  // Handle scroll
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
      }
    }
  }, [currentIndex]);

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 80,
    minimumViewTime: 100,
  };

  // Render reel item
  const renderReel = useCallback(({ item, index }: { item: Reel; index: number }) => (
    <PerfectReelItem
      reel={item}
      isActive={index === currentIndex}
      currentUserId={user?.uid || ''}
      onLike={handleLike}
      onSave={handleSave}
      onShare={handleShare}
      onComment={handleComment}
      onFollow={handleFollow}
    />
  ), [currentIndex, user?.uid, handleLike, handleSave, handleShare, handleComment, handleFollow]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Loading amazing reels...</Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="error-outline" size={48} color="#ff3040" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadReels}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Empty state
  if (reels.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Icon name="video-library" size={48} color="rgba(255,255,255,0.6)" />
        <Text style={styles.emptyText}>No reels available</Text>
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#fff']}
            tintColor="#fff"
          />
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={2}
        windowSize={3}
        initialNumToRender={1}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
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
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 1,
  },
  userInfo: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 80,
    zIndex: 2,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userProfileContainer: {
    marginRight: 12,
  },
  userProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
  },
  defaultProfile: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  userDescription: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  musicContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  musicText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    maxWidth: 150,
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
    fontWeight: '500',
  },
  actionButtons: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    alignItems: 'center',
    zIndex: 3,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
    padding: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  profileContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
  },
  followButton: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff3040',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
  errorText: {
    color: '#ff3040',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#ff3040',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default PerfectReelsScreen;
