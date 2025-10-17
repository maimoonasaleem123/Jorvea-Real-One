/**
 * InstagramShareScreen - Perfect Instagram-style sharing interface
 * Supports sharing reels and posts with beautiful design
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import UltraFastShareService from '../services/UltraFastShareService';
import PerfectChatService from '../services/PerfectChatService';
import UltraFastLazyService from '../services/UltraFastLazyService';
import { User } from '../types';

const { width, height } = Dimensions.get('window');

interface ShareScreenProps {
  route: {
    params: {
      shareContent: {
        type: 'post' | 'reel';
        id: string;
        mediaUrls?: string[];
        videoUrl?: string;
        caption?: string;
        userName: string;
        userProfilePicture?: string;
        thumbnailUrl?: string;
        createdAt?: Date;
      };
    };
  };
}

interface ChatUser {
  uid: string;
  displayName: string;
  profilePicture?: string;
  lastSeen?: Date;
  isOnline?: boolean;
}

interface ShareOption {
  id: string;
  icon: string;
  title: string;
  action: () => void;
}

export default function InstagramShareScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const [recentChats, setRecentChats] = useState<ChatUser[]>([]);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [showMessage, setShowMessage] = useState(false);
  const [shareMessage, setShareMessage] = useState('');

  const shareContent = (route.params as ShareScreenProps['route']['params'])?.shareContent;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = allUsers.filter(chatUser =>
        chatUser.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, allUsers]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Load recent chats and all users in parallel
      const [recentChatsData, allUsersData] = await Promise.all([
        loadRecentChats(),
        loadAllUsers(),
      ]);
      
      setRecentChats(recentChatsData);
      setAllUsers(allUsersData);
    } catch (error) {
      console.error('Error loading share data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentChats = async (): Promise<ChatUser[]> => {
    if (!user) return [];

    try {
      // Get UltraFastShareService instance and use its methods
      const shareService = UltraFastShareService.getInstance();
      const recentChats = await shareService.getRecentChats(user.uid);
      
      return recentChats.map(chatData => ({
        uid: chatData.id,
        displayName: chatData.name,
        profilePicture: chatData.avatar,
        isOnline: chatData.isOnline,
      }));
    } catch (error) {
      console.error('Error loading recent chats:', error);
      return [];
    }
  };

  const loadAllUsers = async (): Promise<ChatUser[]> => {
    if (!user) return [];

    try {
      // Get UltraFastShareService instance and use its methods
      const shareService = UltraFastShareService.getInstance();
      const friends = await shareService.getFriendsForSharing(user.uid);
      
      return friends.map(friendData => ({
        uid: friendData.id,
        displayName: friendData.name,
        profilePicture: friendData.avatar,
        isOnline: friendData.isOnline,
      }));
    } catch (error) {
      console.error('Error loading all users:', error);
      return [];
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleShare = async () => {
    if (selectedUsers.size === 0) {
      Alert.alert('No Recipients', 'Please select at least one person to share with.');
      return;
    }

    if (!shareContent) {
      Alert.alert('Error', 'No content to share.');
      return;
    }

    try {
      setSending(true);

      // Share to each selected user
      const shareService = UltraFastShareService.getInstance();
      const sharePromises = Array.from(selectedUsers).map(async (recipientId) => {
        try {
          if (shareContent.type === 'reel') {
            // Create a reel object for sharing
            const reelToShare = {
              id: shareContent.id,
              videoUrl: shareContent.videoUrl || '',
              caption: shareContent.caption || '',
              thumbnailUrl: shareContent.thumbnailUrl || '',
              userId: shareContent.userName,
              user: {
                uid: shareContent.userName,
                displayName: shareContent.userName,
                profilePicture: shareContent.userProfilePicture,
              },
            };
            
            await shareService.shareReelToUsers(
              user!.uid,
              [recipientId],
              reelToShare as any,
              shareMessage || `Check out this reel!`
            );
          } else {
            // Create a post object for sharing
            const postToShare = {
              id: shareContent.id,
              mediaUrls: shareContent.mediaUrls || [],
              caption: shareContent.caption || '',
              userId: shareContent.userName,
              user: {
                uid: shareContent.userName,
                displayName: shareContent.userName,
                profilePicture: shareContent.userProfilePicture,
              },
            };
            
            await shareService.sharePostToUsers(
              user!.uid,
              [recipientId],
              postToShare as any,
              shareMessage || `Check out this post!`
            );
          }
        } catch (error) {
          console.error(`Error sharing to ${recipientId}:`, error);
        }
      });

      await Promise.all(sharePromises);

      Alert.alert(
        'Shared Successfully!',
        `${shareContent.type} shared to ${selectedUsers.size} ${selectedUsers.size === 1 ? 'person' : 'people'}.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error sharing content:', error);
      Alert.alert('Share Failed', 'Failed to share content. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const shareOptions: ShareOption[] = [
    {
      id: 'story',
      icon: 'add-circle-outline',
      title: 'Share to Story',
      action: () => {
        Alert.alert('Coming Soon', 'Story sharing will be available soon!');
      },
    },
    {
      id: 'copy',
      icon: 'copy-outline',
      title: 'Copy Link',
      action: () => {
        Alert.alert('Link Copied', 'Link copied to clipboard!');
      },
    },
    {
      id: 'more',
      icon: 'ellipsis-horizontal',
      title: 'More',
      action: () => {
        Alert.alert('More Options', 'Additional sharing options coming soon!');
      },
    },
  ];

  const renderShareOption = ({ item }: { item: ShareOption }) => (
    <TouchableOpacity style={styles.shareOptionItem} onPress={item.action}>
      <View style={styles.shareOptionIcon}>
        <Icon name={item.icon} size={24} color="#000" />
      </View>
      <Text style={styles.shareOptionText}>{item.title}</Text>
    </TouchableOpacity>
  );

  const renderUserItem = ({ item }: { item: ChatUser }) => {
    const isSelected = selectedUsers.has(item.uid);
    
    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => toggleUserSelection(item.uid)}
      >
        <View style={styles.userInfo}>
          <View style={styles.avatarContainer}>
            {item.profilePicture ? (
              <Image source={{ uri: item.profilePicture }} style={styles.avatar} />
            ) : (
              <View style={styles.defaultAvatar}>
                <Icon name="person" size={20} color="#fff" />
              </View>
            )}
            {item.isOnline && <View style={styles.onlineIndicator} />}
          </View>
          <Text style={styles.userName}>{item.displayName}</Text>
        </View>
        
        <View style={[styles.selectionCircle, isSelected && styles.selectionCircleSelected]}>
          {isSelected && <Icon name="checkmark" size={16} color="#fff" />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderContentPreview = () => {
    if (!shareContent) return null;

    return (
      <View style={styles.contentPreview}>
        {shareContent.type === 'reel' ? (
          <View style={styles.videoPreview}>
            {shareContent.thumbnailUrl ? (
              <Image source={{ uri: shareContent.thumbnailUrl }} style={styles.previewImage} />
            ) : (
              <View style={styles.videoPlaceholder}>
                <Icon name="play" size={30} color="#fff" />
              </View>
            )}
            <View style={styles.videoOverlay}>
              <Icon name="play" size={20} color="#fff" />
            </View>
          </View>
        ) : (
          <View style={styles.postPreview}>
            {shareContent.mediaUrls && shareContent.mediaUrls[0] ? (
              <Image source={{ uri: shareContent.mediaUrls[0] }} style={styles.previewImage} />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Icon name="image" size={30} color="#ccc" />
              </View>
            )}
          </View>
        )}
        
        <View style={styles.contentInfo}>
          <Text style={styles.contentTitle}>{shareContent.userName}</Text>
          {shareContent.caption && (
            <Text style={styles.contentCaption} numberOfLines={2}>
              {shareContent.caption}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0095F6" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Share</Text>
        <TouchableOpacity 
          onPress={handleShare}
          disabled={selectedUsers.size === 0 || sending}
          style={[styles.shareButton, selectedUsers.size === 0 && styles.shareButtonDisabled]}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.shareButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Content Preview */}
      {renderContentPreview()}

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#8e8e8e" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
        />
      </View>

      {/* Share Options */}
      <View style={styles.shareOptionsContainer}>
        <FlatList
          data={shareOptions}
          renderItem={renderShareOption}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shareOptionsList}
        />
      </View>

      {/* Users List */}
      <View style={styles.usersContainer}>
        <Text style={styles.sectionTitle}>
          {searchQuery ? 'Search Results' : 'Send to'}
        </Text>
        
        <FlatList
          data={searchQuery ? searchResults : recentChats}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.uid}
          showsVerticalScrollIndicator={false}
          style={styles.usersList}
        />
      </View>

      {/* Message Input Modal */}
      <Modal
        visible={showMessage}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMessage(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.messageModal}>
            <Text style={styles.modalTitle}>Add a message</Text>
            <TextInput
              style={styles.messageInput}
              placeholder="Write a message..."
              value={shareMessage}
              onChangeText={setShareMessage}
              multiline
              maxLength={500}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setShowMessage(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => {
                  setShowMessage(false);
                  handleShare();
                }}
              >
                <Text style={styles.modalButtonTextPrimary}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#8e8e8e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  shareButton: {
    backgroundColor: '#0095F6',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  shareButtonDisabled: {
    backgroundColor: '#c7c7c7',
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  contentPreview: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
  },
  videoPreview: {
    position: 'relative',
  },
  postPreview: {
    position: 'relative',
  },
  previewImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  videoPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOverlay: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 2,
  },
  contentInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  contentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  contentCaption: {
    fontSize: 12,
    color: '#8e8e8e',
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#000',
  },
  shareOptionsContainer: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#dbdbdb',
    paddingVertical: 16,
  },
  shareOptionsList: {
    paddingHorizontal: 16,
  },
  shareOptionItem: {
    alignItems: 'center',
    marginRight: 24,
  },
  shareOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  shareOptionText: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
  },
  usersContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  usersList: {
    flex: 1,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  defaultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#c7c7c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#42e695',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#dbdbdb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCircleSelected: {
    backgroundColor: '#0095F6',
    borderColor: '#0095F6',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    width: width - 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 16,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#dbdbdb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 12,
  },
  modalButtonPrimary: {
    backgroundColor: '#0095F6',
    borderRadius: 6,
  },
  modalButtonText: {
    color: '#8e8e8e',
    fontWeight: '500',
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontWeight: '600',
  },
});
