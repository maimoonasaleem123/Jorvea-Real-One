import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/FastAuthContext';
import UltraFastShareService, { ShareTarget } from '../services/UltraFastShareService';
import { Post, Reel } from '../services/firebaseService';

const { width, height } = Dimensions.get('window');

interface ShareBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  contentType: 'post' | 'reel';
  contentData: Post | Reel;
}

interface ShareUserItem extends ShareTarget {
  selected: boolean;
}

const ShareBottomSheet: React.FC<ShareBottomSheetProps> = ({
  visible,
  onClose,
  contentType,
  contentData,
}) => {
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [message, setMessage] = useState('');
  const [users, setUsers] = useState<ShareUserItem[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const shareService = UltraFastShareService.getInstance();

  useEffect(() => {
    if (visible && user) {
      loadUsers();
    }
  }, [visible, user]);

  const loadUsers = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Load both friends and recent chats
      const [friends, recentChats] = await Promise.all([
        shareService.getFriendsForSharing(user.uid),
        shareService.getRecentChatsForSharing(user.uid),
      ]);

      // Combine and deduplicate
      const allUsers = new Map<string, ShareTarget>();
      
      friends.forEach(friend => allUsers.set(friend.id, friend));
      recentChats.forEach(chat => allUsers.set(chat.id, chat));

      const uniqueUsers = Array.from(allUsers.values()).map(user => ({
        ...user,
        selected: false,
      }));

      setUsers(uniqueUsers);
    } catch (error) {
      console.error('Error loading users for sharing:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (user.username && user.username.toLowerCase().includes(searchText.toLowerCase()))
  );

  const toggleUserSelection = (userId: string) => {
    setUsers(prev => prev.map(user => 
      user.id === userId ? { ...user, selected: !user.selected } : user
    ));
    
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleShare = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('No users selected', 'Please select at least one user to share with');
      return;
    }

    if (!user || !contentData) {
      Alert.alert('Error', 'Content not available for sharing');
      return;
    }

    try {
      setSharing(true);

      if (contentType === 'reel') {
        await shareService.shareReelToUsers(
          user.uid,
          selectedUsers,
          contentData as Reel,
          message.trim() || undefined
        );
      } else {
        await shareService.sharePostToUsers(
          user.uid,
          selectedUsers,
          contentData as Post,
          message.trim() || undefined
        );
      }

      Alert.alert('Success', `${contentType} shared successfully!`);
      onClose();
      
      // Reset state
      setSelectedUsers([]);
      setMessage('');
      setSearchText('');
      
    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Error', `Failed to share ${contentType}`);
    } finally {
      setSharing(false);
    }
  };

  const getContentPreview = () => {
    // Add null check for contentData
    if (!contentData) {
      return (
        <View style={styles.contentPreview}>
          <View style={styles.previewImageContainer}>
            <View style={[styles.previewImage, { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' }]}>
              <Icon name="image-outline" size={30} color="#ccc" />
            </View>
          </View>
          <View style={styles.previewInfo}>
            <Text style={styles.previewType}>Loading...</Text>
            <Text style={styles.previewCaption}>Please wait</Text>
          </View>
        </View>
      );
    }

    if (contentType === 'reel') {
      const reel = contentData as Reel;
      return (
        <View style={styles.contentPreview}>
          <View style={styles.previewImageContainer}>
            <Image 
              source={{ uri: reel.thumbnailUrl || reel.videoUrl }}
              style={styles.previewImage}
              resizeMode="cover"
            />
            <View style={styles.playButton}>
              <Icon name="play" size={20} color="#fff" />
            </View>
          </View>
          <View style={styles.previewInfo}>
            <Text style={styles.previewType}>Reel</Text>
            <Text style={styles.previewCaption} numberOfLines={2}>
              {reel.caption || 'No caption'}
            </Text>
          </View>
        </View>
      );
    } else {
      const post = contentData as Post;
      const firstImage = post.mediaUrls?.[0];
      return (
        <View style={styles.contentPreview}>
          <View style={styles.previewImageContainer}>
            {firstImage && (
              <Image 
                source={{ uri: firstImage }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            )}
            {post.mediaUrls && post.mediaUrls.length > 1 && (
              <View style={styles.multipleIndicator}>
                <Icon name="copy-outline" size={16} color="#fff" />
              </View>
            )}
          </View>
          <View style={styles.previewInfo}>
            <Text style={styles.previewType}>Post</Text>
            <Text style={styles.previewCaption} numberOfLines={2}>
              {post.caption || 'No caption'}
            </Text>
          </View>
        </View>
      );
    }
  };

  const renderUserItem = ({ item }: { item: ShareUserItem }) => (
    <TouchableOpacity
      style={[styles.userItem, item.selected && styles.userItemSelected]}
      onPress={() => toggleUserSelection(item.id)}
    >
      <View style={styles.userInfo}>
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.userAvatar} />
        ) : (
          <View style={styles.defaultAvatar}>
            <Text style={styles.avatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.userDetails}>
          <Text style={styles.userName}>{item.name}</Text>
          {item.username && (
            <Text style={styles.userUsername}>@{item.username}</Text>
          )}
          <View style={styles.userStatus}>
            <View style={[styles.statusDot, { backgroundColor: item.isOnline ? '#4CD964' : '#8E8E93' }]} />
            <Text style={styles.statusText}>
              {item.isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.checkbox, item.selected && styles.checkboxSelected]}>
        {item.selected && <Icon name="checkmark" size={16} color="#fff" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share {contentType}</Text>
          <TouchableOpacity
            onPress={handleShare}
            style={[styles.headerButton, styles.shareButton, selectedUsers.length === 0 && styles.shareButtonDisabled]}
            disabled={selectedUsers.length === 0 || sharing}
          >
            {sharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.shareText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content Preview */}
        {getContentPreview()}

        {/* Message Input */}
        <View style={styles.messageInputContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Add a message..."
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
          />
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <View style={styles.selectedUsersContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {users.filter(user => user.selected).map(user => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.selectedUser}
                  onPress={() => toggleUserSelection(user.id)}
                >
                  {user.avatar ? (
                    <Image source={{ uri: user.avatar }} style={styles.selectedUserAvatar} />
                  ) : (
                    <View style={styles.selectedUserDefaultAvatar}>
                      <Text style={styles.selectedUserAvatarText}>
                        {user.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.selectedUserName}>{user.name}</Text>
                  <View style={styles.removeButton}>
                    <Icon name="close" size={12} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Users List */}
        <View style={styles.usersContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading users...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              renderItem={renderUserItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.usersList}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  headerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  shareButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  shareButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  shareText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  contentPreview: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#F8F9FA',
  },
  previewImageContainer: {
    position: 'relative',
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  playButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
  },
  multipleIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  previewType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  previewCaption: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 18,
  },
  messageInputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  messageInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 80,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  selectedUsersContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E1E8ED',
  },
  selectedUser: {
    alignItems: 'center',
    marginHorizontal: 8,
    position: 'relative',
  },
  selectedUserAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 4,
  },
  selectedUserDefaultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  selectedUserAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectedUserName: {
    fontSize: 12,
    color: '#1A1A1A',
    textAlign: 'center',
    maxWidth: 60,
  },
  removeButton: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  usersContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  usersList: {
    paddingHorizontal: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  userItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  defaultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  userStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
});

export default ShareBottomSheet;
