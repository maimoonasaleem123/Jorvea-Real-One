import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  Image,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  PanResponder,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary, launchCamera, MediaType } from 'react-native-image-picker';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import FirebaseService from '../services/firebaseService';
import { EnhancedMultiPostCarousel } from '../components/EnhancedMultiPostCarousel';

const { width, height } = Dimensions.get('window');

interface SelectedMedia {
  uri: string;
  type: 'image' | 'video';
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
}

interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  rotation: number;
  scale: number;
  backgroundColor?: string;
  strokeWidth?: number;
  strokeColor?: string;
}

interface Filter {
  id: string;
  name: string;
  effect: string;
  preview: string;
  colors?: string[];
}

interface StickerElement {
  id: string;
  type: string;
  content: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

const InstagramCreateScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, isDarkMode } = useTheme();
  
  // Core state
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [currentStep, setCurrentStep] = useState<'select' | 'edit' | 'share'>('select');
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  
  // Content state
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [commentsDisabled, setCommentsDisabled] = useState(false);
  const [hideLikeCounts, setHideLikeCounts] = useState(false);
  
  // Edit state
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [stickerElements, setStickerElements] = useState<StickerElement[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<Filter | null>(null);
  
  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [currentTextColor, setCurrentTextColor] = useState('#ffffff');
  const [currentTextSize, setCurrentTextSize] = useState(24);
  const [selectedTextElement, setSelectedTextElement] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Instagram-like filters
  const FILTERS: Filter[] = [
    { id: 'normal', name: 'Normal', effect: 'none', preview: '📷' },
    { id: 'vintage', name: 'Vintage', effect: 'sepia', preview: '📸', colors: ['#8B4513', '#DEB887'] },
    { id: 'black_white', name: 'B&W', effect: 'grayscale', preview: '⚫', colors: ['#000000', '#FFFFFF'] },
    { id: 'cool', name: 'Cool', effect: 'cool', preview: '❄️', colors: ['#87CEEB', '#E0FFFF'] },
    { id: 'warm', name: 'Warm', effect: 'warm', preview: '🔥', colors: ['#FFA500', '#FFD700'] },
    { id: 'dramatic', name: 'Drama', effect: 'contrast', preview: '🎭', colors: ['#000000', '#FF0000'] },
    { id: 'bright', name: 'Bright', effect: 'brightness', preview: '☀️', colors: ['#FFFF00', '#FFFFFF'] },
    { id: 'fade', name: 'Fade', effect: 'fade', preview: '🌫️', colors: ['#F5F5F5', '#DCDCDC'] },
  ];

  // Text colors
  const TEXT_COLORS = [
    '#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080',
    '#ffc0cb', '#a52a2a', '#808080', '#008000', '#000080'
  ];

  // Font families
  const FONT_FAMILIES = [
    { name: 'System', value: 'System' },
    { name: 'Bold', value: 'System-Bold' },
    { name: 'Light', value: 'System-Light' },
    { name: 'Italic', value: 'System-Italic' },
  ];

  // Sticker categories
  const STICKERS = {
    emoji: ['😀', '😂', '😍', '🥰', '😎', '🤔', '😭', '🤩', '🔥', '💯', '❤️', '💪'],
    location: ['📍', '🌍', '🏠', '🏢', '🏖️', '🏔️', '🌆', '🌃'],
    weather: ['☀️', '⛅', '🌧️', '⛈️', '🌈', '❄️', '🌟', '⭐'],
    food: ['🍕', '🍔', '🍟', '🍗', '🍰', '🍺', '☕', '🥤'],
  };

  // Media selection
  const selectFromGallery = useCallback(() => {
    const options = {
      mediaType: 'mixed' as MediaType,
      selectionLimit: 10,
      quality: 0.8,
      includeBase64: false,
    };

    launchImageLibrary(options, (response) => {
      if (response.assets) {
        const media: SelectedMedia[] = response.assets.map(asset => ({
          uri: asset.uri || '',
          type: asset.type?.startsWith('video') ? 'video' : 'image',
          fileName: asset.fileName || 'media',
          fileSize: asset.fileSize || 0,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
        }));
        
        setSelectedMedia(media);
        setCurrentStep('edit');
      }
    });
  }, []);

  const openCamera = useCallback(() => {
    Alert.alert(
      'Camera',
      'Select camera mode',
      [
        { text: 'Photo', onPress: () => captureWithCamera('photo') },
        { text: 'Video', onPress: () => captureWithCamera('video') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  const captureWithCamera = useCallback((type: 'photo' | 'video') => {
    const options = {
      mediaType: type,
      quality: 0.8,
      videoQuality: 'high',
      durationLimit: 60,
    };

    launchCamera(options as any, (response) => {
      if (response.assets?.[0]) {
        const asset = response.assets[0];
        const media: SelectedMedia = {
          uri: asset.uri || '',
          type: type === 'video' ? 'video' : 'image',
          fileName: asset.fileName || 'capture',
          fileSize: asset.fileSize || 0,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
        };
        
        setSelectedMedia([media]);
        setCurrentStep('edit');
      }
    });
  }, []);

  // Text editing
  const addTextElement = useCallback(() => {
    if (!currentText.trim()) return;

    const newElement: TextElement = {
      id: `text_${Date.now()}`,
      text: currentText,
      x: width / 2 - 50,
      y: height / 2 - 50,
      fontSize: currentTextSize,
      color: currentTextColor,
      fontFamily: 'System',
      rotation: 0,
      scale: 1,
    };

    setTextElements(prev => [...prev, newElement]);
    setCurrentText('');
    setShowTextEditor(false);
  }, [currentText, currentTextColor, currentTextSize]);

  const updateTextElement = useCallback((id: string, updates: Partial<TextElement>) => {
    setTextElements(prev => prev.map(element => 
      element.id === id ? { ...element, ...updates } : element
    ));
  }, []);

  const deleteTextElement = useCallback((id: string) => {
    setTextElements(prev => prev.filter(element => element.id !== id));
    setSelectedTextElement(null);
  }, []);

  // Sticker functionality
  const addSticker = useCallback((sticker: string) => {
    const newSticker: StickerElement = {
      id: `sticker_${Date.now()}`,
      type: 'emoji',
      content: sticker,
      x: width / 2 - 25,
      y: height / 2 - 25,
      scale: 1,
      rotation: 0,
    };

    setStickerElements(prev => [...prev, newSticker]);
    setShowStickers(false);
  }, []);

  // Filter application
  const applyFilter = useCallback((filter: Filter) => {
    setSelectedFilter(filter);
    setShowFilters(false);
  }, []);

  // Publishing
  const publishPost = useCallback(async () => {
    if (!user || selectedMedia.length === 0) return;

    try {
      setUploading(true);

      // Upload media files
      const mediaUrls: string[] = [];
      for (const media of selectedMedia) {
        const url = await FirebaseService.uploadMedia(media.uri, user.uid, media.type);
        mediaUrls.push(url);
      }

      // Create post data
      const postData = {
        userId: user.uid,
        type: selectedMedia.length > 1 ? 'carousel' : selectedMedia[0].type === 'video' ? 'video' : 'image',
        mediaUrls,
        caption,
        location: location || undefined,
        hashtags: tags,
        isPrivate,
        commentsDisabled,
        hideLikeCounts,
        filter: selectedFilter,
        textElements,
        stickerElements,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        saves: [],
        likes: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await FirebaseService.createPost(postData);
      
      Alert.alert(
        'Success!',
        'Your post has been shared successfully.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error publishing post:', error);
      Alert.alert('Error', 'Failed to publish post. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [user, selectedMedia, caption, location, tags, isPrivate, commentsDisabled, hideLikeCounts, selectedFilter, textElements, stickerElements, navigation]);

  // Hash tag extraction
  const extractHashtags = useCallback((text: string) => {
    const hashtags = text.match(/#\w+/g) || [];
    setTags(hashtags.map(tag => tag.slice(1)));
  }, []);

  // Render functions
  const renderSelectionScreen = () => (
    <View style={styles.selectionScreen}>
      <View style={styles.selectionHeader}>
        <Text style={[styles.title, { color: colors.text }]}>Create Post</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Share your moment with the world
        </Text>
      </View>

      <View style={styles.selectionOptions}>
        <TouchableOpacity style={styles.selectionOption} onPress={selectFromGallery}>
          <View style={styles.selectionIcon}>
            <Icon name="images" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.selectionText, { color: colors.text }]}>Gallery</Text>
          <Text style={[styles.selectionSubtext, { color: colors.textSecondary }]}>
            Select up to 10 photos/videos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.selectionOption} onPress={openCamera}>
          <View style={styles.selectionIcon}>
            <Icon name="camera" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.selectionText, { color: colors.text }]}>Camera</Text>
          <Text style={[styles.selectionSubtext, { color: colors.textSecondary }]}>
            Take photo or record video
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEditScreen = () => (
    <View style={styles.editScreen}>
      {/* Media preview */}
      <View style={styles.mediaPreview}>
        <EnhancedMultiPostCarousel
          mediaUrls={selectedMedia.map(m => m.uri)}
          postId="preview"
          onIndexChange={setCurrentMediaIndex}
          height={height * 0.5}
        />
        
        {/* Filter overlay */}
        {selectedFilter && selectedFilter.colors && (
          <View style={[styles.filterOverlay, { backgroundColor: selectedFilter.colors[0] + '30' }]} />
        )}

        {/* Text elements overlay */}
        {textElements.map(element => (
          <TouchableOpacity
            key={element.id}
            style={[
              styles.textElement,
              {
                left: element.x,
                top: element.y,
                transform: [
                  { scale: element.scale },
                  { rotate: `${element.rotation}deg` },
                ],
              },
            ]}
            onPress={() => setSelectedTextElement(element.id)}
          >
            <Text
              style={{
                fontSize: element.fontSize,
                color: element.color,
                fontFamily: element.fontFamily,
                textShadowColor: 'rgba(0,0,0,0.5)',
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 2,
              }}
            >
              {element.text}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Sticker elements overlay */}
        {stickerElements.map(sticker => (
          <TouchableOpacity
            key={sticker.id}
            style={[
              styles.stickerElement,
              {
                left: sticker.x,
                top: sticker.y,
                transform: [
                  { scale: sticker.scale },
                  { rotate: `${sticker.rotation}deg` },
                ],
              },
            ]}
          >
            <Text style={styles.stickerText}>{sticker.content}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Edit tools */}
      <View style={styles.editTools}>
        <TouchableOpacity
          style={styles.editTool}
          onPress={() => setShowFilters(true)}
        >
          <Icon name="color-filter" size={24} color={colors.text} />
          <Text style={[styles.editToolText, { color: colors.text }]}>Filter</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editTool}
          onPress={() => setShowTextEditor(true)}
        >
          <Icon name="text" size={24} color={colors.text} />
          <Text style={[styles.editToolText, { color: colors.text }]}>Text</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.editTool}
          onPress={() => setShowStickers(true)}
        >
          <Icon name="happy" size={24} color={colors.text} />
          <Text style={[styles.editToolText, { color: colors.text }]}>Stickers</Text>
        </TouchableOpacity>

        {selectedTextElement && (
          <TouchableOpacity
            style={[styles.editTool, { backgroundColor: colors.error }]}
            onPress={() => deleteTextElement(selectedTextElement)}
          >
            <Icon name="trash" size={24} color="#fff" />
            <Text style={[styles.editToolText, { color: '#fff' }]}>Delete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderShareScreen = () => (
    <KeyboardAvoidingView 
      style={styles.shareScreen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.shareContent} showsVerticalScrollIndicator={false}>
        {/* Media thumbnail */}
        <View style={styles.shareThumbnail}>
          <Image
            source={{ uri: selectedMedia[0]?.uri }}
            style={styles.thumbnailImage}
          />
          {selectedMedia.length > 1 && (
            <View style={styles.multiMediaIndicator}>
              <Icon name="copy" size={16} color="#fff" />
              <Text style={styles.multiMediaText}>{selectedMedia.length}</Text>
            </View>
          )}
        </View>

        {/* Caption input */}
        <View style={styles.captionSection}>
          <TextInput
            style={[styles.captionInput, { color: colors.text, borderColor: colors.border }]}
            placeholder="Write a caption..."
            placeholderTextColor={colors.textSecondary}
            value={caption}
            onChangeText={(text) => {
              setCaption(text);
              extractHashtags(text);
            }}
            multiline
            maxLength={2200}
          />
          <Text style={[styles.captionCounter, { color: colors.textSecondary }]}>
            {caption.length}/2200
          </Text>
        </View>

        {/* Location input */}
        <View style={styles.locationSection}>
          <Icon name="location" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.locationInput, { color: colors.text }]}
            placeholder="Add location"
            placeholderTextColor={colors.textSecondary}
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Privacy settings */}
        <View style={styles.privacySection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy & Settings</Text>
          
          <TouchableOpacity
            style={styles.privacyOption}
            onPress={() => setIsPrivate(!isPrivate)}
          >
            <View style={styles.privacyOptionLeft}>
              <Icon 
                name={isPrivate ? 'lock-closed' : 'earth'} 
                size={20} 
                color={colors.text} 
              />
              <Text style={[styles.privacyOptionText, { color: colors.text }]}>
                {isPrivate ? 'Private' : 'Public'}
              </Text>
            </View>
            <Icon
              name={isPrivate ? 'checkbox' : 'square-outline'}
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.privacyOption}
            onPress={() => setCommentsDisabled(!commentsDisabled)}
          >
            <View style={styles.privacyOptionLeft}>
              <Icon 
                name="chatbubble-outline" 
                size={20} 
                color={colors.text} 
              />
              <Text style={[styles.privacyOptionText, { color: colors.text }]}>
                Turn off commenting
              </Text>
            </View>
            <Icon
              name={commentsDisabled ? 'checkbox' : 'square-outline'}
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.privacyOption}
            onPress={() => setHideLikeCounts(!hideLikeCounts)}
          >
            <View style={styles.privacyOptionLeft}>
              <Icon 
                name="heart-outline" 
                size={20} 
                color={colors.text} 
              />
              <Text style={[styles.privacyOptionText, { color: colors.text }]}>
                Hide like counts
              </Text>
            </View>
            <Icon
              name={hideLikeCounts ? 'checkbox' : 'square-outline'}
              size={20}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => {
          if (currentStep === 'select') {
            navigation.goBack();
          } else if (currentStep === 'edit') {
            setCurrentStep('select');
          } else {
            setCurrentStep('edit');
          }
        }}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {currentStep === 'select' ? 'Create Post' : 
           currentStep === 'edit' ? 'Edit' : 'Share'}
        </Text>

        {currentStep === 'edit' && (
          <TouchableOpacity onPress={() => setCurrentStep('share')}>
            <Text style={[styles.nextButton, { color: colors.primary }]}>Next</Text>
          </TouchableOpacity>
        )}

        {currentStep === 'share' && (
          <TouchableOpacity 
            onPress={publishPost}
            disabled={uploading}
            style={[styles.shareButton, { backgroundColor: colors.primary }]}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.shareButtonText}>Share</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {currentStep === 'select' && renderSelectionScreen()}
      {currentStep === 'edit' && renderEditScreen()}
      {currentStep === 'share' && renderShareScreen()}

      {/* Filter Modal */}
      <Modal visible={showFilters} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Text style={[styles.modalCancel, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Filters</Text>
            <View style={styles.modalSpacer} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
            {FILTERS.map(filter => (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterOption,
                  selectedFilter?.id === filter.id && styles.selectedFilterOption,
                ]}
                onPress={() => applyFilter(filter)}
              >
                <View style={styles.filterPreview}>
                  <Text style={styles.filterEmoji}>{filter.preview}</Text>
                </View>
                <Text style={[styles.filterName, { color: colors.text }]}>{filter.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Text Editor Modal */}
      <Modal visible={showTextEditor} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowTextEditor(false)}>
              <Text style={[styles.modalCancel, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Text</Text>
            <TouchableOpacity onPress={addTextElement}>
              <Text style={[styles.modalDone, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.textEditorContent}>
            <TextInput
              style={[styles.textEditorInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Enter text..."
              placeholderTextColor={colors.textSecondary}
              value={currentText}
              onChangeText={setCurrentText}
              multiline
              autoFocus
            />

            <View style={styles.textControls}>
              <Text style={[styles.textControlLabel, { color: colors.text }]}>Color:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {TEXT_COLORS.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      currentTextColor === color && styles.selectedColorOption,
                    ]}
                    onPress={() => setCurrentTextColor(color)}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.textControls}>
              <Text style={[styles.textControlLabel, { color: colors.text }]}>Size:</Text>
              <View style={styles.sizeControls}>
                <TouchableOpacity
                  onPress={() => setCurrentTextSize(Math.max(12, currentTextSize - 2))}
                  style={styles.sizeButton}
                >
                  <Icon name="remove" size={20} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.sizeValue, { color: colors.text }]}>{currentTextSize}px</Text>
                <TouchableOpacity
                  onPress={() => setCurrentTextSize(Math.min(48, currentTextSize + 2))}
                  style={styles.sizeButton}
                >
                  <Icon name="add" size={20} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Stickers Modal */}
      <Modal visible={showStickers} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowStickers(false)}>
              <Text style={[styles.modalCancel, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Stickers</Text>
            <View style={styles.modalSpacer} />
          </View>

          <ScrollView style={styles.stickersContent}>
            {Object.entries(STICKERS).map(([category, stickers]) => (
              <View key={category} style={styles.stickerCategory}>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
                <View style={styles.stickersGrid}>
                  {stickers.map((sticker, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.stickerOption}
                      onPress={() => addSticker(sticker)}
                    >
                      <Text style={styles.stickerEmoji}>{sticker}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
    fontWeight: 'bold',
  },
  nextButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  shareButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  shareButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Selection Screen
  selectionScreen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  selectionHeader: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  selectionOptions: {
    gap: 24,
  },
  selectionOption: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  selectionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectionText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  selectionSubtext: {
    fontSize: 14,
    textAlign: 'center',
  },

  // Edit Screen
  editScreen: {
    flex: 1,
  },
  mediaPreview: {
    flex: 1,
    position: 'relative',
  },
  filterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    mixBlendMode: 'overlay',
  },
  textElement: {
    position: 'absolute',
    padding: 4,
  },
  stickerElement: {
    position: 'absolute',
    padding: 4,
  },
  stickerText: {
    fontSize: 32,
  },
  editTools: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  editTool: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
  },
  editToolText: {
    fontSize: 12,
    marginTop: 4,
  },

  // Share Screen
  shareScreen: {
    flex: 1,
  },
  shareContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  shareThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginVertical: 16,
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  multiMediaIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },
  multiMediaText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 2,
  },
  captionSection: {
    marginBottom: 16,
  },
  captionInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  captionCounter: {
    textAlign: 'right',
    fontSize: 12,
    marginTop: 4,
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginBottom: 16,
  },
  locationInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  privacySection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  privacyOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyOptionText: {
    fontSize: 16,
    marginLeft: 12,
  },

  // Modals
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalCancel: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalDone: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSpacer: {
    width: 50,
  },
  
  // Filters
  filtersScroll: {
    paddingVertical: 16,
  },
  filterOption: {
    alignItems: 'center',
    marginHorizontal: 8,
    padding: 8,
    borderRadius: 8,
    width: 80,
  },
  selectedFilterOption: {
    backgroundColor: 'rgba(0,123,255,0.1)',
  },
  filterPreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterEmoji: {
    fontSize: 24,
  },
  filterName: {
    fontSize: 12,
    textAlign: 'center',
  },

  // Text Editor
  textEditorContent: {
    flex: 1,
    padding: 16,
  },
  textEditorInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 24,
  },
  textControls: {
    marginBottom: 16,
  },
  textControlLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorOption: {
    borderColor: '#007AFF',
    borderWidth: 3,
  },
  sizeControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sizeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sizeValue: {
    fontSize: 16,
    marginHorizontal: 16,
    minWidth: 60,
    textAlign: 'center',
  },

  // Stickers
  stickersContent: {
    flex: 1,
    padding: 16,
  },
  stickerCategory: {
    marginBottom: 24,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  stickersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stickerOption: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  stickerEmoji: {
    fontSize: 24,
  },
});

export default InstagramCreateScreen;
