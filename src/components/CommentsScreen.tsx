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
  ActivityIndicator,
  Modal,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService, { Comment } from '../services/firebaseService';
import { User } from '../types';
import LikeButton from './LikeButton';
import { BeautifulCard } from './BeautifulCard';

const { width, height } = Dimensions.get('window');

interface CommentsScreenProps {
  visible: boolean;
  onClose: () => void;
  postId?: string;
  reelId?: string;
  contentType: 'post' | 'reel';
}

export const CommentsScreen: React.FC<CommentsScreenProps> = ({
  visible,
  onClose,
  postId,
  reelId,
  contentType,
}) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const textInputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);

  const contentId = postId || reelId;

  useEffect(() => {
    if (visible && contentId) {
      loadComments();
    }
  }, [visible, contentId]);

  const loadComments = async () => {
    if (!contentId) return;

    setLoading(true);
    try {
      const commentsData = await FirebaseService.getComments(contentId, contentType);
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading comments:', error);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!user || !contentId || newComment.trim() === '') return;

    setPosting(true);
    try {
      const commentData = {
        userId: user.uid,
        contentId,
        contentType,
        content: newComment.trim(), // Use 'content' to match Comment interface
        parentId: replyingTo?.id || null, // Ensure null instead of undefined
        mentions: [], // TODO: Extract mentions from comment text
        likesCount: 0,
        repliesCount: 0,
        isEdited: false,
        type: 'text' as const, // Add type field
        mediaUrl: null, // Add mediaUrl field
      };

      const commentId = await FirebaseService.createComment(commentData);
      
      // Add the new comment to local state
      const newCommentObj: Comment = {
        id: commentId,
        ...commentData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'User',
          username: user.displayName?.toLowerCase().replace(/\s+/g, '_') || `user_${user.uid.slice(-6)}`,
          photoURL: user.profilePicture || user.photoURL || '',
          profilePicture: user.profilePicture || user.photoURL || '',
          isVerified: false,
          verified: false,
          followers: [],
          following: [],
          blockedUsers: [],
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          storiesCount: 0,
          reelsCount: 0,
          isPrivate: false,
          bio: '',
          website: '',
          phoneNumber: '',
          createdAt: new Date(),
          lastActive: new Date(),
          settings: {
            notifications: {
              likes: true,
              comments: true,
              follows: true,
              messages: true,
              mentions: true,
              stories: true,
            },
            privacy: {
              isPrivate: false,
              showActivity: true,
              showOnlineStatus: true,
              allowMessages: 'everyone' as const,
            },
            theme: 'light' as const,
          },
        },
        isLiked: false,
      };

      if (replyingTo) {
        // Update replies count for parent comment
        setComments(prev =>
          prev.map(comment =>
            comment.id === replyingTo.id
              ? { ...comment, repliesCount: comment.repliesCount + 1 }
              : comment
          )
        );
        // Expand replies to show the new reply
        setExpandedReplies(prev => new Set(prev).add(replyingTo.id));
      }

      setComments(prev => [newCommentObj, ...prev]);
      setNewComment('');
      setReplyingTo(null);
      
      // Scroll to top to show new comment
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  };

  const handleLikeComment = async (commentId: string) => {
    if (!user) return;

    try {
      const result = await FirebaseService.likeComment(commentId, user.uid);
      
      setComments(prev =>
        prev.map(comment =>
          comment.id === commentId
            ? {
                ...comment,
                isLiked: result.isLiked,
                likesCount: result.likesCount,
              }
            : comment
        )
      );
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  const handleReply = (comment: Comment) => {
    setReplyingTo(comment);
    textInputRef.current?.focus();
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;

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
              setComments(prev => prev.filter(comment => comment.id !== commentId));
            } catch (error) {
              console.error('Error deleting comment:', error);
              Alert.alert('Error', 'Failed to delete comment');
            }
          },
        },
      ]
    );
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(commentId)) {
        newSet.delete(commentId);
      } else {
        newSet.add(commentId);
        // Load replies if not already loaded
        loadReplies(commentId);
      }
      return newSet;
    });
  };

  const loadReplies = async (parentCommentId: string) => {
    try {
      const replies = await FirebaseService.getCommentReplies(parentCommentId);
      setComments(prev => {
        // Remove existing replies and add new ones
        const withoutReplies = prev.filter(c => c.parentId !== parentCommentId);
        return [...withoutReplies, ...replies];
      });
    } catch (error) {
      console.error('Error loading replies:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const commentTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - commentTime.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 24 * 60) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / (24 * 60))}d`;
  };

  const renderComment = ({ item: comment }: { item: Comment }) => {
    const isReply = !!comment.parentId;
    const isExpanded = expandedReplies.has(comment.id);
    const replies = comments.filter(c => c.parentId === comment.id);

    return (
      <View style={[styles.commentContainer, isReply && styles.replyContainer]}>
        <Image
          source={{ uri: comment.user?.profilePicture || comment.user?.photoURL }}
          style={[styles.avatar, isReply && styles.replyAvatar]}
        />
        
        <View style={styles.commentContent}>
          <BeautifulCard style={styles.commentBubble}>
            <View style={styles.commentHeader}>
              <Text style={styles.username}>
                {comment.user?.displayName || comment.user?.username}
              </Text>
              <Text style={styles.timestamp}>{formatTime(comment.createdAt)}</Text>
            </View>
            
            <Text style={styles.commentText}>{comment.content}</Text>
          </BeautifulCard>
          
          <View style={styles.commentActions}>
            <LikeButton
              isLiked={comment.isLiked || false}
              likesCount={comment.likesCount}
              onPress={() => handleLikeComment(comment.id)}
              size={16}
              showCount={comment.likesCount > 0}
            />
            
            {!isReply && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleReply(comment)}
              >
                <Text style={styles.actionText}>Reply</Text>
              </TouchableOpacity>
            )}
            
            {comment.userId === user?.uid && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDeleteComment(comment.id)}
              >
                <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {!isReply && comment.repliesCount > 0 && (
            <TouchableOpacity
              style={styles.viewRepliesButton}
              onPress={() => toggleReplies(comment.id)}
            >
              <Text style={styles.viewRepliesText}>
                {isExpanded ? 'Hide' : 'View'} {comment.repliesCount} {comment.repliesCount === 1 ? 'reply' : 'replies'}
              </Text>
              <Icon
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={16}
                color="#8E8E93"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const getDisplayedComments = () => {
    const mainComments = comments.filter(c => !c.parentId);
    const result: Comment[] = [];
    
    for (const comment of mainComments) {
      result.push(comment);
      if (expandedReplies.has(comment.id)) {
        const replies = comments.filter(c => c.parentId === comment.id);
        result.push(...replies);
      }
    }
    
    return result;
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Comments</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={getDisplayedComments()}
              renderItem={renderComment}
              keyExtractor={(item) => item.id}
              style={styles.commentsList}
              contentContainerStyle={styles.commentsListContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="chatbubble-outline" size={48} color="#C7C7CC" />
                  <Text style={styles.emptyText}>No comments yet</Text>
                  <Text style={styles.emptySubtext}>Be the first to comment!</Text>
                </View>
              }
            />
          )}

          {/* Reply indicator */}
          {replyingTo && (
            <View style={styles.replyIndicator}>
              <Text style={styles.replyingText}>
                Replying to {replyingTo.user?.displayName}
              </Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Icon name="close" size={16} color="#8E8E93" />
              </TouchableOpacity>
            </View>
          )}

          {/* Comment Input */}
          <View style={styles.inputContainer}>
            <Image
              source={{ uri: user?.profilePicture || user?.photoURL }}
              style={styles.userAvatar}
            />
            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              placeholder={replyingTo ? 'Write a reply...' : 'Add a comment...'}
              placeholderTextColor="#8E8E93"
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.postButton,
                (newComment.trim() === '' || posting) && styles.postButtonDisabled,
              ]}
              onPress={handlePostComment}
              disabled={newComment.trim() === '' || posting}
            >
              {posting ? (
                <ActivityIndicator size="small" color="#007AFF" />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentsList: {
    flex: 1,
  },
  commentsListContent: {
    paddingVertical: 8,
  },
  commentContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  replyContainer: {
    paddingLeft: 60,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
  },
  commentText: {
    fontSize: 14,
    color: '#000',
    lineHeight: 18,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  },
  actionButton: {
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  deleteText: {
    color: '#FF3B30',
  },
  viewRepliesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  viewRepliesText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    marginTop: 4,
  },
  replyIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E7',
  },
  replyingText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5E7',
    backgroundColor: '#fff',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    color:"black",
    borderColor: '#E5E5E7',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    marginRight: 12,
  },
  postButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#007AFF',
  },
  postButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  postButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
