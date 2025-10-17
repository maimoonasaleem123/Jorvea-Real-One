import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import { RootStackParamList, Post as TypesPost } from '../types';
import FirebaseService from '../services/firebaseService';
import { BeautifulButton } from '../components/BeautifulButton';

const { width } = Dimensions.get('window');
const imageSize = (width - 3) / 3;

// Memoized Post Grid Item
const PostGridItem = memo<{ post: TypesPost; onPress: () => void }>(({ post, onPress }) => {
  return (
    <TouchableOpacity style={styles.gridItem} onPress={onPress}>
      <Image
        source={{ uri: post.mediaUrls[0] }}
        style={styles.gridImage}
        resizeMode="cover"
      />
      {post.type === 'video' && (
        <View style={styles.videoIndicator}>
          <Icon name="play" size={16} color="white" />
        </View>
      )}
    </TouchableOpacity>
  );
});

// Memoized Stats Component
const ProfileStats = memo<{ 
  postsCount: number; 
  followersCount: number; 
  followingCount: number;
  colors: any;
}>(({ postsCount, followersCount, followingCount, colors }) => (
  <View style={styles.statsContainer}>
    <View style={styles.statItem}>
      <Text style={[styles.statNumber, { color: colors.text }]}>
        {postsCount}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
        Posts
      </Text>
    </View>
    <View style={styles.statItem}>
      <Text style={[styles.statNumber, { color: colors.text }]}>
        {followersCount}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
        Followers
      </Text>
    </View>
    <View style={styles.statItem}>
      <Text style={[styles.statNumber, { color: colors.text }]}>
        {followingCount}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
        Following
      </Text>
    </View>
  </View>
));

export const UltraFastProfileScreen: React.FC = () => {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  
  const [userPosts, setUserPosts] = useState<TypesPost[]>([]);
  const [userStats, setUserStats] = useState({
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
  });

  // Instant profile loading without loading states
  useEffect(() => {
    if (user) {
      // Load posts instantly
      loadUserPosts();
      
      // Set stats instantly from user object
      setUserStats({
        postsCount: user.postsCount || 0,
        followersCount: user.followers?.length || 0,
        followingCount: user.following?.length || 0,
      });
    }
  }, [user]);

  const loadUserPosts = useCallback(async () => {
    if (!user) return;
    
    try {
      const posts = await FirebaseService.getUserPosts(user.uid);
      // Convert Firebase posts to types posts
      const convertedPosts: TypesPost[] = posts.map(post => ({
        id: post.id,
        userId: post.userId,
        user: {
          uid: post.user?.uid || user.uid,
          username: post.user?.username || user.username,
          displayName: post.user?.displayName || user.displayName,
          profilePicture: post.user?.profilePicture || user.profilePicture,
          isVerified: post.user?.isVerified || user.isVerified || false,
        },
        type: post.type,
        mediaUrls: post.mediaUrls,
        thumbnailUrl: post.mediaUrls[0],
        caption: post.caption,
        location: post.location ? {
          id: '',
          name: post.location.name,
          address: '',
          city: '',
          country: '',
          latitude: post.location.coordinates?.latitude || 0,
          longitude: post.location.coordinates?.longitude || 0,
          postsCount: 0,
        } : undefined,
        tags: post.hashtags || [],
        mentions: post.mentions || [],
        likes: post.likes || [],
        comments: [],
        shares: post.shares || 0,
        saves: post.saves || [],
        isArchived: post.isArchived || false,
        isHidden: post.isHidden || false,
        music: post.music ? {
          id: post.music.id,
          title: post.music.title,
          artist: post.music.artist,
          url: post.music.url,
          duration: post.music.duration,
          isPopular: post.music.isPopular || false,
          usageCount: post.music.usageCount || 0,
          createdAt: post.music.createdAt || new Date(),
        } : undefined,
        createdAt: post.createdAt instanceof Date ? post.createdAt : new Date(post.createdAt),
        updatedAt: post.updatedAt instanceof Date ? post.updatedAt : new Date(post.updatedAt),
      }));
      setUserPosts(convertedPosts);
    } catch (error) {
      console.error('Error loading user posts:', error);
    }
  }, [user]);

  const handleEditProfile = useCallback(() => {
    navigation.navigate('EditProfile');
  }, [navigation]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [signOut]);

  const renderPostItem = useCallback(({ item }: { item: TypesPost }) => (
    <PostGridItem
      post={item}
      onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
    />
  ), [navigation]);

  const keyExtractor = useCallback((item: TypesPost) => item.id, []);

  const HeaderComponent = memo(() => (
    <View style={styles.headerContent}>
      {/* Profile Info */}
      <View style={styles.profileHeader}>
        <Image
          source={{ 
            uri: user?.profilePicture || 'https://via.placeholder.com/100' 
          }}
          style={styles.profileImage}
        />
        <ProfileStats 
          postsCount={userStats.postsCount}
          followersCount={userStats.followersCount}
          followingCount={userStats.followingCount}
          colors={colors}
        />
      </View>

      {/* Bio Section */}
      <View style={styles.bioSection}>
        <Text style={[styles.displayName, { color: colors.text }]}>
          {user?.displayName || user?.username || 'User'}
        </Text>
        {user?.bio && (
          <Text style={[styles.bio, { color: colors.textSecondary }]}>
            {user.bio}
          </Text>
        )}
        {user?.website && (
          <Text style={[styles.website, { color: colors.primary }]}>
            {user.website}
          </Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <BeautifulButton
          title="Edit Profile"
          onPress={handleEditProfile}
          variant="secondary"
          size="sm"
          style={styles.editButton}
        />
        <TouchableOpacity
          style={[styles.menuButton, { backgroundColor: colors.surface }]}
          onPress={() => navigation.navigate('Settings')}
        >
          <Icon name="menu" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tab Header */}
      <View style={styles.tabHeader}>
        <TouchableOpacity style={styles.tabItem}>
          <Icon name="grid" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  ));

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.text }]}>
            Please log in to view your profile
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar 
        barStyle={colors.background === '#FFFFFF' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.background}
      />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {user.username}
        </Text>
        <TouchableOpacity onPress={handleLogout}>
          <Icon name="log-out-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Posts Grid with Header */}
      <FlatList
        data={userPosts}
        renderItem={renderPostItem}
        keyExtractor={keyExtractor}
        numColumns={3}
        ListHeaderComponent={HeaderComponent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={15}
        initialNumToRender={12}
        windowSize={5}
        style={styles.grid}
        contentContainerStyle={styles.gridContent}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 20,
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
  bioSection: {
    marginBottom: 16,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  website: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  editButton: {
    flex: 1,
    marginRight: 8,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tabItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  grid: {
    flex: 1,
  },
  gridContent: {
    paddingBottom: 100,
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
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    padding: 2,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
