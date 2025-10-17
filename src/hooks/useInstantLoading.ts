import { useState, useEffect, useCallback, useRef } from 'react';
import { LightningFast } from '../services/LightningFastService';
import { Post, Reel, Story } from '../services/firebaseService';

interface UseInstantLoadingProps {
  userId: string;
  contentType: 'posts' | 'reels' | 'stories';
}

interface InstantLoadingResult<T> {
  data: T[];
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  error: string | null;
}

export function useInstantLoading<T extends Post | Reel | Story>({
  userId,
  contentType
}: UseInstantLoadingProps): InstantLoadingResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const loadingRef = useRef(false);
  const mountedRef = useRef(true);

  // Initial instant load (happens immediately like Instagram)
  const loadInitialData = useCallback(async () => {
    if (!userId || loadingRef.current) return;

    try {
      loadingRef.current = true;
      setError(null);

      let result;
      switch (contentType) {
        case 'posts':
          result = await LightningFast.getInstantPosts(userId);
          break;
        case 'reels':
          result = await LightningFast.getInstantReels(userId);
          break;
        case 'stories':
          result = await LightningFast.getInstantStories(userId);
          break;
        default:
          return;
      }

      if (mountedRef.current) {
        setData(result.instant as T[]);
        setLoading(result.loading);
        setHasMore(result.hasMore);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load content');
        setLoading(false);
      }
    } finally {
      loadingRef.current = false;
    }
  }, [userId, contentType]);

  // Load more content (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingRef.current || data.length === 0) return;

    try {
      loadingRef.current = true;
      const lastItem = data[data.length - 1];
      
      const newItems = await LightningFast.loadMoreContent(
        contentType as 'posts' | 'reels',
        userId,
        lastItem,
        10
      );

      if (mountedRef.current && newItems.length > 0) {
        setData(prevData => [...prevData, ...newItems] as T[]);
        setHasMore(newItems.length >= 10); // If we got less than requested, no more
      } else {
        setHasMore(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load more content');
      }
    } finally {
      loadingRef.current = false;
    }
  }, [hasMore, data, contentType, userId]);

  // Refresh content (pull to refresh)
  const refresh = useCallback(async () => {
    if (loadingRef.current) return;

    try {
      setRefreshing(true);
      setError(null);
      loadingRef.current = true;

      // Clear cache and reload fresh data
      let result;
      switch (contentType) {
        case 'posts':
          result = await LightningFast.getInstantPosts(userId);
          break;
        case 'reels':
          result = await LightningFast.getInstantReels(userId);
          break;
        case 'stories':
          result = await LightningFast.getInstantStories(userId);
          break;
        default:
          return;
      }

      if (mountedRef.current) {
        setData(result.instant as T[]);
        setHasMore(result.hasMore);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to refresh content');
      }
    } finally {
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, [userId, contentType]);

  // Initialize data instantly on mount
  useEffect(() => {
    mountedRef.current = true;
    loadInitialData();

    return () => {
      mountedRef.current = false;
    };
  }, [loadInitialData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    loading,
    refreshing,
    hasMore,
    loadMore,
    refresh,
    error
  };
}

// Hook for instant mixed content (like Instagram home feed)
export function useInstantMixedFeed(userId: string) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Reel[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInstantFeed = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

      // Load all content types in parallel for instant feed
      const [postsResult, reelsResult, storiesResult] = await Promise.all([
        LightningFast.getInstantPosts(userId),
        LightningFast.getInstantReels(userId), 
        LightningFast.getInstantStories(userId)
      ]);

      setPosts(postsResult.instant);
      setReels(reelsResult.instant);
      setStories(storiesResult.instant);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load instant feed:', error);
      setLoading(false);
    }
  }, [userId]);

  const refreshFeed = useCallback(async () => {
    setRefreshing(true);
    await loadInstantFeed();
    setRefreshing(false);
  }, [loadInstantFeed]);

  useEffect(() => {
    loadInstantFeed();
  }, [loadInstantFeed]);

  return {
    posts,
    reels, 
    stories,
    loading,
    refreshing,
    refreshFeed
  };
}
