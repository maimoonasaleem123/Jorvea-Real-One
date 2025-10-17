import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import FirebaseService from '../services/firebaseService';
import { useAuth } from './FastAuthContext';
import { Post } from '../types';

interface FastPostsContextType {
  posts: Post[];
  hasMore: boolean;
  loadNextPage: () => void;
  refreshPosts: () => void;
  addPost: (post: Post) => void;
  updatePost: (postId: string, updates: Partial<Post>) => void;
  likePost: (postId: string) => void;
  savePost: (postId: string) => void;
  isRefreshing: boolean;
  error: string | null;
}

const InstagramFastPostsContext = createContext<FastPostsContextType | undefined>(undefined);

export const useInstagramFastPosts = () => {
  const context = useContext(InstagramFastPostsContext);
  if (!context) {
    throw new Error('useInstagramFastPosts must be used within InstagramFastPostsProvider');
  }
  return context;
};

interface InstagramFastPostsProviderProps {
  children: ReactNode;
}

export const InstagramFastPostsProvider: React.FC<InstagramFastPostsProviderProps> = ({ children }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { user } = useAuth();
  const lastPostIdRef = useRef<string | undefined>(undefined);
  const loadingRef = useRef(false);
  const PAGE_SIZE = 5; // Smaller batches for faster loading
  const INITIAL_LOAD_SIZE = 2; // Load only 2 posts instantly

  const convertFirebasePostToPost = useCallback((firebasePost: any): Post => {
    return {
      ...firebasePost,
      createdAt: firebasePost.createdAt instanceof Date 
        ? firebasePost.createdAt 
        : new Date(firebasePost.createdAt),
      updatedAt: firebasePost.updatedAt instanceof Date 
        ? firebasePost.updatedAt 
        : new Date(firebasePost.updatedAt),
    };
  }, []);

  // Instagram-style instant initial loading (only 2 posts)
  const loadInitialPosts = useCallback(async () => {
    if (loadingRef.current || !user) return;

    try {
      loadingRef.current = true;
      setError(null);

      // Load only 2 posts initially for instant display
      const fetchedPosts = await FirebaseService.getPosts(undefined, INITIAL_LOAD_SIZE);
      const convertedPosts = fetchedPosts.map(convertFirebasePostToPost);
      
      // Sort by newest first (Instagram-like)
      const sortedPosts = convertedPosts.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setPosts(sortedPosts);
      lastPostIdRef.current = sortedPosts[sortedPosts.length - 1]?.id;
      setHasMore(true); // Always assume more posts for lazy loading

    } catch (err) {
      console.error('Error loading initial posts:', err);
      setError('Failed to load posts');
    } finally {
      loadingRef.current = false;
    }
  }, [user, convertFirebasePostToPost, INITIAL_LOAD_SIZE]);

  // Instagram-style lazy loading for additional posts
  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;

    try {
      loadingRef.current = true;
      setError(null);

      const fetchedPosts = await FirebaseService.getPosts(lastPostIdRef.current, PAGE_SIZE);
      
      if (fetchedPosts.length === 0) {
        setHasMore(false);
        return;
      }

      const convertedPosts = fetchedPosts.map(convertFirebasePostToPost);
      
      // Instagram-like: append without loading indicators
      setPosts(prevPosts => {
        const existingIds = new Set(prevPosts.map(p => p.id));
        const newPosts = convertedPosts.filter(p => !existingIds.has(p.id));
        return [...prevPosts, ...newPosts];
      });

      lastPostIdRef.current = fetchedPosts[fetchedPosts.length - 1]?.id;
      
      if (fetchedPosts.length < PAGE_SIZE) {
        setHasMore(false);
      }

    } catch (err) {
      console.error('Error loading posts:', err);
      setError('Failed to load posts');
    } finally {
      loadingRef.current = false;
    }
  }, [hasMore, convertFirebasePostToPost]);

  // Instagram-style pull-to-refresh
  const refreshPosts = useCallback(async () => {
    if (isRefreshing) return;

    try {
      setIsRefreshing(true);
      setError(null);
      lastPostIdRef.current = undefined;

      const fetchedPosts = await FirebaseService.getPosts(undefined, PAGE_SIZE);
      const convertedPosts = fetchedPosts.map(convertFirebasePostToPost);
      
      // Sort by newest first (Instagram-like)
      const sortedPosts = convertedPosts.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setPosts(sortedPosts);
      lastPostIdRef.current = sortedPosts[sortedPosts.length - 1]?.id;
      setHasMore(fetchedPosts.length === PAGE_SIZE);

    } catch (err) {
      console.error('Error refreshing posts:', err);
      setError('Failed to refresh posts');
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, convertFirebasePostToPost]);

  // Instant optimistic updates like Instagram
  const addPost = useCallback((newPost: Post) => {
    setPosts(currentPosts => [newPost, ...currentPosts]);
  }, []);

  const updatePost = useCallback((postId: string, updates: Partial<Post>) => {
    setPosts(currentPosts =>
      currentPosts.map(post =>
        post.id === postId 
          ? { ...post, ...updates, updatedAt: new Date() }
          : post
      )
    );

    // Update in background without blocking UI
    FirebaseService.updatePost(postId, updates).catch(err => {
      console.error('Background update failed:', err);
      // Could revert optimistic update here if needed
    });
  }, []);

  // Instagram-like instant like animation
  const likePost = useCallback((postId: string) => {
    if (!user) return;

    // Instant optimistic update
    setPosts(currentPosts =>
      currentPosts.map(post => {
        if (post.id === postId) {
          const isLiked = post.likes.includes(user.uid);
          return {
            ...post,
            likes: isLiked 
              ? post.likes.filter(id => id !== user.uid)
              : [...post.likes, user.uid]
          };
        }
        return post;
      })
    );

    // Background Firebase update
    FirebaseService.likePost(postId, user.uid).catch(err => {
      console.error('Background like failed:', err);
      // Revert optimistic update
      setPosts(currentPosts =>
        currentPosts.map(post => {
          if (post.id === postId) {
            const isLiked = post.likes.includes(user.uid);
            return {
              ...post,
              likes: isLiked 
                ? [...post.likes, user.uid]
                : post.likes.filter(id => id !== user.uid)
            };
          }
          return post;
        })
      );
    });
  }, [user]);

  // Instagram-like instant save
  const savePost = useCallback((postId: string) => {
    if (!user) return;

    // Instant optimistic update
    setPosts(currentPosts =>
      currentPosts.map(post => {
        if (post.id === postId) {
          const isSaved = post.saves.includes(user.uid);
          return {
            ...post,
            saves: isSaved 
              ? post.saves.filter(id => id !== user.uid)
              : [...post.saves, user.uid]
          };
        }
        return post;
      })
    );

    // Background Firebase update
    FirebaseService.savePost(postId, user.uid).catch(err => {
      console.error('Background save failed:', err);
      // Revert optimistic update
      setPosts(currentPosts =>
        currentPosts.map(post => {
          if (post.id === postId) {
            const isSaved = post.saves.includes(user.uid);
            return {
              ...post,
              saves: isSaved 
                ? [...post.saves, user.uid]
                : post.saves.filter(id => id !== user.uid)
            };
          }
          return post;
        })
      );
    });
  }, [user]);

  // Initial instant load when user is available (only 2 posts)
  useEffect(() => {
    if (user && posts.length === 0) {
      loadInitialPosts();
    }
  }, [user, loadInitialPosts, posts.length]);

  // Remove automatic preloading - let user trigger manually for true lazy loading

  const contextValue: FastPostsContextType = {
    posts,
    hasMore,
    loadNextPage,
    refreshPosts,
    addPost,
    updatePost,
    likePost,
    savePost,
    isRefreshing,
    error,
  };

  return (
    <InstagramFastPostsContext.Provider value={contextValue}>
      {children}
    </InstagramFastPostsContext.Provider>
  );
};
