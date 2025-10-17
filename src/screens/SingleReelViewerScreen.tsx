import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconIonic from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import FirebaseService, { Reel } from '../services/firebaseService';
import RealTimeLikeSystem from '../services/RealTimeLikeSystem';
import ShareBottomSheet from '../components/ShareBottomSheet';
import LinearGradient from 'react-native-linear-gradient';
import UniversalFollowButton from '../components/UniversalFollowButton';
import SaveButton from '../components/SaveButton';
import InstagramShareModal from '../components/InstagramShareModal';

const { width, height } = Dimensions.get('screen');
const statusBarHeight = StatusBar.currentHeight || 0;

// Utility function to format count numbers
const formatCount = (count: number): string => {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
};

interface SingleReelViewerScreenProps {
  route: {
    params: {
      reelId: string;
      reel?: Reel;
      returnScreen?: string; // Which screen to return to (default: 'ChatList')
    };
  };
}

const SingleReelViewerScreen: React.FC<SingleReelViewerScreenProps> = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  // Fallback theme in case theme is undefined
  const safeTheme = colors || {
    background: '#000000',
    text: '#FFFFFF',
    primary: '#007AFF',
    border: '#333333',
    secondaryText: '#888888',
  };
  
  const { reelId, reel: initialReel, returnScreen = 'ChatList' } = route.params as any;

  // State
  const [reel, setReel] = useState<Reel | null>(initialReel || null);
  const [loading, setLoading] = useState(!initialReel);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showInAppShare, setShowInAppShare] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Real-time like state
  const [likeState, setLikeState] = useState({
    isLiked: false,
    likesCount: 0,
    isLoading: false,
  });

  // Refs
  const videoRef = useRef<VideoRef>(null);
  const heartAnimation = useRef(new Animated.Value(0)).current;
  const likeButtonAnimation = useRef(new Animated.Value(1)).current;

  // Load reel data if not provided
  useEffect(() => {
    if (!initialReel && reelId) {
      loadReelData();
    }
  }, [reelId]);

  // Initialize like state
  useEffect(() => {
    if (reel && user?.uid) {
      setLikeState({
        isLiked: reel.isLiked || false,
        likesCount: reel.likesCount || 0,
        isLoading: false,
      });
    }
  }, [reel, user?.uid]);

  const loadReelData = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  // Handle back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (returnScreen === 'ChatList') {
          navigation.navigate('ChatList');
        } else {
          navigation.goBack();
        }
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [navigation, returnScreen])
  );

  // Handle like with Real-time Firebase system
  const handleLike = useCallback(async () => {
    if (!user?.uid || !reel?.id || likeState.isLoading) return;

    try {
      setLikeState(prev => ({ ...prev, isLoading: true }));

      // Optimistic update
      const newIsLiked = !likeState.isLiked;
      const newLikesCount = newIsLiked 
        ? likeState.likesCount + 1 
        : Math.max(0, likeState.likesCount - 1);

      setLikeState({
        isLiked: newIsLiked,
        likesCount: newLikesCount,
        isLoading: false,
      });

      // Animate like button
      Animated.sequence([
        Animated.timing(likeButtonAnimation, {
          toValue: 0.8,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(likeButtonAnimation, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // Animate heart if liking
      if (newIsLiked) {
        Vibration.vibrate(50);
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
      }

      // Firebase update
      const result = await RealTimeLikeSystem.getInstance().toggleLike(
        reel.id,
        user.uid,
        'reel',
        likeState.isLiked,
        likeState.likesCount
      );

      if (result.success) {
        // Update with Firebase result
        setLikeState({
          isLiked: result.isLiked,
          likesCount: result.likesCount,
          isLoading: false,
        });
        
        // Update reel data
        setReel(prev => prev ? {
          ...prev,
          isLiked: result.isLiked,
          likesCount: result.likesCount,
        } : null);

        console.log(`✅ Like updated: ${result.isLiked ? 'liked' : 'unliked'}, count: ${result.likesCount}`);
      } else {
        // Revert on failure
        setLikeState({
          isLiked: likeState.isLiked,
          likesCount: likeState.likesCount,
          isLoading: false,
        });
        
        if (result.error && result.error !== 'Too fast') {
          Alert.alert('Error', 'Unable to update like. Please try again.');
        }
      }

    } catch (error) {
      console.error('Error handling like:', error);
      // Revert optimistic update
      setLikeState(prev => ({
        isLiked: !prev.isLiked,
        likesCount: prev.isLiked ? prev.likesCount + 1 : Math.max(0, prev.likesCount - 1),
        isLoading: false,
      }));
    }
  }, [user?.uid, reel?.id, likeState, heartAnimation, likeButtonAnimation]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!user?.uid || !reel?.id) return;

    try {
      setIsSaved(!isSaved);
      // Add your save logic here
      console.log(`Reel ${isSaved ? 'unsaved' : 'saved'}`);
    } catch (error) {
      console.error('Error saving reel:', error);
      setIsSaved(isSaved); // revert on error
    }
  }, [user?.uid, reel?.id, isSaved]);

  // Handle mute toggle
  const handleMuteToggle = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Handle in-app share
  const handleInAppShare = useCallback(() => {
    setShowInAppShare(true);
  }, []);

  // Handle comments
  const loadComments = async () => {
    if (!reel?.id) return;

    try {
      setLoadingComments(true);
      const commentsData = await FirebaseService.getComments(reel.id, 'reel');
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
      
      // Add comment to Firebase
      const commentId = await FirebaseService.addComment(
        reel.id, 
        user.uid, 
        newComment.trim(), 
        'reel'
      );
      
      // Create optimistic comment object
      const optimisticComment = {
        id: commentId,
        userId: user.uid,
        contentId: reel.id,
        contentType: 'reel' as const,
        content: newComment.trim(),
        createdAt: new Date(),
        user: {
          id: user.uid,
          username: user.displayName || user.username || 'User',
          profilePicture: user.profilePicture || null,
        },
        likesCount: 0,
        repliesCount: 0,
        isLiked: false,
      };

      // Add to local state immediately
      setComments(prev => [optimisticComment, ...prev]);
      setNewComment('');
      
      // Update reel comments count
      setReel(prev => prev ? {
        ...prev,
        commentsCount: (prev.commentsCount || 0) + 1,
      } : null);

      console.log('✅ Comment posted successfully');

    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this reel: ${reel?.description || 'Amazing content!'}`,
        url: reel?.videoUrl,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleDoubleTap = () => {
    if (!likeState.isLiked) {
      handleLike();
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: safeTheme.background }]}>
        <ActivityIndicator size="large" color={safeTheme.primary} />
        <Text style={[styles.loadingText, { color: safeTheme.text }]}>Loading reel...</Text>
      </View>
    );
  }

  if (!reel) {
    return (
      <View style={[styles.container, { backgroundColor: safeTheme.background }]}>
        <Text style={[styles.errorText, { color: safeTheme.text }]}>Reel not found</Text>
        <TouchableOpacity 
          style={[styles.backButton, { backgroundColor: safeTheme.primary }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: safeTheme.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backIcon}
          onPress={() => {
            if (returnScreen === 'ChatList') {
              navigation.navigate('ChatList');
            } else {
              navigation.goBack();
            }
          }}
        >
          <Icon name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reel</Text>
        <TouchableOpacity style={styles.moreIcon}>
          <Icon name="more-vert" size={28} color="white" />
        </TouchableOpacity>
      </View>

      {/* Video Container */}
      <View style={styles.videoContainer}>
        <TouchableOpacity
          style={styles.videoTouchArea}
          onPress={() => setIsPaused(!isPaused)}
          activeOpacity={1}
        >
          <Video
            ref={videoRef}
            source={{ uri: reel.videoUrl }}
            style={styles.video}
            resizeMode="cover"
            repeat
            paused={isPaused}
            muted={isMuted}
            onError={(error) => console.error('Video error:', error)}
            poster={reel.thumbnailUrl}
            posterResizeMode="cover"
          />

          {/* Pause overlay */}
          {isPaused && (
            <View style={styles.pauseOverlay}>
              <Icon name="play-arrow" size={80} color="white" />
            </View>
          )}

          {/* Heart animation overlay */}
          <Animated.View
            style={[
              styles.heartOverlay,
              {
                opacity: heartAnimation,
                transform: [
                  {
                    scale: heartAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1.2],
                    }),
                  },
                ],
              },
            ]}
          >
            <Icon name="favorite" size={100} color="#ff3040" />
          </Animated.View>
        </TouchableOpacity>

        {/* Reel Info Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.infoOverlay}
        >
        {/* Content Info - Matching ReelsScreen Design */}
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
              {formatCount(reel.views || 0)} views • {reel.timeAgo || 'now'}
            </Text>
          </View>

          {/* User Info - Moved to Bottom */}
          <View style={styles.userInfoBottom}>
            <TouchableOpacity
              style={styles.userAvatarContainer}
              onPress={() => navigation.navigate('UserProfile' as any, { userId: reel.user?.id || reel.userId })}>
              <Image
                source={{ 
                  uri: reel.user?.profilePicture || 
                  'https://via.placeholder.com/40x40.png?text=👤' 
                }}
                style={styles.userAvatar}
              />
            </TouchableOpacity>
            
            <View style={styles.userDetails}>
              <TouchableOpacity onPress={() => navigation.navigate('UserProfile' as any, { userId: reel.user?.id || reel.userId })}>
                <Text style={styles.username}>
                  @{reel.user?.username || `user${reel.userId.slice(-4)}`}
                </Text>
              </TouchableOpacity>
              {reel.user?.verified && (
                <Icon name="verified" size={16} color="#1DA1F2" style={styles.verifiedIcon} />
              )}
            </View>

            {(reel.user?.id || reel.userId) !== user?.uid && (
              <UniversalFollowButton
                targetUserId={reel.user?.id || reel.userId}
                targetUserName={reel.user?.displayName || reel.user?.username}
                targetUserAvatar={reel.user?.profilePicture}
                size="small"
                variant="gradient"
                onFollowChange={(isFollowing) => {
                  console.log(`Follow state changed: ${isFollowing}`);
                }}
              />
            )}
          </View>
        </View>
        </LinearGradient>

        {/* Enhanced Action Buttons - Matching ReelsScreen Design */}
        <View style={styles.actionsContainer}>
          {/* Like Button with Instagram-style Animation */}
          <Animated.View style={{ transform: [{ scale: likeButtonAnimation }] }}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={handleLike}
              activeOpacity={0.7}
              disabled={likeState.isLoading}>
              <Icon
                name={likeState.isLiked ? "favorite" : "favorite-border"}
                size={32}
                color={likeState.isLiked ? "#ff3040" : "#fff"}
              />
              <Text style={styles.actionText}>
                {formatCount(likeState.likesCount)}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Comment Button */}
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => {
              setShowComments(true);
              loadComments();
            }}
            activeOpacity={0.7}>
            <IconIonic name="chatbubble-outline" size={30} color="#fff" />
            <Text style={styles.actionText}>
              {formatCount(reel.commentsCount || 0)}
            </Text>
          </TouchableOpacity>

          {/* External Share Button */}
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => setShowShareSheet(true)}
            activeOpacity={0.7}>
            <IconIonic name="paper-plane-outline" size={30} color="#fff" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>

          {/* In-App Share Button (Airplane Style) */}
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={handleInAppShare}
            activeOpacity={0.7}>
            <Icon name="send" size={30} color="#1DA1F2" />
            <Text style={styles.actionText}>Send</Text>
          </TouchableOpacity>

          {/* Save Button */}
          <SaveButton
            isSaved={isSaved}
            onPress={handleSave}
            size={30}
            color={isSaved ? "#ffd700" : "#fff"}
          />

          {/* More Options */}
          <TouchableOpacity 
            style={styles.actionButton} 
            activeOpacity={0.7}>
            <Icon name="more-vert" size={30} color="#fff" />
          </TouchableOpacity>

          {/* Mute Button */}
          <TouchableOpacity style={styles.muteButton} onPress={handleMuteToggle}>
            <Icon
              name={isMuted ? "volume-off" : "volume-up"}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Comments Modal */}
      <Modal
        visible={showComments}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <KeyboardAvoidingView 
          style={[styles.commentsModal, { backgroundColor: safeTheme.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Comments Header */}
          <View style={[styles.commentsHeader, { borderBottomColor: safeTheme.border }]}>
            <Text style={[styles.commentsTitle, { color: safeTheme.text }]}>Comments</Text>
            <TouchableOpacity onPress={() => setShowComments(false)}>
              <Icon name="close" size={24} color={safeTheme.text} />
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.commentsList}
            renderItem={({ item }) => (
              <View style={styles.commentItem}>
                <Image
                  source={{ uri: item.user?.profilePicture || 'https://via.placeholder.com/32' }}
                  style={styles.commentAvatar}
                />
                <View style={styles.commentContent}>
                  <Text style={[styles.commentUsername, { color: safeTheme.text }]}>
                    {item.user?.username || 'User'}
                  </Text>
                  <Text style={[styles.commentText, { color: safeTheme.text }]}>
                    {item.content || item.text}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Text style={[styles.emptyCommentsText, { color: safeTheme.text || '#888888' }]}>
                  {loadingComments ? 'Loading comments...' : 'No comments yet'}
                </Text>
              </View>
            }
          />

          {/* Comment Input */}
          <View style={[styles.commentInput, { borderTopColor: safeTheme.border }]}>
            <TextInput
              style={[styles.commentTextInput, { color: safeTheme.text, borderColor: safeTheme.border }]}
              placeholder="Add a comment..."
              placeholderTextColor={safeTheme.text || '#888888'}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.postButton,
                { 
                  backgroundColor: newComment.trim() ? safeTheme.primary : safeTheme.border,
                  opacity: postingComment ? 0.7 : 1,
                }
              ]}
              onPress={postComment}
              disabled={!newComment.trim() || postingComment}
            >
              {postingComment ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Icon name="send" size={20} color="white" />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Share Bottom Sheet */}
      {showShareSheet && (
        <ShareBottomSheet
          visible={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          contentType="reel"
          content={reel}
          onShare={handleShare}
        />
      )}

      {/* In-App Share Modal */}
      {showInAppShare && (
        <InstagramShareModal
          visible={showInAppShare}
          onClose={() => setShowInAppShare(false)}
          content={reel}
          contentType="reel"
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: statusBarHeight + 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 100,
  },
  backIcon: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  moreIcon: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  videoContainer: {
    width: width,
    height: height,
    position: 'relative',
  },
  videoTouchArea: {
    flex: 1,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  pauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  heartOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -50,
    marginLeft: -50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 80,
    paddingVertical: 20,
    paddingHorizontal: 16,
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
  followButton: {
    marginLeft: 12,
  },
  actionsContainer: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  muteButton: {
    position: 'absolute',
    top: -320,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
  },
  contentInfo: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 80,
  },
  caption: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tag: {
    color: '#1DA1F2',
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 14,
    marginLeft: 4,
    flex: 1,
  },
  statsContainer: {
    marginBottom: 12,
  },
  statText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  userInfoBottom: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatarContainer: {
    marginRight: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
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
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  commentsModal: {
    flex: 1,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  commentsList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 18,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyCommentsText: {
    fontSize: 16,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  commentTextInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  postButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SingleReelViewerScreen;
