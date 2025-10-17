import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Vibration,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { FirebaseService } from '../services/firebaseService';
import { Post, User } from '../types';
import { useAuth } from '../context/FastAuthContext';
import RealTimeLikeSystem from '../services/RealTimeLikeSystem';
import { CommentsScreen } from '../components/CommentsScreen';

interface RouteParams {
  postId?: string;
  post?: Post;
}

export default function PostDetailScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const params = route.params as RouteParams;
  const postId = params?.postId;
  const initialPost = params?.post;
  
  const [post, setPost] = useState<Post | null>(initialPost || null);
  const [postAuthor, setPostAuthor] = useState<User | null>(null);
  const [loading, setLoading] = useState(!initialPost);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (postId && !initialPost) {
      loadPostData();
    } else if (initialPost) {
      loadAuthorData(initialPost.userId);
    } else {
      Alert.alert('Error', 'No post data provided');
      navigation.goBack();
    }
  }, [postId, initialPost]);

  // Real-time comments updates
  useEffect(() => {
    if (!post?.id) return;

    console.log('🔄 Setting up real-time comments listener for post:', post.id);
    
    const unsubscribe = FirebaseService.listenToComments(post.id, (comments) => {
      setPost(prev => prev ? {
        ...prev,
        comments: comments,
      } : null);
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [post?.id]);

  const loadPostData = async () => {
    try {
      setLoading(true);
      
      if (!postId) {
        Alert.alert('Error', 'Invalid post ID');
        setLoading(false);
        return;
      }
      
      const postData = await FirebaseService.getPostById(postId);
      if (!postData) {
        Alert.alert('Error', 'Post not found');
        navigation.goBack();
        return;
      }
      
      setPost(postData);
      await loadAuthorData(postData.userId);
      
    } catch (error) {
      console.error('Error loading post:', error);
      Alert.alert('Error', 'Failed to load post');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const loadAuthorData = async (userId: string) => {
    try {
      const authorData = await FirebaseService.getUserProfile(userId);
      if (authorData) {
        setPostAuthor(authorData);
      }
    } catch (error) {
      console.error('Error loading author:', error);
    }
  };

  // ❤️ PERFECT LIKE SYSTEM for post detail
  const handleLike = useCallback(async () => {
    if (!user?.uid || !post) return;

    try {
      console.log('❤️ PerfectLike: Starting like toggle for post:', post.id);

      // Calculate current like state
      const isCurrentlyLiked = post.likes?.includes(user.uid) || false;
      const currentLikesCount = post.likes?.length || 0;

      // Use PerfectLikeSystem for bulletproof like handling
      const result = await RealTimeLikeSystem.getInstance().toggleLike(
        post.id,
        user.uid,
        'post',
        isCurrentlyLiked,
        currentLikesCount
      );

      if (result.success) {
        // Update local state with the final result
        setPost(prev => prev ? {
          ...prev,
          likes: result.isLiked 
            ? [...(prev.likes || []), user.uid]
            : (prev.likes || []).filter(id => id !== user.uid)
        } : null);

        console.log(`✅ PerfectLike: Post ${post.id} ${result.isLiked ? 'liked' : 'unliked'} successfully. Count: ${result.likesCount}`);
      } else {
        // Show error message if needed
        if (result.error && result.error !== 'Too fast') {
          Alert.alert('❤️ Like Error', 'Unable to update like. Please try again.');
        }
        console.log('⚠️ PerfectLike: Like operation failed:', result.error);
      }

    } catch (error) {
      console.error('❌ PerfectLike: Unexpected error in handleLike:', error);
      Alert.alert('❤️ Like Error', 'Something went wrong. Please check your connection and try again.');
    }
  }, [user?.uid, post]);

  // Handle comments
  const handleComment = useCallback(() => {
    setShowComments(true);
  }, []);

  const handleCloseComments = useCallback(() => {
    setShowComments(false);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E1306C" />
          <Text style={styles.loadingText}>Loading post...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!post || !postAuthor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="alert-circle-outline" size={64} color="#999" />
          <Text style={styles.errorText}>Post not found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Icon name="arrow-back" size={24} color="#262626" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Icon name="ellipsis-horizontal" size={24} color="#262626" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Post Header with User Profile Navigation */}
        <TouchableOpacity 
          style={styles.postHeader}
          onPress={() => {
            (navigation as any).navigate('UserProfile', { 
              userId: postAuthor.uid || postAuthor.id,
              user: postAuthor 
            });
          }}
        >
          <Image
            source={{ 
              uri: postAuthor.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(postAuthor.displayName || postAuthor.username)}&background=E1306C&color=fff`
            }}
            style={styles.profileImage}
          />
          <View style={styles.userInfo}>
            <Text style={styles.username}>{postAuthor.username}</Text>
            <Text style={styles.displayName}>{postAuthor.displayName}</Text>
          </View>
          <TouchableOpacity onPress={(e) => e.stopPropagation()}>
            <Icon name="ellipsis-horizontal" size={20} color="#262626" />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* Post Images */}
        {post.mediaUrls && post.mediaUrls.length > 0 && (
          <View style={styles.imageContainer}>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {post.mediaUrls.map((url, index) => (
                <Image
                  key={index}
                  source={{ uri: url }}
                  style={styles.postImage}
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Post Actions */}
        <View style={styles.actions}>
          <View style={styles.leftActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleLike}
              activeOpacity={0.6}
            >
              <Icon 
                name={post.likes?.includes(user?.uid || '') ? "heart" : "heart-outline"}
                size={24} 
                color={post.likes?.includes(user?.uid || '') ? "#ff3040" : "#262626"}
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleComment}
              activeOpacity={0.6}
            >
              <Icon name="chatbubble-outline" size={24} color="#262626" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Icon name="paper-plane-outline" size={24} color="#262626" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity>
            <Icon 
              name="bookmark-outline"
              size={24} 
              color="#262626" 
            />
          </TouchableOpacity>
        </View>

        {/* Post Info */}
        <View style={styles.postInfo}>
          <Text style={styles.likes}>{post.likes?.length || 0} likes</Text>
          {post.caption && (
            <Text style={styles.caption}>
              <Text style={styles.username}>{postAuthor.username}</Text>{' '}
              {post.caption}
            </Text>
          )}
          {post.comments && post.comments.length > 0 && (
            <TouchableOpacity onPress={handleComment}>
              <Text style={styles.viewComments}>View all {post.comments.length} comments</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.timestamp}>
            {new Date(post.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>

      {/* Comments Modal */}
      <CommentsScreen
        visible={showComments}
        onClose={handleCloseComments}
        postId={post.id}
        contentType="post"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginVertical: 15,
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#E1306C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  content: {
    flex: 1,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#262626',
  },
  displayName: {
    fontSize: 12,
    color: '#8E8E93',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
  },
  actionButton: {
    paddingRight: 16,
  },
  postInfo: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  likes: {
    fontSize: 14,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 4,
  },
  caption: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 18,
    marginBottom: 4,
  },
  viewComments: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
