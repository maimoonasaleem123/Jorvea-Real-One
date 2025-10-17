import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  Alert,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Share as RNShare,
  Clipboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService from '../services/firebaseService';
import { BeautifulCard } from './BeautifulCard';
import { User } from '../types';

interface ShareContentModalProps {
  visible: boolean;
  onClose: () => void;
  content: {
    type: 'post' | 'reel' | 'story';
    id: string;
    url?: string;
    text?: string;
    title?: string;
    mediaUrl?: string;
    userName?: string;
    userProfilePicture?: string;
  };
  onSave?: () => void;
}

interface Friend extends User {
  isSelected?: boolean;
}

export const InstagramShareModal: React.FC<ShareContentModalProps> = ({
  visible,
  onClose,
  content,
  onSave,
}) => {
  const { colors, isDarkMode } = useTheme();
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<Friend[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (visible && user) {
      loadFriends();
      checkIfSaved();
    }
  }, [visible, user]);

  const loadFriends = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      // Get user's followers and following
      const [followers, following] = await Promise.all([
        FirebaseService.getFollowers(user.uid),
        FirebaseService.getFollowing(user.uid)
      ]);
      
      // Combine and deduplicate
      const allConnections = [...followers, ...following];
      const uniqueFriends = allConnections.filter((friend, index, self) => 
        self.findIndex(f => f.uid === friend.uid) === index
      );
      
      setFriends(uniqueFriends);
    } catch (error) {
      console.error('Error loading friends:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkIfSaved = async () => {
    if (!user) return;
    
    try {
      const savedItems = await FirebaseService.getUserSavedItems(user.uid);
      const isSaved = savedItems.some(item => item.id === content.id);
      setSaved(isSaved);
    } catch (error) {
      console.error('Error checking saved status:', error);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    try {
      if (saved) {
        await FirebaseService.unsaveContent(user.uid, content.id);
        setSaved(false);
        Alert.alert('Removed', 'Content removed from saved items');
      } else {
        await FirebaseService.saveContent(user.uid, {
          id: content.id,
          type: content.type,
          url: content.url,
          mediaUrl: content.mediaUrl,
          title: content.title,
          text: content.text,
          userName: content.userName,
          userProfilePicture: content.userProfilePicture,
          savedAt: new Date().toISOString(),
        });
        setSaved(true);
        Alert.alert('Saved', 'Content saved to your collection');
      }
      onSave?.();
    } catch (error) {
      console.error('Error saving content:', error);
      Alert.alert('Error', 'Failed to save content');
    }
  };

  const handleCopyLink = () => {
    const link = content.url || `https://jorvea.app/${content.type}s/${content.id}`;
    Clipboard.setString(link);
    Alert.alert('Link Copied', 'Link copied to clipboard!');
  };

  const handleNativeShare = async () => {
    try {
      await RNShare.share({
        title: content.title || `Amazing ${content.type} on Jorvea`,
        message: content.text || `Check out this ${content.type} by ${content.userName || 'someone'} on Jorvea!`,
        url: content.url || content.mediaUrl,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const toggleFriendSelection = (friend: Friend) => {
    setSelectedFriends(prev => {
      const isSelected = prev.some(f => f.uid === friend.uid);
      if (isSelected) {
        return prev.filter(f => f.uid !== friend.uid);
      } else {
        return [...prev, friend];
      }
    });
  };

  const sendToSelectedFriends = async () => {
    if (selectedFriends.length === 0) {
      Alert.alert('No Friends Selected', 'Please select at least one friend to send to.');
      return;
    }

    try {
      setLoading(true);
      
      // Create share message
      const message = shareMessage || `Check out this ${content.type} ${content.userName ? `by @${content.userName}` : ''}!`;
      
      // Send to each selected friend
      const sendPromises = selectedFriends.map(friend => {
        const messageData = {
          type: 'shared_content',
          content: {
            type: content.type || 'reel',
            id: content.id || '',
            url: content.url || content.mediaUrl || '',
            text: content.text || '',
            title: content.title || '',
            mediaUrl: content.mediaUrl || content.url || '',
            userName: content.userName || '',
            userProfilePicture: content.userProfilePicture || '',
            sharedBy: user!.displayName || user!.email || 'Unknown User',
            sharedMessage: message || '',
          },
          message: message || '',
          senderName: user!.displayName || user!.email || 'Unknown User',
          senderAvatar: user!.profilePicture || user!.photoURL || '',
        };
        
        // Remove any undefined values
        Object.keys(messageData).forEach(key => {
          if (messageData[key] === undefined) {
            messageData[key] = '';
          }
        });
        
        Object.keys(messageData.content).forEach(key => {
          if (messageData.content[key] === undefined) {
            messageData.content[key] = '';
          }
        });
        
        return FirebaseService.sendDirectMessage(user!.uid, friend.uid, messageData);
      });
      
      await Promise.all(sendPromises);
      
      Alert.alert(
        'Sent Successfully!', 
        `${content.type} shared with ${selectedFriends.length} friend${selectedFriends.length > 1 ? 's' : ''}`
      );
      
      // Reset selections
      setSelectedFriends([]);
      setShareMessage('');
      onClose();
    } catch (error) {
      console.error('Error sending to friends:', error);
      Alert.alert('Error', 'Failed to send to friends. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    friend.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderQuickAction = (icon: string, label: string, onPress: () => void, color: string) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <LinearGradient
        colors={[color, `${color}80`]}
        style={styles.quickActionIcon}
      >
        <Icon name={icon} size={24} color="#fff" />
      </LinearGradient>
      <Text style={[styles.quickActionText, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderFriend = ({ item }: { item: Friend }) => {
    const isSelected = selectedFriends.some(f => f.uid === item.uid);
    
    return (
      <TouchableOpacity
        style={[
          styles.friendItem,
          { backgroundColor: colors.card },
          isSelected && { backgroundColor: colors.primary + '20' }
        ]}
        onPress={() => toggleFriendSelection(item)}
      >
        <View style={styles.friendInfo}>
          {item.profilePicture || item.photoURL ? (
            <Image
              source={{ uri: item.profilePicture || item.photoURL }}
              style={styles.friendAvatar}
            />
          ) : (
            <View style={[styles.friendAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.friendAvatarText}>
                {(item.displayName || item.username || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.friendDetails}>
            <Text style={[styles.friendName, { color: colors.text }]}>
              {item.displayName || item.username}
            </Text>
            {item.username && item.displayName && (
              <Text style={[styles.friendUsername, { color: colors.textSecondary }]}>
                @{item.username}
              </Text>
            )}
          </View>
        </View>
        <View style={[
          styles.selectionCircle,
          { borderColor: colors.border },
          isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
        ]}>
          {isSelected && <Icon name="checkmark" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Share</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {renderQuickAction(
            saved ? 'bookmark' : 'bookmark-outline',
            saved ? 'Saved' : 'Save',
            handleSave,
            colors.primary
          )}
          {renderQuickAction('copy-outline', 'Copy Link', handleCopyLink, colors.secondary)}
          {renderQuickAction('share-outline', 'Share', handleNativeShare, colors.accent)}
        </View>

        {/* Send to Friends Section */}
        <View style={styles.sendSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Send to Friends</Text>
          
          {/* Search */}
          <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
            <Icon name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search friends..."
              placeholderTextColor={colors.textSecondary}
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
          </View>

          {/* Selected Friends */}
          {selectedFriends.length > 0 && (
            <View style={styles.selectedFriends}>
              <FlatList
                horizontal
                data={selectedFriends}
                keyExtractor={(item) => item.uid}
                renderItem={({ item }) => (
                  <View style={styles.selectedFriendItem}>
                    {item.profilePicture || item.photoURL ? (
                      <Image
                        source={{ uri: item.profilePicture || item.photoURL }}
                        style={styles.selectedFriendAvatar}
                      />
                    ) : (
                      <View style={[styles.selectedFriendAvatar, { backgroundColor: colors.primary }]}>
                        <Text style={styles.selectedFriendAvatarText}>
                          {(item.displayName || item.username || 'U')[0].toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.removeSelectedFriend}
                      onPress={() => toggleFriendSelection(item)}
                    >
                      <Icon name="close-circle" size={20} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                )}
                showsHorizontalScrollIndicator={false}
              />
            </View>
          )}

          {/* Share Message */}
          {selectedFriends.length > 0 && (
            <TextInput
              style={[styles.messageInput, { backgroundColor: colors.card, color: colors.text }]}
              placeholder="Add a message..."
              placeholderTextColor={colors.textSecondary}
              value={shareMessage}
              onChangeText={setShareMessage}
              multiline
              maxLength={500}
            />
          )}
        </View>

        {/* Friends List */}
        <FlatList
          data={filteredFriends}
          keyExtractor={(item) => item.uid}
          renderItem={renderFriend}
          style={styles.friendsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="people-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                {loading ? 'Loading friends...' : 'No friends found'}
              </Text>
            </View>
          }
        />

        {/* Send Button */}
        {selectedFriends.length > 0 && (
          <View style={[styles.sendButtonContainer, { backgroundColor: colors.background }]}>
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: colors.primary }]}
              onPress={sendToSelectedFriends}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Icon name="send" size={20} color="#fff" />
                  <Text style={styles.sendButtonText}>
                    Send to {selectedFriends.length} friend{selectedFriends.length > 1 ? 's' : ''}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </Modal>
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
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  quickAction: {
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sendSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  selectedFriends: {
    marginBottom: 12,
  },
  selectedFriendItem: {
    marginRight: 12,
    alignItems: 'center',
    position: 'relative',
  },
  selectedFriendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedFriendAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  removeSelectedFriend: {
    position: 'absolute',
    top: -5,
    right: -5,
  },
  messageInput: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 80,
  },
  friendsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  friendAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  friendAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
  },
  friendUsername: {
    fontSize: 14,
    marginTop: 2,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    marginTop: 12,
  },
  sendButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default InstagramShareModal;
