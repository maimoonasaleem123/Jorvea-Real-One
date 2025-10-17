/**
 * Instagram-Style Post Card Component
 * Complete implementation with all Instagram features
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Animated,
  Vibration,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import Video, { VideoRef } from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';

const { width } = Dimensions.get('window');
const POST_WIDTH = width;
const POST_HEIGHT = POST_WIDTH;

interface InstagramPostCardProps {
  post: any;
  onLike: (postId: string) => Promise<void>;
  onComment: (post: any) => void;
  onShare: (post: any) => void;
  onSave: (postId: string) => Promise<void>;
  onUserPress: (userId: string) => void;
  onMorePress: (post: any) => void;
  currentUserId: string;
}

export const InstagramPostCard: React.FC<InstagramPostCardProps> = ({
  post,
  onLike,
  onComment,
  onShare,
  onSave,
  onUserPress,
  onMorePress,
  currentUserId,
}) => {
  // Media carousel state
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  
  // Like animation state
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [optimisticLikeState, setOptimisticLikeState] = useState({
    isLiked: post.isLiked || false,
    likesCount: post.likesCount || 0,
    isOptimistic: false
  });
  const likeButtonAnimation = useRef(new Animated.Value(1)).current;
  const heartAnimation = useRef(new Animated.Value(0)).current;
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  
  // Save state
  const [localIsSaved, setLocalIsSaved] = useState(post.isSaved || false);
  
  // Update optimistic state when post prop changes
  useEffect(() => {
    setOptimisticLikeState({
      isLiked: post.isLiked || false,
      likesCount: post.likesCount || 0,
      isOptimistic: false
    });
    setLocalIsSaved(post.isSaved || false);
  }, [post.isLiked, post.likesCount, post.isSaved]);
  
  // Instagram-style double tap to like
  const handleDoubleTap = useCallback(() => {
    if (!optimisticLikeState.isLiked) {
      handleLikePress();
    }
  }, [optimisticLikeState.isLiked]);
  
  // Instagram-style like handler
  const handleLikePress = useCallback(async () => {
    if (likeAnimating) return;
    
    try {
      setLikeAnimating(true);
      
      const newIsLiked = !optimisticLikeState.isLiked;
      const newLikesCount = newIsLiked 
        ? optimisticLikeState.likesCount + 1 
        : Math.max(0, optimisticLikeState.likesCount - 1);
      
      setOptimisticLikeState({
        isLiked: newIsLiked,
        likesCount: newLikesCount,
        isOptimistic: true
      });
      
      // Heart animation for like
      if (newIsLiked) {
        setShowHeartAnimation(true);
        heartAnimation.setValue(0);
        Animated.parallel([
          Animated.timing(heartAnimation, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(heartAnimation, {
              toValue: 1.2,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(heartAnimation, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => setShowHeartAnimation(false));
      }
      
      // Button bounce animation
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
      
      Vibration.vibrate(newIsLiked ? [50, 100, 50] : 30);
      
      await onLike(post.id);
      
    } catch (error) {
      console.error('❌ Like failed:', error);
      setOptimisticLikeState({
        isLiked: post.isLiked || false,
        likesCount: post.likesCount || 0,
        isOptimistic: false
      });
    } finally {
      setLikeAnimating(false);
    }
  }, [post.id, post.isLiked, post.likesCount, optimisticLikeState, likeAnimating, onLike]);
  
  // Save handler
  const handleSavePress = useCallback(async () => {
    try {
      setLocalIsSaved(!localIsSaved);
      await onSave(post.id);
    } catch (error) {
      console.error('❌ Save failed:', error);
      setLocalIsSaved(localIsSaved);
    }
  }, [post.id, localIsSaved, onSave]);
  
  // Render media item (image or video)
  const renderMediaItem = useCallback(({ item, index }: { item: any; index: number }) => {
    const isVideo = item.type === 'video' || item.mediaUrl?.includes('.mp4') || item.mediaUrl?.includes('.mov');
    
    if (isVideo) {
      return (
        <View style={styles.mediaContainer}>
          <Video
            source={{ uri: item.mediaUrl || item.url }}
            style={styles.media}
            resizeMode="cover"
            repeat
            muted={muted}
            paused={currentMediaIndex !== index}
            playInBackground={false}
            playWhenInactive={false}
            ignoreSilentSwitch="ignore"
          />
          <TouchableOpacity
            style={styles.muteButton}
            onPress={() => setMuted(!muted)}>
            <Icon name={muted ? "volume-mute" : "volume-high"} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <Image
        source={{ uri: item.mediaUrl || item.url }}
        style={styles.media}
        resizeMode="cover"
      />
    );
  }, [currentMediaIndex, muted]);
  
  // Get media array
  const mediaArray = post.mediaUrls?.length > 0 
    ? post.mediaUrls.map((url: string, index: number) => ({
        mediaUrl: url,
        type: post.mediaType || 'image',
        id: `${post.id}_${index}`
      }))
    : [{ mediaUrl: post.imageUrl || post.videoUrl, type: post.mediaType || 'image', id: post.id }];
  
  const hasMultipleMedia = mediaArray.length > 1;
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => onUserPress(post.userId)}
          activeOpacity={0.7}>
          <Image
            source={{ 
              uri: post.user?.profilePicture || 
              'https://via.placeholder.com/40x40.png?text=👤' 
            }}
            style={styles.avatar}
          />
          <View style={styles.userDetails}>
            <View style={styles.usernameRow}>
              <Text style={styles.username}>
                {post.user?.username || `user${post.userId?.slice(-4)}`}
              </Text>
              {post.user?.verified && (
                <Icon name="checkmark-circle" size={14} color="#1DA1F2" style={styles.verifiedIcon} />
              )}
            </View>
            {post.location && (
              <Text style={styles.location}>{post.location.name}</Text>
            )}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => onMorePress(post)} style={styles.moreButton}>
          <Icon name="ellipsis-horizontal" size={24} color="#000" />
        </TouchableOpacity>
      </View>
      
      {/* Media Carousel */}
      <View style={styles.mediaWrapper}>
        <FlatList
          ref={flatListRef}
          data={mediaArray}
          renderItem={renderMediaItem}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / POST_WIDTH);
            setCurrentMediaIndex(index);
          }}
          scrollEnabled={hasMultipleMedia}
        />
        
        {/* Double tap to like overlay */}
        <TouchableOpacity
          style={styles.doubleTapOverlay}
          activeOpacity={1}
          onPress={handleDoubleTap}>
          {showHeartAnimation && (
            <Animated.View 
              style={[
                styles.heartAnimationOverlay,
                {
                  opacity: heartAnimation,
                  transform: [{ scale: heartAnimation }]
                }
              ]}
              pointerEvents="none">
              <MaterialIcon name="favorite" size={100} color="#fff" />
            </Animated.View>
          )}
        </TouchableOpacity>
        
        {/* Media indicator dots */}
        {hasMultipleMedia && (
          <View style={styles.dotsContainer}>
            {mediaArray.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentMediaIndex ? styles.activeDot : styles.inactiveDot
                ]}
              />
            ))}
          </View>
        )}
      </View>
      
      {/* Actions */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          {/* Like Button */}
          <Animated.View style={{ transform: [{ scale: likeButtonAnimation }] }}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleLikePress}
              activeOpacity={0.7}
              disabled={likeAnimating}>
              <MaterialIcon
                name={optimisticLikeState.isLiked ? "favorite" : "favorite-border"}
                size={28}
                color={optimisticLikeState.isLiked ? "#ff3040" : "#000"}
              />
            </TouchableOpacity>
          </Animated.View>
          
          {/* Comment Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => onComment(post)}
            activeOpacity={0.7}>
            <Icon name="chatbubble-outline" size={26} color="#000" />
          </TouchableOpacity>
          
          {/* Share Button */}
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => onShare(post)}
            activeOpacity={0.7}>
            <Icon name="paper-plane-outline" size={26} color="#000" />
          </TouchableOpacity>
        </View>
        
        {/* Save Button */}
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={handleSavePress}
          activeOpacity={0.7}>
          <Icon
            name={localIsSaved ? "bookmark" : "bookmark-outline"}
            size={26}
            color="#000"
          />
        </TouchableOpacity>
      </View>
      
      {/* Post Info */}
      <View style={styles.postInfo}>
        {/* Likes Count */}
        {optimisticLikeState.likesCount > 0 && (
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={[
              styles.likesCount,
              optimisticLikeState.isOptimistic && { opacity: 0.8 }
            ]}>
              {optimisticLikeState.likesCount.toLocaleString()} likes
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Caption */}
        {post.caption && (
          <View style={styles.captionContainer}>
            <Text style={styles.caption} numberOfLines={2}>
              <Text style={styles.captionUsername}>
                {post.user?.username || `user${post.userId?.slice(-4)}`}
              </Text>
              {' '}
              {post.caption}
            </Text>
          </View>
        )}
        
        {/* View Comments */}
        {post.commentsCount > 0 && (
          <TouchableOpacity onPress={() => onComment(post)} activeOpacity={0.7}>
            <Text style={styles.viewComments}>
              View all {post.commentsCount} comments
            </Text>
          </TouchableOpacity>
        )}
        
        {/* Time Ago */}
        {post.createdAt && (
          <Text style={styles.timeAgo}>
            {formatTimeAgo(post.createdAt)}
          </Text>
        )}
      </View>
    </View>
  );
};

// Helper function to format time ago
const formatTimeAgo = (timestamp: any): string => {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return `${Math.floor(seconds / 604800)}w ago`;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  userDetails: {
    marginLeft: 10,
    flex: 1,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#262626',
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  location: {
    fontSize: 12,
    color: '#262626',
    marginTop: 1,
  },
  moreButton: {
    padding: 4,
  },
  mediaWrapper: {
    width: POST_WIDTH,
    height: POST_HEIGHT,
    backgroundColor: '#000',
  },
  mediaContainer: {
    width: POST_WIDTH,
    height: POST_HEIGHT,
  },
  media: {
    width: POST_WIDTH,
    height: POST_HEIGHT,
  },
  muteButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 20,
  },
  doubleTapOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartAnimationOverlay: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: '#1DA1F2',
  },
  inactiveDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 16,
    padding: 4,
  },
  postInfo: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  likesCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 6,
  },
  captionContainer: {
    marginBottom: 4,
  },
  caption: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 18,
  },
  captionUsername: {
    fontWeight: '600',
  },
  viewComments: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: 11,
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
});

export default InstagramPostCard;
