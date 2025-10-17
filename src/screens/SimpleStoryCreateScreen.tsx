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
  SafeAreaView,
  Animated,
  Modal,
  FlatList,
  ScrollView,
} from 'react-native';
import { launchImageLibrary, launchCamera, MediaType } from 'react-native-image-picker';
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
  { id: 'clarendon', name: 'Clarendon', preview: '☀️', filterStyle: { opacity: 0.9 } },
  { id: 'gingham', name: 'Gingham', preview: '🌸', filterStyle: { opacity: 0.8 } },
  { id: 'moon', name: 'Moon', preview: '🌙', filterStyle: { opacity: 0.7 } },
  { id: 'lark', name: 'Lark', preview: '🦜', filterStyle: { opacity: 0.85 } },
  { id: 'reyes', name: 'Reyes', preview: '☁️', filterStyle: { opacity: 0.9 } },
  { id: 'juno', name: 'Juno', preview: '🔥', filterStyle: { opacity: 1.1 } },
  { id: 'slumber', name: 'Slumber', preview: '😴', filterStyle: { opacity: 0.8 } },
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

  // Media States
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  
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

  // Animation values
  const buttonScale = useRef(new Animated.Value(1)).current;

  const handleTakePhoto = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
    };

    launchCamera(options, (response) => {
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setSelectedMedia(asset.uri || null);
        setMediaType('image');
        setCurrentStep('edit');
      }
    });
  };

  const handleTakeVideo = () => {
    const options = {
      mediaType: 'video' as MediaType,
      includeBase64: false,
      durationLimit: 60, // 60 seconds max
      videoQuality: 'medium' as 'medium',
    };

    launchCamera(options, (response) => {
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setSelectedMedia(asset.uri || null);
        setMediaType('video');
        setCurrentStep('edit');
      }
    });
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

  const animateButton = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(callback);
  };

  // Render Camera/Capture View
  const renderCaptureView = () => (
    <View style={styles.captureContainer}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={['#833AB4', '#FD1D1D', '#FCB045']}
        style={styles.captureBackground}
      >
        {/* Header */}
        <SafeAreaView style={styles.captureHeader}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => {}} // Navigate back
          >
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          <Text style={styles.captureTitle}>Create Story</Text>
          
          <TouchableOpacity style={styles.headerButton}>
            <Icon name="settings" size={24} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Capture Options */}
        <View style={styles.captureOptions}>
          <TouchableOpacity 
            style={styles.captureOptionCard}
            onPress={() => animateButton(handleTakePhoto)}
          >
            <Animated.View style={[styles.captureOptionContent, { transform: [{ scale: buttonScale }] }]}>
              <Icon name="camera" size={40} color="#fff" />
              <Text style={styles.captureOptionTitle}>Take Photo</Text>
              <Text style={styles.captureOptionSubtitle}>Capture a moment</Text>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.captureOptionCard}
            onPress={() => animateButton(handleTakeVideo)}
          >
            <Animated.View style={[styles.captureOptionContent, { transform: [{ scale: buttonScale }] }]}>
              <Icon name="videocam" size={40} color="#fff" />
              <Text style={styles.captureOptionTitle}>Record Video</Text>
              <Text style={styles.captureOptionSubtitle}>Create a video story</Text>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.captureOptionCard}
            onPress={() => animateButton(handleSelectFromGallery)}
          >
            <Animated.View style={[styles.captureOptionContent, { transform: [{ scale: buttonScale }] }]}>
              <Icon name="images" size={40} color="#fff" />
              <Text style={styles.captureOptionTitle}>From Gallery</Text>
              <Text style={styles.captureOptionSubtitle}>Choose existing media</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <Icon name="text" size={24} color="#fff" />
            <Text style={styles.quickActionText}>Text</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickAction}>
            <Icon name="color-palette" size={24} color="#fff" />
            <Text style={styles.quickActionText}>Create</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickAction}>
            <Icon name="musical-notes" size={24} color="#fff" />
            <Text style={styles.quickActionText}>Music</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
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

        {/* Filter Overlay */}
        {selectedFilter.id !== 'normal' && (
          <View style={[styles.filterOverlay, selectedFilter.filterStyle]} />
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
              <Icon name="ellipsis-horizontal" size={24} color="#fff" />
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
            <View style={styles.shareOptionTextContainer}>
              <Text style={styles.shareOptionText}>Your Story</Text>
              <Text style={styles.shareOptionSubtext}>Share to your story</Text>
            </View>
            {isUploading && <Icon name="hourglass" size={20} color="#fff" />}
          </LinearGradient>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.shareOption}>
          <View style={styles.shareOptionContent}>
            <Icon name="heart" size={24} color="#fff" />
            <View style={styles.shareOptionTextContainer}>
              <Text style={styles.shareOptionText}>Close Friends</Text>
              <Text style={styles.shareOptionSubtext}>Share to close friends only</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <View style={styles.container}>
      {currentStep === 'capture' && renderCaptureView()}
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

  // Capture/Camera Styles
  captureContainer: {
    flex: 1,
  },
  captureBackground: {
    flex: 1,
  },
  captureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  headerButton: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  captureTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  captureOptions: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 20,
  },
  captureOptionCard: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  captureOptionContent: {
    alignItems: 'center',
  },
  captureOptionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  captureOptionSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    borderRadius: 16,
    minWidth: 80,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
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
  filterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
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
  shareOptionTextContainer: {
    flex: 1,
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
