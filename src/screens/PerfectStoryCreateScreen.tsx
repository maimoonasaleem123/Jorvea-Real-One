import React, { useState, useRef, useEffect } from 'react';
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
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Animated,
} from 'react-native';
import { 
  launchImageLibrary, 
  launchCamera, 
  MediaType, 
  ImagePickerResponse,
  PhotoQuality,
} from 'react-native-image-picker';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Video from 'react-native-video';
import { useAuth } from '../context/FastAuthContext';
import DigitalOceanService from '../services/digitalOceanService';
import FirebaseService from '../services/firebaseService';
import { User } from '../types';

const { width, height } = Dimensions.get('window');

interface StoryText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  fontFamily: string;
  rotation: number;
  scale: number;
}

interface StorySticker {
  id: string;
  emoji: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

interface SelectedMedia {
  uri: string;
  type: 'image' | 'video';
  duration?: number;
  width?: number;
  height?: number;
}

export default function PerfectStoryCreateScreen(): React.JSX.Element {
  const { user } = useAuth();
  
  // Media states
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Story elements
  const [storyTexts, setStoryTexts] = useState<StoryText[]>([]);
  const [storyStickers, setStoryStickers] = useState<StorySticker[]>([]);
  const [currentTextInput, setCurrentTextInput] = useState('');
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [selectedTextColor, setSelectedTextColor] = useState('#FFFFFF');
  
  // UI states
  const [showMediaPicker, setShowMediaPicker] = useState(true);
  const [showEditTools, setShowEditTools] = useState(false);
  
  // Animation refs
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const uploadProgressAnimation = useRef(new Animated.Value(0)).current;

  // Color palette for text
  const textColors = [
    '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'
  ];

  // Emoji stickers
  const emojiStickers = [
    '😀', '😍', '🥰', '😎', '🤩', '🔥', '💯', '❤️', '👍', '🎉',
    '🌟', '✨', '⚡', '🌈', '🎵', '📍', '🍕', '☕', '🎂', '🎮'
  ];

  useEffect(() => {
    if (!user) {
      Alert.alert('Error', 'Please login to create stories');
      return;
    }
  }, [user]);

  const animateScale = (callback?: () => void) => {
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  const pickFromGallery = () => {
    const options = {
      mediaType: 'mixed' as MediaType,
      quality: 0.9 as const,
      videoQuality: 'high' as const,
      maxWidth: 1080,
      maxHeight: 1920,
      includeBase64: false,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setSelectedMedia({
          uri: asset.uri!,
          type: asset.type?.startsWith('video') ? 'video' : 'image',
          duration: asset.duration,
          width: asset.width,
          height: asset.height,
        });
        setShowMediaPicker(false);
        setShowEditTools(true);
      }
    });
  };

  const takePhoto = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.9 as const,
      maxWidth: 1080,
      maxHeight: 1920,
      includeBase64: false,
    };

    launchCamera(options, (response: ImagePickerResponse) => {
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setSelectedMedia({
          uri: asset.uri!,
          type: 'image',
          width: asset.width,
          height: asset.height,
        });
        setShowMediaPicker(false);
        setShowEditTools(true);
      }
    });
  };

  const recordVideo = () => {
    const options = {
      mediaType: 'video' as MediaType,
      quality: 0.8 as PhotoQuality,
      videoQuality: 'high' as const,
      durationLimit: 60,
      includeBase64: false,
    };

    launchCamera(options, (response: ImagePickerResponse) => {
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setSelectedMedia({
          uri: asset.uri!,
          type: 'video',
          duration: asset.duration,
          width: asset.width,
          height: asset.height,
        });
        setShowMediaPicker(false);
        setShowEditTools(true);
      }
    });
  };

  const addText = () => {
    if (currentTextInput.trim()) {
      const newText: StoryText = {
        id: Date.now().toString(),
        text: currentTextInput,
        x: width / 2,
        y: height / 2,
        color: selectedTextColor,
        fontSize: 24,
        fontFamily: 'System',
        rotation: 0,
        scale: 1,
      };
      setStoryTexts(prev => [...prev, newText]);
      setCurrentTextInput('');
      setShowTextEditor(false);
    }
  };

  const addSticker = (emoji: string) => {
    const newSticker: StorySticker = {
      id: Date.now().toString(),
      emoji,
      x: width / 2,
      y: height / 2,
      scale: 1,
      rotation: 0,
    };
    setStoryStickers(prev => [...prev, newSticker]);
  };

  const removeText = (textId: string) => {
    setStoryTexts(prev => prev.filter(t => t.id !== textId));
  };

  const removeSticker = (stickerId: string) => {
    setStoryStickers(prev => prev.filter(s => s.id !== stickerId));
  };

  const publishStory = async () => {
    if (!selectedMedia || !user) {
      Alert.alert('Error', 'Please select media and ensure you are logged in');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Animate upload progress
      Animated.timing(uploadProgressAnimation, {
        toValue: 1,
        duration: 10000, // 10 seconds max
        useNativeDriver: false,
      }).start();

      // Progress simulation
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + Math.random() * 10;
          return newProgress >= 90 ? 90 : newProgress;
        });
      }, 200);

      // Upload video to DigitalOcean or image to Firebase
      let mediaUrl: string;
      let storageLocation: 'digitalocean' | 'firebase';

      if (selectedMedia.type === 'video') {
        // Upload videos to DigitalOcean
        console.log('📹 Uploading video to DigitalOcean...');
        const fileName = `stories/${Date.now()}_${user.uid}.mp4`;
        mediaUrl = await DigitalOceanService.uploadMedia(
          selectedMedia.uri,
          fileName,
          'video/mp4'
        );
        storageLocation = 'digitalocean';
        console.log('✅ Video uploaded to DigitalOcean:', mediaUrl);
      } else {
        // Upload images to Firebase (for smaller size)
        console.log('📸 Uploading image to Firebase...');
        mediaUrl = await FirebaseService.uploadMedia(
          selectedMedia.uri,
          user.uid,
          'image'
        );
        storageLocation = 'firebase';
        console.log('✅ Image uploaded to Firebase:', mediaUrl);
      }

      clearInterval(progressInterval);
      setUploadProgress(95);

      // Create story metadata in Firebase
      const storyData = {
        userId: user.uid,
        mediaUrl,
        mediaType: selectedMedia.type === 'video' ? 'video' as const : 'image' as const,
        storageLocation,
        duration: selectedMedia.duration || (selectedMedia.type === 'video' ? 15 : 5),
        texts: storyTexts.length > 0 ? storyTexts.map(text => ({
          id: text.id,
          text: text.text,
          color: text.color,
          fontSize: text.fontSize,
          fontFamily: text.fontFamily,
          position: { x: text.x, y: text.y },
          rotation: text.rotation,
          scale: text.scale,
          opacity: 1,
        })) : undefined,
        stickers: storyStickers.length > 0 ? storyStickers.map(sticker => ({
          id: sticker.id,
          type: 'emoji' as const,
          content: sticker.emoji,
          position: { x: sticker.x, y: sticker.y },
          rotation: sticker.rotation,
          scale: sticker.scale,
          opacity: 1,
        })) : undefined,
        width: selectedMedia.width,
        height: selectedMedia.height,
      };

      console.log('💾 Creating story metadata in Firebase...');
      const storyId = await FirebaseService.createStory(storyData);
      
      setUploadProgress(100);
      
      setTimeout(() => {
        Alert.alert(
          'Story Published! ✨',
          'Your story is now live and will be visible for 24 hours.',
          [
            {
              text: 'Create Another',
              onPress: () => {
                setSelectedMedia(null);
                setStoryTexts([]);
                setStoryStickers([]);
                setShowMediaPicker(true);
                setShowEditTools(false);
              },
            },
            {
              text: 'Done',
              style: 'cancel',
              onPress: () => {
                // Navigate back or close
              },
            },
          ]
        );
      }, 500);

    } catch (error) {
      console.error('❌ Error publishing story:', error);
      Alert.alert(
        'Upload Failed',
        'Failed to publish your story. Please check your connection and try again.',
        [
          { text: 'Retry', onPress: publishStory },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      uploadProgressAnimation.setValue(0);
    }
  };

  const renderMediaPicker = () => (
    <View style={styles.mediaPickerContainer}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.mediaPickerGradient}
      >
        <Text style={styles.mediaPickerTitle}>Create Your Story</Text>
        <Text style={styles.mediaPickerSubtitle}>
          Share a moment that matters
        </Text>

        <View style={styles.mediaPickerOptions}>
          <Animated.View style={{ transform: [{ scale: scaleAnimation }] }}>
            <TouchableOpacity
              style={styles.mediaOption}
              onPress={() => animateScale(takePhoto)}
            >
              <LinearGradient
                colors={['#FF6B6B', '#FF8E8E']}
                style={styles.mediaOptionGradient}
              >
                <Icon name="camera-alt" size={40} color="#fff" />
                <Text style={styles.mediaOptionText}>Take Photo</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: scaleAnimation }] }}>
            <TouchableOpacity
              style={styles.mediaOption}
              onPress={() => animateScale(recordVideo)}
            >
              <LinearGradient
                colors={['#4ECDC4', '#44A08D']}
                style={styles.mediaOptionGradient}
              >
                <Icon name="videocam" size={40} color="#fff" />
                <Text style={styles.mediaOptionText}>Record Video</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={{ transform: [{ scale: scaleAnimation }] }}>
            <TouchableOpacity
              style={styles.mediaOption}
              onPress={() => animateScale(pickFromGallery)}
            >
              <LinearGradient
                colors={['#A8E6CF', '#7FC7AF']}
                style={styles.mediaOptionGradient}
              >
                <Icon name="photo-library" size={40} color="#fff" />
                <Text style={styles.mediaOptionText}>From Gallery</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );

  const renderStoryEditor = () => (
    <View style={styles.editorContainer}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Media Background */}
      <View style={styles.mediaContainer}>
        {selectedMedia?.type === 'video' ? (
          <Video
            source={{ uri: selectedMedia.uri }}
            style={styles.mediaPreview}
            resizeMode="cover"
            repeat
            muted
          />
        ) : (
          <Image
            source={{ uri: selectedMedia?.uri }}
            style={styles.mediaPreview}
            resizeMode="cover"
          />
        )}

        {/* Story Elements Overlay */}
        <View style={styles.elementsOverlay}>
          {/* Text Elements */}
          {storyTexts.map(text => (
            <TouchableOpacity
              key={text.id}
              style={[
                styles.textElement,
                {
                  left: text.x - 50,
                  top: text.y - 20,
                  transform: [
                    { rotate: `${text.rotation}deg` },
                    { scale: text.scale },
                  ],
                },
              ]}
              onLongPress={() => removeText(text.id)}
            >
              <Text
                style={[
                  styles.textElementText,
                  {
                    color: text.color,
                    fontSize: text.fontSize,
                    fontFamily: text.fontFamily,
                  },
                ]}
              >
                {text.text}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Sticker Elements */}
          {storyStickers.map(sticker => (
            <TouchableOpacity
              key={sticker.id}
              style={[
                styles.stickerElement,
                {
                  left: sticker.x - 25,
                  top: sticker.y - 25,
                  transform: [
                    { rotate: `${sticker.rotation}deg` },
                    { scale: sticker.scale },
                  ],
                },
              ]}
              onLongPress={() => removeSticker(sticker.id)}
            >
              <Text style={styles.stickerEmoji}>{sticker.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Edit Tools */}
      {showEditTools && (
        <View style={styles.editToolsContainer}>
          <View style={styles.editTools}>
            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => setShowTextEditor(true)}
            >
              <Icon name="text-fields" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => {
                // Show sticker picker (simplified)
                addSticker(emojiStickers[Math.floor(Math.random() * emojiStickers.length)]);
              }}
            >
              <Icon name="emoji-emotions" size={24} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolButton, styles.publishButton]}
              onPress={publishStory}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="send" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Upload Progress */}
      {isUploading && (
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadProgress}>
            <Text style={styles.uploadText}>Publishing your story...</Text>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: uploadProgressAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );

  const renderTextEditor = () => (
    <Modal visible={showTextEditor} transparent animationType="slide">
      <View style={styles.textEditorOverlay}>
        <View style={styles.textEditorContainer}>
          <Text style={styles.textEditorTitle}>Add Text</Text>
          
          <TextInput
            style={styles.textInput}
            value={currentTextInput}
            onChangeText={setCurrentTextInput}
            placeholder="Enter your text..."
            placeholderTextColor="#666"
            multiline
            maxLength={100}
          />

          {/* Color Picker */}
          <View style={styles.colorPicker}>
            {textColors.map(color => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  selectedTextColor === color && styles.selectedColor,
                ]}
                onPress={() => setSelectedTextColor(color)}
              />
            ))}
          </View>

          <View style={styles.textEditorButtons}>
            <TouchableOpacity
              style={[styles.textEditorButton, styles.cancelButton]}
              onPress={() => {
                setShowTextEditor(false);
                setCurrentTextInput('');
              }}
            >
              <Text style={styles.textEditorButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.textEditorButton, styles.addButton]}
              onPress={addText}
            >
              <Text style={styles.textEditorButtonText}>Add Text</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="person-outline" size={60} color="#ccc" />
          <Text style={styles.errorText}>Please log in to create stories</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {showMediaPicker ? renderMediaPicker() : renderStoryEditor()}
      {renderTextEditor()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  mediaPickerContainer: {
    flex: 1,
  },
  mediaPickerGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  mediaPickerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  mediaPickerSubtitle: {
    fontSize: 16,
    color: '#rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginBottom: 50,
  },
  mediaPickerOptions: {
    width: '100%',
    gap: 20,
  },
  mediaOption: {
    width: '100%',
    height: 80,
    borderRadius: 20,
    overflow: 'hidden',
  },
  mediaOptionGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 15,
  },
  mediaOptionText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  editorContainer: {
    flex: 1,
  },
  mediaContainer: {
    flex: 1,
    position: 'relative',
  },
  mediaPreview: {
    width: '100%',
    height: '100%',
  },
  elementsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  textElement: {
    position: 'absolute',
    padding: 5,
  },
  textElementText: {
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  stickerElement: {
    position: 'absolute',
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerEmoji: {
    fontSize: 30,
  },
  editToolsContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  editTools: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 20,
  },
  toolButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishButton: {
    backgroundColor: '#FF6B6B',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadProgress: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    minWidth: 250,
  },
  uploadText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  progressBarContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF6B6B',
    borderRadius: 4,
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 10,
  },
  textEditorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textEditorContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: width * 0.9,
    maxWidth: 400,
  },
  textEditorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    maxHeight: 100,
    marginBottom: 20,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#333',
    borderWidth: 3,
  },
  textEditorButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  textEditorButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  addButton: {
    backgroundColor: '#FF6B6B',
  },
  textEditorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
  },
});
