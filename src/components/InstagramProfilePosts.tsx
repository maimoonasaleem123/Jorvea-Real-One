import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  FlatList,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Post } from '../services/firebaseService';
import Icon from 'react-native-vector-icons/Ionicons';
import FastImage from 'react-native-fast-image';

const { width: screenWidth } = Dimensions.get('window');
const itemSize = (screenWidth - 4) / 3; // 3 columns with 2px gaps

interface InstagramProfilePostsProps {
  posts: Post[];
  loading?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const InstagramProfilePosts: React.FC<InstagramProfilePostsProps> = ({
  posts,
  loading = false,
  onRefresh,
  refreshing = false,
}) => {
  const navigation = useNavigation();

  // Memoized posts for performance
  const memoizedPosts = useMemo(() => posts, [posts]);

  const handlePostPress = useCallback((post: Post) => {
    (navigation as any).navigate('PostDetail', { postId: post.id });
  }, [navigation]);

  const renderPost = useCallback(({ item: post, index }: { item: Post; index: number }) => {
    const isVideo = post.mediaType === 'video';
    const imageUri = post.mediaUrls?.[0] || 'https://via.placeholder.com/300';

    return (
      <TouchableOpacity
        style={[
          styles.postContainer,
          {
            marginRight: (index + 1) % 3 === 0 ? 0 : 2,
            marginBottom: 2,
          },
        ]}
        onPress={() => handlePostPress(post)}
        activeOpacity={0.8}
      >
        <FastImage
          source={{ uri: imageUri }}
          style={styles.postImage}
          resizeMode={FastImage.resizeMode.cover}
        />
        
        {/* Video indicator */}
        {isVideo && (
          <View style={styles.videoIndicator}>
            <Icon name="play" size={16} color="#fff" />
          </View>
        )}
        
        {/* Multiple photos indicator */}
        {post.mediaUrls && post.mediaUrls.length > 1 && (
          <View style={styles.multipleIndicator}>
            <Icon name="copy-outline" size={16} color="#fff" />
          </View>
        )}
        
        {/* Engagement overlay */}
        <View style={styles.engagementOverlay}>
          <View style={styles.engagementItem}>
            <Icon name="heart" size={14} color="#fff" />
            <Text style={styles.engagementText}>
              {post.likesCount > 0 ? post.likesCount : ''}
            </Text>
          </View>
          <View style={styles.engagementItem}>
            <Icon name="chatbubble" size={14} color="#fff" />
            <Text style={styles.engagementText}>
              {post.commentsCount > 0 ? post.commentsCount : ''}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [handlePostPress]);

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="images-outline" size={60} color="#ccc" />
      <Text style={styles.emptyTitle}>No Posts Yet</Text>
      <Text style={styles.emptySubtitle}>
        Share your first post to get started!
      </Text>
    </View>
  );

  const renderHeader = () => {
    if (posts.length === 0) return null;
    
    return (
      <View style={styles.headerContainer}>
        <Text style={styles.postsCount}>
          {posts.length} {posts.length === 1 ? 'post' : 'posts'}
        </Text>
      </View>
    );
  };

  if (loading && posts.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading posts...</Text>
      </View>
    );
  }

  if (posts.length === 0) {
    return renderEmptyState();
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={memoizedPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        numColumns={3}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.gridContainer}
        ListHeaderComponent={renderHeader}
        onRefresh={onRefresh}
        refreshing={refreshing}
        removeClippedSubviews={true}
        maxToRenderPerBatch={15}
        windowSize={10}
        initialNumToRender={12}
        getItemLayout={(data, index) => ({
          length: itemSize,
          offset: itemSize * Math.floor(index / 3),
          index,
        })}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  headerContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  postsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  gridContainer: {
    paddingTop: 2,
  },
  postContainer: {
    width: itemSize,
    height: itemSize,
    position: 'relative',
    backgroundColor: '#f8f8f8',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 4,
  },
  multipleIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    padding: 4,
  },
  engagementOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  engagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  engagementText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default InstagramProfilePosts;
