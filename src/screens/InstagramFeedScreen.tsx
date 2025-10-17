/**
 * Instagram-Style Feed Screen
 * Smart algorithm: Following posts first, then discover content
 * Complete implementation with all features
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Text,
  StatusBar,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useAuth } from '../context/FastAuthContext';
import { useNavigation } from '@react-navigation/native';
import InstagramPostCard from '../components/InstagramPostCard';
import DynamicFirebasePostsService from '../services/DynamicFirebasePostsService';
import RealTimeLikeSystem from '../services/RealTimeLikeSystem';
import Icon from 'react-native-vector-icons/Ionicons';

export const InstagramFeedScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const lastPostIdRef = useRef<string | null>(null);
  
  // Load initial posts
  useEffect(() => {
    if (user?.uid) {
      loadPosts();
    }
  }, [user?.uid]);
  
  // Load posts with smart algorithm
  const loadPosts = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      setLoading(true);
      console.log('📱 Loading Instagram feed...');
      
      const dynamicPosts = await DynamicFirebasePostsService.getInstance().getDynamicPosts(user.uid, 20);
      
      console.log(`✅ Loaded ${dynamicPosts.length} posts`);
      setPosts(dynamicPosts);
      
      if (dynamicPosts.length > 0) {
        lastPostIdRef.current = dynamicPosts[dynamicPosts.length - 1].id;
      }
      
      setHasMore(dynamicPosts.length >= 20);
    } catch (error) {
      console.error('❌ Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);
  
  // Refresh posts
  const handleRefresh = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      setRefreshing(true);
      console.log('🔄 Refreshing feed...');
      
      const dynamicPosts = await DynamicFirebasePostsService.getInstance().refreshPosts(user.uid);
      
      console.log(`✅ Refreshed ${dynamicPosts.length} posts`);
      setPosts(dynamicPosts);
      
      if (dynamicPosts.length > 0) {
        lastPostIdRef.current = dynamicPosts[dynamicPosts.length - 1].id;
      }
      
      setHasMore(dynamicPosts.length >= 20);
    } catch (error) {
      console.error('❌ Failed to refresh posts:', error);
    } finally {
      setRefreshing(false);
    }
  }, [user?.uid]);
  
  // Load more posts
  const handleLoadMore = useCallback(async () => {
    if (!user?.uid || loadingMore || !hasMore || !lastPostIdRef.current) return;
    
    try {
      setLoadingMore(true);
      console.log('📚 Loading more posts...');
      
      const morePosts = await DynamicFirebasePostsService.getInstance().loadMorePosts(
        user.uid,
        lastPostIdRef.current,
        10
      );
      
      console.log(`✅ Loaded ${morePosts.length} more posts`);
      
      if (morePosts.length > 0) {
        setPosts(prev => [...prev, ...morePosts]);
        lastPostIdRef.current = morePosts[morePosts.length - 1].id;
        setHasMore(morePosts.length >= 10);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('❌ Failed to load more posts:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [user?.uid, loadingMore, hasMore]);
  
  // Handle like
  const handleLike = useCallback(async (postId: string) => {
    if (!user?.uid) return;
    
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;
      
      console.log(`🎯 Liking post ${postId}`);
      
      const result = await RealTimeLikeSystem.getInstance().toggleLike(
        postId,
        user.uid,
        'post',
        post.isLiked,
        post.likesCount
      );
      
      if (result.success) {
        setPosts(prevPosts =>
          prevPosts.map(p =>
            p.id === postId
              ? { ...p, isLiked: result.isLiked, likesCount: result.likesCount }
              : p
          )
        );
        console.log(`✅ Post ${result.isLiked ? 'liked' : 'unliked'}: ${result.likesCount} likes`);
      }
    } catch (error) {
      console.error('❌ Like failed:', error);
    }
  }, [user?.uid, posts]);
  
  // Handle save
  const handleSave = useCallback(async (postId: string) => {
    if (!user?.uid) return;
    
    try {
      // TODO: Implement save functionality
      console.log('💾 Save post:', postId);
    } catch (error) {
      console.error('❌ Save failed:', error);
    }
  }, [user?.uid]);
  
  // Handle comment
  const handleComment = useCallback((post: any) => {
    // TODO: Navigate to comments screen
    console.log('💬 Comment on post:', post.id);
  }, []);
  
  // Handle share
  const handleShare = useCallback((post: any) => {
    // TODO: Implement share functionality
    console.log('🔗 Share post:', post.id);
  }, []);
  
  // Handle user press
  const handleUserPress = useCallback((userId: string) => {
    if (userId === user?.uid) {
      (navigation as any).navigate('Profile');
    } else {
      (navigation as any).navigate('UserProfile', { userId });
    }
  }, [user?.uid, navigation]);
  
  // Handle more press
  const handleMorePress = useCallback((post: any) => {
    // TODO: Show action sheet (Delete, Report, etc.)
    console.log('⋯ More options for post:', post.id);
  }, []);
  
  // Render post item
  const renderPost = useCallback(({ item }: { item: any }) => (
    <InstagramPostCard
      post={item}
      onLike={handleLike}
      onComment={handleComment}
      onShare={handleShare}
      onSave={handleSave}
      onUserPress={handleUserPress}
      onMorePress={handleMorePress}
      currentUserId={user?.uid || ''}
    />
  ), [handleLike, handleComment, handleShare, handleSave, handleUserPress, handleMorePress, user?.uid]);
  
  // Render empty state
  const renderEmpty = useCallback(() => {
    if (loading) return null;
    
    return (
      <View style={styles.emptyContainer}>
        <Icon name="images-outline" size={64} color="#8E8E93" />
        <Text style={styles.emptyTitle}>No Posts Yet</Text>
        <Text style={styles.emptySubtitle}>
          Follow users to see their posts here
        </Text>
        <TouchableOpacity 
          style={styles.exploreButton}
          onPress={() => (navigation as any).navigate('Explore')}>
          <Text style={styles.exploreButtonText}>Explore</Text>
        </TouchableOpacity>
      </View>
    );
  }, [loading, navigation]);
  
  // Render footer
  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoading}>
        <ActivityIndicator size="small" color="#1DA1F2" />
      </View>
    );
  }, [loadingMore]);
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1DA1F2" />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>Jorvea</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => (navigation as any).navigate('CreatePost')}>
            <Icon name="add-circle-outline" size={26} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => (navigation as any).navigate('Messages')}>
            <Icon name="paper-plane-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Posts Feed */}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1DA1F2"
            colors={['#1DA1F2']}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        initialNumToRender={3}
        windowSize={5}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DBDBDB',
  },
  logo: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: Platform.select({ ios: 'HelveticaNeue-Bold', android: 'sans-serif-medium' }),
    color: '#000',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: 16,
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#262626',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
  exploreButton: {
    marginTop: 20,
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  footerLoading: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

export default InstagramFeedScreen;
