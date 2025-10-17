import firestore from '@react-native-firebase/firestore';
import { Post } from './firebaseService';

export interface PostInteraction {
  userId: string;
  postId: string;
  type: 'like' | 'comment' | 'save' | 'share';
  timestamp: any;
  data?: any; // Additional data for comments, shares, etc.
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  userAvatar?: string;
  text: string;
  timestamp: any;
  likesCount: number;
  isLiked?: boolean;
  replies?: PostComment[];
}

class UltraFastPostService {
  private static instance: UltraFastPostService;

  static getInstance(): UltraFastPostService {
    if (!UltraFastPostService.instance) {
      UltraFastPostService.instance = new UltraFastPostService();
    }
    return UltraFastPostService.instance;
  }

  /**
   * Toggle like on a post INSTANTLY
   * DEPRECATED: Use RealTimeLikeSystem instead for consistent like handling
   */
  async togglePostLike(postId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    try {
      console.warn('⚠️ UltraFastPostService.togglePostLike is deprecated. Use RealTimeLikeSystem instead.');
      
      // Use RealTimeLikeSystem for consistent like handling
      const RealTimeLikeSystem = require('./RealTimeLikeSystem').default;
      const result = await RealTimeLikeSystem.getInstance().toggleLike(
        postId,
        userId,
        'post',
        undefined, // Let the system check current state
        undefined  // Let the system check current count
      );
      
      return {
        isLiked: result.isLiked,
        likesCount: result.likesCount
      };
    } catch (error) {
      console.error('❌ Error toggling post like:', error);
      throw error;
    }
  }

  /**
   * Toggle save on a post INSTANTLY
   */
  async togglePostSave(postId: string, userId: string): Promise<{ isSaved: boolean }> {
    try {
      const saveRef = firestore().collection('users').doc(userId).collection('savedPosts').doc(postId);
      
      // Check current save status
      const saveDoc = await saveRef.get();
      const isCurrentlySaved = saveDoc.exists;
      
      if (isCurrentlySaved) {
        // Unsave: remove save document
        await saveRef.delete();
        console.log('📌 Post unsaved successfully');
        return { isSaved: false };
      } else {
        // Save: add save document
        await saveRef.set({
          postId,
          savedAt: firestore.FieldValue.serverTimestamp()
        });
        console.log('💾 Post saved successfully');
        return { isSaved: true };
      }
    } catch (error) {
      console.error('❌ Error toggling post save:', error);
      throw error;
    }
  }

  /**
   * Add comment to a post INSTANTLY
   */
  async addPostComment(postId: string, userId: string, text: string): Promise<PostComment | null> {
    try {
      // Get user data for comment
      const userDoc = await firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      const commentId = firestore().collection('comments').doc().id;
      
      const commentData: PostComment = {
        id: commentId,
        postId,
        userId,
        username: userData?.username || 'user',
        userAvatar: userData?.profilePicture,
        text,
        timestamp: firestore.FieldValue.serverTimestamp(),
        likesCount: 0,
        isLiked: false
      };

      // Add comment to comments collection
      await firestore().collection('comments').doc(commentId).set(commentData);
      
      // Update post comments count
      await firestore().collection('posts').doc(postId).update({
        commentsCount: firestore.FieldValue.increment(1)
      });

      console.log('💬 Comment added successfully');
      return { ...commentData, timestamp: new Date() } as PostComment;
      
    } catch (error) {
      console.error('❌ Error adding comment:', error);
      return null;
    }
  }

  /**
   * Get comments for a post
   */
  async getPostComments(postId: string, limit: number = 20): Promise<PostComment[]> {
    try {
      const commentsSnapshot = await firestore()
        .collection('comments')
        .where('postId', '==', postId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const comments: PostComment[] = commentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PostComment));

      console.log(`✅ Loaded ${comments.length} comments`);
      return comments;
      
    } catch (error) {
      console.error('❌ Error loading comments:', error);
      return [];
    }
  }

  /**
   * Share post to users INSTANTLY
   */
  async sharePostToUsers(
    senderId: string, 
    recipientIds: string[], 
    post: Post, 
    customMessage?: string
  ): Promise<boolean> {
    try {
      console.log(`🚀 Sharing post to ${recipientIds.length} users...`);
      
      const senderDoc = await firestore().collection('users').doc(senderId).get();
      const senderData = senderDoc.data();
      const senderName = senderData?.displayName || senderData?.username || 'Someone';

      // Share to all recipients in parallel
      const sharePromises = recipientIds.map(async (recipientId) => {
        try {
          const chatId = [senderId, recipientId].sort().join('_');
          const messageId = firestore().collection('messages').doc().id;
          
          const messageData = {
            id: messageId,
            senderId,
            recipientId,
            postId: post.id,
            postData: {
              imageUrl: post.imageUrl,
              caption: post.caption || '',
              username: post.user?.username || 'user',
              userAvatar: post.user?.profilePicture || ''
            },
            message: customMessage || `${senderName} shared a post with you! 📸`,
            timestamp: firestore.FieldValue.serverTimestamp(),
            read: false,
            delivered: true,
            type: 'post'
          };

          // Create message document
          await firestore().collection('messages').doc(messageId).set(messageData);

          // Update or create chat
          const chatRef = firestore().collection('chats').doc(chatId);
          
          await chatRef.set({
            id: chatId,
            participants: [senderId, recipientId],
            lastMessage: {
              text: customMessage || '📸 Shared a post',
              timestamp: firestore.FieldValue.serverTimestamp(),
              senderId,
              type: 'post'
            },
            updatedAt: firestore.FieldValue.serverTimestamp(),
            [`unreadCount.${recipientId}`]: firestore.FieldValue.increment(1)
          }, { merge: true });

          return true;
        } catch (error) {
          console.error(`❌ Error sharing to user ${recipientId}:`, error);
          return false;
        }
      });

      const results = await Promise.all(sharePromises);
      const successCount = results.filter(Boolean).length;
      
      // Update share count on post
      await firestore().collection('posts').doc(post.id).update({
        sharesCount: firestore.FieldValue.increment(successCount)
      });
      
      console.log(`✅ Successfully shared to ${successCount}/${recipientIds.length} users`);
      return successCount === recipientIds.length;

    } catch (error) {
      console.error('❌ Error sharing post:', error);
      return false;
    }
  }

  /**
   * Get posts with user interactions loaded
   */
  async getPostsWithInteractions(userId: string, limit: number = 10): Promise<Post[]> {
    try {
      console.log('🚀 Loading posts with interactions...');
      
      const postsSnapshot = await firestore()
        .collection('posts')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      const posts = await Promise.all(
        postsSnapshot.docs.map(async (doc) => {
          const postData = doc.data() as Post;
          const postId = doc.id;

          try {
            // Check if user liked this post
            const likeDoc = await firestore()
              .collection('posts')
              .doc(postId)
              .collection('likes')
              .doc(userId)
              .get();

            // Check if user saved this post
            const saveDoc = await firestore()
              .collection('users')
              .doc(userId)
              .collection('savedPosts')
              .doc(postId)
              .get();

            // Load post author data
            const userDoc = await firestore()
              .collection('users')
              .doc(postData.userId)
              .get();

            const userData = userDoc.data();

            return {
              ...postData,
              id: postId,
              isLiked: likeDoc.exists,
              isSaved: saveDoc.exists,
              user: userData ? {
                id: postData.userId,
                username: userData.username || 'user',
                displayName: userData.displayName || userData.username || 'User',
                profilePicture: userData.profilePicture,
                verified: userData.verified || false
              } : undefined
            };
          } catch (error) {
            console.error('Error loading post interactions:', error);
            return {
              ...postData,
              id: postId,
              isLiked: false,
              isSaved: false
            };
          }
        })
      );

      console.log(`✅ Loaded ${posts.length} posts with interactions`);
      return posts;

    } catch (error) {
      console.error('❌ Error loading posts:', error);
      return [];
    }
  }

  /**
   * Get user's liked posts
   */
  async getUserLikedPosts(userId: string, limit: number = 20): Promise<Post[]> {
    try {
      const likesSnapshot = await firestore()
        .collection('posts')
        .doc()
        .collection('likes')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const likedPostIds = likesSnapshot.docs.map(doc => doc.ref.parent.parent?.id).filter(Boolean);
      
      if (likedPostIds.length === 0) return [];

      const postsPromises = likedPostIds.map(async (postId) => {
        try {
          const postDoc = await firestore().collection('posts').doc(postId!).get();
          if (postDoc.exists) {
            return { id: postDoc.id, ...postDoc.data() } as Post;
          }
          return null;
        } catch (error) {
          return null;
        }
      });

      const posts = (await Promise.all(postsPromises)).filter(Boolean) as Post[];
      
      console.log(`✅ Loaded ${posts.length} liked posts`);
      return posts;

    } catch (error) {
      console.error('❌ Error loading liked posts:', error);
      return [];
    }
  }

  /**
   * Get user's saved posts
   */
  async getUserSavedPosts(userId: string, limit: number = 20): Promise<Post[]> {
    try {
      const savedSnapshot = await firestore()
        .collection('users')
        .doc(userId)
        .collection('savedPosts')
        .orderBy('savedAt', 'desc')
        .limit(limit)
        .get();

      const savedPostIds = savedSnapshot.docs.map(doc => doc.id);
      
      if (savedPostIds.length === 0) return [];

      const postsPromises = savedPostIds.map(async (postId) => {
        try {
          const postDoc = await firestore().collection('posts').doc(postId).get();
          if (postDoc.exists) {
            return { id: postDoc.id, ...postDoc.data() } as Post;
          }
          return null;
        } catch (error) {
          return null;
        }
      });

      const posts = (await Promise.all(postsPromises)).filter(Boolean) as Post[];
      
      console.log(`✅ Loaded ${posts.length} saved posts`);
      return posts;

    } catch (error) {
      console.error('❌ Error loading saved posts:', error);
      return [];
    }
  }
}

export default UltraFastPostService;
