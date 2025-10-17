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
  SafeAreaView,
  Animated,
  PanResponder,
  Modal,
  FlatList,
  ScrollView,
} from 'react-native';
import { Camera, useCameraDevices, useFrameProcessor } from 'react-native-vision-camera';
import { launchImageLibrary, MediaType } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Video from 'react-native-video';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import FirebaseService from '../services/firebaseService';
import DigitalOceanService from '../services/digitalOceanService';

const { width, height } = Dimensions.get('window');

interface StoryText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontFamily: string;
  fontSize: number;
  backgroundColor: string;
  rotation: number;
}

interface StorySticker {
  id: string;
  type: 'emoji' | 'gif' | 'location' | 'mention' | 'hashtag' | 'time' | 'poll' | 'question';
  content: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

interface StoryFilter {
  id: string;
  name: string;
  preview: string;
  filterStyle: any;
}

const STORY_FILTERS: StoryFilter[] = [
  { id: 'normal', name: 'Normal', preview: '📷', filterStyle: {} },
  { id: 'clarendon', name: 'Clarendon', preview: '☀️', filterStyle: { brightness: 1.2, contrast: 1.3, saturation: 1.2 } },
  { id: 'gingham', name: 'Gingham', preview: '🌸', filterStyle: { sepia: 0.2, contrast: 0.9 } },
  { id: 'moon', name: 'Moon', preview: '🌙', filterStyle: { brightness: 0.8, contrast: 1.1 } },
  { id: 'lark', name: 'Lark', preview: '🦜', filterStyle: { brightness: 1.1, saturation: 0.9 } },
  { id: 'reyes', name: 'Reyes', preview: '☁️', filterStyle: { brightness: 1.05, saturation: 0.85 } },
  { id: 'juno', name: 'Juno', preview: '🔥', filterStyle: { contrast: 1.2, saturation: 1.4 } },
  { id: 'slumber', name: 'Slumber', preview: '😴', filterStyle: { brightness: 0.9, saturation: 0.8 } },
];

const TEXT_COLORS = [
  '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
  '#FF00FF', '#00FFFF', '#FF8000', '#8000FF', '#FF0080', '#80FF00'
];

const STICKER_EMOJIS = [
  '😀', '😂', '😍', '🤔', '😎', '🥳', '😴', '🤯', '🔥', '💯', '❤️', '💔',
  '👍', '👎', '🙌', '👏', '💪', '🤝', '🙏', '✨', '⭐', '🌟', '💫', '⚡'
];

export default function InstagramStoryCreateScreen(): React.JSX.Element {
  const { user } = useAuth();
  const { colors } = useTheme();

  // Camera and Media States
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  
  // Story Creation States
  const [currentStep, setCurrentStep] = useState<'capture' | 'edit' | 'share'>('capture');
  const [selectedFilter, setSelectedFilter] = useState<StoryFilter>(STORY_FILTERS[0]);
  const [storyTexts, setStoryTexts] = useState<StoryText[]>([]);
  const [storyStickers, setStoryStickers] = useState<StorySticker[]>([]);
  
  // UI States
  const [showFilters, setShowFilters] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [currentTextInput, setCurrentTextInput] = useState('');
  const [currentTextColor, setCurrentTextColor] = useState('#FFFFFF');
  const [isUploading, setIsUploading] = useState(false);

  // Camera setup
  const devices = useCameraDevices();
  const device = devices.find(d => d.position === cameraType) || devices[0];
  const camera = useRef<Camera>(null);

  // Animation values
  const recordingScale = useRef(new Animated.Value(1)).current;
  const filterOpacity = useRef(new Animated.Value(0)).current;

  const handleTakePhoto = async () => {
    if (camera.current) {
      try {
        const photo = await camera.current.takePhoto({
          flash: 'off',
        });
        setSelectedMedia(`file://${photo.path}`);
        setMediaType('image');
        setCurrentStep('edit');
      } catch (error) {
        console.error('Error taking photo:', error);
        Alert.alert('Error', 'Failed to take photo');
      }
    }
  };

  const handleStartRecording = async () => {
    if (camera.current && !isRecording) {
      try {
        setIsRecording(true);
        
        // Start recording animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(recordingScale, {
              toValue: 1.2,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(recordingScale, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        ).start();

        await camera.current.startRecording({
          flash: 'off',
          onRecordingFinished: (video) => {
            setSelectedMedia(`file://${video.path}`);
            setMediaType('video');
            setCurrentStep('edit');
            setIsRecording(false);
            recordingScale.stopAnimation();
          },
          onRecordingError: (error) => {
            console.error('Recording error:', error);
            setIsRecording(false);
            recordingScale.stopAnimation();
            Alert.alert('Error', 'Failed to record video');
          },
        });
      } catch (error) {
        console.error('Error starting recording:', error);
        setIsRecording(false);
        Alert.alert('Error', 'Failed to start recording');
      }
    }
  };

  const handleStopRecording = async () => {
    if (camera.current && isRecording) {
      try {
        await camera.current.stopRecording();
        recordingScale.stopAnimation();
        recordingScale.setValue(1);
      } catch (error) {
        console.error('Error stopping recording:', error);
      }
    }
  };

  const handleSelectFromGallery = () => {
    const options = {
      mediaType: 'mixed' as MediaType,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
    };

    launchImageLibrary(options, (response) => {
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setSelectedMedia(asset.uri || null);
        setMediaType(asset.type?.includes('video') ? 'video' : 'image');
        setCurrentStep('edit');
      }
    });
  };

  const handleAddText = () => {
    if (currentTextInput.trim()) {
      const newText: StoryText = {
        id: Date.now().toString(),
        text: currentTextInput,
        x: width / 2 - 100,
        y: height / 2 - 50,
        color: currentTextColor,
        fontFamily: 'bold',
        fontSize: 24,
        backgroundColor: 'transparent',
        rotation: 0,
      };
      setStoryTexts(prev => [...prev, newText]);
      setCurrentTextInput('');
      setShowTextEditor(false);
    }
  };

  const handleAddSticker = (emoji: string) => {
    const newSticker: StorySticker = {
      id: Date.now().toString(),
      type: 'emoji',
      content: emoji,
      x: width / 2 - 25,
      y: height / 2 - 25,
      scale: 1,
      rotation: 0,
    };
    setStoryStickers(prev => [...prev, newSticker]);
    setShowStickerPicker(false);
  };

  const handlePublishStory = async () => {
    if (!selectedMedia || !user) {
      Alert.alert('Error', 'Please select media and ensure you are logged in');
      return;
    }

    setIsUploading(true);
    try {
      // Upload media to DigitalOcean
      const mediaKey = await DigitalOceanService.uploadMedia(selectedMedia, 'stories');
      const mediaUrl = `https://your-bucket.nyc3.digitaloceanspaces.com/${mediaKey}`;

      // Create story object
      const storyData: any = {
        userId: user.uid,
        mediaUrl,
        mediaType,
        duration: mediaType === 'video' ? 15 : 5, // 15s for video, 5s for image
        viewsCount: 0,
        viewers: [],
        likesCount: 0,
        isLiked: false,
        commentsCount: 0,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      };

      // Only add optional fields if they have values
      if (storyTexts.length > 0) {
        storyData.texts = storyTexts;
      }
      if (storyStickers.length > 0) {
        storyData.stickers = storyStickers;
      }
      if (selectedFilter.id !== 'none') {
        storyData.filter = selectedFilter;
      }

      // Save to Firebase
      await FirebaseService.createStory(storyData);

      Alert.alert('Success', 'Your story has been published!', [
        { text: 'OK', onPress: () => {
          // Navigate back to home or stories view
          // navigation.goBack();
        }}
      ]);

    } catch (error) {
      console.error('Error publishing story:', error);
      Alert.alert('Error', 'Failed to publish story. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Render Camera View
  const renderCameraView = () => (
    <View style={styles.cameraContainer}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {device && (
        <Camera
          ref={camera}
          style={styles.camera}
          device={device}
          isActive={currentStep === 'capture'}
          photo={cameraMode === 'photo'}
          video={cameraMode === 'video'}
        />
      )}

      {/* Camera Controls Overlay */}
      <View style={styles.cameraOverlay}>
        {/* Top Controls */}
        <SafeAreaView style={styles.topControls}>
          <TouchableOpacity 
            style={styles.topButton}
            onPress={() => {}} // Navigate back
          >
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.topMiddle}>
            <TouchableOpacity 
              style={[styles.modeButton, cameraMode === 'photo' && styles.activeModeButton]}
              onPress={() => setCameraMode('photo')}
            >
              <Text style={styles.modeText}>PHOTO</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.modeButton, cameraMode === 'video' && styles.activeModeButton]}
              onPress={() => setCameraMode('video')}
            >
              <Text style={styles.modeText}>VIDEO</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.topButton}
            onPress={() => setCameraType(cameraType === 'front' ? 'back' : 'front')}
          >
            <Icon name="camera-reverse" size={24} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <TouchableOpacity 
            style={styles.galleryButton}
            onPress={handleSelectFromGallery}
          >
            <Icon name="images" size={24} color="#fff" />
          </TouchableOpacity>

          {/* Capture Button */}
          <TouchableOpacity
            style={styles.captureButtonContainer}
            onPress={cameraMode === 'photo' ? handleTakePhoto : handleStartRecording}
            onPressOut={cameraMode === 'video' && isRecording ? handleStopRecording : undefined}
          >
            <Animated.View 
              style={[
                styles.captureButton,
                isRecording && styles.recordingButton,
                { transform: [{ scale: recordingScale }] }
              ]}
            >
              {isRecording && <View style={styles.recordingDot} />}
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.effectsButton}>
            <Icon name="happy" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  // Render Edit View
  const renderEditView = () => (
    <View style={styles.editContainer}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Media Preview */}
      <View style={styles.mediaPreview}>
        {selectedMedia && (
          mediaType === 'image' ? (
            <Image
              source={{ uri: selectedMedia }}
              style={[styles.previewMedia, selectedFilter.filterStyle]}
              resizeMode="cover"
            />
          ) : (
            <Video
              source={{ uri: selectedMedia }}
              style={styles.previewMedia}
              resizeMode="cover"
              paused={false}
              repeat
              muted
            />
          )
        )}

        {/* Text Overlays */}
        {storyTexts.map((textItem) => (
          <View
            key={textItem.id}
            style={[
              styles.textOverlay,
              {
                left: textItem.x,
                top: textItem.y,
                transform: [{ rotate: `${textItem.rotation}deg` }],
              },
            ]}
          >
            <Text
              style={[
                styles.overlayText,
                {
                  color: textItem.color,
                  fontSize: textItem.fontSize,
                  fontWeight: textItem.fontFamily === 'bold' ? 'bold' : 'normal',
                  backgroundColor: textItem.backgroundColor,
                },
              ]}
            >
              {textItem.text}
            </Text>
          </View>
        ))}

        {/* Sticker Overlays */}
        {storyStickers.map((sticker) => (
          <View
            key={sticker.id}
            style={[
              styles.stickerOverlay,
              {
                left: sticker.x,
                top: sticker.y,
                transform: [
                  { scale: sticker.scale },
                  { rotate: `${sticker.rotation}deg` }
                ],
              },
            ]}
          >
            <Text style={styles.stickerEmoji}>{sticker.content}</Text>
          </View>
        ))}
      </View>

      {/* Edit Controls */}
      <SafeAreaView style={styles.editControls}>
        {/* Top Controls */}
        <View style={styles.editTopControls}>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setCurrentStep('capture')}
          >
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.editTopRight}>
            <TouchableOpacity style={styles.editButton}>
              <Icon name="download" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.editButton}>
              <Icon name="more-horizontal" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Side Tools */}
        <View style={styles.sideTools}>
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => setShowTextEditor(true)}
          >
            <Icon name="text" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => setShowStickerPicker(true)}
          >
            <Icon name="happy" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Icon name="color-filter" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => setShowMusicPicker(true)}
          >
            <Icon name="musical-notes" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Bottom Controls */}
        <View style={styles.editBottomControls}>
          {showFilters && (
            <ScrollView 
              horizontal 
              style={styles.filtersContainer}
              showsHorizontalScrollIndicator={false}
            >
              {STORY_FILTERS.map((filter) => (
                <TouchableOpacity
                  key={filter.id}
                  style={[
                    styles.filterItem,
                    selectedFilter.id === filter.id && styles.selectedFilter
                  ]}
                  onPress={() => setSelectedFilter(filter)}
                >
                  <Text style={styles.filterEmoji}>{filter.preview}</Text>
                  <Text style={styles.filterName}>{filter.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          
          <TouchableOpacity 
            style={styles.shareButton}
            onPress={() => setCurrentStep('share')}
          >
            <LinearGradient
              colors={['#833AB4', '#FD1D1D', '#FCB045']}
              style={styles.shareButtonGradient}
            >
              <Text style={styles.shareButtonText}>Your Story</Text>
              <Icon name="arrow-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );

  // Render Share View
  const renderShareView = () => (
    <SafeAreaView style={styles.shareContainer}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <View style={styles.shareHeader}>
        <TouchableOpacity onPress={() => setCurrentStep('edit')}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.shareTitle}>Share to</Text>
        <TouchableOpacity>
          <Icon name="settings" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.sharePreview}>
        {selectedMedia && (
          <Image
            source={{ uri: selectedMedia }}
            style={styles.shareMediaPreview}
            resizeMode="cover"
          />
        )}
      </View>

      <View style={styles.shareOptions}>
        <TouchableOpacity 
          style={styles.shareOption}
          onPress={handlePublishStory}
          disabled={isUploading}
        >
          <LinearGradient
            colors={['#833AB4', '#FD1D1D', '#FCB045']}
            style={styles.shareOptionGradient}
          >
            <Icon name="people" size={24} color="#fff" />
            <Text style={styles.shareOptionText}>Your Story</Text>
            <Text style={styles.shareOptionSubtext}>Share to your story</Text>
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.shareOption}>
          <View style={styles.shareOptionContent}>
            <Icon name="heart" size={24} color="#fff" />
            <Text style={styles.shareOptionText}>Close Friends</Text>
            <Text style={styles.shareOptionSubtext}>Share to close friends only</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <View style={styles.container}>
      {currentStep === 'capture' && renderCameraView()}
      {currentStep === 'edit' && renderEditView()}
      {currentStep === 'share' && renderShareView()}

      {/* Text Editor Modal */}
      <Modal visible={showTextEditor} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.textEditorContainer}>
            <Text style={styles.modalTitle}>Add Text</Text>
            
            <TextInput
              style={styles.textInput}
              value={currentTextInput}
              onChangeText={setCurrentTextInput}
              placeholder="Type your text..."
              placeholderTextColor="#999"
              multiline
              autoFocus
            />
            
            <ScrollView horizontal style={styles.colorPicker}>
              {TEXT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    currentTextColor === color && styles.selectedColor
                  ]}
                  onPress={() => setCurrentTextColor(color)}
                />
              ))}
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={() => setShowTextEditor(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.primaryButton]}
                onPress={handleAddText}
              >
                <Text style={styles.modalButtonTextPrimary}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Sticker Picker Modal */}
      <Modal visible={showStickerPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.stickerPickerContainer}>
            <Text style={styles.modalTitle}>Add Sticker</Text>
            
            <FlatList
              data={STICKER_EMOJIS}
              numColumns={6}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.emojiButton}
                  onPress={() => handleAddSticker(item)}
                >
                  <Text style={styles.emojiText}>{item}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item}
            />
            
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowStickerPicker(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Camera Styles
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  topButton: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  topMiddle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 4,
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  activeModeButton: {
    backgroundColor: '#fff',
  },
  modeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  galleryButton: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  recordingButton: {
    backgroundColor: '#FF3040',
  },
  recordingDot: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  effectsButton: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Edit Styles
  editContainer: {
    flex: 1,
  },
  mediaPreview: {
    flex: 1,
    position: 'relative',
  },
  previewMedia: {
    width: '100%',
    height: '100%',
  },
  textOverlay: {
    position: 'absolute',
    padding: 8,
  },
  overlayText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  stickerOverlay: {
    position: 'absolute',
    padding: 4,
  },
  stickerEmoji: {
    fontSize: 40,
  },
  editControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  editTopControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  editTopRight: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  sideTools: {
    position: 'absolute',
    right: 20,
    top: '50%',
    transform: [{ translateY: -100 }],
    gap: 16,
  },
  toolButton: {
    width: 50,
    height: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBottomControls: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  filtersContainer: {
    marginBottom: 20,
  },
  filterItem: {
    alignItems: 'center',
    marginRight: 16,
    padding: 8,
    borderRadius: 8,
  },
  selectedFilter: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  filterName: {
    color: '#fff',
    fontSize: 12,
  },
  shareButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  shareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Share Styles
  shareContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  shareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  shareTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  sharePreview: {
    height: 200,
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  shareMediaPreview: {
    width: '100%',
    height: '100%',
  },
  shareOptions: {
    flex: 1,
    paddingHorizontal: 20,
  },
  shareOption: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  shareOptionGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  shareOptionContent: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  shareOptionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  shareOptionSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textEditorContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    width: width * 0.9,
    maxHeight: height * 0.7,
  },
  stickerPickerContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    width: width * 0.9,
    maxHeight: height * 0.7,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  colorPicker: {
    marginBottom: 20,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  modalButtonTextPrimary: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  emojiButton: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  emojiText: {
    fontSize: 24,
  },
});
