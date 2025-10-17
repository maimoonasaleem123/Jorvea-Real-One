import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  ActivityIndicator,
  Animated,
  Alert,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Video, { VideoRef } from 'react-native-video';
import { Post, Reel } from '../services/firebaseService';
import FirebaseService from '../services/firebaseService';
import { useAuth } from '../context/FastAuthContext';
import { UniversalLikeButton } from './UniversalLikeButton';
import { CommentsModal } from './CommentsModal';
import { ShareModal } from './ShareModal';
import FreeVideoPlayer from './FreeVideoPlayer';

const { width, height } = Dimensions.get('window');

interface InstagramPostViewerProps {
  visible: boolean;
  posts: Post[];
  initialIndex: number;
  onClose: () => void;
  onUserProfilePress?: (userId: string) => void;
}

interface InstagramReelViewerProps {
  visible: boolean;
  reels: Reel[];
  initialIndex: number;
  onClose: () => void;
  onUserProfilePress?: (userId: string) => void;
}

// Instagram-style Post Viewer
export const InstagramPostViewer: React.FC<InstagramPostViewerProps> = ({
  visible,
  posts,
  initialIndex,
  onClose,
  onUserProfilePress,
}) => {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const currentPost = posts[currentIndex];

  useEffect(() => {
    if (visible && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: currentIndex * width, animated: false });
    }
  }, [visible, currentIndex]);

  const handleScroll = (event: any) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < posts.length) {
      setCurrentIndex(newIndex);
    }
  };

  const formatTimeAgo = (timestamp: any): string => {
    try {
      const now = new Date();
      let date: Date;

      // Handle different timestamp formats
      if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        // Firebase Timestamp object
        date = new Date(timestamp.seconds * 1000);
      } else if (timestamp && timestamp.toDate && typeof timestamp.toDate === 'function') {
        // Firebase Timestamp with toDate method
        date = timestamp.toDate();
      } else {
        console.warn('Invalid timestamp format in InstagramViewers:', timestamp);
        return 'Unknown';
      }

      // Validate the date
      if (!date || isNaN(date.getTime())) {
        console.warn('Invalid date created from timestamp in InstagramViewers:', timestamp);
        return 'Unknown';
      }

      const diffInMs = now.getTime() - date.getTime();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes}m`;
      if (diffInHours < 24) return `${diffInHours}h`;
      if (diffInDays < 7) return `${diffInDays}d`;
      return date.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting time ago in InstagramViewers:', error, 'for timestamp:', timestamp);
      return 'Unknown';
    }
  };

  if (!currentPost) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <SafeAreaView style={styles.modal}>
        <TouchableOpacity 
          style={styles.container}
          onPress={onClose}
          activeOpacity={1}
        >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.userInfo}
                onPress={() => onUserProfilePress?.(currentPost.userId)}
              >
                <Image
                  source={{ uri: currentPost.user?.profilePicture || 'https://via.placeholder.com/40' }}
                  style={styles.userAvatar}
                />
                <View>
                  <Text style={styles.username}>{currentPost.user?.username || 'User'}</Text>
                  <Text style={styles.timestamp}>{formatTimeAgo(currentPost.createdAt)}</Text>
                </View>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Posts Carousel */}
            <ScrollView
              ref={scrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              style={styles.postsContainer}
            >
              {posts.map((post, index) => (
                <View key={post.id} style={styles.postContainer}>
                  {post.mediaUrls && post.mediaUrls.length > 0 ? (
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      style={styles.mediaContainer}
                    >
                      {post.mediaUrls.map((mediaUrl, mediaIndex) => (
                        <View key={mediaIndex} style={styles.mediaItem}>
                          {post.mediaType === 'video' ? (
                            <Video
                              source={{ uri: mediaUrl }}
                              style={styles.media}
                              resizeMode="contain"
                              repeat
                              controls={false}
                              muted={false}
                            />
                          ) : (
                            <Image
                              source={{ uri: mediaUrl }}
                              style={styles.media}
                              resizeMode="contain"
                            />
                          )}
                        </View>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.placeholderMedia}>
                      <Icon name="image-outline" size={100} color="#666" />
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>

            {/* Post Actions */}
            <View style={styles.actionsContainer}>
              <View style={styles.leftActions}>
                <UniversalLikeButton
                  contentId={currentPost.id}
                  contentType="post"
                  size="large"
                  showCount={true}
                />
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setShowComments(true)}
                >
                  <Icon name="chatbubble-outline" size={28} color="#fff" />
                  <Text style={styles.actionCount}>
                    {FirebaseService.formatNumber(currentPost.commentsCount || 0)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setShowShare(true)}
                >
                  <Icon name="paper-plane-outline" size={28} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity style={styles.saveButton}>
                <Icon name="bookmark-outline" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Post Caption */}
            {currentPost.caption && (
              <View style={styles.captionContainer}>
                <Text style={styles.caption}>
                  <Text style={styles.captionUsername}>{currentPost.user?.username} </Text>
                  {currentPost.caption}
                </Text>
              </View>
            )}

            {/* Page Indicator */}
            {posts.length > 1 && (
              <View style={styles.pageIndicator}>
                <Text style={styles.pageText}>
                  {currentIndex + 1} / {posts.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

        {/* Comments Modal */}
        <CommentsModal
          visible={showComments}
          targetId={currentPost.id}
          targetType="post"
          onClose={() => setShowComments(false)}
        />

        {/* Share Modal */}
        <ShareModal
          visible={showShare}
          post={currentPost}
          onClose={() => setShowShare(false)}
        />
      </SafeAreaView>
    </Modal>
  );
};

// Instagram-style Reel Viewer  
export const InstagramReelViewer: React.FC<InstagramReelViewerProps> = ({
  visible,
  reels,
  initialIndex,
  onClose,
  onUserProfilePress,
}) => {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showComments, setShowComments] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const videoRefs = useRef<{ [key: string]: VideoRef | null }>({});

  const currentReel = reels[currentIndex];

  useEffect(() => {
    if (visible && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: currentIndex * width, animated: false });
    }
  }, [visible, currentIndex]);

  const handleScroll = (event: any) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < reels.length) {
      setCurrentIndex(newIndex);
      
      // Pause previous video
      const prevReel = reels[currentIndex];
      if (prevReel && videoRefs.current[prevReel.id]) {
        videoRefs.current[prevReel.id]?.seek(0);
      }
      
      // Play new video
      const newReel = reels[newIndex];
      if (newReel && videoRefs.current[newReel.id]) {
        videoRefs.current[newReel.id]?.seek(0);
      }
    }
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  if (!currentReel) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <SafeAreaView style={[styles.modal, styles.reelModal]}>
        {/* Header */}
        <View style={styles.reelHeader}>
          <Text style={styles.reelTitle}>Reels</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Reels Carousel */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          style={styles.reelsContainer}
        >
          {reels.map((reel, index) => (
            <View key={reel.id} style={styles.reelContainer}>
              <TouchableOpacity
                style={styles.videoContainer}
                onPress={togglePlayPause}
                activeOpacity={1}
              >
                {/* 🎬 HLS-Compatible Video Player */}
                <FreeVideoPlayer
                  videoUrl={reel.videoUrl}
                  thumbnailUrl={reel.thumbnailUrl || ''}
                  paused={!isPlaying || index !== currentIndex}
                  muted={isMuted}
                  repeat={true}
                  resizeMode="cover"
                  onLoad={() => {
                    // Increment view count
                    FirebaseService.incrementReelViews(reel.id);
                  }}
                  showControls={false}
                  style={styles.video}
                />
                
                {/* Play/Pause Overlay */}
                {!isPlaying && (
                  <View style={styles.playOverlay}>
                    <Icon name="play" size={60} color="rgba(255,255,255,0.8)" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Reel Info Overlay */}
              <View style={styles.reelInfoOverlay}>
                {/* User Info */}
                <TouchableOpacity
                  style={styles.reelUserInfo}
                  onPress={() => onUserProfilePress?.(reel.userId)}
                >
                  <Image
                    source={{ uri: reel.user?.profilePicture || 'https://via.placeholder.com/40' }}
                    style={styles.reelUserAvatar}
                  />
                  <Text style={styles.reelUsername}>{reel.user?.username || 'User'}</Text>
                  {reel.user?.verified && (
                    <Icon name="checkmark-circle" size={16} color="#1DA1F2" />
                  )}
                </TouchableOpacity>

                {/* Caption */}
                {reel.caption && (
                  <Text style={styles.reelCaption} numberOfLines={2}>
                    {reel.caption}
                  </Text>
                )}

                {/* Music Info */}
                {reel.musicTitle && (
                  <View style={styles.musicInfo}>
                    <Icon name="musical-notes" size={14} color="#fff" />
                    <Text style={styles.musicText} numberOfLines={1}>
                      {reel.musicTitle || 'Original Audio'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Actions Sidebar */}
              <View style={styles.reelActions}>
                <UniversalLikeButton
                  contentId={reel.id}
                  contentType="reel"
                  size="large"
                  showCount={true}
                  variant="default"
                />
                
                <TouchableOpacity
                  style={styles.reelActionButton}
                  onPress={() => setShowComments(true)}
                >
                  <Icon name="chatbubble-outline" size={32} color="#fff" />
                  <Text style={styles.reelActionCount}>
                    {FirebaseService.formatNumber(reel.commentsCount || 0)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.reelActionButton}>
                  <Icon name="paper-plane-outline" size={32} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.reelActionButton}>
                  <Icon name="bookmark-outline" size={32} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.reelActionButton}
                  onPress={toggleMute}
                >
                  <Icon 
                    name={isMuted ? "volume-mute" : "volume-high"} 
                    size={32} 
                    color="#fff" 
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Page Indicator */}
        {reels.length > 1 && (
          <View style={styles.reelPageIndicator}>
            <Text style={styles.pageText}>
              {currentIndex + 1} / {reels.length}
            </Text>
          </View>
        )}

        {/* Comments Modal */}
        <CommentsModal
          visible={showComments}
          targetId={currentReel.id}
          targetType="reel"
          onClose={() => setShowComments(false)}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  reelModal: {
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  reelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  reelTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  username: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  closeButton: {
    padding: 8,
  },
  postsContainer: {
    flex: 1,
  },
  reelsContainer: {
    flex: 1,
    marginTop: 60,
  },
  postContainer: {
    width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelContainer: {
    width,
    height: height - 120,
    position: 'relative',
  },
  mediaContainer: {
    flex: 1,
  },
  mediaItem: {
    width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: width * 0.9,
    height: height * 0.6,
  },
  placeholderMedia: {
    width: width * 0.9,
    height: height * 0.6,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width,
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  actionCount: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  saveButton: {
    padding: 8,
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  caption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  captionUsername: {
    fontWeight: '600',
  },
  pageIndicator: {
    position: 'absolute',
    top: 80,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  reelPageIndicator: {
    position: 'absolute',
    top: 80,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  pageText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  reelInfoOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 80,
  },
  reelUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reelUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  reelUsername: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  reelCaption: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 8,
  },
  musicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  musicText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    flex: 1,
  },
  reelActions: {
    position: 'absolute',
    right: 12,
    bottom: 100,
    alignItems: 'center',
  },
  reelActionButton: {
    alignItems: 'center',
    marginBottom: 16,
  },
  reelActionCount: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
});
