import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService, { Comment } from '../services/firebaseService';

interface CommentsModalProps {
  visible: boolean;
  targetId: string;
  targetType: 'post' | 'reel' | 'story';
  onClose: () => void;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({
  visible,
  targetId,
  targetType,
  onClose,
}) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible && targetId) {
      loadComments();
    }
  }, [visible, targetId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const commentsData = await FirebaseService.getComments(targetId, targetType);
      setComments(commentsData);
    } catch (error) {
      console.error('Error loading comments:', error);
      Alert.alert('Error', 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const postComment = async () => {
    if (!newComment.trim() || !user) return;

    try {
      setPosting(true);
      await FirebaseService.addComment(targetId, targetType, newComment.trim(), user.uid);
      setNewComment('');
      await loadComments(); // Reload comments
      
      // Scroll to bottom to show new comment
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error posting comment:', error);
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setPosting(false);
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
        console.warn('Invalid timestamp format in CommentsModal:', timestamp);
        return 'Unknown';
      }

      // Validate the date
      if (!date || isNaN(date.getTime())) {
        console.warn('Invalid date created from timestamp in CommentsModal:', timestamp);
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
      console.error('Error formatting time ago in CommentsModal:', error, 'for timestamp:', timestamp);
      return 'Unknown';
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <Image
        source={{ uri: item.user?.profilePicture || 'https://via.placeholder.com/32' }}
        style={styles.commentAvatar}
      />
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <Text style={styles.commentUsername}>
            {item.user?.username || 'User'}
          </Text>
          <Text style={styles.commentTime}>
            {formatTimeAgo(item.createdAt)}
          </Text>
        </View>
        <Text style={styles.commentText}>
          {item.text}
        </Text>
        <View style={styles.commentActions}>
          <TouchableOpacity style={styles.commentAction}>
            <Icon name="heart-outline" size={14} color="#666" />
            <Text style={styles.commentActionText}>
              {item.likesCount || 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.commentAction}>
            <Text style={styles.replyText}>Reply</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.modal}>
        <KeyboardAvoidingView 
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Comments</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Comments List */}
          <FlatList
            ref={flatListRef}
            data={comments}
            renderItem={renderComment}
            keyExtractor={(item) => item.id}
            style={styles.commentsList}
            contentContainerStyle={styles.commentsContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                {loading ? (
                  <ActivityIndicator size="large" color="#E1306C" />
                ) : (
                  <>
                    <Icon name="chatbubble-outline" size={60} color="#ccc" />
                    <Text style={styles.emptyText}>No comments yet</Text>
                    <Text style={styles.emptySubtext}>Be the first to comment!</Text>
                  </>
                )}
              </View>
            )}
          />

          {/* Comment Input */}
          <View style={styles.inputContainer}>
            <Image
              source={{ uri: user?.profilePicture || user?.photoURL || 'https://via.placeholder.com/32' }}
              style={styles.userAvatar}
            />
            <TextInput
              style={styles.commentInput}
              placeholder="Add a comment..."
              placeholderTextColor="#999"
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.postButton, { opacity: newComment.trim() ? 1 : 0.5 }]}
              onPress={postComment}
              disabled={!newComment.trim() || posting}
            >
              {posting ? (
                <ActivityIndicator size="small" color="#E1306C" />
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
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  commentsList: {
    flex: 1,
  },
  commentsContent: {
    paddingBottom: 20,
  },
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
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
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUsername: {
    fontWeight: '600',
    color: '#000',
    marginRight: 8,
  },
  commentTime: {
    fontSize: 12,
    color: '#666',
  },
  commentText: {
    color: '#000',
    lineHeight: 18,
    marginBottom: 8,
  },
  commentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commentAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  commentActionText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  replyText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    fontWeight: '500',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  userAvatar: {
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
    maxHeight: 100,
    fontSize: 14,
    color: '#000',
  },
  postButton: {
    marginLeft: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  postButtonText: {
    color: '#E1306C',
    fontWeight: '600',
    fontSize: 14,
  },
});
