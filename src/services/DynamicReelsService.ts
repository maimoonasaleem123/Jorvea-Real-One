import { useState, useEffect, useCallback } from 'react';
import firestore from '@react-native-firebase/firestore';
import FirebaseService, { Reel, Comment } from './firebaseService';
import { User } from '../types';

export interface EnhancedReel extends Reel {
  isLiked?: boolean;
  isSaved?: boolean;
  isFollowing?: boolean;
  realTimeComments?: Comment[];
  realTimeLikesCount?: number;
  realTimeCommentsCount?: number;
}

class DynamicReelsService {
  private static instance: DynamicReelsService;
  private reelsCache = new Map<string, EnhancedReel>();
  private likesListeners = new Map<string, () => void>();
  private commentsListeners = new Map<string, () => void>();
  private followListeners = new Map<string, () => void>();
  
  static getInstance(): DynamicReelsService {
    if (!DynamicReelsService.instance) {
      DynamicReelsService.instance = new DynamicReelsService();
    }
    return DynamicReelsService.instance;
  }

  // Enhanced like functionality with real-time updates
  async toggleLike(reelId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    try {
      // Optimistic update first
      const cachedReel = this.reelsCache.get(reelId);
      if (cachedReel) {
        const wasLiked = cachedReel.isLiked || false;
        cachedReel.isLiked = !wasLiked;
        cachedReel.realTimeLikesCount = (cachedReel.realTimeLikesCount || cachedReel.likesCount || 0) + (wasLiked ? -1 : 1);
        this.reelsCache.set(reelId, cachedReel);
      }

      // Perform Firebase update
      const result = await FirebaseService.likeReel(reelId, userId);
      
      // Update cache with final result
      if (cachedReel) {
        cachedReel.isLiked = result.isLiked;
        cachedReel.realTimeLikesCount = result.likesCount;
        this.reelsCache.set(reelId, cachedReel);
      }

      return result;
    } catch (error) {
      console.error('Error toggling like:', error);
      
      // Revert optimistic update on error
      const cachedReel = this.reelsCache.get(reelId);
      if (cachedReel) {
        cachedReel.isLiked = !cachedReel.isLiked;
        cachedReel.realTimeLikesCount = (cachedReel.realTimeLikesCount || 0) + (cachedReel.isLiked ? -1 : 1);
        this.reelsCache.set(reelId, cachedReel);
      }
      
      throw error;
    }
  }

  // Real-time likes listener
  listenToLikes(reelId: string, callback: (likesCount: number, isLiked?: boolean) => void) {
    const unsubscribe = firestore()
      .collection('reels')
      .doc(reelId)
      .onSnapshot(doc => {
        if (doc.exists) {
          const data = doc.data();
          const likesCount = data?.likesCount || 0;
          
          // Update cache
          const cachedReel = this.reelsCache.get(reelId);
          if (cachedReel) {
            cachedReel.realTimeLikesCount = likesCount;
            this.reelsCache.set(reelId, cachedReel);
          }
          
          callback(likesCount);
        }
      });

    this.likesListeners.set(reelId, unsubscribe);
    return unsubscribe;
  }

  // Real-time comments listener
  listenToComments(reelId: string, callback: (comments: Comment[], count: number) => void) {
    const unsubscribe = firestore()
      .collection('comments')
      .where('contentId', '==', reelId)
      .where('contentType', '==', 'reel')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        const comments = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Comment));

        // Update cache
        const cachedReel = this.reelsCache.get(reelId);
        if (cachedReel) {
          cachedReel.realTimeComments = comments;
          cachedReel.realTimeCommentsCount = comments.length;
          this.reelsCache.set(reelId, cachedReel);
        }

        callback(comments, comments.length);
      });

    this.commentsListeners.set(reelId, unsubscribe);
    return unsubscribe;
  }

  // Add comment with real-time update
  async addComment(reelId: string, userId: string, text: string): Promise<string> {
    try {
      const commentId = await FirebaseService.addComment(reelId, userId, text, 'reel');
      
      // Update reel comments count in real-time
      const reelRef = firestore().collection('reels').doc(reelId);
      await reelRef.update({
        commentsCount: firestore.FieldValue.increment(1),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      return commentId;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  // Enhanced user profile picture with caching
  async getUserProfilePicture(userId: string): Promise<string | null> {
    try {
      const userDoc = await firestore().collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        return userData?.profilePicture || userData?.photoURL || null;
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile picture:', error);
      return null;
    }
  }

  // Get enhanced reel with real-time data
  getEnhancedReel(reelId: string): EnhancedReel | null {
    return this.reelsCache.get(reelId) || null;
  }

  // Update reel cache
  updateReelCache(reel: Reel, userId?: string): EnhancedReel {
    const enhancedReel: EnhancedReel = {
      ...reel,
      realTimeLikesCount: reel.likesCount,
      realTimeCommentsCount: reel.commentsCount,
    };

    // Check if user has liked this reel (you'll need to implement this check)
    if (userId) {
      this.checkUserLikedReel(reel.id, userId).then(isLiked => {
        enhancedReel.isLiked = isLiked;
        this.reelsCache.set(reel.id, enhancedReel);
      });
    }

    this.reelsCache.set(reel.id, enhancedReel);
    return enhancedReel;
  }

  // Check if user has liked a reel
  private async checkUserLikedReel(reelId: string, userId: string): Promise<boolean> {
    try {
      const likeDoc = await firestore()
        .collection('likes')
        .doc(`${reelId}_${userId}`)
        .get();
      return likeDoc.exists();
    } catch (error) {
      console.error('Error checking if user liked reel:', error);
      return false;
    }
  }

  // Clean up listeners
  cleanup() {
    this.likesListeners.forEach(unsubscribe => unsubscribe());
    this.commentsListeners.forEach(unsubscribe => unsubscribe());
    this.followListeners.forEach(unsubscribe => unsubscribe());
    
    this.likesListeners.clear();
    this.commentsListeners.clear();
    this.followListeners.clear();
    this.reelsCache.clear();
  }

  // Clean up specific reel listeners
  cleanupReel(reelId: string) {
    const likesListener = this.likesListeners.get(reelId);
    const commentsListener = this.commentsListeners.get(reelId);
    
    if (likesListener) {
      likesListener();
      this.likesListeners.delete(reelId);
    }
    
    if (commentsListener) {
      commentsListener();
      this.commentsListeners.delete(reelId);
    }
    
    this.reelsCache.delete(reelId);
  }
}

// React Hook for dynamic reels functionality
export const useDynamicReel = (reel: Reel, userId?: string) => {
  const [enhancedReel, setEnhancedReel] = useState<EnhancedReel>(() => 
    DynamicReelsService.getInstance().updateReelCache(reel, userId)
  );
  const [isLiking, setIsLiking] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);

  const service = DynamicReelsService.getInstance();

  useEffect(() => {
    // Listen to real-time likes
    const unsubscribeLikes = service.listenToLikes(reel.id, (likesCount, isLiked) => {
      setEnhancedReel(prev => ({
        ...prev,
        realTimeLikesCount: likesCount,
        ...(isLiked !== undefined && { isLiked })
      }));
    });

    // Listen to real-time comments
    const unsubscribeComments = service.listenToComments(reel.id, (comments, count) => {
      setEnhancedReel(prev => ({
        ...prev,
        realTimeComments: comments,
        realTimeCommentsCount: count
      }));
    });

    return () => {
      unsubscribeLikes();
      unsubscribeComments();
    };
  }, [reel.id]);

  const toggleLike = useCallback(async () => {
    if (!userId || isLiking) return;

    setIsLiking(true);
    try {
      const result = await service.toggleLike(reel.id, userId);
      setEnhancedReel(prev => ({
        ...prev,
        isLiked: result.isLiked,
        realTimeLikesCount: result.likesCount
      }));
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setIsLiking(false);
    }
  }, [reel.id, userId, isLiking]);

  const addComment = useCallback(async (text: string) => {
    if (!userId || isCommenting) return null;

    setIsCommenting(true);
    try {
      const commentId = await service.addComment(reel.id, userId, text);
      return commentId;
    } catch (error) {
      console.error('Error adding comment:', error);
      return null;
    } finally {
      setIsCommenting(false);
    }
  }, [reel.id, userId, isCommenting]);

  return {
    enhancedReel,
    toggleLike,
    addComment,
    isLiking,
    isCommenting,
  };
};

export default DynamicReelsService;
