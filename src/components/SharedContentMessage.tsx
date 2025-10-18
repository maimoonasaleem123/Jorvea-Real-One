import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const messageWidth = width * 0.7;

interface SharedReelMessageProps {
  reelData: {
    id: string;
    videoUrl: string;
    caption: string;
    thumbnailUrl: string;
    userId: string;
    user: any;
    duration?: number;
    likes?: string[];
    likesCount?: number;
    commentsCount?: number;
    views?: number;
    createdAt?: Date;
  };
  message?: string;
  isOwn: boolean;
  onPress?: () => void;
}

interface SharedPostMessageProps {
  postData: {
    id: string;
    mediaUrls: string[];
    caption: string;
    userId: string;
    user: any;
    likes?: string[];
    likesCount?: number;
    commentsCount?: number;
    createdAt?: Date;
  };
  message?: string;
  isOwn: boolean;
  onPress?: () => void;
}

export const SharedReelMessage: React.FC<SharedReelMessageProps> = ({
  reelData,
  message,
  isOwn,
  onPress,
}) => {
  const navigation = useNavigation();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Navigate to ReelsScreen with return context
      // User can press back to return to chat
      (navigation as any).navigate('Reels', {
        initialReelId: reelData.id,
        focusedReelId: reelData.id,
        userId: reelData.userId,
        returnTo: 'Chat', // Mark where to return
      });
    }
  };

  const formatDuration = (seconds: number = 0) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (views: number = 0) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  return (
    <View style={[styles.sharedContentContainer, isOwn && styles.ownMessage]}>
      <TouchableOpacity style={styles.reelContainer} onPress={handlePress}>
        {/* Reel Thumbnail */}
        <View style={styles.reelThumbnailContainer}>
          <Image
            source={{ uri: reelData.thumbnailUrl || reelData.videoUrl }}
            style={styles.reelThumbnail}
            resizeMode="cover"
          />
          
          {/* Play Button Overlay */}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Icon name="play" size={24} color="#fff" />
            </View>
          </View>
          
          {/* Duration Badge */}
          {reelData.duration && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>
                {formatDuration(reelData.duration)}
              </Text>
            </View>
          )}
          
          {/* Reel Icon */}
          <View style={styles.reelIcon}>
            <Icon name="videocam" size={16} color="#fff" />
          </View>
        </View>
        
        {/* Reel Info */}
        <View style={styles.reelInfo}>
          <View style={styles.reelHeader}>
            <View style={styles.userInfo}>
              {reelData.user?.profilePicture ? (
                <Image
                  source={{ uri: reelData.user.profilePicture }}
                  style={styles.userAvatar}
                />
              ) : (
                <View style={styles.defaultAvatar}>
                  <Text style={styles.avatarText}>
                    {reelData.user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              <Text style={styles.username}>
                {reelData.user?.displayName || reelData.user?.username || 'Unknown'}
              </Text>
            </View>
            <Text style={styles.reelLabel}>Reel</Text>
          </View>
          
          <Text style={styles.reelCaption} numberOfLines={2}>
            {reelData.caption || 'No caption'}
          </Text>
          
          {/* Stats */}
          <View style={styles.reelStats}>
            <View style={styles.statItem}>
              <Icon name="heart" size={14} color="#FF3B30" />
              <Text style={styles.statText}>
                {formatViews(reelData.likesCount || reelData.likes?.length || 0)}
              </Text>
            </View>
            {reelData.commentsCount !== undefined && reelData.commentsCount > 0 && (
              <View style={styles.statItem}>
                <Icon name="chatbubble" size={14} color="#8E8E93" />
                <Text style={styles.statText}>
                  {formatViews(reelData.commentsCount)}
                </Text>
              </View>
            )}
            <View style={styles.statItem}>
              <Icon name="eye" size={14} color="#8E8E93" />
              <Text style={styles.statText}>
                {formatViews(reelData.views || 0)}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
      
      {/* Additional Message */}
      {message && message.trim() !== '' && (
        <Text style={[styles.additionalMessage, isOwn && styles.ownMessageText]}>
          {message}
        </Text>
      )}
    </View>
  );
};

export const SharedPostMessage: React.FC<SharedPostMessageProps> = ({
  postData,
  message,
  isOwn,
  onPress,
}) => {
  const navigation = useNavigation();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Navigate to post detail or home feed
      (navigation as any).navigate('Home', {
        initialPostId: postData.id,
      });
    }
  };

  const formatLikes = (likes: number = 0) => {
    if (likes >= 1000000) {
      return `${(likes / 1000000).toFixed(1)}M`;
    } else if (likes >= 1000) {
      return `${(likes / 1000).toFixed(1)}K`;
    }
    return likes.toString();
  };

  const firstImage = postData.mediaUrls?.[0];
  const hasMultipleImages = postData.mediaUrls && postData.mediaUrls.length > 1;

  return (
    <View style={[styles.sharedContentContainer, isOwn && styles.ownMessage]}>
      <TouchableOpacity style={styles.postContainer} onPress={handlePress}>
        {/* Post Image(s) */}
        {firstImage && (
          <View style={styles.postImageContainer}>
            <Image
              source={{ uri: firstImage }}
              style={styles.postImage}
              resizeMode="cover"
            />
            
            {/* Multiple Images Indicator */}
            {hasMultipleImages && (
              <View style={styles.multipleImagesIndicator}>
                <Icon name="copy-outline" size={16} color="#fff" />
                <Text style={styles.multipleImagesText}>
                  {postData.mediaUrls.length}
                </Text>
              </View>
            )}
            
            {/* Post Icon */}
            <View style={styles.postIcon}>
              <Icon name="image" size={16} color="#fff" />
            </View>
          </View>
        )}
        
        {/* Post Info */}
        <View style={styles.postInfo}>
          <View style={styles.postHeader}>
            <View style={styles.userInfo}>
              {postData.user?.profilePicture ? (
                <Image
                  source={{ uri: postData.user.profilePicture }}
                  style={styles.userAvatar}
                />
              ) : (
                <View style={styles.defaultAvatar}>
                  <Text style={styles.avatarText}>
                    {postData.user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              <Text style={styles.username}>
                {postData.user?.displayName || postData.user?.username || 'Unknown'}
              </Text>
            </View>
            <Text style={styles.postLabel}>Post</Text>
          </View>
          
          <Text style={styles.postCaption} numberOfLines={2}>
            {postData.caption || 'No caption'}
          </Text>
          
          {/* Stats */}
          <View style={styles.postStats}>
            <View style={styles.statItem}>
              <Icon name="heart" size={14} color="#FF3B30" />
              <Text style={styles.statText}>
                {formatLikes(postData.likesCount || postData.likes?.length || 0)}
              </Text>
            </View>
            {postData.commentsCount !== undefined && postData.commentsCount > 0 && (
              <View style={styles.statItem}>
                <Icon name="chatbubble" size={14} color="#8E8E93" />
                <Text style={styles.statText}>
                  {formatLikes(postData.commentsCount)}
                </Text>
              </View>
            )}
            {hasMultipleImages && (
              <View style={styles.statItem}>
                <Icon name="images" size={14} color="#8E8E93" />
                <Text style={styles.statText}>
                  {postData.mediaUrls.length}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
      
      {/* Additional Message */}
      {message && message.trim() !== '' && (
        <Text style={[styles.additionalMessage, isOwn && styles.ownMessageText]}>
          {message}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sharedContentContainer: {
    maxWidth: messageWidth,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  ownMessage: {
    backgroundColor: '#007AFF',
  },
  ownMessageText: {
    color: '#fff',
  },
  
  // Instagram-style Reel Styles
  reelContainer: {
    backgroundColor: '#FFFFFF',
  },
  reelThumbnailContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    backgroundColor: '#000000',
  },
  reelThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2F2F7',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  playButton: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  durationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  durationText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  viewsBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewsText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  reelInfo: {
    padding: 16,
  },
  reelIcon: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  defaultAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reelStats: {
    flexDirection: 'row',
    gap: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
    color: '#262626',
  },
  reelLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  reelCaption: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 20,
    marginBottom: 10,
  },
  customMessageContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    backgroundColor: '#FAFAFA',
  },
  customMessage: {
    fontSize: 13,
    color: '#000000',
    marginTop: 8,
  },
  ownCustomMessage: {
    color: '#FFFFFF',
  },
  
  // Post Styles - Instagram-like
  postContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
  },
  postImageContainer: {
    position: 'relative',
    width: 100,
    height: 100,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2F2F7',
  },
  multipleImagesIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  multipleImagesText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  postIcon: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postInfo: {
    flex: 1,
    padding: 12,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  postLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FF6B35',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  postCaption: {
    fontSize: 12,
    color: '#1A1A1A',
    lineHeight: 16,
    marginBottom: 8,
  },
  postStats: {
    flexDirection: 'row',
    gap: 12,
  },
  
  // Common Styles
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '500',
  },
  additionalMessage: {
    padding: 12,
    paddingTop: 0,
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 18,
  },
});

export default { SharedReelMessage, SharedPostMessage };
