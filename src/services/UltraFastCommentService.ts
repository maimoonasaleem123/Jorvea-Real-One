/**
 * UltraFastCommentService - Instagram-style commenting system
 * Supports real-time comments for posts and reels
 */

import firestore from '@react-native-firebase/firestore';
import { User } from '../types';

interface Comment {
  id: string;
  userId: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
  likesCount: number;
  repliesCount: number;
  user?: {
    uid: string;
    displayName: string;
    profilePicture?: string;
  };
  isLiked?: boolean;
  parentCommentId?: string; // For replies
}

interface CommentReply {
  id: string;
  userId: string;
  text: string;
  createdAt: Date;
  likesCount: number;
  user?: {
    uid: string;
    displayName: string;
    profilePicture?: string;
  };
  isLiked?: boolean;
}

class UltraFastCommentService {
  /**
   * Add comment to post or reel
   */
  static async addComment(
    contentId: string,
    contentType: 'post' | 'reel',
    userId: string,
    text: string,
    parentCommentId?: string
  ): Promise<{ success: boolean; commentId?: string; error?: string }> {
    try {
      const commentData = {
        userId,
        text: text.trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
        likesCount: 0,
        repliesCount: 0,
        ...(parentCommentId && { parentCommentId }),
      };

      const collectionName = contentType === 'post' ? 'posts' : 'reels';
      
      // Add comment to subcollection
      const commentRef = await firestore()
        .collection(collectionName)
        .doc(contentId)
        .collection('comments')
        .add(commentData);

      // Update parent content comments count
      await firestore()
        .collection(collectionName)
        .doc(contentId)
        .update({
          commentsCount: firestore.FieldValue.increment(1),
          updatedAt: new Date(),
        });

      // If it's a reply, update parent comment replies count
      if (parentCommentId) {
        await firestore()
          .collection(collectionName)
          .doc(contentId)
          .collection('comments')
          .doc(parentCommentId)
          .update({
            repliesCount: firestore.FieldValue.increment(1),
            updatedAt: new Date(),
          });
      }

      // Add activity notification
      await this.addCommentNotification(contentId, contentType, userId, commentRef.id, parentCommentId);

      return { success: true, commentId: commentRef.id };
    } catch (error) {
      console.error('Error adding comment:', error);
      return { success: false, error: 'Failed to add comment' };
    }
  }

  /**
   * Get comments for post or reel with pagination
   */
  static async getComments(
    contentId: string,
    contentType: 'post' | 'reel',
    currentUserId: string,
    limit = 20,
    lastCommentId?: string
  ): Promise<Comment[]> {
    try {
      const collectionName = contentType === 'post' ? 'posts' : 'reels';
      
      let query = firestore()
        .collection(collectionName)
        .doc(contentId)
        .collection('comments')
        .where('parentCommentId', '==', null) // Only top-level comments
        .orderBy('createdAt', 'desc')
        .limit(limit);

      if (lastCommentId) {
        const lastDoc = await firestore()
          .collection(collectionName)
          .doc(contentId)
          .collection('comments')
          .doc(lastCommentId)
          .get();
        
        if (lastDoc.exists) {
          query = query.startAfter(lastDoc);
        }
      }

      const snapshot = await query.get();
      const comments: Comment[] = [];

      // Process comments in parallel
      const commentPromises = snapshot.docs.map(async (doc) => {
        const commentData = doc.data();
        
        // Get user data and like status in parallel
        const [userDoc, likeDoc] = await Promise.all([
          firestore().collection('users').doc(commentData.userId).get(),
          firestore()
            .collection(collectionName)
            .doc(contentId)
            .collection('comments')
            .doc(doc.id)
            .collection('likes')
            .doc(currentUserId)
            .get(),
        ]);

        const userData = userDoc.data();
        
        return {
          id: doc.id,
          userId: commentData.userId,
          text: commentData.text,
          createdAt: commentData.createdAt.toDate(),
          updatedAt: commentData.updatedAt.toDate(),
          likesCount: commentData.likesCount || 0,
          repliesCount: commentData.repliesCount || 0,
          user: {
            uid: commentData.userId,
            displayName: userData?.displayName || 'Unknown User',
            profilePicture: userData?.profilePicture,
          },
          isLiked: likeDoc.exists,
        };
      });

      const resolvedComments = await Promise.all(commentPromises);
      return resolvedComments;
    } catch (error) {
      console.error('Error getting comments:', error);
      return [];
    }
  }

  /**
   * Get replies for a comment
   */
  static async getCommentReplies(
    contentId: string,
    contentType: 'post' | 'reel',
    parentCommentId: string,
    currentUserId: string,
    limit = 10
  ): Promise<CommentReply[]> {
    try {
      const collectionName = contentType === 'post' ? 'posts' : 'reels';
      
      const snapshot = await firestore()
        .collection(collectionName)
        .doc(contentId)
        .collection('comments')
        .where('parentCommentId', '==', parentCommentId)
        .orderBy('createdAt', 'asc')
        .limit(limit)
        .get();

      const replies: CommentReply[] = [];

      for (const doc of snapshot.docs) {
        const replyData = doc.data();
        
        // Get user data and like status
        const [userDoc, likeDoc] = await Promise.all([
          firestore().collection('users').doc(replyData.userId).get(),
          firestore()
            .collection(collectionName)
            .doc(contentId)
            .collection('comments')
            .doc(doc.id)
            .collection('likes')
            .doc(currentUserId)
            .get(),
        ]);

        const userData = userDoc.data();
        
        replies.push({
          id: doc.id,
          userId: replyData.userId,
          text: replyData.text,
          createdAt: replyData.createdAt.toDate(),
          likesCount: replyData.likesCount || 0,
          user: {
            uid: replyData.userId,
            displayName: userData?.displayName || 'Unknown User',
            profilePicture: userData?.profilePicture,
          },
          isLiked: likeDoc.exists,
        });
      }

      return replies;
    } catch (error) {
      console.error('Error getting comment replies:', error);
      return [];
    }
  }

  /**
   * Like/unlike a comment
   */
  static async toggleCommentLike(
    contentId: string,
    contentType: 'post' | 'reel',
    commentId: string,
    userId: string
  ): Promise<{ success: boolean; isLiked: boolean }> {
    try {
      const collectionName = contentType === 'post' ? 'posts' : 'reels';
      const likeRef = firestore()
        .collection(collectionName)
        .doc(contentId)
        .collection('comments')
        .doc(commentId)
        .collection('likes')
        .doc(userId);

      const commentRef = firestore()
        .collection(collectionName)
        .doc(contentId)
        .collection('comments')
        .doc(commentId);

      const likeDoc = await likeRef.get();
      const isCurrentlyLiked = likeDoc.exists;

      if (isCurrentlyLiked) {
        // Unlike the comment
        await Promise.all([
          likeRef.delete(),
          commentRef.update({
            likesCount: firestore.FieldValue.increment(-1),
            updatedAt: new Date(),
          }),
        ]);
        return { success: true, isLiked: false };
      } else {
        // Like the comment
        await Promise.all([
          likeRef.set({
            userId,
            createdAt: new Date(),
          }),
          commentRef.update({
            likesCount: firestore.FieldValue.increment(1),
            updatedAt: new Date(),
          }),
        ]);
        return { success: true, isLiked: true };
      }
    } catch (error) {
      console.error('Error toggling comment like:', error);
      return { success: false, isLiked: false };
    }
  }

  /**
   * Delete a comment
   */
  static async deleteComment(
    contentId: string,
    contentType: 'post' | 'reel',
    commentId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const collectionName = contentType === 'post' ? 'posts' : 'reels';
      const commentRef = firestore()
        .collection(collectionName)
        .doc(contentId)
        .collection('comments')
        .doc(commentId);

      // Get comment data to check ownership
      const commentDoc = await commentRef.get();
      if (!commentDoc.exists) {
        return { success: false, error: 'Comment not found' };
      }

      const commentData = commentDoc.data();
      if (commentData?.userId !== userId) {
        return { success: false, error: 'Not authorized to delete this comment' };
      }

      // Delete comment and update counts
      await Promise.all([
        commentRef.delete(),
        firestore()
          .collection(collectionName)
          .doc(contentId)
          .update({
            commentsCount: firestore.FieldValue.increment(-1),
            updatedAt: new Date(),
          }),
      ]);

      // If it has a parent, update parent's reply count
      if (commentData.parentCommentId) {
        await firestore()
          .collection(collectionName)
          .doc(contentId)
          .collection('comments')
          .doc(commentData.parentCommentId)
          .update({
            repliesCount: firestore.FieldValue.increment(-1),
            updatedAt: new Date(),
          });
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting comment:', error);
      return { success: false, error: 'Failed to delete comment' };
    }
  }

  /**
   * Edit a comment
   */
  static async editComment(
    contentId: string,
    contentType: 'post' | 'reel',
    commentId: string,
    userId: string,
    newText: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const collectionName = contentType === 'post' ? 'posts' : 'reels';
      const commentRef = firestore()
        .collection(collectionName)
        .doc(contentId)
        .collection('comments')
        .doc(commentId);

      // Get comment data to check ownership
      const commentDoc = await commentRef.get();
      if (!commentDoc.exists) {
        return { success: false, error: 'Comment not found' };
      }

      const commentData = commentDoc.data();
      if (commentData?.userId !== userId) {
        return { success: false, error: 'Not authorized to edit this comment' };
      }

      // Update comment text
      await commentRef.update({
        text: newText.trim(),
        updatedAt: new Date(),
        isEdited: true,
      });

      return { success: true };
    } catch (error) {
      console.error('Error editing comment:', error);
      return { success: false, error: 'Failed to edit comment' };
    }
  }

  /**
   * Real-time comment listener
   */
  static subscribeToComments(
    contentId: string,
    contentType: 'post' | 'reel',
    currentUserId: string,
    callback: (comments: Comment[]) => void
  ) {
    const collectionName = contentType === 'post' ? 'posts' : 'reels';
    
    return firestore()
      .collection(collectionName)
      .doc(contentId)
      .collection('comments')
      .where('parentCommentId', '==', null)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .onSnapshot(async (snapshot) => {
        try {
          const comments: Comment[] = [];

          for (const doc of snapshot.docs) {
            const commentData = doc.data();
            
            // Get user data and like status
            const [userDoc, likeDoc] = await Promise.all([
              firestore().collection('users').doc(commentData.userId).get(),
              firestore()
                .collection(collectionName)
                .doc(contentId)
                .collection('comments')
                .doc(doc.id)
                .collection('likes')
                .doc(currentUserId)
                .get(),
            ]);

            const userData = userDoc.data();
            
            comments.push({
              id: doc.id,
              userId: commentData.userId,
              text: commentData.text,
              createdAt: commentData.createdAt.toDate(),
              updatedAt: commentData.updatedAt.toDate(),
              likesCount: commentData.likesCount || 0,
              repliesCount: commentData.repliesCount || 0,
              user: {
                uid: commentData.userId,
                displayName: userData?.displayName || 'Unknown User',
                profilePicture: userData?.profilePicture,
              },
              isLiked: likeDoc.exists,
            });
          }

          callback(comments);
        } catch (error) {
          console.error('Error in comment listener:', error);
          callback([]);
        }
      });
  }

  /**
   * Add notification for new comment
   */
  private static async addCommentNotification(
    contentId: string,
    contentType: 'post' | 'reel',
    commenterId: string,
    commentId: string,
    parentCommentId?: string
  ) {
    try {
      // Get content owner
      const collectionName = contentType === 'post' ? 'posts' : 'reels';
      const contentDoc = await firestore().collection(collectionName).doc(contentId).get();
      const contentData = contentDoc.data();
      
      if (!contentData) return;

      const ownerId = contentData.userId;
      
      // Don't notify if user is commenting on their own content
      if (ownerId === commenterId) return;

      // Create notification
      await firestore().collection('notifications').add({
        type: 'comment',
        recipientId: ownerId,
        senderId: commenterId,
        contentId,
        contentType,
        commentId,
        parentCommentId,
        message: `commented on your ${contentType}`,
        isRead: false,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Error adding comment notification:', error);
    }
  }

  /**
   * Get comment statistics
   */
  static async getCommentStats(
    contentId: string,
    contentType: 'post' | 'reel'
  ): Promise<{ totalComments: number; totalReplies: number }> {
    try {
      const collectionName = contentType === 'post' ? 'posts' : 'reels';
      
      const [commentsSnapshot, repliesSnapshot] = await Promise.all([
        firestore()
          .collection(collectionName)
          .doc(contentId)
          .collection('comments')
          .where('parentCommentId', '==', null)
          .get(),
        firestore()
          .collection(collectionName)
          .doc(contentId)
          .collection('comments')
          .where('parentCommentId', '!=', null)
          .get(),
      ]);

      return {
        totalComments: commentsSnapshot.size,
        totalReplies: repliesSnapshot.size,
      };
    } catch (error) {
      console.error('Error getting comment stats:', error);
      return { totalComments: 0, totalReplies: 0 };
    }
  }
}

export default UltraFastCommentService;
export type { Comment, CommentReply };
