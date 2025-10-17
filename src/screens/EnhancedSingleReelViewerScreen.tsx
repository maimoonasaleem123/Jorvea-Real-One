import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
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
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  PanGestureHandler,
  GestureHandlerRootView,
} from 'react-native';
import { PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import Video, { VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconIonic from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import FirebaseService, { Reel, Comment } from '../services/firebaseService';
import RealTimeLikeSystem from '../services/RealTimeLikeSystem';
import ShareBottomSheet from '../components/ShareBottomSheet';
import LinearGradient from 'react-native-linear-gradient';
import UniversalFollowButton from '../components/UniversalFollowButton';
import SaveButton from '../components/SaveButton';
import InstagramShareModal from '../components/InstagramShareModal';
import PerfectChunkedVideoPlayer from '../components/PerfectChunkedVideoPlayer';
import PerfectChunkedStreamingEngine from '../services/PerfectChunkedStreamingEngine';
import PerfectInstantThumbnailSystem from '../services/PerfectInstantThumbnailSystem';
import AdvancedSegmentedVideoFetcher from '../services/AdvancedSegmentedVideoFetcher';
import InstantReelsPreloader from '../services/InstantReelsPreloader';

const { width, height } = Dimensions.get('screen');
const statusBarHeight = StatusBar.currentHeight || 0;
const REEL_HEIGHT = Platform.OS === 'android' ? height : height;

interface SingleReelViewerScreenProps {
  route: {
    params: {
      reelId: string;
      reel?: Reel;
      returnScreen?: string;
    };
  };
}

const EnhancedSingleReelViewerScreen: React.FC<SingleReelViewerScreenProps> = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { theme } = useTheme();
  
  const safeTheme = theme || {
    background: '#000000',
    text: '#FFFFFF',
    primary: '#007AFF',
    border: '#333333',
    secondaryText: '#888888',
  };
  
  const { reelId, reel: initialReel, returnScreen = 'ChatList' } = route.params as any;

  // 🚀 Initialize Perfect Video Systems (same as ReelsScreen)
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

  // State - Video First Priority
  const [reel, setReel] = useState<Reel | null>(initialReel || null);
  const [videoLoading, setVideoLoading] = useState(true);
  const [metadataLoading, setMetadataLoading] = useState(!initialReel);
  
  // Video state
  const [isPlaying, setIsPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
  const [doubleTapCount, setDoubleTapCount] = useState(0);

  // Interaction state
  const [showComments, setShowComments] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showInAppShare, setShowInAppShare] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  // Like state (optimistic UI)
  const [optimisticLikeState, setOptimisticLikeState] = useState({
    isLiked: false,
    likesCount: 0,
    isOptimistic: false
  });

  // Refs
  const videoRef = useRef<VideoRef>(null);
  const heartAnimation = useRef(new Animated.Value(0)).current;
  const likeButtonAnimation = useRef(new Animated.Value(1)).current;
  const volumeIndicatorAnimation = useRef(new Animated.Value(0)).current;
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const doubleTapTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastTapTime = useRef(0);

  // 🚀 PRIORITY 1: Load Video Immediately
  useEffect(() => {
    if (reel?.videoUrl) {
      console.log('⚡ Loading video first priority:', reel.id);
      loadVideoFirst();
    } else if (reelId && !initialReel) {
      console.log('⚡ Loading reel data for video priority:', reelId);
      loadReelForVideo();
    }
  }, [reelId, reel?.videoUrl]);

  // 🚀 PRIORITY 2: Load Metadata in Background
  useEffect(() => {
    if (reel?.id && !reel.user) {
      console.log('🔄 Loading metadata in background:', reel.id);
      setTimeout(() => {
        loadMetadataInBackground();
      }, 200); // Delay to let video start first
    }
  }, [reel?.id]);

  // Initialize like state from reel
  useEffect(() => {
    if (reel && user?.uid) {
      setOptimisticLikeState({
        isLiked: reel.isLiked || false,
        likesCount: reel.likesCount || 0,
        isOptimistic: false
      });
    }
  }, [reel, user?.uid]);

  // 🎬 Load Video First (Priority Function)
  const loadVideoFirst = async () => {
    if (!reel?.videoUrl) return;

    try {
      setVideoLoading(true);
      console.log('⚡ Starting video preparation...');

      // Use advanced video systems if available
      if (advancedVideoFetcher) {
        try {
          await advancedVideoFetcher.prepareVideo(reel.videoUrl, reel.id);
          console.log('✅ Video prepared with segmentation');
        } catch (error) {
          console.warn('Video segmentation fallback:', error);
        }
      }

      // Initialize perfect streaming
      if (perfectChunkedEngine) {
        try {
          await perfectChunkedEngine.initializeStream(reel.videoUrl, reel.id);
          console.log('✅ Perfect streaming initialized');
        } catch (error) {
          console.warn('Perfect streaming fallback:', error);
        }
      }

      // Prepare thumbnail
      if (perfectThumbnailSystem) {
        try {
          await perfectThumbnailSystem.prepareThumbnail(reel.id, reel.videoUrl);
          console.log('✅ Thumbnail prepared');
        } catch (error) {
          console.warn('Thumbnail preparation fallback:', error);
        }
      }

    } catch (error) {
      console.error('Video loading error:', error);
    } finally {
      setVideoLoading(false);
    }
  };

  // 📱 Load Reel Data for Video Priority
  const loadReelForVideo = async () => {
    if (!user?.uid || !reelId) return;

    try {
      console.log('⚡ Loading reel data with video priority...');
      
      // Try preloader cache first
      const cachedReels = await instantPreloader.getInstantReels(user.uid, 10);
      const cachedReel = cachedReels.find(r => r.id === reelId);
      
      if (cachedReel) {
        console.log('✅ Found reel in cache!');
        setReel(cachedReel);
        return;
      }

      // Fallback to direct fetch
      const reelData = await FirebaseService.getReelById(reelId);
      if (reelData) {
        setReel(reelData);
      } else {
        Alert.alert('Error', 'Reel not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading reel:', error);
      Alert.alert('Error', 'Failed to load reel');
      navigation.goBack();
    }
  };

  // 🔄 Load Metadata in Background
  const loadMetadataInBackground = async () => {
    if (!reel?.id || !user?.uid) return;

    try {
      setMetadataLoading(true);
      console.log('🔄 Loading metadata in background...');

      // Get full reel data with user info
      const fullReelData = await FirebaseService.getReelById(reel.id);
      if (fullReelData && fullReelData.user) {
        setReel(prev => ({
          ...prev!,
          ...fullReelData,
          user: fullReelData.user
        }));
        console.log('✅ Metadata loaded in background');
      }
    } catch (error) {
      console.error('Background metadata loading error:', error);
    } finally {
      setMetadataLoading(false);
    }
  };

  // 📱 Video Event Handlers (same as ReelsScreen)
  const onVideoLoad = (data: any) => {
    setDuration(data.duration);
    setVideoLoading(false);
    console.log('📹 Video loaded successfully');
  };

  const onVideoProgress = (data: any) => {
    setCurrentTime(data.currentTime);
  };

  const onVideoEnd = () => {
    if (videoRef.current) {
      videoRef.current.seek(0);
      setCurrentTime(0);
    }
  };

  const onVideoError = (error: any) => {
    console.error('Video error:', error);
    setVideoLoading(false);
  };

  // 🎮 Video Controls (same as ReelsScreen)
  const togglePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
    showControlsTemporarily();
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(prev => !prev);
    
    // Show volume indicator
    setShowVolumeIndicator(true);
    Animated.sequence([
      Animated.timing(volumeIndicatorAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.delay(1000),
      Animated.timing(volumeIndicatorAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setShowVolumeIndicator(false));
  }, [volumeIndicatorAnimation]);

  const showControlsTemporarily = () => {
    setShowControls(true);
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  // 👆 Touch Handlers (same as ReelsScreen)
  const handleSingleTap = () => {
    togglePlayPause();
  };

  const handleDoubleTap = () => {
    handleLike();
    
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

    // Vibration feedback
    Vibration.vibrate(50);
  };

  const onTapGesture = () => {
    const now = Date.now();
    const timeDiff = now - lastTapTime.current;
    
    if (timeDiff < 300) {
      // Double tap
      if (doubleTapTimeout.current) {
        clearTimeout(doubleTapTimeout.current);
      }
      setDoubleTapCount(prev => prev + 1);
      handleDoubleTap();
    } else {
      // Single tap
      doubleTapTimeout.current = setTimeout(() => {
        if (doubleTapCount === 0) {
          handleSingleTap();
        }
        setDoubleTapCount(0);
      }, 300);
    }
    
    lastTapTime.current = now;
  };

  // ❤️ Like Handler (optimistic UI)
  const handleLike = useCallback(async () => {
    if (!user?.uid || !reel?.id) return;

    try {
      // Optimistic UI update
      setOptimisticLikeState(prev => {
        const newIsLiked = !prev.isLiked;
        const newCount = newIsLiked ? prev.likesCount + 1 : Math.max(0, prev.likesCount - 1);
        return {
          isLiked: newIsLiked,
          likesCount: newCount,
          isOptimistic: true
        };
      });

      // Like button animation
      Animated.sequence([
        Animated.timing(likeButtonAnimation, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(likeButtonAnimation, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      // Firebase update
      const result = await RealTimeLikeSystem.getInstance().toggleLike(
        reel.id,
        user.uid,
        'reel',
        optimisticLikeState.isLiked,
        optimisticLikeState.likesCount
      );
      
      if (result.success) {
        // Update with real Firebase data
        setOptimisticLikeState({
          isLiked: result.isLiked,
          likesCount: result.likesCount,
          isOptimistic: false
        });
      }
    } catch (error) {
      console.error('Like error:', error);
      // Revert optimistic update on error
      setOptimisticLikeState(prev => ({
        isLiked: !prev.isLiked,
        likesCount: prev.isLiked ? prev.likesCount + 1 : Math.max(0, prev.likesCount - 1),
        isOptimistic: false
      }));
    }
  }, [user?.uid, reel?.id, likeButtonAnimation]);

  // 💬 Comments Handler
  const loadComments = async () => {
    if (!reel?.id) return;

    try {
      setLoadingComments(true);
      const commentsData = await FirebaseService.getReelComments(reel.id);
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const postComment = async () => {
    if (!user?.uid || !reel?.id || !newComment.trim()) return;

    try {
      setPostingComment(true);
      
      // Optimistic UI
      const tempComment: Comment = {
        id: Date.now().toString(),
        userId: user.uid,
        contentId: reel.id,
        contentType: 'reel',
        content: newComment.trim(),
        type: 'text',
        likesCount: 0,
        repliesCount: 0,
        isEdited: false,
        createdAt: new Date(),
        user: {
          id: user.uid,
          uid: user.uid,
          username: user.displayName || user.username || 'User',
          displayName: user.displayName || user.username || 'User',
          profilePicture: user.profilePicture || null,
        } as any
      };

      setComments(prev => [tempComment, ...prev]);
      setNewComment('');

      // Firebase update
      await FirebaseService.addComment(reel.id, user.uid, newComment.trim(), 'reel');
      
      // Reload comments to get real data
      setTimeout(() => {
        loadComments();
      }, 1000);
      
    } catch (error) {
      console.error('Error posting comment:', error);
      // Remove optimistic comment on error
      setComments(prev => prev.filter(c => c.id !== tempComment.id));
    } finally {
      setPostingComment(false);
    }
  };

  // 📤 Share Handlers
  const handleShare = () => {
    setShowShareSheet(true);
  };

  const handleInAppShare = () => {
    setShowInAppShare(true);
  };

  const handleExternalShare = async () => {
    try {
      await Share.share({
        message: `Check out this reel: ${reel?.caption || 'Amazing content!'}`,
        url: reel?.videoUrl,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  // � Save Handler
  const handleSave = async (reelId: string) => {
    try {
      // Toggle save state optimistically
      setReel(prev => prev ? {
        ...prev,
        isSaved: !prev.isSaved
      } : null);
      
      // Here you would call your save service
      console.log('Save/unsave reel:', reelId);
    } catch (error) {
      console.error('Save error:', error);
      // Revert on error
      setReel(prev => prev ? {
        ...prev,
        isSaved: !prev.isSaved
      } : null);
    }
  };

  // �👤 User Profile Handler
  const handleUserPress = () => {
    if (reel?.user?.id) {
      navigation.navigate('UserProfile', { userId: reel.user.id });
    }
  };

  // 🔙 Back Handler
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (showComments) {
          setShowComments(false);
          return true;
        }
        if (returnScreen === 'ChatList') {
          navigation.navigate('ChatList');
        } else {
          navigation.goBack();
        }
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [navigation, returnScreen, showComments])
  );

  // 🧹 Cleanup
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

  // 📱 Render Loading State
  if (!reel) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: safeTheme.background }]}>
        <StatusBar hidden />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={safeTheme.primary} />
          <Text style={[styles.loadingText, { color: safeTheme.text }]}>Loading reel...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={[styles.container, { backgroundColor: safeTheme.background }]}>
        <StatusBar hidden />
        
        {/* Video Container */}
        <TouchableOpacity 
          style={styles.videoContainer}
          activeOpacity={1}
          onPress={onTapGesture}
        >
          {/* Perfect Chunked Video Player */}
          <PerfectChunkedVideoPlayer
            reelId={reel.id}
            videoUrl={reel.videoUrl}
            thumbnailUrl={reel.thumbnailUrl || ''}
            shouldPlay={isPlaying}
            isFocused={true}
            isActive={true}
            onLoad={onVideoLoad}
            onProgress={onVideoProgress}
            style={styles.video}
          />

          {/* Video Loading Overlay */}
          {videoLoading && (
            <View style={styles.videoLoadingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}

          {/* Heart Animation */}
          <Animated.View
            style={[
              styles.heartAnimation,
              {
                opacity: heartAnimation,
                transform: [{ scale: heartAnimation }],
              },
            ]}
          >
            <Icon name="favorite" size={80} color="#FF6B6B" />
          </Animated.View>

          {/* Volume Indicator */}
          {showVolumeIndicator && (
            <Animated.View
              style={[
                styles.volumeIndicator,
                {
                  opacity: volumeIndicatorAnimation,
                  transform: [{ scale: volumeIndicatorAnimation }],
                },
              ]}
            >
              <Icon 
                name={muted ? 'volume-off' : 'volume-up'} 
                size={40} 
                color="#FFFFFF" 
              />
            </Animated.View>
          )}

          {/* Video Controls */}
          {showControls && (
            <View style={styles.videoControls}>
              <TouchableOpacity onPress={togglePlayPause} style={styles.playButton}>
                <Icon 
                  name={isPlaying ? 'pause' : 'play-arrow'} 
                  size={50} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>

        {/* UI Overlay */}
        <View style={styles.overlay}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Icon name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleMute} style={styles.muteButton}>
              <Icon 
                name={muted ? 'volume-off' : 'volume-up'} 
                size={24} 
                color="#FFFFFF" 
              />
            </TouchableOpacity>
          </View>

          {/* Side Actions */}
          <View style={styles.sideActions}>
            {/* User Profile */}
            <TouchableOpacity onPress={handleUserPress} style={styles.actionButton}>
              <Image 
                source={{ uri: reel.user?.profilePicture || 'https://via.placeholder.com/40' }}
                style={styles.profilePicture}
              />
            </TouchableOpacity>

            {/* Like Button */}
            <Animated.View style={{ transform: [{ scale: likeButtonAnimation }] }}>
              <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
                <Icon 
                  name={optimisticLikeState.isLiked ? 'favorite' : 'favorite-border'} 
                  size={32} 
                  color={optimisticLikeState.isLiked ? '#FF6B6B' : '#FFFFFF'} 
                />
                <Text style={styles.actionText}>
                  {optimisticLikeState.likesCount > 0 ? optimisticLikeState.likesCount : ''}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            {/* Comments */}
            <TouchableOpacity 
              onPress={() => {
                setShowComments(true);
                loadComments();
              }} 
              style={styles.actionButton}
            >
              <Icon name="comment" size={32} color="#FFFFFF" />
              <Text style={styles.actionText}>
                {reel.commentsCount > 0 ? reel.commentsCount : ''}
              </Text>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
              <Icon name="share" size={32} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Save */}
            <SaveButton
              isSaved={reel.isSaved || false}
              onPress={() => handleSave(reel.id)}
              size={32}
              color="#FFFFFF"
            />
          </View>

          {/* Bottom Info */}
          <View style={styles.bottomInfo}>
            {/* User Info */}
            <View style={styles.userInfo}>
              <TouchableOpacity onPress={handleUserPress}>
                <Text style={styles.username}>
                  @{reel.user?.username || 'user'}
                </Text>
              </TouchableOpacity>
              {reel.user?.id !== user?.uid && (
                <UniversalFollowButton
                  targetUserId={reel.user?.id || ''}
                  style={styles.followButton}
                  textStyle={styles.followButtonText}
                />
              )}
            </View>

            {/* Caption */}
            {reel.caption && (
              <Text style={styles.caption} numberOfLines={3}>
                {reel.caption}
              </Text>
            )}

            {/* Metadata Loading Indicator */}
            {metadataLoading && (
              <View style={styles.metadataLoading}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.metadataLoadingText}>Loading details...</Text>
              </View>
            )}
          </View>
        </View>

        {/* Comments Modal */}
        <Modal
          visible={showComments}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowComments(false)}
        >
          <View style={styles.commentsModal}>
            <View style={styles.commentsContainer}>
              {/* Comments Header */}
              <View style={styles.commentsHeader}>
                <Text style={styles.commentsTitle}>Comments</Text>
                <TouchableOpacity onPress={() => setShowComments(false)}>
                  <Icon name="close" size={24} color={safeTheme.text} />
                </TouchableOpacity>
              </View>

              {/* Comments List */}
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <Image 
                      source={{ uri: item.user?.profilePicture || 'https://via.placeholder.com/30' }}
                      style={styles.commentAvatar}
                    />
                    <View style={styles.commentContent}>
                      <Text style={styles.commentUsername}>
                        {item.user?.username || 'User'}
                      </Text>
                      <Text style={styles.commentText}>{item.content}</Text>
                    </View>
                  </View>
                )}
                style={styles.commentsList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  loadingComments ? (
                    <ActivityIndicator size="small" color={safeTheme.primary} />
                  ) : (
                    <Text style={styles.noCommentsText}>No comments yet</Text>
                  )
                }
              />

              {/* Comment Input */}
              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.commentInputContainer}
              >
                <TextInput
                  style={styles.commentInput}
                  placeholder="Add a comment..."
                  placeholderTextColor={safeTheme.secondaryText}
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                />
                <TouchableOpacity 
                  onPress={postComment}
                  disabled={!newComment.trim() || postingComment}
                  style={[
                    styles.postButton,
                    { opacity: newComment.trim() && !postingComment ? 1 : 0.5 }
                  ]}
                >
                  {postingComment ? (
                    <ActivityIndicator size="small" color={safeTheme.primary} />
                  ) : (
                    <Text style={styles.postButtonText}>Post</Text>
                  )}
                </TouchableOpacity>
              </KeyboardAvoidingView>
            </View>
          </View>
        </Modal>

        {/* Share Bottom Sheet */}
        <ShareBottomSheet
          visible={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          onExternalShare={handleExternalShare}
          onInAppShare={handleInAppShare}
          content={{
            type: 'reel',
            id: reel.id,
            title: reel.caption || 'Check out this reel!',
            url: reel.videoUrl,
          }}
        />

        {/* In-App Share Modal */}
        <InstagramShareModal
          visible={showInAppShare}
          onClose={() => setShowInAppShare(false)}
          content={{
            type: 'reel',
            id: reel.id,
            title: reel.caption || 'Check out this reel!',
            thumbnail: reel.thumbnailUrl,
            url: reel.videoUrl,
          }}
        />
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  video: {
    width: width,
    height: REEL_HEIGHT,
  },
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  heartAnimation: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -40,
    marginLeft: -40,
    zIndex: 10,
  },
  volumeIndicator: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    marginLeft: -20,
    zIndex: 10,
  },
  videoControls: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -25,
    marginLeft: -25,
    zIndex: 5,
  },
  playButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    padding: 10,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: statusBarHeight + 10,
    paddingBottom: 10,
  },
  backButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  muteButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  sideActions: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -120 }],
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  profilePicture: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 80,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  username: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  followButton: {
    marginLeft: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FF6B6B',
    borderRadius: 20,
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  metadataLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  metadataLoadingText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginLeft: 8,
    opacity: 0.7,
  },
  commentsModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  commentsContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.8,
    paddingBottom: 20,
  },
  commentsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  commentItem: {
    flexDirection: 'row',
    marginVertical: 8,
  },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#000000',
  },
  commentText: {
    fontSize: 14,
    color: '#333333',
    marginTop: 2,
  },
  noCommentsText: {
    textAlign: 'center',
    color: '#666666',
    marginTop: 20,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    color: '#000000',
  },
  postButton: {
    marginLeft: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  postButtonText: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default EnhancedSingleReelViewerScreen;
