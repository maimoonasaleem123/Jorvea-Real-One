import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Pressable,
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { InstagramLikeButton } from './InstagramLikeButton';
import { EnhancedDoubleTapLike } from './EnhancedDoubleTapLike';
import { useTheme } from '../context/ThemeContext';
import { Post } from '../services/firebaseService';

interface EnhancedPostItemProps {
  post: Post;
  onLike: (postId: string) => void;
  onComment: (post: Post) => void;
  onShare: (post: Post) => void;
  onSave: (postId: string) => void;
  onUserPress: (userId: string) => void;
}

const { width } = Dimensions.get('window');

export const EnhancedPostItem: React.FC<EnhancedPostItemProps> = ({
  post,
  onLike,
  onComment,
  onShare,
  onSave,
  onUserPress,
}) => {
  const { colors } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<VideoRef>(null);

  const isVideo = post.mediaUrls[0]?.includes('.mp4') || post.mediaUrls[0]?.includes('.mov');

  const togglePlayback = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const toggleControls = useCallback(() => {
    setShowControls(!showControls);
    if (!showControls) {
      setTimeout(() => setShowControls(false), 3000);
    }
  }, [showControls]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderMedia = () => {
    if (isVideo) {
      return (
        <EnhancedDoubleTapLike
          contentId={post.id}
          contentType="post"
          onSingleTap={toggleControls}
          style={styles.mediaContainer}
        >
          <Video
            ref={videoRef}
            source={{ uri: post.mediaUrls[0] }}
            style={styles.media}
            resizeMode="cover"
            paused={!isPlaying}
            onLoad={(data) => setDuration(data.duration)}
            onProgress={(data) => setCurrentTime(data.currentTime)}
            onEnd={() => setIsPlaying(false)}
            repeat={false}
          />
          
          {/* Video Controls Overlay */}
          {showControls && (
            <View style={styles.videoControls}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={togglePlayback}
              >
                <Icon
                  name={isPlaying ? 'pause' : 'play'}
                  size={24}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
              
              <View style={styles.timeInfo}>
                <Text style={styles.timeText}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Text>
              </View>
            </View>
          )}
          
          {/* Video Progress Bar */}
          {duration > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(currentTime / duration) * 100}%` }
                  ]}
                />
              </View>
            </View>
          )}
        </EnhancedDoubleTapLike>
      );
    }

    return (
      <EnhancedDoubleTapLike
        contentId={post.id}
        contentType="post"
        style={styles.mediaContainer}
      >
        <Image source={{ uri: post.mediaUrls[0] }} style={styles.media} />
      </EnhancedDoubleTapLike>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => onUserPress(post.userId)}
        >
          <Image
            source={{
              uri: post.user?.profilePicture || 'https://via.placeholder.com/40',
            }}
            style={styles.avatar}
          />
          <View>
            <Text style={[styles.username, { color: colors.text }]}>
              {post.user?.username || post.user?.displayName}
            </Text>
            {post.location && (
              <Text style={[styles.location, { color: colors.textSecondary }]}>
                {post.location}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.moreButton}>
          <Icon name="ellipsis-horizontal" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Media */}
      {renderMedia()}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <View style={styles.leftActions}>
          <InstagramLikeButton
            contentId={post.id}
            contentType="post"
            initialLiked={post.isLiked}
            initialCount={post.likesCount}
            size="large"
            showCount={false}
            showAnimation={true}
          />
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onComment(post)}
          >
            <Icon name="chatbubble-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onShare(post)}
          >
            <Icon name="paper-plane-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => onSave(post.id)}>
          <Icon name="bookmark-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Like Count */}
      {post.likesCount > 0 && (
        <TouchableOpacity style={styles.likesContainer}>
          <Text style={[styles.likesText, { color: colors.text }]}>
            {post.likesCount === 1 ? '1 like' : `${post.likesCount.toLocaleString()} likes`}
          </Text>
        </TouchableOpacity>
      )}

      {/* Caption */}
      {post.caption && (
        <View style={styles.captionContainer}>
          <Text style={[styles.caption, { color: colors.text }]}>
            <Text style={styles.captionUsername}>
              {post.user?.username || post.user?.displayName}
            </Text>{' '}
            {post.caption}
          </Text>
        </View>
      )}

      {/* Comments Preview */}
      {post.commentsCount > 0 && (
        <TouchableOpacity
          style={styles.commentsPreview}
          onPress={() => onComment(post)}
        >
          <Text style={[styles.commentsText, { color: colors.textSecondary }]}>
            View all {post.commentsCount} comments
          </Text>
        </TouchableOpacity>
      )}

      {/* Timestamp */}
      <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
        {new Date(post.createdAt).toLocaleDateString()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
  },
  location: {
    fontSize: 12,
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
  },
  mediaContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  videoControls: {
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
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeInfo: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  progressBar: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginLeft: 16,
    padding: 8,
  },
  likesContainer: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  likesText: {
    fontSize: 14,
    fontWeight: '600',
  },
  captionContainer: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  caption: {
    fontSize: 14,
    lineHeight: 18,
  },
  captionUsername: {
    fontWeight: '600',
  },
  commentsPreview: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  commentsText: {
    fontSize: 14,
  },
  timestamp: {
    paddingHorizontal: 12,
    fontSize: 12,
    marginBottom: 8,
  },
});

export default EnhancedPostItem;
