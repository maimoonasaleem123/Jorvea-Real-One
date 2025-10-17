import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import FirebaseService from '../services/firebaseService';
import { Post, User, RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import { DynamicFollowButton } from '../components/DynamicFollowButton';

const { width } = Dimensions.get('window');
const imageSize = (width - 3) / 3;

// Memoized Post Grid Item
const PostGridItem = memo<{ post: Post; onPress: () => void }>(({ post, onPress }) => {
  return (
    <TouchableOpacity style={styles.gridItem} onPress={onPress}>
      <Image
        source={{ uri: post.mediaUrls[0] }}
        style={styles.gridImage}
        resizeMode="cover"
      />
      {post.type === 'video' && (
        <View style={styles.videoIndicator}>
          <Icon name="play" size={20} color="white" />
        </View>
      )}
    </TouchableOpacity>
  );
});

// Memoized User Item
const UserItem = memo<{ user: User; currentUserId: string; onPress: () => void }>(({ user, currentUserId, onPress }) => {
  const { colors } = useTheme();
  
  return (
    <TouchableOpacity style={[styles.userItem, { backgroundColor: colors.surface }]} onPress={onPress}>
      <View style={styles.userInfo}>
        <Image
          source={{ uri: user.profilePicture || 'https://via.placeholder.com/50' }}
          style={styles.userAvatar}
        />
        <View style={styles.userDetails}>
          <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
            {user.username}
          </Text>
          <Text style={[styles.displayName, { color: colors.textSecondary }]} numberOfLines={1}>
            {user.displayName}
          </Text>
          {user.followersCount !== undefined && (
            <Text style={[styles.followersCount, { color: colors.textMuted }]}>
              {user.followersCount} followers
            </Text>
          )}
        </View>
      </View>
      {user.uid !== currentUserId && (
        <DynamicFollowButton
          targetUserId={user.uid}
          size="small"
          variant="outline"
        />
      )}
    </TouchableOpacity>
  );
});

export const UltraFastSearchScreen: React.FC = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<'explore' | 'users'>('explore');

  // Instagram-like instant search without loading
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      // Instant search with background loading
      const users = await FirebaseService.searchUsers(query);
      setSearchResults(users);
    } catch (error) {
      console.error('Search error:', error);
      // Don't show error states, just keep previous results
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Load explore posts instantly on mount
  useEffect(() => {
    const loadExplorePosts = async () => {
      try {
        const posts = await FirebaseService.getAllPosts();
        setExplorePosts(posts);
      } catch (error) {
        console.error('Error loading explore posts:', error);
      }
    };

    loadExplorePosts();
  }, []);

  // Memoized render functions
  const renderPostItem = useCallback(({ item }: { item: Post }) => (
    <PostGridItem
      post={item}
      onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
    />
  ), [navigation]);

  const renderUserItem = useCallback(({ item }: { item: User }) => (
    <UserItem
      user={item}
      currentUserId={user?.uid || ''}
      onPress={() => navigation.navigate('UserProfile', { userId: item.uid })}
    />
  ), [navigation, user?.uid]);

  const keyExtractor = useCallback((item: Post) => item.id, []);

  // Tab switching without loading states
  const handleTabChange = useCallback((tab: 'explore' | 'users') => {
    setActiveTab(tab);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Input */}
      <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSoft }]}>
        <Icon name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search users, posts..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'explore' && { borderBottomColor: colors.primary }
          ]}
          onPress={() => handleTabChange('explore')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'explore' ? colors.primary : colors.textSecondary }
          ]}>
            Explore
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'users' && { borderBottomColor: colors.primary }
          ]}
          onPress={() => handleTabChange('users')}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'users' ? colors.primary : colors.textSecondary }
          ]}>
            Users {searchResults.length > 0 && `(${searchResults.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {activeTab === 'explore' ? (
          <FlatList
            key="explore-grid-3-columns" // Fixed: Add key when using numColumns
            data={explorePosts}
            renderItem={renderPostItem}
            keyExtractor={keyExtractor}
            numColumns={3}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={15}
            initialNumToRender={12}
            windowSize={5}
            style={styles.grid}
          />
        ) : (
          <FlatList
            key="users-list-1-column" // Fixed: Add key when switching
            data={searchResults}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.uid}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            initialNumToRender={8}
            windowSize={5}
            style={styles.usersList}
            ListEmptyComponent={
              searchQuery.length > 1 ? (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No users found for "{searchQuery}"
                  </Text>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Start typing to search for users
                  </Text>
                </View>
              )
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    marginTop: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  grid: {
    flex: 1,
  },
  gridItem: {
    width: imageSize,
    height: imageSize,
    margin: 0.5,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  usersList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    justifyContent: 'space-between',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  displayName: {
    fontSize: 14,
    marginBottom: 2,
  },
  followersCount: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
