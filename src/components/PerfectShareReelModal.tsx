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
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import IconIonic from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/FastAuthContext';
import { Reel } from '../services/firebaseService';
import UltraFastShareService, { ShareTarget } from '../services/UltraFastShareService';

const { width } = Dimensions.get('window');

interface ShareReelModalProps {
  visible: boolean;
  reel: Reel | null;
  onClose: () => void;
}

const PerfectShareReelModal: React.FC<ShareReelModalProps> = ({ visible, reel, onClose }) => {
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<ShareTarget[]>([]);
  const [recentChats, setRecentChats] = useState<ShareTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [customMessage, setCustomMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'recent' | 'friends'>('recent');

  // Load friends and recent chats with UltraFastShareService
  const loadShareTargets = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    setLoading(true);
    try {
      const ultraFastShareService = UltraFastShareService.getInstance();
      
      // Load both friends and recent chats in parallel
      const [friendsList, recentChatsList] = await Promise.all([
        ultraFastShareService.getFriendsForSharing(currentUser.uid),
        ultraFastShareService.getRecentChats(currentUser.uid)
      ]);

      setFriends(friendsList);
      setRecentChats(recentChatsList);
      
      console.log(`✅ Loaded ${friendsList.length} friends and ${recentChatsList.length} recent chats`);
    } catch (error) {
      console.error('Error loading share targets:', error);
      Alert.alert('Error', 'Failed to load friends list');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid]);

  // Toggle friend selection
  const toggleFriendSelection = useCallback((userId: string) => {
    setSelectedFriends(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      Vibration.vibrate(30); // Haptic feedback
      return newSet;
    });
  }, []);

  // Get current data source based on active tab
  const getCurrentData = useCallback(() => {
    const data = activeTab === 'recent' ? recentChats : friends;
    if (searchQuery.trim()) {
      return data.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return data;
  }, [activeTab, recentChats, friends, searchQuery]);

  // Send reel to selected friends
  const sendReel = useCallback(async () => {
    if (!reel || selectedFriends.size === 0 || !currentUser?.uid) return;

    setSending(true);
    try {
      const ultraFastShareService = UltraFastShareService.getInstance();
      const selectedUserIds = Array.from(selectedFriends);
      
      const success = await ultraFastShareService.shareReelToUsers(
        currentUser.uid,
        selectedUserIds,
        reel,
        customMessage || undefined
      );

      if (success) {
        Vibration.vibrate([50, 100, 50]); // Success haptic
        Alert.alert(
          'Reel Sent! 🎉',
          `Successfully sent reel to ${selectedFriends.size} friend${selectedFriends.size > 1 ? 's' : ''}`,
          [{ text: 'Awesome!', onPress: onClose }]
        );
      } else {
        Alert.alert('Partial Success', 'Reel was sent to some friends. Please try again for failed sends.');
      }
      
      setSelectedFriends(new Set());
      setCustomMessage('');
    } catch (error) {
      console.error('Error sending reel:', error);
      Alert.alert('Error', 'Failed to send reel. Please try again.');
    } finally {
      setSending(false);
    }
  }, [reel, selectedFriends, currentUser?.uid, customMessage, onClose]);

  // Load data when modal opens
  useEffect(() => {
    if (visible) {
      loadShareTargets();
      setSelectedFriends(new Set());
      setSearchQuery('');
      setCustomMessage('');
    }
  }, [visible, loadShareTargets]);

  // Render share target item
  const renderShareTarget = ({ item }: { item: ShareTarget }) => (
    <TouchableOpacity
      style={[
        styles.friendItem,
        selectedFriends.has(item.id) && styles.friendItemSelected
      ]}
      onPress={() => toggleFriendSelection(item.id)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.avatar || 'https://via.placeholder.com/50?text=👤' }}
        style={styles.friendAvatar}
      />
      <View style={styles.friendInfo}>
        <Text style={styles.friendName} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={styles.statusContainer}>
          {item.isOnline && <View style={styles.onlineIndicator} />}
          <Text style={styles.statusText}>
            {item.isOnline ? 'Online' : 'Last seen recently'}
          </Text>
        </View>
      </View>
      {selectedFriends.has(item.id) && (
        <View style={styles.selectedIcon}>
          <Icon name="check-circle" size={24} color="#4CAF50" />
        </View>
      )}
    </TouchableOpacity>
  );

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="people-outline" size={64} color="rgba(255,255,255,0.3)" />
      <Text style={styles.emptyStateText}>
        {activeTab === 'recent' ? 'No recent chats' : 'No friends found'}
      </Text>
      <Text style={styles.emptyStateSubtext}>
        {activeTab === 'recent' 
          ? 'Start chatting with friends to see them here'
          : 'Follow some users to share reels with them'
        }
      </Text>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Share Reel</Text>
            <TouchableOpacity 
              onPress={sendReel} 
              style={[styles.sendButton, selectedFriends.size === 0 && styles.sendButtonDisabled]}
              disabled={selectedFriends.size === 0 || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendButtonText}>
                  Send {selectedFriends.size > 0 && `(${selectedFriends.size})`}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Reel Preview */}
          {reel && (
            <View style={styles.reelPreview}>
              <Image source={{ uri: reel.thumbnailUrl }} style={styles.reelThumbnail} />
              <View style={styles.reelInfo}>
                <Text style={styles.reelCaption} numberOfLines={2}>
                  {reel.caption || 'Amazing reel!'}
                </Text>
                <Text style={styles.reelUsername}>
                  by @{reel.user?.username || 'user'}
                </Text>
              </View>
            </View>
          )}

          {/* Custom Message Input */}
          <View style={styles.messageInputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Add a message (optional)"
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={customMessage}
              onChangeText={setCustomMessage}
              multiline
              maxLength={200}
            />
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color="rgba(255,255,255,0.7)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'recent' && styles.activeTab]}
              onPress={() => setActiveTab('recent')}
            >
              <Icon name="history" size={20} color={activeTab === 'recent' ? '#fff' : 'rgba(255,255,255,0.6)'} />
              <Text style={[styles.tabText, activeTab === 'recent' && styles.activeTabText]}>
                Recent
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'friends' && styles.activeTab]}
              onPress={() => setActiveTab('friends')}
            >
              <Icon name="people" size={20} color={activeTab === 'friends' ? '#fff' : 'rgba(255,255,255,0.6)'} />
              <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>
                Friends
              </Text>
            </TouchableOpacity>
          </View>

          {/* Friends List */}
          <View style={styles.listContainer}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Loading friends...</Text>
              </View>
            ) : (
              <FlatList
                data={getCurrentData()}
                renderItem={renderShareTarget}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={renderEmptyState}
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
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  sendButton: {
    backgroundColor: '#ff3040',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255,48,64,0.5)',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  reelPreview: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
  },
  reelThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  reelInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  reelCaption: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  reelUsername: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  messageInputContainer: {
    marginHorizontal: 20,
    marginBottom: 10,
  },
  messageInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    maxHeight: 80,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
    marginBottom: 15,
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
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#ff3040',
  },
  tabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  activeTabText: {
    color: '#fff',
  },
  listContainer: {
    flex: 1,
    marginHorizontal: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 12,
    fontSize: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 2,
  },
  friendItemSelected: {
    backgroundColor: 'rgba(76,175,80,0.2)',
  },
  friendAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 12,
  },
  friendName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  statusText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  selectedIcon: {
    marginLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
  },
  emptyStateSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});

export default PerfectShareReelModal;
