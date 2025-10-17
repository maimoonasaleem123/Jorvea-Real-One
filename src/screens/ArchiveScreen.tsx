import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../context/FastAuthContext';
import { useNavigation } from '@react-navigation/native';
import FirebaseService, { Post } from '../services/firebaseService';

const { width } = Dimensions.get('window');
const ITEM_SIZE = (width - 30) / 3;

const ArchiveScreen: React.FC = () => {
  const [archivedPosts, setArchivedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const navigation = useNavigation();

  useEffect(() => {
    loadArchivedPosts();
  }, []);

  const loadArchivedPosts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const posts = await FirebaseService.getArchivedPosts(user.uid);
      setArchivedPosts(posts);
    } catch (error) {
      console.error('Error loading archived posts:', error);
      Alert.alert('Error', 'Failed to load archived posts');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadArchivedPosts();
    setRefreshing(false);
  };

  const handlePostPress = (post: Post) => {
    (navigation as any).navigate('PostDetail', { postId: post.id });
  };

  const handleUnarchivePost = async (postId: string) => {
    if (!user) return;

    try {
      await FirebaseService.archivePost(postId, user.uid, false);
      setArchivedPosts(prev => prev.filter(post => post.id !== postId));
      Alert.alert('Success', 'Post unarchived successfully');
    } catch (error) {
      console.error('Error unarchiving post:', error);
      Alert.alert('Error', 'Failed to unarchive post');
    }
  };

  const renderPostItem = ({ item }: { item: Post }) => (
    <TouchableOpacity
      style={styles.postItem}
      onPress={() => handlePostPress(item)}
    >
      <Image source={{ uri: item.mediaUrls[0] }} style={styles.postImage} />
      {item.type === 'carousel' && (
        <View style={styles.carouselIndicator}>
          <Icon name="collections" size={16} color="#fff" />
        </View>
      )}
      {item.type === 'video' && (
        <View style={styles.videoIndicator}>
          <Icon name="play-arrow" size={16} color="#fff" />
        </View>
      )}
      <TouchableOpacity
        style={styles.unarchiveButton}
        onPress={() => handleUnarchivePost(item.id)}
      >
        <Icon name="unarchive" size={20} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="archive" size={80} color="#ccc" />
      <Text style={styles.emptyTitle}>No Archived Posts</Text>
      <Text style={styles.emptySubtitle}>
        Posts you archive will appear here
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Archive</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={archivedPosts}
        renderItem={renderPostItem}
        numColumns={3}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContainer,
          archivedPosts.length === 0 && styles.emptyContainer,
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
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
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  listContainer: {
    padding: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: 5,
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  carouselIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 4,
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 4,
  },
  unarchiveButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ArchiveScreen;
