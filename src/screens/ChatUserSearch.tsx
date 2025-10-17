import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import FirebaseService from '../services/firebaseService';
import { User, RootStackParamList } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import { BeautifulHeader } from '../components/BeautifulHeader';
import { EnhancedFollowButton } from '../components/EnhancedFollowButton';

interface ChatUserSearchProps {
  onUserSelect?: (user: User) => void;
  showFollowButton?: boolean;
  excludeCurrentUser?: boolean;
  route?: {
    params?: {
      onUserSelect?: (user: User) => void;
      showFollowButton?: boolean;
    };
  };
}

const ChatUserSearch: React.FC<ChatUserSearchProps> = ({ 
  route,
  onUserSelect: propOnUserSelect,
  showFollowButton = true,
  excludeCurrentUser = true,
}) => {
  const { user: currentUser } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [recentChats, setRecentChats] = useState<User[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  // Get props from route params if available
  const onUserSelect = route?.params?.onUserSelect || propOnUserSelect;
  const shouldShowFollowButton = route?.params?.showFollowButton ?? showFollowButton;

  // Load initial data
  useEffect(() => {
    loadRecentChats();
    loadSuggestedUsers();
  }, []);

  const loadRecentChats = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    try {
      // Get recent chat participants
      const chats = await FirebaseService.getChats(currentUser.uid);
      const recentUsers: User[] = [];
      
      for (const chat of chats.slice(0, 5)) { // Get last 5 chats
        if (chat.otherUser) {
          recentUsers.push(chat.otherUser as User);
        }
      }
      
      setRecentChats(recentUsers);
    } catch (error) {
      console.error('Error loading recent chats:', error);
    }
  }, [currentUser?.uid]);

  const loadSuggestedUsers = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    try {
      // Get users you're following or popular users
      const following = await FirebaseService.getFollowing(currentUser.uid);
      const allUsers = await FirebaseService.searchUsers(''); // Get all users
      
      // Filter out current user and get suggested users
      const suggested = allUsers
        .filter(u => u.uid !== currentUser.uid)
        .slice(0, 10);
      
      setSuggestedUsers(suggested);
    } catch (error) {
      console.error('Error loading suggested users:', error);
    }
  }, [currentUser?.uid]);

  const searchUsers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const users = await FirebaseService.searchUsers(query);
      
      // Filter out current user if needed
      const filteredUsers = excludeCurrentUser 
        ? users.filter(u => u.uid !== currentUser?.uid)
        : users;
      
      setSearchResults(filteredUsers);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, excludeCurrentUser]);

  useEffect(() => {
    const debounceTimeout = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(debounceTimeout);
  }, [searchQuery, searchUsers]);

  const handleUserPress = useCallback((selectedUser: User) => {
    if (onUserSelect) {
      onUserSelect(selectedUser);
      navigation.goBack();
    } else {
      // Navigate to chat with this user
      navigation.navigate('ChatScreen', { 
        userId: selectedUser.uid,
        otherUserName: selectedUser.displayName || selectedUser.username,
        otherUserAvatar: selectedUser.profilePicture || selectedUser.photoURL,
      });
    }
  }, [navigation, onUserSelect]);

  const handleUserProfilePress = useCallback((selectedUser: User) => {
    navigation.navigate('UserProfile', { userId: selectedUser.uid });
  }, [navigation]);

  const renderSearchBar = () => (
    <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
      <Icon name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        placeholder="Search for people..."
        placeholderTextColor={colors.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={true}
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')}>
          <Icon name="close-circle" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderUserItem = ({ item, showActions = true }: { item: User; showActions?: boolean }) => (
    <TouchableOpacity 
      style={[styles.userItem, { backgroundColor: colors.surface }]} 
      onPress={() => handleUserPress(item)}
      activeOpacity={0.7}
    >
      <TouchableOpacity onPress={() => handleUserProfilePress(item)}>
        <Image
          source={{
            uri: item.profilePicture || item.photoURL || 'https://via.placeholder.com/50'
          }}
          style={styles.userAvatar}
        />
      </TouchableOpacity>
      
      <View style={styles.userInfo}>
        <View style={styles.userNameContainer}>
          <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
            {item.username || item.displayName}
          </Text>
          {item.isVerified && (
            <Icon name="checkmark-circle" size={16} color="#1DA1F2" style={styles.verifiedIcon} />
          )}
        </View>
        <Text style={[styles.displayName, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.displayName}
        </Text>
        {(item.followersCount !== undefined) && (
          <Text style={[styles.followStats, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.followersCount || 0} followers
          </Text>
        )}
      </View>

      <View style={styles.actionsContainer}>
        {shouldShowFollowButton && showActions && (
          <EnhancedFollowButton
            targetUserId={item.uid}
            targetUserName={item.displayName || item.username}
            size="small"
            variant="outlined"
          />
        )}
        <TouchableOpacity 
          style={[styles.messageButton, { backgroundColor: colors.primary }]}
          onPress={() => handleUserPress(item)}
        >
          <Icon name="chatbubble" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderSection = (title: string, data: User[], showActions = true) => {
    if (data.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        <FlatList
          data={data}
          keyExtractor={(item) => `${title}-${item.uid}`}
          renderItem={({ item }) => renderUserItem({ item, showActions })}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  const renderContent = () => {
    if (loading && searchQuery) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Searching for people...
          </Text>
        </View>
      );
    }

    if (searchQuery && searchResults.length > 0) {
      return renderSection('Search Results', searchResults);
    }

    if (searchQuery && searchResults.length === 0 && !loading) {
      return (
        <View style={styles.emptyState}>
          <Icon name="people-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No people found
          </Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Try searching with a different name or username
          </Text>
        </View>
      );
    }

    // Show recent chats and suggested users when not searching
    return (
      <View style={styles.sectionsContainer}>
        {renderSection('Recent Chats', recentChats, false)}
        {renderSection('Suggested People', suggestedUsers)}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar backgroundColor={colors.background} barStyle={isDarkMode ? "light-content" : "dark-content"} />
      
      {/* Header */}
      <BeautifulHeader
        title="Find People"
        showBackButton={true}
        onBackPress={() => navigation.goBack()}
      />

      {/* Search Bar */}
      {renderSearchBar()}

      {/* Content */}
      {renderContent()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  sectionsContainer: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 4,
  },
  displayName: {
    fontSize: 14,
    marginBottom: 2,
  },
  followStats: {
    fontSize: 12,
    marginTop: 2,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ChatUserSearch;
