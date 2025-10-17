import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Vibration } from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useAuth } from '../context/FastAuthContext';

export type ContentType = 'post' | 'reel' | 'story' | 'comment';

interface LikeData {
  isLiked: boolean;
  likesCount: number;
  recentLikers: string[];
}

interface UseLikeProps {
  contentId: string;
  contentType: ContentType;
  initialLiked?: boolean;
  initialCount?: number;
  onLikeChange?: (isLiked: boolean, likesCount: number) => void;
  enableHaptics?: boolean;
  enableAnimation?: boolean;
}

export function useInstagramLike({
  contentId,
  contentType,
  initialLiked = false,
  initialCount = 0,
  onLikeChange,
  enableHaptics = true,
  enableAnimation = true,
}: UseLikeProps) {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(initialLiked);
  const [likesCount, setLikesCount] = useState(initialCount);
  const [recentLikers, setRecentLikers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastLikeTime = useRef<number>(0);

  // Get collection name based on content type
  const getCollectionName = useCallback(() => {
    switch (contentType) {
      case 'post': return 'posts';
      case 'reel': return 'reels';
      case 'story': return 'stories';
      case 'comment': return 'comments';
      default: return 'posts';
    }
  }, [contentType]);

  // Real-time listener for like updates
  useEffect(() => {
    if (!contentId || !user) return;

    const collection = getCollectionName();
    const docRef = firestore().collection(collection).doc(contentId);

    // Subscribe to real-time updates
    unsubscribeRef.current = docRef.onSnapshot(
      (doc) => {
        if (doc.exists) {
          const data = doc.data();
          const likes = data?.likes || [];
          const newIsLiked = likes.includes(user.uid);
          const newLikesCount = likes.length;
          const newRecentLikers = likes.slice(-3); // Last 3 likers

          setIsLiked(newIsLiked);
          setLikesCount(newLikesCount);
          setRecentLikers(newRecentLikers);

          // Notify parent component
          onLikeChange?.(newIsLiked, newLikesCount);
        }
      },
      (error) => {
        console.error(`Error listening to ${contentType} likes:`, error);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [contentId, contentType, user, getCollectionName, onLikeChange]);

  // Handle like/unlike with Instagram-style behavior
  const handleLike = useCallback(async () => {
    if (!user || isLoading) return;

    // Prevent double-tap spam
    const now = Date.now();
    if (now - lastLikeTime.current < 500) return;
    lastLikeTime.current = now;

    try {
      setIsLoading(true);
      
      // Haptic feedback
      if (enableHaptics) {
        Vibration.vibrate(50);
      }

      // Animation trigger
      if (enableAnimation) {
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 1000);
      }

      const collection = getCollectionName();
      const docRef = firestore().collection(collection).doc(contentId);
      
      // Use transaction for consistency
      await firestore().runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        
        if (!doc.exists) {
          throw new Error(`${contentType} not found`);
        }

        const data = doc.data();
        const currentLikes = data?.likes || [];
        const userLikedIndex = currentLikes.indexOf(user.uid);
        
        let newLikes: string[];
        let newLikesCount: number;

        if (userLikedIndex === -1) {
          // Add like
          newLikes = [...currentLikes, user.uid];
          newLikesCount = data?.likesCount ? data.likesCount + 1 : currentLikes.length + 1;
        } else {
          // Remove like
          newLikes = currentLikes.filter((uid: string) => uid !== user.uid);
          newLikesCount = Math.max(0, data?.likesCount ? data.likesCount - 1 : currentLikes.length - 1);
        }

        // Update document
        transaction.update(docRef, {
          likes: newLikes,
          likesCount: newLikesCount,
          lastLikedAt: firestore.FieldValue.serverTimestamp(),
        });

        // Update user's liked content
        const userRef = firestore().collection('users').doc(user.uid);
        const likedField = `liked${contentType.charAt(0).toUpperCase() + contentType.slice(1)}s`;
        
        if (userLikedIndex === -1) {
          transaction.update(userRef, {
            [likedField]: firestore.FieldValue.arrayUnion(contentId)
          });
        } else {
          transaction.update(userRef, {
            [likedField]: firestore.FieldValue.arrayRemove(contentId)
          });
        }
      });

    } catch (error) {
      console.error(`Error toggling like for ${contentType}:`, error);
      Alert.alert('Error', `Failed to ${isLiked ? 'unlike' : 'like'} ${contentType}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoading, contentId, contentType, isLiked, enableHaptics, enableAnimation, getCollectionName]);

  // Double tap to like (Instagram style)
  const handleDoubleTap = useCallback(() => {
    if (!isLiked) {
      handleLike();
    }
  }, [isLiked, handleLike]);

  // Get like text (Instagram style)
  const getLikeText = useCallback(() => {
    if (likesCount === 0) return '';
    if (likesCount === 1) return '1 like';
    return `${likesCount.toLocaleString()} likes`;
  }, [likesCount]);

  return {
    isLiked,
    likesCount,
    recentLikers,
    isLoading,
    isAnimating,
    handleLike,
    handleDoubleTap,
    getLikeText,
  };
}

export default useInstagramLike;
