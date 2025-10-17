import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useAuth } from '../context/FastAuthContext';
import { usePosts } from '../context/PostsContext';
import SafeErrorBoundary from '../components/SafeErrorBoundary';

const { width } = Dimensions.get('window');

interface Post {
  id: string;
  userId: string;
  caption: string;
  imageUrls: string[];
  createdAt: any;
  likesCount: number;
  commentsCount: number;
}

const PostItem = React.memo(({ item }: { item: Post }) => (
  <SafeErrorBoundary fallback={<View style={styles.errorItem}><Text>Post unavailable</Text></View>}>
    <View style={styles.postContainer}>
      <Text style={styles.caption} numberOfLines={3}>{item.caption}</Text>
      <Text style={styles.stats}>❤️ {item.likesCount} 💬 {item.commentsCount}</Text>
    </View>
  </SafeErrorBoundary>
));

export default function FastHomeScreen() {
  const { user } = useAuth();
  const { posts, loading, refreshing, refreshPosts } = usePosts();

  const renderItem = useCallback(({ item }: { item: any }) => (
    <PostItem item={item} />
  ), []);

  const keyExtractor = useCallback((item: any) => item.id, []);

  const ListHeaderComponent = useMemo(() => (
    <View style={styles.header}>
      <Text style={styles.welcome}>Welcome back{user?.displayName ? `, ${user.displayName}` : ''}!</Text>
    </View>
  ), [user?.displayName]);

  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No posts yet</Text>
      <Text style={styles.emptySubtext}>Follow some users to see their posts here</Text>
    </View>
  ), []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Loading posts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <SafeErrorBoundary>
        <FlatList
          data={posts}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={ListHeaderComponent}
          ListEmptyComponent={ListEmptyComponent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refreshPosts} />
          }
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={5}
          getItemLayout={(data, index) => ({
            length: 200,
            offset: 200 * index,
            index,
          })}
        />
      </SafeErrorBoundary>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  welcome: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  postContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    minHeight: 200,
  },
  caption: {
    fontSize: 16,
    color: '#333',
    marginBottom: 12,
  },
  stats: {
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  errorItem: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
});
