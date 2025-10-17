import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  TextInput,
  Alert,
  StatusBar,
} from 'react-native';
import { launchImageLibrary, MediaType } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { FriendTagger } from '../components/FriendTagger';
import { EnhancedStoryCamera } from '../components/EnhancedStoryCamera';
import { User, Story } from '../types';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService from '../services/firebaseService';
import DigitalOceanService from '../services/digitalOceanService';

const { width, height } = Dimensions.get('window');

export default function CreateStoryScreen(): React.JSX.Element {
  const { user } = useAuth();
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState('');
  const [showFriendTagger, setShowFriendTagger] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [taggedFriends, setTaggedFriends] = useState<User[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleSelectMedia = () => {
    setShowCamera(true);
  };

  const handleTagFriend = (friend: User) => {
    setTaggedFriends(prev => [...prev, friend]);
  };

  const handleRemoveTag = (friendId: string) => {
    setTaggedFriends(prev => prev.filter(friend => friend.uid !== friendId));
  };

  const handleShareStory = async () => {
    if (!selectedMedia) {
      Alert.alert('Error', 'Please select an image or video first');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to share a story');
      return;
    }

    setIsUploading(true);
    
    try {
      console.log('📤 Starting story upload...');
      
      // Determine file type
      const isVideo = selectedMedia.includes('.mp4') || selectedMedia.includes('.mov');
      const fileExtension = isVideo ? 'mp4' : 'jpg';
      const mimeType = isVideo ? 'video/mp4' : 'image/jpeg';
      
      // Upload media to Digital Ocean Spaces
      console.log('📁 Uploading story media...');
      const uploadedUrl = await DigitalOceanService.uploadMedia(
        selectedMedia,
        `stories/${Date.now()}_story.${fileExtension}`,
        mimeType
      );
      
      console.log('✅ Story media uploaded:', uploadedUrl);

      // Prepare story data for Firebase
      const storyData = {
        userId: user.uid,
        user: {
          uid: user.uid,
          username: user.username || user.displayName || '',
          displayName: user.displayName || '',
          photoURL: user.profilePicture || user.photoURL || '',
          email: user.email || '',
          isVerified: false,
          followers: [],
          following: [],
          blockedUsers: [],
          followersCount: 0,
          followingCount: 0,
          postsCount: 0,
          storiesCount: 0,
          reelsCount: 0,
          isPrivate: false,
          createdAt: new Date(),
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
              isPrivate: false,
              showActivity: true,
              showOnlineStatus: true,
              allowMessages: 'everyone' as const,
            },
            theme: 'light' as const,
          },
        },
        mediaUrl: uploadedUrl,
        mediaType: isVideo ? 'video' as const : 'image' as const,
        caption: caption.trim(),
        viewsCount: 0,
        viewers: [],
        isViewed: false,
      };

      console.log('💾 Saving story to Firebase...');
      const storyId = await FirebaseService.createStory(storyData);
      console.log('✅ Story created with ID:', storyId);
      
      Alert.alert('Success', 'Your story has been shared!', [
        {
          text: 'OK',
          onPress: () => {
            // Reset form
            setSelectedMedia(null);
            setCaption('');
            setTaggedFriends([]);
            console.log('Story shared successfully');
          },
        },
      ]);
    } catch (error) {
      console.error('❌ Error sharing story:', error);
      Alert.alert('Error', 'Failed to share story. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity>
          <Icon name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Story</Text>
        <TouchableOpacity
          style={[styles.shareButton, (!selectedMedia || isUploading) && styles.shareButtonDisabled]}
          onPress={handleShareStory}
          disabled={!selectedMedia || isUploading}
        >
          <Text style={[styles.shareButtonText, (!selectedMedia || isUploading) && styles.shareButtonTextDisabled]}>
            {isUploading ? 'Sharing...' : 'Share'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Media Preview */}
      <View style={styles.mediaContainer}>
        {selectedMedia ? (
          <Image source={{ uri: selectedMedia }} style={styles.mediaPreview} />
        ) : (
          <View style={styles.emptyMediaContainer}>
            <Icon name="add-photo-alternate" size={80} color="#666" />
            <Text style={styles.emptyMediaText}>Tap to add photo or video</Text>
          </View>
        )}
        
        {!selectedMedia && (
          <TouchableOpacity style={styles.selectMediaOverlay} onPress={handleSelectMedia}>
            <View style={styles.selectMediaButton}>
              <Icon name="add" size={30} color="#fff" />
            </View>
          </TouchableOpacity>
        )}

        {/* Tagged Friends Overlay */}
        {taggedFriends.length > 0 && selectedMedia && (
          <View style={styles.taggedFriendsOverlay}>
            {taggedFriends.map((friend, index) => (
              <View key={friend.uid} style={[styles.friendTag, { top: 100 + (index * 40) }]}>
                <Image source={{ uri: friend.profilePicture }} style={styles.friendTagAvatar} />
                <Text style={styles.friendTagName}>@{friend.username}</Text>
                <TouchableOpacity
                  style={styles.removeFriendTag}
                  onPress={() => handleRemoveTag(friend.uid)}
                >
                  <Icon name="close" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Tools */}
      {selectedMedia && (
        <View style={styles.toolsContainer}>
          <TouchableOpacity style={styles.toolButton} onPress={handleSelectMedia}>
            <Icon name="photo-library" size={24} color="#fff" />
            <Text style={styles.toolButtonText}>Gallery</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => setShowFriendTagger(true)}
          >
            <Icon name="person-add" size={24} color="#fff" />
            <Text style={styles.toolButtonText}>Tag Friends</Text>
            {taggedFriends.length > 0 && (
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>{taggedFriends.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.toolButton}>
            <Icon name="text-fields" size={24} color="#fff" />
            <Text style={styles.toolButtonText}>Text</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.toolButton}>
            <Icon name="music-note" size={24} color="#fff" />
            <Text style={styles.toolButtonText}>Music</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Caption Input */}
      {selectedMedia && (
        <View style={styles.captionContainer}>
          <TextInput
            style={styles.captionInput}
            placeholder="Add a caption..."
            placeholderTextColor="#888"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={150}
          />
          <Text style={styles.captionCounter}>{caption.length}/150</Text>
        </View>
      )}

      {/* Friend Tagger Modal */}
      <FriendTagger
        visible={showFriendTagger}
        onClose={() => setShowFriendTagger(false)}
        onFriendsTagged={(friends) => setTaggedFriends(friends)}
        initialTaggedFriends={taggedFriends}
      />

      {/* Enhanced Story Camera */}
      <EnhancedStoryCamera
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onMediaCaptured={(media) => {
          setSelectedMedia(media.uri);
          setMediaType(media.type);
          setShowCamera(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 44, // Safe area
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  shareButton: {
    backgroundColor: '#1DA1F2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  shareButtonDisabled: {
    backgroundColor: '#333',
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  shareButtonTextDisabled: {
    color: '#666',
  },
  mediaContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginVertical: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  emptyMediaContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  emptyMediaText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  selectMediaOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectMediaButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(29, 161, 242, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taggedFriendsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  friendTag: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  friendTagAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  friendTagName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  removeFriendTag: {
    marginLeft: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  toolButton: {
    alignItems: 'center',
    position: 'relative',
  },
  toolButtonText: {
    color: '#fff',
    fontSize: 10,
    marginTop: 4,
  },
  tagBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  captionInput: {
    color: '#fff',
    fontSize: 16,
    minHeight: 40,
    maxHeight: 100,
  },
  captionCounter: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
});
