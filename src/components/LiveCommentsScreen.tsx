import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService from '../services/firebaseService';

const { width } = Dimensions.get('window');

interface Comment {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  text: string;
  likesCount: number;
  isLiked: boolean;
  replies: Reply[];
  createdAt: string;
  isVerified?: boolean;
  isPinned?: boolean;
}

interface Reply {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  text: string;
  likesCount: number;
  isLiked: boolean;
  createdAt: string;
}

interface LiveCommentsProps {
  postId: string;
  postType: 'post' | 'reel' | 'story';
  isLive?: boolean;
}

export default function LiveCommentsScreen({ postId, postType, isLive = false }: LiveCommentsProps): React.JSX.Element {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  
  // Live animation states
  const heartAnimation = useRef(new Animated.Value(0)).current;
  const [showFloatingHearts, setShowFloatingHearts] = useState<number[]>([]);

  useEffect(() => {
    loadComments();
    
    // Set up real-time listener for live comments
    if (isLive) {
      const unsubscribe = FirebaseService.listenToComments(postId, (updatedComments) => {
        setComments(updatedComments);
        // Auto-scroll to bottom for new comments
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      });
      
      return unsubscribe;
    }
  }, [postId, isLive]);

  const loadComments = async () => {
    try {
      const fetchedComments = await FirebaseService.getComments(postId, 'post');
      setComments(fetchedComments as unknown as Comment[]);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendComment = async () => {
    if (!newComment.trim() || !user || sending) return;

    setSending(true);
    try {
      const commentData = {
        postId,
        postType,
        text: newComment.trim(),
        userId: user.uid,
        username: user.displayName || 'Anonymous',
        userAvatar: user.photoURL || '',
        isVerified: user.isVerified || false,
      };

      await FirebaseService.addComment(
        postId,
        user.uid,
        newComment.trim(),
        postType as 'post' | 'reel'
      );
      
      if (!isLive) {
        await loadComments(); // Reload if not live
      }
      
      setNewComment('');
      
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending comment:', error);
      Alert.alert('Error', 'Failed to send comment');
    } finally {
      setSending(false);
    }
  };

  const sendReply = async (commentId: string) => {
    if (!replyText.trim() || !user || sending) return;

    setSending(true);
    try {
      const replyData = {
        commentId,
        text: replyText.trim(),
        userId: user.uid,
        username: user.displayName || 'Anonymous',
        userAvatar: user.photoURL || '',
      };

      await FirebaseService.addReply(replyData);
      
      if (!isLive) {
        await loadComments();
      }
      
      setReplyText('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Error sending reply:', error);
      Alert.alert('Error', 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const likeComment = async (commentId: string) => {
    try {
      await FirebaseService.likeComment(commentId, user?.uid || '');
      
      if (!isLive) {
        await loadComments();
      }
      
      // Trigger heart animation
      triggerHeartAnimation();
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const likeReply = async (commentId: string, replyId: string) => {
    try {
      await FirebaseService.likeReply(commentId, replyId, user?.uid || '');
      
      if (!isLive) {
        await loadComments();
      }
      
      triggerHeartAnimation();
    } catch (error) {
      console.error('Error liking reply:', error);
    }
  };

  const triggerHeartAnimation = () => {
    const heartId = Date.now();
    setShowFloatingHearts(prev => [...prev, heartId]);
    
    // Animate heart
    Animated.sequence([
      Animated.timing(heartAnimation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(heartAnimation, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowFloatingHearts(prev => prev.filter(id => id !== heartId));
    });
  };

  const deleteComment = async (commentId: string) => {
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await FirebaseService.deleteComment(commentId);
              if (!isLive) {
                await loadComments();
              }
            } catch (error) {
              console.error('Error deleting comment:', error);
            }
          },
        },
      ]
    );
  };

  const pinComment = async (commentId: string) => {
    try {
      await FirebaseService.pinComment(commentId);
      if (!isLive) {
        await loadComments();
      }
    } catch (error) {
      console.error('Error pinning comment:', error);
    }
  };

  const formatTimeAgo = (timestamp: any) => {
    try {
      const now = new Date();
      let time: Date;

      // Handle different timestamp formats
      if (timestamp instanceof Date) {
        time = timestamp;
      } else if (typeof timestamp === 'string') {
        time = new Date(timestamp);
      } else if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
        // Firebase Timestamp object
        time = new Date(timestamp.seconds * 1000);
      } else if (timestamp && timestamp.toDate && typeof timestamp.toDate === 'function') {
        // Firebase Timestamp with toDate method
        time = timestamp.toDate();
      } else {
        console.warn('Invalid timestamp format in LiveCommentsScreen:', timestamp);
        return 'Unknown';
      }

      // Validate the date
      if (!time || isNaN(time.getTime())) {
        console.warn('Invalid date created from timestamp in LiveCommentsScreen:', timestamp);
        return 'Unknown';
      }

      const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
      
      if (diffInMinutes < 1) return 'now';
      if (diffInMinutes < 60) return `${diffInMinutes}m`;
      if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
      return `${Math.floor(diffInMinutes / 1440)}d`;
    } catch (error) {
      console.error('Error formatting time ago in LiveCommentsScreen:', error, 'for timestamp:', timestamp);
      return 'Unknown';
    }
  };

  const renderReply = ({ item: reply }: { item: Reply }) => (
    <View style={styles.replyContainer}>
      <Image source={{ uri: reply.userAvatar }} style={styles.replyAvatar} />
      <View style={styles.replyContent}>
        <View style={styles.replyHeader}>
          <Text style={styles.replyUsername}>{reply.username}</Text>
          <Text style={styles.replyTime}>{formatTimeAgo(reply.createdAt)}</Text>
        </View>
        <Text style={styles.replyText}>{reply.text}</Text>
        <View style={styles.replyActions}>
          <TouchableOpacity
            style={styles.replyAction}
            onPress={() => likeReply(reply.id, reply.id)}
          >
            <Icon
              name={reply.isLiked ? 'heart' : 'heart-outline'}
              size={14}
              color={reply.isLiked ? '#ff3040' : '#666'}
            />
            {reply.likesCount > 0 && (
              <Text style={styles.replyActionText}>{reply.likesCount}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderComment = ({ item: comment }: { item: Comment }) => (
    <View style={[styles.commentContainer, comment.isPinned && styles.pinnedComment]}>
      {comment.isPinned && (
        <View style={styles.pinnedBadge}>
          <Icon name="pin" size={12} color="#E1306C" />
          <Text style={styles.pinnedText}>Pinned</Text>
        </View>
      )}
      
      <View style={styles.commentHeader}>
        <Image source={{ uri: comment.userAvatar }} style={styles.commentAvatar} />
        <View style={styles.commentMeta}>
          <View style={styles.commentUserInfo}>
            <Text style={styles.commentUsername}>{comment.username}</Text>
            {comment.isVerified && (
              <Icon name="checkmark-circle" size={16} color="#1DA1F2" />
            )}
            <Text style={styles.commentTime}>{formatTimeAgo(comment.createdAt)}</Text>
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
        </View>
      </View>

      <View style={styles.commentActions}>
        <TouchableOpacity
          style={styles.commentAction}
          onPress={() => likeComment(comment.id)}
        >
          <Icon
            name={comment.isLiked ? 'heart' : 'heart-outline'}
            size={16}
            color={comment.isLiked ? '#ff3040' : '#666'}
          />
          {comment.likesCount > 0 && (
            <Text style={styles.commentActionText}>{comment.likesCount}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.commentAction}
          onPress={() => setReplyingTo(comment.id)}
        >
          <Icon name="chatbubble-outline" size={16} color="#666" />
          <Text style={styles.commentActionText}>Reply</Text>
        </TouchableOpacity>

        {(user?.uid === comment.userId || isLive) && (
          <TouchableOpacity
            style={styles.commentAction}
            onPress={() => deleteComment(comment.id)}
          >
            <Icon name="trash-outline" size={16} color="#666" />
          </TouchableOpacity>
        )}

        {isLive && !comment.isPinned && (
          <TouchableOpacity
            style={styles.commentAction}
            onPress={() => pinComment(comment.id)}
          >
            <Icon name="pin-outline" size={16} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <FlatList
          data={comment.replies}
          renderItem={renderReply}
          keyExtractor={(reply) => reply.id}
          style={styles.repliesList}
        />
      )}

      {/* Reply Input */}
      {replyingTo === comment.id && (
        <View style={styles.replyInputContainer}>
          <TextInput
            style={styles.replyInput}
            placeholder={`Reply to ${comment.username}...`}
            value={replyText}
            onChangeText={setReplyText}
            multiline
          />
          <TouchableOpacity
            style={styles.replyButton}
            onPress={() => sendReply(comment.id)}
            disabled={!replyText.trim() || sending}
          >
            <Icon
              name="send"
              size={16}
              color={replyText.trim() ? '#E1306C' : '#ccc'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelReplyButton}
            onPress={() => {
              setReplyingTo(null);
              setReplyText('');
            }}
          >
            <Icon name="close" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Live Indicator */}
      {isLive && (
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
          <Text style={styles.viewerCount}>{comments.length} viewers</Text>
        </View>
      )}

      {/* Comments List */}
      <FlatList
        ref={flatListRef}
        data={comments}
        renderItem={renderComment}
        keyExtractor={(item) => item.id}
        style={styles.commentsList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (isLive) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }}
      />

      {/* Floating Hearts */}
      {showFloatingHearts.map((heartId) => (
        <Animated.View
          key={heartId}
          style={[
            styles.floatingHeart,
            {
              opacity: heartAnimation,
              transform: [
                {
                  translateY: heartAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -100],
                  }),
                },
                {
                  scale: heartAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 1.2, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Icon name="heart" size={24} color="#ff3040" />
        </Animated.View>
      ))}

      {/* Comment Input */}
      <View style={styles.inputContainer}>
        <Image
          source={{ uri: user?.photoURL || '' }}
          style={styles.inputAvatar}
        />
        <TextInput
          style={styles.commentInput}
          placeholder={isLive ? "Say something..." : "Add a comment..."}
          value={newComment}
          onChangeText={setNewComment}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={styles.sendButton}
          onPress={sendComment}
          disabled={!newComment.trim() || sending}
        >
          <Icon
            name="send"
            size={20}
            color={newComment.trim() ? '#E1306C' : '#ccc'}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#ff3040',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  liveText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
    marginRight: 8,
  },
  viewerCount: {
    color: '#fff',
    fontSize: 12,
  },
  commentsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  commentContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pinnedComment: {
    backgroundColor: '#fef7f0',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderBottomColor: '#E1306C',
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  pinnedText: {
    color: '#E1306C',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  commentHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentMeta: {
    flex: 1,
  },
  commentUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUsername: {
    fontWeight: '600',
    marginRight: 6,
  },
  commentTime: {
    color: '#666',
    fontSize: 12,
    marginLeft: 6,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 12,
    color: '#666',
  },
  repliesList: {
    marginTop: 8,
    marginLeft: 44,
  },
  replyContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  replyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  replyContent: {
    flex: 1,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  replyUsername: {
    fontWeight: '600',
    fontSize: 12,
    marginRight: 6,
  },
  replyTime: {
    color: '#666',
    fontSize: 10,
  },
  replyText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  replyActions: {
    flexDirection: 'row',
  },
  replyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  replyActionText: {
    fontSize: 10,
    color: '#666',
  },
  replyInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 44,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyInput: {
    flex: 1,
    fontSize: 14,
    maxHeight: 80,
  },
  replyButton: {
    marginLeft: 8,
    padding: 4,
  },
  cancelReplyButton: {
    marginLeft: 4,
    padding: 4,
  },
  floatingHeart: {
    position: 'absolute',
    right: 20,
    bottom: 100,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
  },
  sendButton: {
    marginLeft: 12,
    padding: 8,
  },
});
