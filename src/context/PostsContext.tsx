import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import FirebaseService from '../services/firebaseService';
import { useAuth } from './FastAuthContext';
import { Post } from '../types';

interface PostsContextType {
  posts: Post[];
  loading: boolean;
  refreshing: boolean;
  loadPosts: () => Promise<void>;
  refreshPosts: () => Promise<void>;
  addPost: (post: Post) => void;
  updatePost: (postId: string, updates: Partial<Post>) => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  unlikePost: (postId: string) => Promise<void>;
  savePost: (postId: string) => Promise<void>;
  unsavePost: (postId: string) => Promise<void>;
}

const PostsContext = createContext<PostsContextType | undefined>(undefined);

export const usePostsContext = () => {
  const context = useContext(PostsContext);
  if (!context) {
    throw new Error('usePostsContext must be used within a PostsProvider');
  }
  return context;
};

interface PostsProviderProps {
  children: ReactNode;
}

export const PostsProvider: React.FC<PostsProviderProps> = ({ children }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  const convertFirebasePostToPost = (firebasePost: any): Post => {
    return {
      ...firebasePost,
      createdAt: firebasePost.createdAt instanceof Date 
        ? firebasePost.createdAt 
        : new Date(firebasePost.createdAt),
      updatedAt: firebasePost.updatedAt instanceof Date 
        ? firebasePost.updatedAt 
        : new Date(firebasePost.updatedAt),
    };
  };

  const loadPosts = async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      const fetchedPosts = await FirebaseService.getAllPosts();
      const convertedPosts = fetchedPosts.map(convertFirebasePostToPost);
      
      // Sort posts by creation date (newest first)
      const sortedPosts = convertedPosts.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setPosts(sortedPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
      Alert.alert('Error', 'Failed to load posts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const refreshPosts = async () => {
    if (refreshing) return;
    
    try {
      setRefreshing(true);
      const fetchedPosts = await FirebaseService.getAllPosts();
      const convertedPosts = fetchedPosts.map(convertFirebasePostToPost);
      
      // Sort posts by creation date (newest first)
      const sortedPosts = convertedPosts.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      setPosts(sortedPosts);
    } catch (error) {
      console.error('Error refreshing posts:', error);
      Alert.alert('Error', 'Failed to refresh posts. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const addPost = (newPost: Post) => {
    setPosts(currentPosts => [newPost, ...currentPosts]);
  };

  const updatePost = async (postId: string, updates: Partial<Post>) => {
    try {
      await FirebaseService.updatePost(postId, updates);
      setPosts(currentPosts =>
        currentPosts.map(post =>
          post.id === postId 
            ? { ...post, ...updates, updatedAt: new Date() }
            : post
        )
      );
    } catch (error) {
      console.error('Error updating post:', error);
      Alert.alert('Error', 'Failed to update post. Please try again.');
      throw error;
    }
  };

  const likePost = async (postId: string) => {
    if (!user) {
      Alert.alert('Error', 'Please log in to like posts.');
      return;
    }

    try {
      // Optimistic update
      setPosts(currentPosts =>
        currentPosts.map(post => {
          if (post.id === postId) {
            const isCurrentlyLiked = post.likes.includes(user.uid);
            return {
              ...post,
              likes: isCurrentlyLiked 
                ? post.likes.filter(id => id !== user.uid)
                : [...post.likes, user.uid]
            };
          }
          return post;
        })
      );

      // Call Firebase service
      const result = await FirebaseService.likePost(postId, user.uid);
      
      // Update with actual result from server
      setPosts(currentPosts =>
        currentPosts.map(post =>
          post.id === postId 
            ? { 
                ...post, 
                likes: result.isLiked 
                  ? [...post.likes.filter(id => id !== user.uid), user.uid]
                  : post.likes.filter(id => id !== user.uid)
              }
            : post
        )
      );
    } catch (error) {
      console.error('Error liking post:', error);
      // Revert optimistic update on error
      setPosts(currentPosts =>
        currentPosts.map(post => {
          if (post.id === postId) {
            const isCurrentlyLiked = post.likes.includes(user.uid);
            return {
              ...post,
              likes: isCurrentlyLiked 
                ? post.likes.filter(id => id !== user.uid)
                : [...post.likes, user.uid]
            };
          }
          return post;
        })
      );
      Alert.alert('Error', 'Failed to like post. Please try again.');
    }
  };

  const unlikePost = async (postId: string) => {
    if (!user) {
      Alert.alert('Error', 'Please log in to unlike posts.');
      return;
    }

    try {
      // Call the same likePost method as it handles both like and unlike
      await likePost(postId);
    } catch (error) {
      console.error('Error unliking post:', error);
      Alert.alert('Error', 'Failed to unlike post. Please try again.');
    }
  };

  const savePost = async (postId: string) => {
    if (!user) {
      Alert.alert('Error', 'Please log in to save posts.');
      return;
    }

    try {
      // Optimistic update
      setPosts(currentPosts =>
        currentPosts.map(post => {
          if (post.id === postId) {
            const isCurrentlySaved = post.saves.includes(user.uid);
            return {
              ...post,
              saves: isCurrentlySaved 
                ? post.saves.filter(id => id !== user.uid)
                : [...post.saves, user.uid]
            };
          }
          return post;
        })
      );

      const result = await FirebaseService.savePost(postId, user.uid);
      
      // Update with actual result from server
      setPosts(currentPosts =>
        currentPosts.map(post =>
          post.id === postId 
            ? { 
                ...post, 
                saves: result.isSaved 
                  ? [...post.saves.filter(id => id !== user.uid), user.uid]
                  : post.saves.filter(id => id !== user.uid)
              }
            : post
        )
      );
    } catch (error) {
      console.error('Error saving post:', error);
      // Revert optimistic update on error
      setPosts(currentPosts =>
        currentPosts.map(post => {
          if (post.id === postId) {
            const isCurrentlySaved = post.saves.includes(user.uid);
            return {
              ...post,
              saves: isCurrentlySaved 
                ? post.saves.filter(id => id !== user.uid)
                : [...post.saves, user.uid]
            };
          }
          return post;
        })
      );
      Alert.alert('Error', 'Failed to save post. Please try again.');
    }
  };

  const unsavePost = async (postId: string) => {
    if (!user) {
      Alert.alert('Error', 'Please log in to unsave posts.');
      return;
    }

    try {
      await FirebaseService.unsavePost(postId, user.uid);
      
      setPosts(currentPosts =>
        currentPosts.map(post =>
          post.id === postId 
            ? { ...post, saves: post.saves.filter(id => id !== user.uid) }
            : post
        )
      );
    } catch (error) {
      console.error('Error unsaving post:', error);
      Alert.alert('Error', 'Failed to unsave post. Please try again.');
    }
  };

  // Load posts on mount
  useEffect(() => {
    if (user) {
      loadPosts();
    }
  }, [user]);

  const contextValue: PostsContextType = {
    posts,
    loading,
    refreshing,
    loadPosts,
    refreshPosts,
    addPost,
    updatePost,
    likePost,
    unlikePost,
    savePost,
    unsavePost,
  };

  return (
    <PostsContext.Provider value={contextValue}>
      {children}
    </PostsContext.Provider>
  );
};
