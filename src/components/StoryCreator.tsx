import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Text,
  TextInput,
  SafeAreaView,
  StatusBar,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import Video from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary, MediaType, ImagePickerResponse } from 'react-native-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService from '../services/firebaseService';

const { width, height } = Dimensions.get('window');

interface StoryCreatorProps {
  visible: boolean;
  onClose: () => void;
  onStoryCreated?: () => void;
}

interface CapturedMedia {
  uri: string;
  type: 'image' | 'video';
  duration?: number;
}

const StoryCreator: React.FC<StoryCreatorProps> = ({
  visible,
  onClose,
  onStoryCreated,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setCapturedMedia(null);
      setCaption('');
      setIsUploading(false);
    }
  }, [visible]);

  // Gallery selection with proper media handling
  const selectFromGallery = useCallback(() => {
    const options = {
      mediaType: 'mixed' as MediaType,
      quality: 0.9,
      videoQuality: 'high' as const,
      includeBase64: false,
      maxWidth: 1920,
      maxHeight: 1920,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }
      
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const isVideo = asset.type?.startsWith('video') || asset.fileName?.includes('.mp4') || asset.fileName?.includes('.mov');
        
        setCapturedMedia({
          uri: asset.uri!,
          type: isVideo ? 'video' : 'image',
          duration: asset.duration,
        });
      }
    });
  }, []);

  // Upload story with proper error handling
  const uploadStory = useCallback(async () => {
    if (!capturedMedia || !user) {
      Alert.alert('Error', 'Please select media and ensure you are logged in');
      return;
    }

    if (!capturedMedia.uri) {
      Alert.alert('Error', 'Invalid media selected');
      return;
    }

    setIsUploading(true);
    
    try {
      console.log('Creating story with:', {
        mediaUri: capturedMedia.uri,
        mediaType: capturedMedia.type === 'image' ? 'photo' : 'video',
        caption: caption.trim(),
        userId: user.uid,
      });

      const storyId = await FirebaseService.createStory({
        mediaUri: capturedMedia.uri,
        mediaType: capturedMedia.type === 'image' ? 'photo' : 'video',
        caption: caption.trim() || undefined,
        userId: user.uid,
        duration: capturedMedia.duration,
      });

      console.log('Story created successfully with ID:', storyId);

      Alert.alert('Success', 'Your story has been shared!', [
        {
          text: 'OK',
          onPress: () => {
            onStoryCreated?.();
            onClose();
          },
        },
      ]);
    } catch (error) {
      console.error('Error uploading story:', error);
      Alert.alert(
        'Upload Failed', 
        'Unable to share your story. Please check your connection and try again.',
        [
          { text: 'Retry', onPress: uploadStory },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setIsUploading(false);
    }
  }, [capturedMedia, caption, user, onStoryCreated, onClose]);

  // Render captured media preview
  const renderPreview = () => {
    if (!capturedMedia) return null;

    return (
      <View style={styles.previewContainer}>
        {capturedMedia.type === 'video' ? (
          <Video
            source={{ uri: capturedMedia.uri }}
            style={styles.previewMedia}
            resizeMode="cover"
            repeat
            paused={false}
            muted
            onError={(error) => {
              console.error('Video preview error:', error);
              Alert.alert('Error', 'Unable to preview video');
            }}
          />
        ) : (
          <Image
            source={{ uri: capturedMedia.uri }}
            style={styles.previewMedia}
            resizeMode="cover"
            onError={() => {
              Alert.alert('Error', 'Unable to preview image');
            }}
          />
        )}
        
        {/* Preview overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.previewOverlay}
        />
        
        {/* Media type indicator */}
        {capturedMedia.type === 'video' && (
          <View style={styles.mediaTypeIndicator}>
            <Icon name="videocam" size={16} color="#FFFFFF" />
            <Text style={styles.mediaTypeText}>Video</Text>
          </View>
        )}
        
        {/* Caption input */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.captionContainer}
        >
          <TextInput
            style={styles.captionInput}
            placeholder="Share what's on your mind..."
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={200}
            returnKeyType="done"
            blurOnSubmit
          />
          <Text style={styles.captionCounter}>
            {caption.length}/200
          </Text>
        </KeyboardAvoidingView>
        
        {/* Preview controls */}
        <View style={styles.previewControls}>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={() => setCapturedMedia(null)}
            disabled={isUploading}
          >
            <Icon name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.shareButton, isUploading && styles.shareButtonDisabled]}
            onPress={uploadStory}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Icon name="send" size={20} color="#FFFFFF" />
                <Text style={styles.shareButtonText}>Share Story</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render gallery selection view
  const renderGallerySelection = () => (
    <View style={styles.galleryContainer}>
      <View style={styles.galleryOverlay}>
        {/* Top controls */}
        <View style={styles.topControls}>
          <TouchableOpacity style={styles.controlButton} onPress={onClose}>
            <Icon name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={styles.titleText}>Create Story</Text>
          
          <View style={styles.placeholder} />
        </View>

        {/* Gallery selection button */}
        <View style={styles.selectionContainer}>
          <TouchableOpacity style={styles.gallerySelectButton} onPress={selectFromGallery}>
            <Icon name="images" size={48} color="#FFFFFF" />
            <Text style={styles.gallerySelectText}>Select from Gallery</Text>
            <Text style={styles.gallerySelectSubtext}>Choose photo or video</Text>
          </TouchableOpacity>
        </View>
        
        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionText}>Select a photo or video from your gallery to create a story</Text>
        </View>
      </View>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.container}>
        {capturedMedia ? renderPreview() : renderGallerySelection()}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  galleryContainer: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: StatusBar.currentHeight || 44,
    paddingBottom: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 30,
  },
  iconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  subText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  selectButton: {
    marginBottom: 30,
  },
  selectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  selectButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  featuresList: {
    alignItems: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginLeft: 8,
  },
  previewContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  previewMedia: {
    width: width,
    height: height,
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 250,
  },
  mediaTypeIndicator: {
    position: 'absolute',
    top: StatusBar.currentHeight + 20 || 64,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mediaTypeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
  },
  captionInput: {
    color: '#FFFFFF',
    fontSize: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 25,
    minHeight: 50,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  captionCounter: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  previewControls: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  shareButtonDisabled: {
    backgroundColor: 'rgba(0,122,255,0.5)',
  },
  shareButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default StoryCreator;
