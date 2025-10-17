import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  Vibration,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import Video, { VideoRef } from 'react-native-video';
import VideoPlayer from './VideoPlayer';
import LinearGradient from 'react-native-linear-gradient';
import LikeButton from './LikeButton';
import SaveButton from './SaveButton';
import { BeautifulCard } from './BeautifulCard';
import { Post } from '../services/firebaseService';

const { width, height } = Dimensions.get('window');
const isTablet = width > 768;
const isSmallScreen = width < 350;
const cardMaxWidth = isTablet ? 500 : width;
const mediaHeight = isSmallScreen ? width * 0.75 : width;

interface EnhancedPostCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onSave: (postId: string) => void;
  onComment: (post: Post) => void;
  onShare: (post: Post) => void;
  onUserPress?: (userId: string) => void;
  onHashtagPress?: (hashtag: string) => void;
  onLocationPress?: (location: string) => void;
  showFullContent?: boolean;
}

export const EnhancedPostCard: React.FC<EnhancedPostCardProps> = ({
  post,
  onLike,
  onSave,
  onComment,
  onShare,
  onUserPress,
  onHashtagPress,
  onLocationPress,
  showFullContent = true,
}) => {
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<VideoRef>(null);
  const musicPulseAnimation = useRef(new Animated.Value(1)).current;
  
  // Instagram-style like animation states
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [optimisticLikeState, setOptimisticLikeState] = useState({
    isLiked: post.isLiked || false,
    likesCount: post.likesCount || 0,
    isOptimistic: false
  });
  const likeButtonAnimation = useRef(new Animated.Value(1)).current;
  const heartAnimation = useRef(new Animated.Value(0)).current;
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);

  // Update optimistic state when post prop changes
  React.useEffect(() => {
    setOptimisticLikeState({
      isLiked: post.isLiked || false,
      likesCount: post.likesCount || 0,
      isOptimistic: false
    });
  }, [post.isLiked, post.likesCount]);

  // Instagram-style perfect like handler
  const handleLikePress = useCallback(async () => {
    if (likeAnimating) return;
    
    try {
      setLikeAnimating(true);
      
      // Optimistic update
      const newIsLiked = !optimisticLikeState.isLiked;
      const newLikesCount = newIsLiked 
        ? optimisticLikeState.likesCount + 1 
        : Math.max(0, optimisticLikeState.likesCount - 1);
      
      setOptimisticLikeState({
        isLiked: newIsLiked,
        likesCount: newLikesCount,
        isOptimistic: true
      });
      
      // Show heart animation for like
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
      
      // Call the actual like handler
      await onLike(post.id);
      
    } catch (error) {
      console.error('❌ Instagram like failed:', error);
      // Revert optimistic update on error
      setOptimisticLikeState({
        isLiked: post.isLiked || false,
        likesCount: post.likesCount || 0,
        isOptimistic: false
      });
    } finally {
      setLikeAnimating(false);
    }
  }, [post.id, post.isLiked, post.likesCount, optimisticLikeState, likeAnimating, onLike, heartAnimation, likeButtonAnimation]);

  React.useEffect(() => {
    if (post.music) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(musicPulseAnimation, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(musicPulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      
      return () => pulseAnimation.stop();
    }
  }, [post.music]);

  const renderSticker = (sticker: any, index: number) => {
    const stickerStyle = {
      position: 'absolute' as const,
      left: sticker.x || 50,
      top: sticker.y || 50,
      transform: [
        { scale: sticker.scale || 1 },
        { rotate: `${sticker.rotation || 0}deg` }
      ],
    };

    const content = () => {
      switch (sticker.type) {
        case 'time':
          return (
            <View style={styles.stickerContent}>
              <Icon name="time" size={16} color="#fff" />
              <Text style={styles.stickerText}>
                {new Date(sticker.data?.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          );
        case 'location':
          return (
            <TouchableOpacity 
              style={styles.stickerContent}
              onPress={() => onLocationPress?.(sticker.data?.name || 'Location')}
            >
              <Icon name="location" size={16} color="#fff" />
              <Text style={styles.stickerText}>{sticker.data?.name || 'Location'}</Text>
            </TouchableOpacity>
          );
        case 'music':
          return (
            <Animated.View 
              style={[
                styles.stickerContent,
                { transform: [{ scale: musicPulseAnimation }] }
              ]}
            >
              <Icon name="musical-notes" size={16} color="#fff" />
              <Text style={styles.stickerText} numberOfLines={1}>
                {sticker.data?.title || 'Music'}
              </Text>
            </Animated.View>
          );
        default:
          return (
            <View style={styles.stickerContent}>
              <Text style={styles.stickerText}>🎉</Text>
            </View>
          );
      }
    };

    return (
      <View key={`sticker-${index}`} style={stickerStyle}>
        {content()}
      </View>
    );
  };

  const renderTextElement = (textElement: any, index: number) => (
    <View
      key={`text-${index}`}
      style={[
        styles.textElement,
        {
          left: textElement.x || 50,
          top: textElement.y || 50,
          transform: [
            { scale: textElement.scale || 1 },
            { rotate: `${textElement.rotation || 0}deg` }
          ],
        }
      ]}
    >
      <Text
        style={[
          styles.textElementText,
          {
            fontSize: textElement.fontSize || 24,
            color: textElement.color || '#FFFFFF',
            fontFamily: textElement.fontFamily || 'System',
            opacity: textElement.opacity || 1,
          },
        ]}
      >
        {textElement.text || 'Text'}
      </Text>
    </View>
  );

  const renderMedia = () => {
    const currentMedia = post.mediaUrls[currentMediaIndex];
    const isVideo = post.type === 'video' || post.mediaType === 'video';

    return (
      <View style={styles.mediaContainer}>
        <View style={styles.mediaWrapper}>
          {isVideo ? (
            <VideoPlayer
              source={{ uri: currentMedia }}
              style={styles.media}
              resizeMode="cover"
              repeat={true}
              muted={muted}
              paused={false}
              showControls={true}
            />
          ) : (
            <Image source={{ uri: currentMedia }} style={styles.media} resizeMode="cover" />
          )}
          
          {/* Filter overlay */}
          {post.filter && post.filter.id !== 'none' && post.filter.colors && post.filter.colors.length > 0 && (
            <View style={styles.filterOverlay}>
              <LinearGradient
                colors={post.filter.colors}
                style={[
                  styles.filterGradient,
                  { opacity: post.filter.intensity || 0.3 }
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            </View>
          )}
          
          {/* Text elements */}
          {post.textElements?.map(renderTextElement)}
          
          {/* Sticker elements */}
          {post.stickerElements?.map(renderSticker)}
        </View>

        {/* Music info overlay */}
        {post.music && (
          <TouchableOpacity style={styles.musicOverlay}>
            <Animated.View 
              style={[
                styles.musicIcon,
                { transform: [{ scale: musicPulseAnimation }] }
              ]}
            >
              <Icon name="musical-notes" size={16} color="#fff" />
            </Animated.View>
            <View style={styles.musicInfo}>
              <Text style={styles.musicTitle} numberOfLines={1}>
                {post.music.title}
              </Text>
              <Text style={styles.musicArtist} numberOfLines={1}>
                {post.music.artist}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Filter info badge */}
        {post.filter && post.filter.id !== 'none' && (
          <View style={styles.filterBadge}>
            <Icon name="color-filter" size={12} color="#fff" />
            <Text style={styles.filterBadgeText}>{post.filter.name}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <BeautifulCard style={styles.postCard}>
      {/* Post Header */}
      <View style={styles.postHeader}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => onUserPress?.(post.userId)}
        >
          {post.user?.profilePicture ? (
            <Image source={{ uri: post.user.profilePicture }} style={styles.avatar} />
          ) : (
            <View style={styles.defaultAvatar}>
              <Text style={styles.defaultAvatarText}>
                {(post.user?.displayName || post.user?.username || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <View style={styles.usernameContainer}>
              <Text style={styles.username}>
                {post.user?.username || post.user?.displayName || `user_${post.userId.slice(-6)}`}
              </Text>
              {post.user?.isVerified && (
                <Icon name="checkmark-circle" size={14} color="#007AFF" />
              )}
            </View>
            {post.location && post.location.name && (
              <TouchableOpacity onPress={() => onLocationPress?.(post.location!.name)}>
                <Text style={styles.location}>{post.location.name}</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.moreButton}>
          <Icon name="ellipsis-horizontal" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Post Media */}
      {renderMedia()}

      {/* Post Actions */}
      <View style={styles.postActions}>
        <View style={styles.leftActions}>
          {/* Instagram-Style Animated Like Button */}
          <Animated.View
            style={{
              transform: [{ scale: likeButtonAnimation }]
            }}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleLikePress}
              activeOpacity={0.7}
              disabled={likeAnimating}>
              <MaterialIcon
                name={optimisticLikeState.isLiked ? "favorite" : "favorite-border"}
                size={30}
                color={optimisticLikeState.isLiked ? "#ff3040" : "#262626"}
              />
            </TouchableOpacity>
          </Animated.View>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => onComment(post)}
          >
            <Icon name="chatbubble-outline" size={28} color="#262626" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => onShare(post)}
          >
            <Icon name="paper-plane-outline" size={28} color="#262626" />
          </TouchableOpacity>
        </View>
        <SaveButton
          isSaved={post.isSaved || false}
          onPress={() => onSave(post.id)}
          size={28}
        />
      </View>
      
      {/* Instagram-style Heart Animation Overlay */}
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
          <MaterialIcon name="favorite" size={80} color="#ff3040" />
        </Animated.View>
      )}

      {/* Post Info */}
      {showFullContent && (
        <View style={styles.postInfo}>
          {optimisticLikeState.likesCount > 0 && (
            <Text style={[
              styles.likesCount,
              optimisticLikeState.isOptimistic && { opacity: 0.8 }
            ]}>
              {optimisticLikeState.likesCount.toLocaleString()} likes
            </Text>
          )}
          
          {post.caption && (
            <View style={styles.captionContainer}>
              <Text style={styles.caption}>
                <Text style={styles.captionUsername}>
                  {post.user?.username || post.user?.displayName}
                </Text>
                {' '}
                {post.caption}
              </Text>
            </View>
          )}

          {post.hashtags && post.hashtags.length > 0 && (
            <View style={styles.hashtagsContainer}>
              {post.hashtags.map((hashtag, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => onHashtagPress?.(hashtag)}
                >
                  <Text style={styles.hashtag}>#{hashtag}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {post.commentsCount > 0 && (
            <TouchableOpacity onPress={() => onComment(post)}>
              <Text style={styles.viewComments}>
                View all {post.commentsCount} comments
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.timeAgo}>
            {new Date(post.createdAt).toLocaleDateString()}
          </Text>
        </View>
      )}
    </BeautifulCard>
  );
};

const styles = StyleSheet.create({
  postCard: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  defaultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  usernameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#262626',
    marginRight: 4,
  },
  location: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
  },
  mediaContainer: {
    position: 'relative',
  },
  mediaWrapper: {
    width: cardMaxWidth,
    height: mediaHeight,
    position: 'relative',
    alignSelf: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  filterGradient: {
    width: '100%',
    height: '100%',
  },
  textElement: {
    position: 'absolute',
    padding: 4,
  },
  textElementText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  stickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  stickerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    maxWidth: 100,
  },
  mediaIndicators: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  mediaIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 2,
  },
  activeIndicator: {
    backgroundColor: '#fff',
  },
  musicOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: width * 0.7,
  },
  musicIcon: {
    marginRight: 8,
  },
  musicInfo: {
    flex: 1,
  },
  musicTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  musicArtist: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
  },
  filterBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  muteButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 20,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  actionButton: {
    padding: 6,
  },
  postInfo: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  likesCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 4,
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
  hashtag: {
    color: '#007AFF',
    fontWeight: '600',
  },
  mention: {
    color: '#007AFF',
    fontWeight: '600',
  },
  hashtagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  viewComments: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: 12,
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  heartAnimationOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -40,
    marginTop: -40,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
});
