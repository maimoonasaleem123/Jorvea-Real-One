/**
 * 🎯 FIREBASE DYNAMIC LIKE HOOK
 * 
 * React hook for seamless like system integration
 * - Real-time state updates
 * - Optimistic UI
 * - Error handling
 * - Instagram-quality animations
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import FirebaseDynamicLikeSystem, { LikeResult } from '../services/FirebaseDynamicLikeSystem';

interface UseLikeOptions {
  contentId: string;
  userId: string;
  contentType?: 'post' | 'reel' | 'comment';
  enableRealtime?: boolean;
  onLikeSuccess?: (result: LikeResult) => void;
  onLikeError?: (error: string) => void;
}

interface UseLikeReturn {
  isLiked: boolean;
  likesCount: number;
  isLoading: boolean;
  error: string | null;
  toggleLike: () => Promise<void>;
  refreshState: () => Promise<void>;
  hasOptimisticUpdate: boolean;
}

export const useFirebaseLike = ({
  contentId,
  userId,
  contentType = 'post',
  enableRealtime = true,
  onLikeSuccess,
  onLikeError
}: UseLikeOptions): UseLikeReturn => {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasOptimisticUpdate, setHasOptimisticUpdate] = useState(false);

  const likeSystemRef = useRef(FirebaseDynamicLikeSystem.getInstance());
  const mountedRef = useRef(true);
  const lastUpdateRef = useRef(0);

  // Initialize state
  useEffect(() => {
    let mounted = true;

    const initializeState = async () => {
      try {
        // Try to get cached state first for instant UI
        const cached = likeSystemRef.current.getCachedLikeState(contentId);
        if (cached && mounted) {
          setIsLiked(cached.isLiked);
          setLikesCount(cached.likesCount);
        }

        // Get fresh state from Firebase
        const freshState = await likeSystemRef.current.getLikeState(
          contentId,
          userId,
          contentType
        );

        if (mounted) {
          setIsLiked(freshState.isLiked);
          setLikesCount(freshState.likesCount);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load like state');
          console.error('Error initializing like state:', err);
        }
      }
    };

    initializeState();

    return () => {
      mounted = false;
    };
  }, [contentId, userId, contentType]);

  // Real-time updates via polling (since we can't directly listen to the service state)
  useEffect(() => {
    if (!enableRealtime) return;

    const pollInterval = setInterval(() => {
      const cached = likeSystemRef.current.getCachedLikeState(contentId);
      if (cached && mountedRef.current) {
        const now = Date.now();
        if (now - lastUpdateRef.current > 500) { // Throttle updates
          setIsLiked(cached.isLiked);
          setLikesCount(cached.likesCount);
          lastUpdateRef.current = now;
        }
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [contentId, enableRealtime]);

  // Toggle like function
  const toggleLike = useCallback(async () => {
    if (isLoading) {
      console.log('🚫 Like operation already in progress');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Optimistic update
    const optimisticIsLiked = !isLiked;
    const optimisticLikesCount = optimisticIsLiked 
      ? likesCount + 1 
      : Math.max(0, likesCount - 1);

    setIsLiked(optimisticIsLiked);
    setLikesCount(optimisticLikesCount);
    setHasOptimisticUpdate(true);

    try {
      const result = await likeSystemRef.current.toggleLike(
        contentId,
        userId,
        contentType
      );

      if (mountedRef.current) {
        if (result.success) {
          // Update with final state from Firebase
          setIsLiked(result.isLiked);
          setLikesCount(result.likesCount);
          setHasOptimisticUpdate(false);
          setError(null);

          // Call success callback
          onLikeSuccess?.(result);

          console.log(`✅ Like ${result.isLiked ? 'added' : 'removed'} successfully`);
        } else {
          // Revert optimistic update and show error
          setIsLiked(!optimisticIsLiked);
          setLikesCount(optimisticIsLiked ? likesCount - 1 : likesCount + 1);
          setHasOptimisticUpdate(false);
          
          const errorMessage = result.error || 'Failed to update like';
          setError(errorMessage);
          onLikeError?.(errorMessage);

          console.warn('❌ Like operation failed:', result.error);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        // Revert optimistic update
        setIsLiked(!optimisticIsLiked);
        setLikesCount(optimisticIsLiked ? likesCount - 1 : likesCount + 1);
        setHasOptimisticUpdate(false);

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        onLikeError?.(errorMessage);

        console.error('❌ Like hook error:', err);
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [contentId, userId, contentType, isLiked, likesCount, isLoading, onLikeSuccess, onLikeError]);

  // Refresh state function
  const refreshState = useCallback(async () => {
    try {
      setError(null);
      const state = await likeSystemRef.current.getLikeState(
        contentId,
        userId,
        contentType
      );

      if (mountedRef.current) {
        setIsLiked(state.isLiked);
        setLikesCount(state.likesCount);
        setHasOptimisticUpdate(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to refresh state');
      }
    }
  }, [contentId, userId, contentType]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    isLiked,
    likesCount,
    isLoading,
    error,
    toggleLike,
    refreshState,
    hasOptimisticUpdate
  };
};

// Additional hook for getting likes with user details
export const useFirebaseLikesWithUsers = (
  contentId: string,
  contentType: 'post' | 'reel' | 'comment' = 'post',
  limit: number = 20
) => {
  const [likes, setLikes] = useState<Array<{
    userId: string;
    username: string;
    profilePicture: string | null;
    timestamp: any;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const likeSystemRef = useRef(FirebaseDynamicLikeSystem.getInstance());

  const loadLikes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const likesData = await likeSystemRef.current.getLikesWithUsers(
        contentId,
        contentType,
        limit
      );

      setLikes(likesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load likes');
      console.error('Error loading likes with users:', err);
    } finally {
      setLoading(false);
    }
  }, [contentId, contentType, limit]);

  useEffect(() => {
    loadLikes();
  }, [loadLikes]);

  return {
    likes,
    loading,
    error,
    refreshLikes: loadLikes
  };
};

export default useFirebaseLike;
