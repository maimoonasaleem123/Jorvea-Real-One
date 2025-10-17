import { useState, useEffect, useCallback } from 'react';
import { Alert, Vibration } from 'react-native';
import RealTimeLikeSystem from '../services/RealTimeLikeSystem';
import { useAuth } from '../context/FastAuthContext';

export interface LikeState {
  isLiked: boolean;
  likesCount: number;
  isLoading: boolean;
}

export interface LikeActions {
  handleLike: () => Promise<void>;
  updateLikeState: (newState: Partial<LikeState>) => void;
}

export type ContentType = 'post' | 'reel' | 'story' | 'comment';

interface UseLikeProps {
  contentId: string;
  contentType: ContentType;
  initialLiked?: boolean;
  initialCount?: number;
  onLikeChange?: (isLiked: boolean, likesCount: number) => void;
  enableHaptics?: boolean;
}

export function useLike({
  contentId,
  contentType,
  initialLiked = false,
  initialCount = 0,
  onLikeChange,
  enableHaptics = true,
}: UseLikeProps): LikeState & LikeActions {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialCount);
  const [isLoading, setIsLoading] = useState(false);

  // Update state when props change
  useEffect(() => {
    setIsLiked(initialLiked);
    setLikesCount(initialCount);
  }, [initialLiked, initialCount]);

  const updateLikeState = useCallback((newState: Partial<LikeState>) => {
    if (newState.isLiked !== undefined) {
      setIsLiked(newState.isLiked);
    }
    if (newState.likesCount !== undefined) {
      setLikesCount(newState.likesCount);
    }
    if (newState.isLoading !== undefined) {
      setIsLoading(newState.isLoading);
    }
  }, []);

  const handleLike = useCallback(async () => {
    if (!user || isLoading) return;

    try {
      setIsLoading(true);
      
      // Haptic feedback
      if (enableHaptics) {
        Vibration.vibrate(50);
      }

      // Optimistic update
      const newLikedState = !isLiked;
      const newCount = newLikedState ? likesCount + 1 : Math.max(0, likesCount - 1);
      
      setIsLiked(newLikedState);
      setLikesCount(newCount);

      // Call RealTimeLikeSystem for consistent like handling
      const result = await RealTimeLikeSystem.getInstance().toggleLike(
        contentId,
        user.uid,
        contentType as 'reel' | 'story' | 'post',
        isLiked,
        likesCount
      );

      if (result.success) {
        // Update with server response
        setIsLiked(result.isLiked);
        setLikesCount(result.likesCount);
        
        // Notify parent component
        onLikeChange?.(result.isLiked, result.likesCount);
      } else {
        // Revert optimistic update on failure
        setIsLiked(!newLikedState);
        setLikesCount(likesCount);
        
        if (result.error && result.error !== 'Too fast') {
          Alert.alert('Error', 'Unable to update like. Please try again.');
        }
      }

    } catch (error) {
      console.error(`Error liking ${contentType}:`, error);
      
      // Revert optimistic update
      setIsLiked(!isLiked);
      setLikesCount(likesCount);
      
      Alert.alert('Error', `Failed to ${isLiked ? 'unlike' : 'like'} ${contentType}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoading, contentId, contentType, isLiked, likesCount, enableHaptics, onLikeChange]);

  return {
    isLiked,
    likesCount,
    isLoading,
    handleLike,
    updateLikeState,
  };
}

// Hook for bulk like operations (for feeds)
export function useBulkLike(contentType: ContentType) {
  const { user } = useAuth();
  
  const likeBulkContent = useCallback(async (
    contentItems: Array<{ id: string; isLiked: boolean; likesCount: number }>,
    updateFunction: (contentId: string, isLiked: boolean, likesCount: number) => void
  ) => {
    if (!user) return;

    for (const item of contentItems) {
      try {
        const result = await RealTimeLikeSystem.getInstance().toggleLike(
          item.id,
          user.uid,
          contentType as 'reel' | 'story' | 'post',
          item.isLiked,
          item.likesCount
        );

        if (result.success) {
          updateFunction(item.id, result.isLiked, result.likesCount);
        }
      } catch (error) {
        console.error(`Error bulk liking ${contentType} ${item.id}:`, error);
      }
    }
  }, [user, contentType]);

  return { likeBulkContent };
}
