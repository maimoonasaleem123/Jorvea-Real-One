import React, { useState, useEffect, useCallback } from 'react';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import FirebaseService, { Reel, Comment } from './firebaseService';
import { User } from '../types';

interface RealTimeData {
  likes: Map<string, { count: number; isLiked: boolean }>;
  comments: Map<string, Comment[]>;
  follows: Map<string, boolean>;
  saves: Map<string, boolean>;
  profiles: Map<string, User>;
}

class RealTimeDynamicService {
  private static instance: RealTimeDynamicService;
  private listeners = new Map<string, () => void>();
  private data: RealTimeData = {
    likes: new Map(),
    comments: new Map(),
    follows: new Map(),
    saves: new Map(),
    profiles: new Map(),
  };

  static getInstance(): RealTimeDynamicService {
    if (!RealTimeDynamicService.instance) {
      RealTimeDynamicService.instance = new RealTimeDynamicService();
    }
    return RealTimeDynamicService.instance;
  }

  // Set up real-time listeners for a reel
  setupReelListeners(reelId: string, userId: string, callbacks: {
    onLikesUpdate?: (count: number, isLiked: boolean) => void;
    onCommentsUpdate?: (comments: Comment[], count: number) => void;
    onSaveUpdate?: (isSaved: boolean) => void;
  }) {
    // Likes listener
    const likesUnsubscribe = firestore()
      .collection('reels')
      .doc(reelId)
      .onSnapshot(doc => {
        if (doc.exists) {
          const data = doc.data();
          const likesCount = data?.likesCount || 0;
          
          // Check if user liked this reel
          firestore()
            .collection('likes')
            .doc(`${reelId}_${userId}`)
            .get()
            .then(likeDoc => {
              const isLiked = likeDoc.exists();
              this.data.likes.set(reelId, { count: likesCount, isLiked });
              callbacks.onLikesUpdate?.(likesCount, isLiked);
            });
        }
      });

    // Comments listener
    const commentsUnsubscribe = firestore()
      .collection('comments')
      .where('contentId', '==', reelId)
      .where('contentType', '==', 'reel')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        const comments = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Comment));
        
        this.data.comments.set(reelId, comments);
        callbacks.onCommentsUpdate?.(comments, comments.length);
      });

    // Save status listener
    const saveUnsubscribe = firestore()
      .collection('saves')
      .doc(`${reelId}_${userId}`)
      .onSnapshot(doc => {
        const isSaved = doc.exists();
        this.data.saves.set(reelId, isSaved);
        callbacks.onSaveUpdate?.(isSaved);
      });

    // Store listeners
    const listenerId = `${reelId}_${userId}`;
    this.listeners.set(listenerId, () => {
      likesUnsubscribe();
      commentsUnsubscribe();
      saveUnsubscribe();
    });

    return listenerId;
  }

  // Set up user profile listener
  setupUserProfileListener(userId: string, callback: (user: User) => void) {
    const unsubscribe = firestore()
      .collection('users')
      .doc(userId)
      .onSnapshot(doc => {
        if (doc.exists) {
          const userData = { id: doc.id, ...doc.data() } as User;
          this.data.profiles.set(userId, userData);
          callback(userData);
        }
      });

    this.listeners.set(`user_${userId}`, unsubscribe);
    return `user_${userId}`;
  }

  // Dynamic like toggle
  async toggleLike(reelId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    try {
      const result = await FirebaseService.likeReel(reelId, userId);
      
      // Update local cache
      this.data.likes.set(reelId, { count: result.likesCount, isLiked: result.isLiked });
      
      return result;
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    }
  }

  // Dynamic comment add
  async addComment(reelId: string, userId: string, text: string): Promise<string> {
    try {
      const commentId = await FirebaseService.addComment(reelId, userId, text, 'reel');
      return commentId;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  }

  // Dynamic save toggle
  async toggleSave(reelId: string, userId: string): Promise<boolean> {
    try {
      const saveRef = firestore().collection('saves').doc(`${reelId}_${userId}`);
      const saveDoc = await saveRef.get();
      
      if (saveDoc.exists) {
        await saveRef.delete();
        this.data.saves.set(reelId, false);
        return false;
      } else {
        await saveRef.set({
          reelId,
          userId,
          type: 'reel',
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
        this.data.saves.set(reelId, true);
        return true;
      }
    } catch (error) {
      console.error('Error toggling save:', error);
      throw error;
    }
  }

  // Dynamic follow toggle
  async toggleFollow(targetUserId: string, currentUserId: string): Promise<boolean> {
    try {
      const result = await FirebaseService.toggleFollowUser(currentUserId, targetUserId);
      this.data.follows.set(targetUserId, result.isFollowing);
      return result.isFollowing;
    } catch (error) {
      console.error('Error toggling follow:', error);
      throw error;
    }
  }

  // Get cached data
  getCachedData(type: keyof RealTimeData, key: string) {
    return this.data[type].get(key);
  }

  // Clean up listener
  cleanupListener(listenerId: string) {
    const unsubscribe = this.listeners.get(listenerId);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(listenerId);
    }
  }

  // Clean up all listeners
  cleanupAll() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners.clear();
    this.data = {
      likes: new Map(),
      comments: new Map(),
      follows: new Map(),
      saves: new Map(),
      profiles: new Map(),
    };
  }
}

// React Hook for real-time dynamic reel
export const useRealTimeDynamicReel = (reel: Reel, userId?: string) => {
  const [likesCount, setLikesCount] = useState(reel.likesCount || 0);
  const [isLiked, setIsLiked] = useState(false);
  const [commentsCount, setCommentsCount] = useState(reel.commentsCount || 0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [userProfile, setUserProfile] = useState<User | null>(reel.user || null);
  const [isLoading, setIsLoading] = useState(false);

  const service = RealTimeDynamicService.getInstance();

  useEffect(() => {
    if (!userId) return;

    const listenerId = service.setupReelListeners(reel.id, userId, {
      onLikesUpdate: (count, liked) => {
        setLikesCount(count);
        setIsLiked(liked);
      },
      onCommentsUpdate: (commentsList, count) => {
        setComments(commentsList);
        setCommentsCount(count);
      },
      onSaveUpdate: (saved) => {
        setIsSaved(saved);
      },
    });

    // Setup user profile listener
    let profileListenerId = '';
    if (reel.userId || reel.user?.id) {
      profileListenerId = service.setupUserProfileListener(
        reel.userId || reel.user!.id,
        setUserProfile
      );
    }

    return () => {
      service.cleanupListener(listenerId);
      if (profileListenerId) {
        service.cleanupListener(profileListenerId);
      }
    };
  }, [reel.id, reel.userId, reel.user?.id, userId]);

  const toggleLike = useCallback(async () => {
    if (!userId || isLoading) return;
    
    setIsLoading(true);
    try {
      // Optimistic update
      setIsLiked(!isLiked);
      setLikesCount(prev => prev + (isLiked ? -1 : 1));
      
      const result = await service.toggleLike(reel.id, userId);
      
      // Update with server result
      setIsLiked(result.isLiked);
      setLikesCount(result.likesCount);
    } catch (error) {
      // Revert optimistic update
      setIsLiked(isLiked);
      setLikesCount(likesCount);
      console.error('Error toggling like:', error);
    } finally {
      setIsLoading(false);
    }
  }, [reel.id, userId, isLiked, likesCount, isLoading]);

  const addComment = useCallback(async (text: string) => {
    if (!userId || isLoading) return null;
    
    setIsLoading(true);
    try {
      const commentId = await service.addComment(reel.id, userId, text);
      return commentId;
    } catch (error) {
      console.error('Error adding comment:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [reel.id, userId, isLoading]);

  const toggleSave = useCallback(async () => {
    if (!userId || isLoading) return;
    
    setIsLoading(true);
    try {
      // Optimistic update
      setIsSaved(!isSaved);
      
      const result = await service.toggleSave(reel.id, userId);
      setIsSaved(result);
    } catch (error) {
      // Revert optimistic update
      setIsSaved(isSaved);
      console.error('Error toggling save:', error);
    } finally {
      setIsLoading(false);
    }
  }, [reel.id, userId, isSaved, isLoading]);

  const toggleFollow = useCallback(async () => {
    if (!userId || !userProfile || isLoading) return;
    
    setIsLoading(true);
    try {
      const result = await service.toggleFollow(userProfile.id, userId);
      setUserProfile(prev => prev ? { ...prev, isFollowing: result } : null);
    } catch (error) {
      console.error('Error toggling follow:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, userProfile, isLoading]);

  return {
    likesCount,
    isLiked,
    commentsCount,
    comments,
    isSaved,
    userProfile,
    isLoading,
    toggleLike,
    addComment,
    toggleSave,
    toggleFollow,
  };
};

export default RealTimeDynamicService;
