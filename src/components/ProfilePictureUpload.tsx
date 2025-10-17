import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { imageUploadService, ImageUploadOptions } from '../services/imageUploadService';

interface ProfilePictureUploadProps {
  userId: string;
  currentProfilePicture?: string;
  size?: number;
  onUploadComplete?: (imageUrl: string) => void;
  onUploadError?: (error: string) => void;
  storage?: 'digitalocean' | 'base64';
}

const ProfilePictureUpload: React.FC<ProfilePictureUploadProps> = ({
  userId,
  currentProfilePicture,
  size = 120,
  onUploadComplete,
  onUploadError,
  storage = 'digitalocean',
}) => {
  const [uploading, setUploading] = useState(false);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);

  const handleUploadProfilePicture = async () => {
    try {
      setUploading(true);

      const options: ImageUploadOptions = {
        storage,
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.8,
        cropping: true,
        folder: 'profile-pictures',
      };

      const result = await imageUploadService.uploadProfilePicture(userId, options);
      
      // Update local state immediately for better UX
      setLocalImageUri(result.uri);
      
      // Notify parent component
      const finalUrl = result.url || result.base64 || result.uri;
      onUploadComplete?.(finalUrl);

      Alert.alert('Success', 'Profile picture updated successfully!');
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      const errorMessage = error.message || 'Failed to upload profile picture';
      onUploadError?.(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveProfilePicture = () => {
    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setUploading(true);
              await imageUploadService.deleteProfilePicture(userId);
              setLocalImageUri(null);
              onUploadComplete?.('');
              Alert.alert('Success', 'Profile picture removed successfully!');
            } catch (error: any) {
              console.error('Error removing profile picture:', error);
              Alert.alert('Error', 'Failed to remove profile picture');
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  const displayImage = localImageUri || currentProfilePicture;

  return (
    <View style={styles.container}>
      <View style={[styles.imageContainer, { width: size, height: size }]}>
        {displayImage ? (
          <Image
            source={{ uri: displayImage }}
            style={[styles.profileImage, { width: size, height: size }]}
          />
        ) : (
          <View style={[styles.placeholderImage, { width: size, height: size }]}>
            <Icon name="person" size={size * 0.4} color="#999" />
          </View>
        )}
        
        {uploading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        )}
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handleUploadProfilePicture}
          disabled={uploading}
        >
          <Icon name="camera-alt" size={20} color="#007AFF" />
          <Text style={styles.uploadButtonText}>
            {displayImage ? 'Change Photo' : 'Add Photo'}
          </Text>
        </TouchableOpacity>

        {displayImage && (
          <TouchableOpacity
            style={styles.removeButton}
            onPress={handleRemoveProfilePicture}
            disabled={uploading}
          >
            <Icon name="delete" size={20} color="#FF3B30" />
            <Text style={styles.removeButtonText}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.storageInfo}>
        Storage: {storage === 'digitalocean' ? 'DigitalOcean Spaces' : 'Base64 in Firestore'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profileImage: {
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#E0E0E0',
  },
  placeholderImage: {
    borderRadius: 60,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#E0E0E0',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 10,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
    gap: 5,
  },
  uploadButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F0',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF3B30',
    gap: 5,
  },
  removeButtonText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '500',
  },
  storageInfo: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 5,
  },
});

export default ProfilePictureUpload;
