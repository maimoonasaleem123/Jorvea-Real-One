import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
  SafeAreaView,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import UltraFastShareService, { ShareTarget } from '../services/UltraFastShareService';
import UltraFastInstantService from '../services/UltraFastInstantService';
import UltraFastPostService from '../services/UltraFastPostService';
import firestore from '@react-native-firebase/firestore';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const { width } = Dimensions.get('window');

interface ContentItem {
  id: string;
  type: 'reel' | 'post';
  thumbnail: string;
  mediaUrl?: string;
  caption: string;
  userName: string;
  userProfilePicture?: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: Date;
}

interface ShareContentScreenProps {
  chatId?: string;
  mode?: 'selectContent' | 'selectUsers';
  title?: string;
  selectedContent?: ContentItem;
}

const ShareContentScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as ShareContentScreenProps;
  
  const {
    chatId,
    mode = 'selectContent',
    title = 'Share Content',
    selectedContent,
  } = params;

  const [reels, setReels] = useState<ContentItem[]>([]);
  const [posts, setPosts] = useState<ContentItem[]>([]);
  const [activeTab, setActiveTab] = useState<'reels' | 'posts'>('reels');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<ShareTarget[]>([]);
  const [sharing, setSharing] = useState(false);

  const ultraFastShareService = UltraFastShareService.getInstance();
  const ultraFastInstantService = UltraFastInstantService.getInstance();
  const ultraFastPostService = UltraFastPostService.getInstance();

  useFocusEffect(
    useCallback(() => {
      if (mode === 'selectContent') {
        loadContent();
      }
    }, [mode])
  );

  const loadContent = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      console.log('📚 Loading user content for sharing...');

      // Load user's reels and posts in parallel
      const [userReels, userPosts] = await Promise.all([
        loadUserReels(),
        loadUserPosts(),
      ]);

      setReels(userReels);
      setPosts(userPosts);
      console.log(`✅ Loaded ${userReels.length} reels and ${userPosts.length} posts`);
    } catch (error) {
      console.error('❌ Error loading content:', error);
      Alert.alert('Error', 'Failed to load content. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUserReels = async (): Promise<ContentItem[]> => {
    try {
      const reelsSnapshot = await firestore()
        .collection('reels')
        .where('userId', '==', user?.uid)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      return reelsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'reel' as const,
          thumbnail: data.thumbnail || data.videoUrl,
          mediaUrl: data.videoUrl,
          caption: data.caption || '',
          userName: data.userName || user?.displayName || 'You',
          userProfilePicture: data.userProfilePicture,
          likesCount: data.likesCount || 0,
          commentsCount: data.commentsCount || 0,
          sharesCount: data.sharesCount || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });
    } catch (error) {
      console.error('Error loading user reels:', error);
      return [];
    }
  };

  const loadUserPosts = async (): Promise<ContentItem[]> => {
    try {
      const postsSnapshot = await firestore()
        .collection('posts')
        .where('userId', '==', user?.uid)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      return postsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'post' as const,
          thumbnail: data.mediaUrls?.[0] || data.imageUrl,
          mediaUrl: data.mediaUrls?.[0] || data.imageUrl,
          caption: data.caption || data.description || '',
          userName: data.userName || user?.displayName || 'You',
          userProfilePicture: data.userProfilePicture,
          likesCount: data.likesCount || 0,
          commentsCount: data.commentsCount || 0,
          sharesCount: data.sharesCount || 0,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });
    } catch (error) {
      console.error('Error loading user posts:', error);
      return [];
    }
  };

  const selectContentToShare = (content: ContentItem) => {
    if (chatId) {
      // Direct share to specific chat
      shareContentToChat(content);
    } else {
      // Navigate to user selection
      (navigation as any).navigate('UserSearchScreen', {
        mode: 'share',
        title: `Share ${content.type}`,
        shareContent: {
          type: content.type,
          data: content,
        },
        multiSelect: true,
      });
    }
  };

  const shareContentToChat = async (content: ContentItem) => {
    if (!user?.uid || !chatId || sharing) return;

    try {
      setSharing(true);
      console.log(`📤 Sharing ${content.type} to chat: ${chatId}`);

      // Create shared content message
      const sharedContent = {
        id: content.id,
        type: content.type,
        thumbnail: content.thumbnail,
        title: content.caption,
        author: content.userName,
        authorAvatar: content.userProfilePicture,
      };

      // Add message to chat
      await firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .add({
          text: `Shared a ${content.type}`,
          senderId: user.uid,
          senderName: user.displayName || user.email || 'User',
          senderAvatar: (user as any)?.photoURL || (user as any)?.profilePicture,
          timestamp: firestore.FieldValue.serverTimestamp(),
          type: content.type,
          sharedContent,
          isRead: false,
          isDelivered: true,
        });

      // Update chat metadata
      await firestore()
        .collection('chats')
        .doc(chatId)
        .update({
          lastMessage: `Shared a ${content.type}`,
          lastMessageTime: firestore.FieldValue.serverTimestamp(),
          lastMessageType: content.type,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      // Haptic feedback
      ReactNativeHapticFeedback.trigger('impactMedium');

      // Show success and go back
      Alert.alert(
        'Shared!',
        `Successfully shared ${content.type} to chat`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error sharing content to chat:', error);
      Alert.alert('Error', 'Failed to share content. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredContent = () => {
    const content = activeTab === 'reels' ? reels : posts;
    if (!searchQuery.trim()) return content;
    
    return content.filter(item =>
      item.caption.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const renderContentItem = ({ item }: { item: ContentItem }) => (
    <TouchableOpacity
      style={styles.contentItem}
      onPress={() => selectContentToShare(item)}
      activeOpacity={0.7}
    >
      <View style={styles.contentThumbnail}>
        <Image source={{ uri: item.thumbnail }} style={styles.thumbnailImage} />
        {item.type === 'reel' && (
          <View style={styles.playIcon}>
            <Icon name="play-circle-filled" size={24} color="#fff" />
          </View>
        )}
        {item.type === 'post' && item.mediaUrl?.includes('.mp4') && (
          <View style={styles.playIcon}>
            <Icon name="play-circle-filled" size={24} color="#fff" />
          </View>
        )}
      </View>

      <View style={styles.contentInfo}>
        <Text style={styles.contentCaption} numberOfLines={2}>
          {item.caption || `My ${item.type}`}
        </Text>
        <Text style={styles.contentStats}>
          {item.likesCount} likes • {item.commentsCount} comments
        </Text>
        <Text style={styles.contentTime}>
          {formatTimeAgo(item.createdAt)}
        </Text>
      </View>

      <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.5)" />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon 
        name={activeTab === 'reels' ? 'videocam' : 'photo'} 
        size={64} 
        color="rgba(255,255,255,0.3)" 
      />
      <Text style={styles.emptyStateTitle}>
        No {activeTab} to share
      </Text>
      <Text style={styles.emptyStateText}>
        Create some {activeTab} first to share them with friends
      </Text>
      <TouchableOpacity 
        style={styles.createButton}
        onPress={() => {
          if (activeTab === 'reels') {
            (navigation as any).navigate('CreateReelScreen');
          } else {
            (navigation as any).navigate('CreatePostScreen');
          }
        }}
      >
        <Text style={styles.createButtonText}>
          Create {activeTab === 'reels' ? 'Reel' : 'Post'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity style={styles.helpButton}>
          <Icon name="help-outline" size={24} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="rgba(255,255,255,0.7)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your content..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="clear" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reels' && styles.activeTab]}
          onPress={() => setActiveTab('reels')}
        >
          <Icon 
            name="videocam" 
            size={20} 
            color={activeTab === 'reels' ? '#ff3040' : 'rgba(255,255,255,0.7)'} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'reels' && styles.activeTabText
          ]}>
            Reels ({reels.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'posts' && styles.activeTab]}
          onPress={() => setActiveTab('posts')}
        >
          <Icon 
            name="photo" 
            size={20} 
            color={activeTab === 'posts' ? '#ff3040' : 'rgba(255,255,255,0.7)'} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'posts' && styles.activeTabText
          ]}>
            Posts ({posts.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content List */}
      <FlatList
        data={filteredContent()}
        renderItem={renderContentItem}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        contentContainerStyle={styles.contentList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={loadContent}
            tintColor="#fff"
            colors={['#ff3040']}
          />
        }
        ListEmptyComponent={loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff3040" />
            <Text style={styles.loadingText}>Loading your content...</Text>
          </View>
        ) : (
          renderEmptyState()
        )}
      />

      {/* Sharing Overlay */}
      {sharing && (
        <View style={styles.sharingOverlay}>
          <View style={styles.sharingModal}>
            <ActivityIndicator size="large" color="#ff3040" />
            <Text style={styles.sharingText}>Sharing content...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    marginRight: 15,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  helpButton: {
    padding: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 25,
    height: 44,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 25,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: 'rgba(255,48,64,0.2)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#ff3040',
  },
  contentList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  contentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  contentThumbnail: {
    position: 'relative',
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  playIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  contentInfo: {
    flex: 1,
  },
  contentCaption: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  contentStats: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  contentTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 12,
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#ff3040',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sharingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sharingModal: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
  },
  sharingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 15,
  },
});

export default ShareContentScreen;
