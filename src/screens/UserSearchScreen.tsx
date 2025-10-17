import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Keyboard,
  Animated,
  SafeAreaView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import UltraFastShareService, { ShareTarget } from '../services/UltraFastShareService';
import PerfectChatService from '../services/PerfectChatService';
import firestore from '@react-native-firebase/firestore';

const { width } = Dimensions.get('window');

interface User {
  id: string;
  username: string;
  displayName: string;
  profilePicture?: string;
  bio?: string;
  isFollowing?: boolean;
  isFollowedBy?: boolean;
  isOnline?: boolean;
  lastSeen?: Date;
  verified?: boolean;
  followerCount?: number;
  followingCount?: number;
}

interface UserSearchScreenProps {
  mode?: 'chat' | 'share';
  title?: string;
  shareContent?: {
    type: 'reel' | 'post';
    data: any;
  };
  onUserSelect?: (user: User) => void;
  showFollowButton?: boolean;
  multiSelect?: boolean;
}

const UserSearchScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as UserSearchScreenProps;
  
  const {
    mode = 'chat',
    title = 'Search Users',
    shareContent,
    onUserSelect,
    showFollowButton = true,
    multiSelect = false,
  } = params;

  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  const ultraFastShareService = UltraFastShareService.getInstance();
  const perfectChatService = PerfectChatService.getInstance();

  useEffect(() => {
    loadRecentUsers();
    
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      // Debounce search
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        searchUsers(searchQuery.trim());
      }, 300);
    } else {
      setUsers([]);
      setSearchLoading(false);
    }
  }, [searchQuery]);

  const loadRecentUsers = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      console.log('👥 Loading recent users...');

      // Get recent chat partners
      const chatsSnapshot = await firestore()
        .collection('chats')
        .where('participants', 'array-contains', user.uid)
        .orderBy('updatedAt', 'desc')
        .limit(10)
        .get();

      const recentUserIds = new Set<string>();
      
      chatsSnapshot.docs.forEach(doc => {
        const chatData = doc.data();
        const otherUserId = chatData.participants.find((p: string) => p !== user.uid);
        if (otherUserId) recentUserIds.add(otherUserId);
      });

      // Get user details for recent chat partners
      const recentUserPromises = Array.from(recentUserIds).map(async (userId) => {
        try {
          const userDoc = await firestore().collection('users').doc(userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            return {
              id: userId,
              username: userData?.username || '',
              displayName: userData?.displayName || userData?.username || 'User',
              profilePicture: userData?.profilePicture,
              bio: userData?.bio,
              isOnline: userData?.isOnline || false,
              verified: userData?.verified || false,
            };
          }
          return null;
        } catch (error) {
          console.warn('Error loading recent user:', error);
          return null;
        }
      });

      const recentUserResults = await Promise.all(recentUserPromises);
      const validRecentUsers = recentUserResults.filter(u => u !== null) as User[];

      setRecentUsers(validRecentUsers);
      console.log(`✅ Loaded ${validRecentUsers.length} recent users`);
    } catch (error) {
      console.error('❌ Error loading recent users:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (!user?.uid || query.length < 2) return;

    try {
      setSearchLoading(true);
      console.log(`🔍 Searching users for: "${query}"`);

      const searchResults: User[] = [];

      // Search by username (case-insensitive)
      const usernameQuery = await firestore()
        .collection('users')
        .where('username', '>=', query.toLowerCase())
        .where('username', '<=', query.toLowerCase() + '\uf8ff')
        .limit(20)
        .get();

      // Search by display name (case-insensitive)
      const displayNameQuery = await firestore()
        .collection('users')
        .where('displayName', '>=', query)
        .where('displayName', '<=', query + '\uf8ff')
        .limit(20)
        .get();

      const userIds = new Set<string>();

      // Process username results
      usernameQuery.docs.forEach(doc => {
        if (doc.id !== user.uid) {
          userIds.add(doc.id);
          const userData = doc.data();
          searchResults.push({
            id: doc.id,
            username: userData.username || '',
            displayName: userData.displayName || userData.username || 'User',
            profilePicture: userData.profilePicture,
            bio: userData.bio,
            isOnline: userData.isOnline || false,
            verified: userData.verified || false,
            followerCount: userData.followerCount || 0,
            followingCount: userData.followingCount || 0,
          });
        }
      });

      // Process display name results (avoid duplicates)
      displayNameQuery.docs.forEach(doc => {
        if (doc.id !== user.uid && !userIds.has(doc.id)) {
          userIds.add(doc.id);
          const userData = doc.data();
          searchResults.push({
            id: doc.id,
            username: userData.username || '',
            displayName: userData.displayName || userData.username || 'User',
            profilePicture: userData.profilePicture,
            bio: userData.bio,
            isOnline: userData.isOnline || false,
            verified: userData.verified || false,
            followerCount: userData.followerCount || 0,
            followingCount: userData.followingCount || 0,
          });
        }
      });

      // Sort by relevance (exact matches first, then partial matches)
      searchResults.sort((a, b) => {
        const aUsernameMatch = a.username.toLowerCase() === query.toLowerCase();
        const bUsernameMatch = b.username.toLowerCase() === query.toLowerCase();
        const aDisplayNameMatch = a.displayName.toLowerCase() === query.toLowerCase();
        const bDisplayNameMatch = b.displayName.toLowerCase() === query.toLowerCase();

        if (aUsernameMatch && !bUsernameMatch) return -1;
        if (bUsernameMatch && !aUsernameMatch) return 1;
        if (aDisplayNameMatch && !bDisplayNameMatch) return -1;
        if (bDisplayNameMatch && !aDisplayNameMatch) return 1;

        return a.displayName.localeCompare(b.displayName);
      });

      setUsers(searchResults);
      console.log(`✅ Found ${searchResults.length} users`);
    } catch (error) {
      console.error('❌ Error searching users:', error);
      Alert.alert('Error', 'Failed to search users. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleUserSelect = async (selectedUser: User) => {
    try {
      if (multiSelect) {
        // Handle multi-selection
        setSelectedUsers(prev => {
          const isSelected = prev.some(u => u.id === selectedUser.id);
          if (isSelected) {
            return prev.filter(u => u.id !== selectedUser.id);
          } else {
            return [...prev, selectedUser];
          }
        });
        return;
      }

      if (onUserSelect) {
        onUserSelect(selectedUser);
        return;
      }

      if (mode === 'share' && shareContent) {
        // Share content to user
        await handleShareToUser(selectedUser);
      } else {
        // Start chat with user
        await startChatWithUser(selectedUser);
      }
    } catch (error) {
      console.error('Error handling user selection:', error);
      Alert.alert('Error', 'Failed to process selection. Please try again.');
    }
  };

  const startChatWithUser = async (selectedUser: User) => {
    if (!user?.uid) return;

    try {
      console.log(`💬 Starting chat with user: ${selectedUser.displayName}`);

      // Check if chat already exists
      const existingChatsSnapshot = await firestore()
        .collection('chats')
        .where('participants', 'array-contains', user.uid)
        .get();

      let existingChatId: string | null = null;

      for (const doc of existingChatsSnapshot.docs) {
        const chatData = doc.data();
        if (chatData.participants.includes(selectedUser.id) && chatData.participants.length === 2) {
          existingChatId = doc.id;
          break;
        }
      }

      if (existingChatId) {
        // Navigate to existing chat
        (navigation as any).navigate('ChatScreen', {
          chatId: existingChatId,
          otherUser: selectedUser,
          chatTitle: selectedUser.displayName,
        });
      } else {
        // Create new chat
        const newChatRef = await firestore().collection('chats').add({
          participants: [user.uid, selectedUser.id],
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          lastMessage: '',
          lastMessageTime: firestore.FieldValue.serverTimestamp(),
          lastMessageType: 'text',
        });

        // Navigate to new chat
        (navigation as any).navigate('ChatScreen', {
          chatId: newChatRef.id,
          otherUser: selectedUser,
          chatTitle: selectedUser.displayName,
        });
      }
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert('Error', 'Failed to start chat. Please try again.');
    }
  };

  const handleShareToUser = async (selectedUser: User) => {
    if (!user?.uid || !shareContent) return;

    try {
      setLoading(true);
      console.log(`📤 Sharing ${shareContent.type} to: ${selectedUser.displayName}`);

      if (shareContent.type === 'reel') {
        await ultraFastShareService.shareReelToUsers(
          user.uid,
          [selectedUser.id],
          shareContent.data,
          `${user.displayName || user.username} shared a reel with you`
        );
      } else if (shareContent.type === 'post') {
        await ultraFastShareService.sharePostToUsers(
          user.uid,
          [selectedUser.id],
          shareContent.data,
          `${user.displayName || user.username} shared a post with you`
        );
      }

      Alert.alert(
        '🎉 Shared!',
        `Successfully sent your ${shareContent.type} to ${selectedUser.displayName}.\n\nThey'll receive it in their messages.`,
        [{ text: 'Great!', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error sharing content:', error);
      Alert.alert('Error', 'Failed to share content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle sharing to multiple users when Done button is pressed
  const handleShareToMultipleUsers = async () => {
    if (!user?.uid || !shareContent || selectedUsers.length === 0) return;

    try {
      setLoading(true);
      console.log(`📤 Sharing ${shareContent.type} to ${selectedUsers.length} users`);

      const recipientIds = selectedUsers.map(selectedUser => selectedUser.id);

      if (shareContent.type === 'reel') {
        await ultraFastShareService.shareReelToUsers(
          user.uid,
          recipientIds,
          shareContent.data,
          `${user.displayName || user.username} shared an amazing reel with you!`
        );
      } else if (shareContent.type === 'post') {
        await ultraFastShareService.sharePostToUsers(
          user.uid,
          recipientIds,
          shareContent.data,
          `${user.displayName || user.username} shared a post with you!`
        );
      }

      const userNames = selectedUsers.slice(0, 3).map(u => u.displayName).join(', ');
      const remainingCount = selectedUsers.length - 3;
      const recipientsText = remainingCount > 0 
        ? `${userNames} and ${remainingCount} others`
        : userNames;

      Alert.alert(
        '🎉 Shared Successfully!',
        `Your ${shareContent.type} has been sent to ${recipientsText}.\n\nThey'll receive it in their messages.`,
        [{ 
          text: 'Awesome!', 
          onPress: () => {
            // Reset selection and go back
            setSelectedUsers([]);
            navigation.goBack();
          }
        }]
      );
    } catch (error) {
      console.error('Error sharing to multiple users:', error);
      Alert.alert('Error', 'Failed to share content. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[
        styles.userItem,
        multiSelect && selectedUsers.some(u => u.id === item.id) && styles.selectedUserItem
      ]}
      onPress={() => handleUserSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.userAvatar}>
        <Image
          source={{ uri: item.profilePicture || 'https://via.placeholder.com/50?text=👤' }}
          style={styles.avatarImage}
        />
        {item.isOnline && <View style={styles.onlineIndicator} />}
      </View>

      <View style={styles.userInfo}>
        <View style={styles.userHeader}>
          <Text style={styles.userName}>{item.displayName}</Text>
          {item.verified && (
            <Icon name="verified" size={16} color="#4FC3F7" style={styles.verifiedIcon} />
          )}
        </View>
        <Text style={styles.userUsername}>@{item.username}</Text>
        {item.bio && (
          <Text style={styles.userBio} numberOfLines={1}>{item.bio}</Text>
        )}
        {item.followerCount !== undefined && (
          <Text style={styles.userStats}>
            {item.followerCount} followers • {item.followingCount} following
          </Text>
        )}
      </View>

      <View style={styles.userActions}>
        {multiSelect ? (
          <View style={[
            styles.checkbox,
            selectedUsers.some(u => u.id === item.id) && styles.checkedBox
          ]}>
            {selectedUsers.some(u => u.id === item.id) && (
              <Icon name="check" size={16} color="#fff" />
            )}
          </View>
        ) : (
          <Icon name="chevron-right" size={24} color="rgba(255,255,255,0.5)" />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderRecentSection = () => {
    if (searchQuery.trim() || recentUsers.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Chats</Text>
        <FlatList
          data={recentUsers}
          renderItem={renderUserItem}
          keyExtractor={(item) => `recent-${item.id}`}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  const renderSearchResults = () => {
    if (!searchQuery.trim()) return null;

    if (searchLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff3040" />
          <Text style={styles.loadingText}>Searching users...</Text>
        </View>
      );
    }

    if (users.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Icon name="search-off" size={64} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyStateTitle}>No users found</Text>
          <Text style={styles.emptyStateText}>Try searching with a different username or name</Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Search Results ({users.length})</Text>
        <FlatList
          data={users}
          renderItem={renderUserItem}
          keyExtractor={(item) => `search-${item.id}`}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

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
        {multiSelect && selectedUsers.length > 0 && (
          <TouchableOpacity 
            style={[styles.doneButton, loading && styles.doneButtonDisabled]} 
            onPress={handleShareToMultipleUsers}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.doneButtonText}>Done ({selectedUsers.length})</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="rgba(255,255,255,0.7)" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus={true}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="clear" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingBottom: keyboardHeight }]}>
        {searchQuery.trim() ? renderSearchResults() : renderRecentSection()}
        
        {loading && !searchLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#ff3040" />
            <Text style={styles.loadingText}>Loading recent users...</Text>
          </View>
        )}
      </View>

      {/* Sharing Overlay */}
      {loading && mode === 'share' && (
        <View style={styles.sharingOverlay}>
          <View style={styles.sharingModal}>
            <ActivityIndicator size="large" color="#ff3040" />
            <Text style={styles.sharingText}>
              {multiSelect && selectedUsers.length > 1 
                ? `Sharing to ${selectedUsers.length} people...`
                : `Sharing ${shareContent?.type}...`
              }
            </Text>
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
  doneButton: {
    backgroundColor: '#ff3040',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  doneButtonDisabled: {
    backgroundColor: 'rgba(255,48,64,0.5)',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  selectedUserItem: {
    backgroundColor: 'rgba(255,48,64,0.1)',
  },
  userAvatar: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#000',
  },
  userInfo: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  userUsername: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  userBio: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  userStats: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  userActions: {
    marginLeft: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkedBox: {
    backgroundColor: '#ff3040',
    borderColor: '#ff3040',
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
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
    zIndex: 1000,
  },
  sharingModal: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 200,
  },
  sharingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 15,
    textAlign: 'center',
  },
});

export default UserSearchScreen;
