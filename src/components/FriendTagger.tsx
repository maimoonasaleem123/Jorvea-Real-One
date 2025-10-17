
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { User } from '../types';
import FirebaseService from '../services/firebaseService';

interface FriendTaggerProps {
  visible: boolean;
  onClose: () => void;
  onFriendsTagged: (friends: User[]) => void;
  initialTaggedFriends?: User[];
}

export const FriendTagger: React.FC<FriendTaggerProps> = ({
  visible,
  onClose,
  onFriendsTagged,
  initialTaggedFriends = [],
}) => {
  const [taggedFriends, setTaggedFriends] = useState<User[]>(initialTaggedFriends);
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<User[]>([]);

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    try {
      const users = await FirebaseService.searchUsers('');
      // Convert FirebaseService.User to types.User
      const convertedUsers: User[] = users.map(user => ({
        uid: user.uid,
        email: user.email,
        username: user.username || '',
        displayName: user.displayName,
        profilePicture: user.profilePicture || user.photoURL,
        photoURL: user.profilePicture || user.photoURL,
        bio: user.bio,
        website: user.website,
        phoneNumber: user.phoneNumber,
        isPrivate: user.isPrivate || false,
        isVerified: user.isVerified || false,
        verified: user.isVerified || false,
        followers: [],
        following: [],
        blockedUsers: [],
        postsCount: user.postsCount || 0,
        storiesCount: 0,
        reelsCount: 0,
        createdAt: new Date(user.createdAt || Date.now()),
        lastActive: new Date(),
        settings: {
          notifications: {
            likes: true,
            comments: true,
            follows: true,
            messages: true,
            mentions: true,
            stories: true,
          },
          privacy: {
            isPrivate: user.isPrivate || false,
            showActivity: true,
            showOnlineStatus: true,
            allowMessages: 'everyone' as const,
          },
          theme: 'light' as const,
        },
      }));
      setFriends(convertedUsers);
    } catch (error) {
      console.error('Error loading friends:', error);
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTagFriend = (friend: User) => {
    if (!taggedFriends.find(tagged => tagged.uid === friend.uid)) {
      setTaggedFriends(prev => [...prev, friend]);
    }
  };

  const onRemoveTag = (friendId: string) => {
    setTaggedFriends(prev => prev.filter(friend => friend.uid !== friendId));
  };

  const handleDone = () => {
    onFriendsTagged(taggedFriends);
    onClose();
  };

  const renderFriendItem = ({ item }: { item: User }) => {
    const isTagged = taggedFriends.find(tagged => tagged.uid === item.uid);

    return (
      <TouchableOpacity
        style={[styles.friendItem, isTagged && styles.taggedFriendItem]}
        onPress={() => handleTagFriend(item)}
      >
        <Image source={{ uri: item.profilePicture || item.photoURL }} style={styles.friendAvatar} />
        <View style={styles.friendInfo}>
          <Text style={styles.friendName}>{item.displayName}</Text>
          <Text style={styles.friendUsername}>@{item.username}</Text>
        </View>
        {item.isVerified && (
          <Icon name="checkmark-circle" size={16} color="#007AFF" />
        )}
        {isTagged && (
          <Icon name="checkmark" size={20} color="#007AFF" style={styles.checkmark} />
        )}
      </TouchableOpacity>
    );
  };

  const renderTaggedFriend = ({ item }: { item: User }) => (
    <View style={styles.taggedFriend}>
      <Image source={{ uri: item.profilePicture || item.photoURL }} style={styles.taggedAvatar} />
      <Text style={styles.taggedName}>{item.displayName}</Text>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => onRemoveTag(item.uid)}
      >
        <Icon name="close" size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Tag Friends</Text>
          <TouchableOpacity onPress={handleDone} style={styles.doneButton}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {taggedFriends.length > 0 && (
          <View style={styles.taggedSection}>
            <Text style={styles.sectionTitle}>Tagged ({taggedFriends.length})</Text>
            <FlatList
              horizontal
              data={taggedFriends}
              renderItem={renderTaggedFriend}
              keyExtractor={(item) => item.uid}
              contentContainerStyle={styles.taggedList}
              showsHorizontalScrollIndicator={false}
            />
          </View>
        )}

        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Icon name="search" size={16} color="#8E8E93" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#8E8E93"
            />
          </View>
        </View>

        <FlatList
          data={filteredFriends}
          renderItem={renderFriendItem}
          keyExtractor={(item) => item.uid}
          style={styles.friendsList}
        />
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
    borderBottomColor: '#E5E5E7',
  },
  cancelButton: {
    minWidth: 60,
  },
  cancelText: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  doneButton: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  taggedSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E7',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  taggedList: {
    paddingHorizontal: 16,
  },
  taggedFriend: {
    alignItems: 'center',
    marginRight: 12,
  },
  taggedAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 4,
  },
  taggedName: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
    maxWidth: 60,
  },
  removeButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 36,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#000',
  },
  friendsList: {
    flex: 1,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  taggedFriendItem: {
    backgroundColor: '#F0F8FF',
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
  },
  friendUsername: {
    fontSize: 14,
    color: '#8E8E93',
  },
  checkmark: {
    marginLeft: 8,
  },
});

export default FriendTagger;
