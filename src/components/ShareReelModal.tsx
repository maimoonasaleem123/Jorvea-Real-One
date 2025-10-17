import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  Vibration,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconIonic from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService, { Reel } from '../services/firebaseService';
import UltraFastShareService, { ShareTarget } from '../services/UltraFastShareService';
import { User } from '../types';

const { width } = Dimensions.get('window');

interface ShareReelModalProps {
  visible: boolean;
  reel: Reel | null;
  onClose: () => void;
}

interface ShareReelModalProps {
  visible: boolean;
  reel: Reel | null;
  onClose: () => void;
}

const ShareReelModal: React.FC<ShareReelModalProps> = ({ visible, reel, onClose }) => {
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<ShareTarget[]>([]);
  const [recentChats, setRecentChats] = useState<ShareTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [customMessage, setCustomMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'recent'>('recent');

  // Load friends and recent chats
  const loadFriends = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    setLoading(true);
    try {
      // Load followers and following as potential friends
      const [followers, following, recentChatUsers] = await Promise.all([
        FirebaseService.getFollowers(currentUser.uid),
        FirebaseService.getFollowing(currentUser.uid),
        FirebaseService.getRecentChatUsers(currentUser.uid).catch(() => []), // Fallback to empty array
      ]);

      // Combine and deduplicate friends
      const allFriends = [...followers, ...following];
      const uniqueFriends = allFriends.filter((friend, index, self) => 
        index === self.findIndex(f => f.id === friend.id)
      );

      setFriends(uniqueFriends.map(user => ({ user, selected: false })));
      setRecentChats(recentChatUsers.slice(0, 6).map(user => ({ user, selected: false })));
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid]);

  // Filter friends based on search
  const filteredFriends = friends.filter(item =>
    item.user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.user.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Toggle friend selection
  const toggleFriendSelection = useCallback((userId: string) => {
    setSelectedFriends(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  }, []);

  // Send reel to selected friends
  const sendReelToFriends = useCallback(async () => {
    if (!reel || selectedFriends.size === 0) return;

    setSending(true);
    try {
      const selectedUserIds = Array.from(selectedFriends);
      
      // Send reel to each selected friend
      await Promise.all(
        selectedUserIds.map(async (userId) => {
          try {
            await FirebaseService.sendReelMessage(currentUser?.uid!, userId, reel);
          } catch (error) {
            console.error(`Error sending reel to user ${userId}:`, error);
          }
        })
      );

      Alert.alert(
        'Reel Sent! 🎉',
        `Successfully sent reel to ${selectedFriends.size} friend${selectedFriends.size > 1 ? 's' : ''}`,
        [{ text: 'OK', onPress: onClose }]
      );
      
      setSelectedFriends(new Set());
    } catch (error) {
      console.error('Error sending reel:', error);
      Alert.alert('Error', 'Failed to send reel. Please try again.');
    } finally {
      setSending(false);
    }
  }, [reel, selectedFriends, currentUser?.uid, onClose]);

  // Load data when modal opens
  useEffect(() => {
    if (visible) {
      loadFriends();
      setSelectedFriends(new Set());
      setSearchQuery('');
    }
  }, [visible, loadFriends]);

  const renderFriendItem = ({ item }: { item: FriendItem }) => (
    <TouchableOpacity
      style={[
        styles.friendItem,
        selectedFriends.has(item.user.id) && styles.friendItemSelected
      ]}
      onPress={() => toggleFriendSelection(item.user.id)}
    >
      <Image
        source={{ uri: item.user.profilePicture || 'https://via.placeholder.com/50' }}
        style={styles.friendAvatar}
      />
      <View style={styles.friendInfo}>
        <Text style={styles.friendName} numberOfLines={1}>
          {item.user.displayName || item.user.username}
        </Text>
        <Text style={styles.friendUsername} numberOfLines={1}>
          @{item.user.username}
        </Text>
      </View>
      <View style={[
        styles.selectionIndicator,
        selectedFriends.has(item.user.id) && styles.selectionIndicatorSelected
      ]}>
        {selectedFriends.has(item.user.id) && (
          <Icon name="check" size={16} color="#fff" />
        )}
      </View>
    </TouchableOpacity>
  );

  const renderRecentChatItem = ({ item }: { item: FriendItem }) => (
    <TouchableOpacity
      style={[
        styles.recentChatItem,
        selectedFriends.has(item.user.id) && styles.recentChatItemSelected
      ]}
      onPress={() => toggleFriendSelection(item.user.id)}
    >
      <Image
        source={{ uri: item.user.profilePicture || 'https://via.placeholder.com/50' }}
        style={styles.recentChatAvatar}
      />
      <Text style={styles.recentChatName} numberOfLines={1}>
        {item.user.displayName?.split(' ')[0] || item.user.username}
      </Text>
      {selectedFriends.has(item.user.id) && (
        <View style={styles.recentChatSelected}>
          <Icon name="check-circle" size={20} color="#1DA1F2" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <LinearGradient
            colors={['#1DA1F2', '#1991DB']}
            style={styles.header}
          >
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Share Reel</Text>
            <TouchableOpacity 
              onPress={sendReelToFriends}
              disabled={selectedFriends.size === 0 || sending}
              style={[
                styles.sendButton,
                (selectedFriends.size === 0 || sending) && styles.sendButtonDisabled
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendButtonText}>
                  Send {selectedFriends.size > 0 ? `(${selectedFriends.size})` : ''}
                </Text>
              )}
            </TouchableOpacity>
          </LinearGradient>

          {/* Reel Preview */}
          {reel && (
            <View style={styles.reelPreview}>
              <Image
                source={{ uri: reel.thumbnailUrl }}
                style={styles.reelThumbnail}
              />
              <View style={styles.reelInfo}>
                <Text style={styles.reelCaption} numberOfLines={2}>
                  {reel.caption || 'Amazing reel!'}
                </Text>
                <Text style={styles.reelUser}>
                  By @{reel.user?.username || 'user'}
                </Text>
              </View>
            </View>
          )}

          {/* Search */}
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#666"
            />
          </View>

          {/* Recent Chats */}
          {recentChats.length > 0 && (
            <View style={styles.recentChatsSection}>
              <Text style={styles.sectionTitle}>Recent</Text>
              <FlatList
                data={recentChats}
                renderItem={renderRecentChatItem}
                keyExtractor={(item) => `recent-${item.user.id}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentChatsList}
              />
            </View>
          )}

          {/* Friends List */}
          <View style={styles.friendsSection}>
            <Text style={styles.sectionTitle}>
              All Friends {searchQuery && `(Search: ${searchQuery})`}
            </Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1DA1F2" />
                <Text style={styles.loadingText}>Loading friends...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredFriends}
                renderItem={renderFriendItem}
                keyExtractor={(item) => item.user.id}
                showsVerticalScrollIndicator={false}
                style={styles.friendsList}
                ListEmptyComponent={() => (
                  <View style={styles.emptyContainer}>
                    <Icon name="people-outline" size={48} color="#ccc" />
                    <Text style={styles.emptyText}>
                      {searchQuery ? 'No friends found' : 'No friends yet'}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  sendButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reelPreview: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  reelThumbnail: {
    width: 60,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  reelInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  reelCaption: {
    fontSize: 14,
    color: '#000',
    marginBottom: 4,
  },
  reelUser: {
    fontSize: 12,
    color: '#666',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    color: '#000',
  },
  recentChatsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  recentChatsList: {
    paddingHorizontal: 16,
  },
  recentChatItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  recentChatItemSelected: {
    opacity: 0.8,
  },
  recentChatAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 6,
  },
  recentChatName: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
  },
  recentChatSelected: {
    position: 'absolute',
    top: -2,
    right: 8,
  },
  friendsSection: {
    flex: 1,
  },
  friendsList: {
    flex: 1,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  friendItemSelected: {
    backgroundColor: '#f8f9ff',
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  friendUsername: {
    fontSize: 14,
    color: '#666',
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionIndicatorSelected: {
    backgroundColor: '#1DA1F2',
    borderColor: '#1DA1F2',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
});

export default ShareReelModal;
