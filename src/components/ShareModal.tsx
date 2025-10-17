import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Share,
  Alert,
  Clipboard,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Post, Reel } from '../services/firebaseService';
import { useAuth } from '../context/FastAuthContext';

interface ShareModalProps {
  visible: boolean;
  post?: Post;
  reel?: Reel;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  visible,
  post,
  reel,
  onClose,
}) => {
  const { user } = useAuth();
  const [sharing, setSharing] = useState(false);

  const content = post || reel;
  const contentType = post ? 'post' : 'reel';

  const getShareUrl = () => {
    // In a real app, this would be your actual deep link URL
    const baseUrl = 'https://jorvea.app';
    if (post) {
      return `${baseUrl}/post/${post.id}`;
    } else if (reel) {
      return `${baseUrl}/reel/${reel.id}`;
    }
    return baseUrl;
  };

  const shareOptions = [
    {
      id: 'external',
      title: 'Share to...',
      icon: 'share-outline',
      action: async () => {
        try {
          setSharing(true);
          const shareUrl = getShareUrl();
          const shareContent = {
            title: `Check out this ${contentType} on Jorvea!`,
            message: content?.caption 
              ? `"${content.caption}" - ${shareUrl}`
              : `Amazing ${contentType} on Jorvea! ${shareUrl}`,
            url: shareUrl,
          };
          
          await Share.share(shareContent);
        } catch (error) {
          console.error('Error sharing:', error);
        } finally {
          setSharing(false);
          onClose();
        }
      },
    },
    {
      id: 'copy-link',
      title: 'Copy Link',
      icon: 'link-outline',
      action: async () => {
        try {
          const shareUrl = getShareUrl();
          await Clipboard.setString(shareUrl);
          Alert.alert('Link Copied', 'Link has been copied to clipboard');
          onClose();
        } catch (error) {
          Alert.alert('Error', 'Failed to copy link');
        }
      },
    },
    {
      id: 'send-message',
      title: 'Send in Message',
      icon: 'paper-plane-outline',
      action: () => {
        Alert.alert('Send Message', 'Direct messaging feature coming soon!');
        onClose();
      },
    },
    {
      id: 'add-to-story',
      title: 'Add to Story',
      icon: 'add-circle-outline',
      action: () => {
        Alert.alert('Add to Story', 'Story sharing feature coming soon!');
        onClose();
      },
    },
    {
      id: 'report',
      title: 'Report',
      icon: 'flag-outline',
      destructive: true,
      action: () => {
        Alert.alert(
          'Report Content',
          `Are you sure you want to report this ${contentType}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Report',
              style: 'destructive',
              onPress: () => {
                Alert.alert('Reported', `This ${contentType} has been reported for review.`);
                onClose();
              },
            },
          ]
        );
      },
    },
  ];

  if (!content) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.modal}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        
        <View style={styles.container}>
          {/* Handle */}
          <View style={styles.handle} />
          
          {/* Content Preview */}
          <View style={styles.contentPreview}>
            <Image
              source={{ 
                uri: post?.mediaUrls?.[0] || reel?.thumbnailUrl || reel?.videoUrl || 'https://via.placeholder.com/60'
              }}
              style={styles.contentThumbnail}
              resizeMode="cover"
            />
            <View style={styles.contentInfo}>
              <Text style={styles.contentTitle} numberOfLines={1}>
                {content.caption || `${contentType.charAt(0).toUpperCase() + contentType.slice(1)} by ${content.user?.username || 'User'}`}
              </Text>
              <Text style={styles.contentSubtitle}>
                {content.user?.username || 'User'} • {contentType}
              </Text>
            </View>
          </View>

          {/* Share Options */}
          <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
            {shareOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.optionItem}
                onPress={option.action}
                disabled={sharing}
              >
                <View style={[
                  styles.optionIcon,
                  option.destructive && styles.destructiveIcon
                ]}>
                  <Icon 
                    name={option.icon} 
                    size={24} 
                    color={option.destructive ? '#FF3B30' : '#000'} 
                  />
                </View>
                <Text style={[
                  styles.optionText,
                  option.destructive && styles.destructiveText
                ]}>
                  {option.title}
                </Text>
                <Icon name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Cancel Button */}
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#ddd',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  contentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  contentThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  contentInfo: {
    flex: 1,
  },
  contentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  contentSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  optionsList: {
    maxHeight: 300,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  destructiveIcon: {
    backgroundColor: '#FFE5E5',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  destructiveText: {
    color: '#FF3B30',
  },
  cancelButton: {
    margin: 20,
    paddingVertical: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
});
