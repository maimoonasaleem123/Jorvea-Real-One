import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService from '../services/firebaseService';

const { width, height } = Dimensions.get('window');

interface StoryFilter {
  id: string;
  name: string;
  colors: string[];
  intensity: number;
  emoji: string;
}

interface StoryText {
  id: string;
  text: string;
  color: string;
  fontSize: number;
  fontFamily: string;
  position: { x: number; y: number };
  rotation: number;
  scale: number;
  opacity: number;
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowOffset?: { x: number; y: number };
  shadowBlur?: number;
}

interface StorySticker {
  id: string;
  type: 'emoji' | 'gif' | 'location' | 'mention' | 'hashtag' | 'music' | 'time' | 'weather';
  content: string;
  position: { x: number; y: number };
  scale: number;
  rotation: number;
  opacity: number;
}

interface StoryMusic {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  startTime: number;
}

const STORY_FILTERS: StoryFilter[] = [
  { id: 'none', name: 'Normal', colors: [], intensity: 0, emoji: '📷' },
  { id: 'vintage', name: 'Vintage', colors: ['#8B4513', '#DEB887'], intensity: 0.3, emoji: '📸' },
  { id: 'bright', name: 'Bright', colors: ['#FFD700', '#FFA500'], intensity: 0.2, emoji: '☀️' },
  { id: 'cool', name: 'Cool', colors: ['#00CED1', '#4169E1'], intensity: 0.25, emoji: '❄️' },
  { id: 'warm', name: 'Warm', colors: ['#FF6347', '#FF4500'], intensity: 0.2, emoji: '🔥' },
  { id: 'dramatic', name: 'Dramatic', colors: ['#800080', '#4B0082'], intensity: 0.4, emoji: '🎭' },
  { id: 'sunset', name: 'Sunset', colors: ['#FF8C00', '#FF1493'], intensity: 0.3, emoji: '🌅' },
  { id: 'ocean', name: 'Ocean', colors: ['#0077BE', '#00CED1'], intensity: 0.25, emoji: '🌊' },
  { id: 'forest', name: 'Forest', colors: ['#228B22', '#32CD32'], intensity: 0.3, emoji: '🌲' },
  { id: 'neon', name: 'Neon', colors: ['#FF1493', '#00FFFF'], intensity: 0.4, emoji: '💎' },
];

const TEXT_COLORS = [
  '#FFFFFF', '#000000', '#FF3040', '#FF6B35', '#F7931E',
  '#FFD23F', '#00C896', '#00A8CC', '#0078FF', '#8B5CF6',
  '#F472B6', '#EF4444', '#10B981', '#F59E0B', '#8B5A2B',
];

const FONT_FAMILIES = [
  { name: 'System', value: 'System' },
  { name: 'Bold', value: 'HelveticaNeue-Bold' },
  { name: 'Light', value: 'HelveticaNeue-Light' },
  { name: 'Typewriter', value: 'American Typewriter' },
  { name: 'Modern', value: 'Avenir-Heavy' },
  { name: 'Classic', value: 'Charter-Roman' },
];

const POPULAR_EMOJIS = [
  '😀', '😂', '❤️', '🔥', '👏', '😍', '🤔', '😎', '💯', '✨',
  '🎉', '🎵', '📸', '🌟', '💫', '🦄', '🌈', '☀️', '🌙', '⭐',
];

const STORY_STICKERS = [
  { type: 'time', label: 'Time', icon: '🕐' },
  { type: 'weather', label: 'Weather', icon: '🌤️' },
  { type: 'location', label: 'Location', icon: '📍' },
  { type: 'mention', label: 'Mention', icon: '@' },
  { type: 'hashtag', label: 'Hashtag', icon: '#' },
  { type: 'music', label: 'Music', icon: '🎵' },
];

export default function ComprehensiveStoryCreationScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  // Media states
  const [selectedMedia, setSelectedMedia] = useState<{
    uri: string;
    type: 'photo' | 'video';
    duration?: number;
    width?: number;
    height?: number;
  } | null>(null);
  
  // Story editing states
  const [selectedFilter, setSelectedFilter] = useState<StoryFilter>(STORY_FILTERS[0]);
  const [storyTexts, setStoryTexts] = useState<StoryText[]>([]);
  const [storyStickers, setStoryStickers] = useState<StorySticker[]>([]);
  const [selectedMusic, setSelectedMusic] = useState<StoryMusic | null>(null);
  
  // UI states
  const [showMediaPicker, setShowMediaPicker] = useState(!selectedMedia);
  const [showFilterSelector, setShowFilterSelector] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showStickerSelector, setShowStickerSelector] = useState(false);
  const [showMusicSelector, setShowMusicSelector] = useState(false);
  const [currentTextEdit, setCurrentTextEdit] = useState<StoryText | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  
  // Upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Animation refs
  const filterOpacity = useRef(new Animated.Value(0)).current;
  
  // Safety check for user
  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="person-outline" size={60} color="#ccc" />
          <Text style={styles.errorText}>Please log in to create stories</Text>
          <TouchableOpacity 
            style={styles.errorButton} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pickMediaFromGallery = useCallback(() => {
    try {
      const options = {
        mediaType: 'mixed' as MediaType,
        quality: 0.9 as const,
        videoQuality: 'high' as const,
        maxWidth: 1080,
        maxHeight: 1920,
        includeBase64: false,
        allowsEditing: true,
      };

      launchImageLibrary(options, (response: ImagePickerResponse) => {
        if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          setSelectedMedia({
            uri: asset.uri!,
            type: asset.type?.startsWith('video') ? 'video' : 'photo',
            duration: asset.duration,
            width: asset.width,
            height: asset.height,
          });
          setShowMediaPicker(false);
        }
      });
    } catch (error) {
      console.error('Error picking media:', error);
      Alert.alert('Error', 'Failed to pick media. Please try again.');
    }
  }, []);

  const captureFromCamera = useCallback(() => {
    try {
      const options = {
        mediaType: 'mixed' as MediaType,
        quality: 0.9 as const,
        videoQuality: 'high' as const,
        maxWidth: 1080,
        maxHeight: 1920,
        includeBase64: false,
        cameraType: 'back' as const,
      };

      launchCamera(options, (response: ImagePickerResponse) => {
        if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          setSelectedMedia({
            uri: asset.uri!,
            type: asset.type?.startsWith('video') ? 'video' : 'photo',
            duration: asset.duration,
            width: asset.width,
            height: asset.height,
          });
          setShowMediaPicker(false);
        }
      });
    } catch (error) {
      console.error('Error capturing media:', error);
      Alert.alert('Error', 'Failed to capture media. Please try again.');
    }
  }, []);

  const addText = useCallback(() => {
    const newText: StoryText = {
      id: Date.now().toString(),
      text: 'Your text here',
      color: '#FFFFFF',
      fontSize: 24,
      fontFamily: 'System',
      position: { x: width / 2, y: height / 2 },
      rotation: 0,
      scale: 1,
      opacity: 1,
      strokeColor: '#000000',
      strokeWidth: 0,
      shadowColor: 'rgba(0,0,0,0.5)',
      shadowOffset: { x: 2, y: 2 },
      shadowBlur: 4,
    };
    
    setStoryTexts(prev => [...prev, newText]);
    setCurrentTextEdit(newText);
    setShowTextEditor(true);
  }, []);

  const updateText = useCallback((textId: string, updates: Partial<StoryText>) => {
    setStoryTexts(prev => prev.map(text => 
      text.id === textId ? { ...text, ...updates } : text
    ));
    
    if (currentTextEdit && currentTextEdit.id === textId) {
      setCurrentTextEdit({ ...currentTextEdit, ...updates });
    }
  }, [currentTextEdit]);

  const deleteText = useCallback((textId: string) => {
    setStoryTexts(prev => prev.filter(text => text.id !== textId));
    if (currentTextEdit?.id === textId) {
      setCurrentTextEdit(null);
      setShowTextEditor(false);
    }
  }, [currentTextEdit]);

  const addSticker = useCallback((type: string, content: string) => {
    const newSticker: StorySticker = {
      id: Date.now().toString(),
      type: type as any,
      content,
      position: { x: width / 2, y: height / 2 },
      scale: 1,
      rotation: 0,
      opacity: 1,
    };
    
    setStoryStickers(prev => [...prev, newSticker]);
    setShowStickerSelector(false);
  }, []);

  const applyFilter = useCallback((filter: StoryFilter) => {
    setSelectedFilter(filter);
    setShowFilterSelector(false);
    
    Animated.sequence([
      Animated.timing(filterOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(filterOpacity, {
        toValue: filter.intensity,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [filterOpacity]);

  const publishStory = async () => {
    if (!selectedMedia || !user) {
      Alert.alert('Error', 'Please select media first');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Create story data - only include defined values
      const storyData: any = {
        mediaUri: selectedMedia.uri,
        mediaType: selectedMedia.type,
      };

      // Only add optional fields if they have values
      if (selectedMedia.duration) {
        storyData.duration = selectedMedia.duration;
      }
      if (selectedFilter.id !== 'none') {
        storyData.filter = selectedFilter;
      }
      if (storyTexts.length > 0) {
        storyData.texts = storyTexts;
      }
      if (storyStickers.length > 0) {
        storyData.stickers = storyStickers;
      }
      if (selectedMusic) {
        storyData.music = selectedMusic;
      }

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = prev + Math.random() * 20;
          return newProgress >= 90 ? 90 : newProgress;
        });
      }, 200);

      // Upload to Firebase
      await FirebaseService.createStory(storyData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(() => {
        Alert.alert(
          'Success! ✨', 
          'Your story has been published and will be visible for 24 hours.',
          [{ text: 'Great!', onPress: () => navigation.goBack() }]
        );
      }, 500);
      
    } catch (error) {
      console.error('Publish story error:', error);
      Alert.alert('Error', 'Failed to publish story. Please try again.');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const getCurrentWeather = () => {
    // In a real app, you would get this from a weather API
    const weathers = ['☀️ Sunny', '⛅ Partly Cloudy', '☁️ Cloudy', '🌧️ Rainy'];
    return weathers[Math.floor(Math.random() * weathers.length)];
  };

  if (showMediaPicker) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="close" size={28} color="#fff" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Create Story</Text>
          
          <View style={styles.headerButton} />
        </View>
        
        {/* Media Picker */}
        <View style={styles.mediaPickerContainer}>
          <View style={styles.mediaPickerContent}>
            <Icon name="camera-outline" size={80} color="#fff" />
            <Text style={styles.mediaPickerTitle}>Add Photo or Video</Text>
            <Text style={styles.mediaPickerSubtitle}>
              Choose from gallery or capture new content
            </Text>
            
            <View style={styles.mediaPickerButtons}>
              <TouchableOpacity style={styles.mediaButton} onPress={captureFromCamera}>
                <Icon name="camera" size={24} color="#fff" />
                <Text style={styles.mediaButtonText}>Camera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.mediaButton} onPress={pickMediaFromGallery}>
                <Icon name="images" size={24} color="#fff" />
                <Text style={styles.mediaButtonText}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => setShowMediaPicker(true)}
        >
          <Icon name="refresh" size={28} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Edit Story</Text>
        
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={publishStory}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.publishText}>Share</Text>
          )}
        </TouchableOpacity>
      </View>
      
      {/* Main Content */}
      <View style={styles.editingContainer}>
        {selectedMedia && (
          <>
            <Image source={{ uri: selectedMedia.uri }} style={styles.editingMedia} />
            
            {/* Filter Overlay */}
            {selectedFilter.id !== 'none' && (
              <Animated.View 
                style={[
                  styles.filterOverlay,
                  { opacity: filterOpacity }
                ]}
              >
                <LinearGradient
                  colors={selectedFilter.colors}
                  style={styles.filterGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              </Animated.View>
            )}
            
            {/* Text Elements */}
            {storyTexts.map(textElement => (
              <TouchableOpacity
                key={textElement.id}
                style={[
                  styles.textElement,
                  {
                    left: textElement.position.x - 50,
                    top: textElement.position.y - 20,
                    transform: [
                      { rotate: `${textElement.rotation}deg` },
                      { scale: textElement.scale },
                    ],
                  },
                ]}
                onPress={() => {
                  setCurrentTextEdit(textElement);
                  setShowTextEditor(true);
                }}
                onLongPress={() => setSelectedElement(textElement.id)}
              >
                <Text
                  style={[
                    styles.storyText,
                    {
                      color: textElement.color,
                      fontSize: textElement.fontSize,
                      fontFamily: textElement.fontFamily,
                      opacity: textElement.opacity,
                    },
                  ]}
                >
                  {textElement.text}
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
                    left: sticker.position.x - 25,
                    top: sticker.position.y - 25,
                    transform: [
                      { rotate: `${sticker.rotation}deg` },
                      { scale: sticker.scale },
                    ],
                  },
                ]}
                onPress={() => setSelectedElement(sticker.id)}
              >
                <Text style={[styles.stickerText, { opacity: sticker.opacity }]}>
                  {sticker.content}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
      
      {/* Upload Progress */}
      {isUploading && (
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadProgress}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.uploadText}>Publishing your story...</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
          </View>
        </View>
      )}
      
      {/* Controls */}
      <View style={styles.editingControls}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setShowFilterSelector(true)}
        >
          <Icon name="color-filter-outline" size={24} color="#fff" />
          <Text style={styles.controlLabel}>Filter</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={addText}
        >
          <Icon name="text-outline" size={24} color="#fff" />
          <Text style={styles.controlLabel}>Text</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setShowStickerSelector(true)}
        >
          <Icon name="happy-outline" size={24} color="#fff" />
          <Text style={styles.controlLabel}>Stickers</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setShowMusicSelector(true)}
        >
          <Icon name="musical-notes-outline" size={24} color="#fff" />
          <Text style={styles.controlLabel}>Music</Text>
        </TouchableOpacity>
      </View>
      
      {/* Filter Selector Modal */}
      <Modal
        visible={showFilterSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterSelector(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.filterModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Filter</Text>
              <TouchableOpacity onPress={() => setShowFilterSelector(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
              {STORY_FILTERS.map(filter => (
                <TouchableOpacity
                  key={filter.id}
                  style={[
                    styles.filterOption,
                    selectedFilter.id === filter.id && styles.selectedFilter
                  ]}
                  onPress={() => applyFilter(filter)}
                >
                  <View style={styles.filterPreview}>
                    {filter.colors.length > 0 ? (
                      <LinearGradient
                        colors={filter.colors}
                        style={styles.filterGradientPreview}
                      />
                    ) : (
                      <View style={styles.filterNormalPreview} />
                    )}
                    <Text style={styles.filterEmoji}>{filter.emoji}</Text>
                  </View>
                  <Text style={styles.filterName}>{filter.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Text Editor Modal */}
      <Modal
        visible={showTextEditor}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTextEditor(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.textModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Text</Text>
              <TouchableOpacity onPress={() => setShowTextEditor(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.textInput}
              value={currentTextEdit?.text || ''}
              onChangeText={(text) => {
                if (currentTextEdit) {
                  updateText(currentTextEdit.id, { text });
                }
              }}
              placeholder="Type your text..."
              placeholderTextColor="#999"
              multiline
              maxLength={150}
            />
            
            {/* Font Family Selector */}
            <Text style={styles.sectionTitle}>Font Style</Text>
            <ScrollView horizontal style={styles.fontSelector} showsHorizontalScrollIndicator={false}>
              {FONT_FAMILIES.map(font => (
                <TouchableOpacity
                  key={font.value}
                  style={[
                    styles.fontOption,
                    currentTextEdit?.fontFamily === font.value && styles.selectedFontOption
                  ]}
                  onPress={() => {
                    if (currentTextEdit) {
                      updateText(currentTextEdit.id, { fontFamily: font.value });
                    }
                  }}
                >
                  <Text style={[styles.fontPreview, { fontFamily: font.value }]}>Aa</Text>
                  <Text style={styles.fontName}>{font.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Color Picker */}
            <Text style={styles.sectionTitle}>Text Color</Text>
            <ScrollView horizontal style={styles.colorPicker} showsHorizontalScrollIndicator={false}>
              {TEXT_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    currentTextEdit?.color === color && styles.selectedColor
                  ]}
                  onPress={() => {
                    if (currentTextEdit) {
                      updateText(currentTextEdit.id, { color });
                    }
                  }}
                />
              ))}
            </ScrollView>
            
            {/* Size Slider */}
            <Text style={styles.sectionTitle}>Text Size</Text>
            <View style={styles.sliderContainer}>
              <TouchableOpacity
                style={styles.sliderButton}
                onPress={() => {
                  if (currentTextEdit && currentTextEdit.fontSize > 12) {
                    updateText(currentTextEdit.id, { fontSize: currentTextEdit.fontSize - 2 });
                  }
                }}
              >
                <Icon name="remove" size={20} color="#666" />
              </TouchableOpacity>
              
              <Text style={styles.sliderValue}>{currentTextEdit?.fontSize || 24}px</Text>
              
              <TouchableOpacity
                style={styles.sliderButton}
                onPress={() => {
                  if (currentTextEdit && currentTextEdit.fontSize < 48) {
                    updateText(currentTextEdit.id, { fontSize: currentTextEdit.fontSize + 2 });
                  }
                }}
              >
                <Icon name="add" size={20} color="#666" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.textModalButtons}>
              <TouchableOpacity
                style={styles.textModalButton}
                onPress={() => {
                  if (currentTextEdit) {
                    deleteText(currentTextEdit.id);
                  }
                }}
              >
                <Icon name="trash" size={20} color="#FF3B30" />
                <Text style={[styles.textModalButtonText, { color: '#FF3B30' }]}>Delete</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.textModalButton, styles.primaryButton]}
                onPress={() => setShowTextEditor(false)}
              >
                <Icon name="checkmark" size={20} color="#fff" />
                <Text style={[styles.textModalButtonText, styles.primaryButtonText]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Sticker Selector Modal */}
      <Modal
        visible={showStickerSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStickerSelector(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.stickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Stickers</Text>
              <TouchableOpacity onPress={() => setShowStickerSelector(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            {/* Story Stickers */}
            <Text style={styles.sectionTitle}>Story Elements</Text>
            <View style={styles.stickerGrid}>
              {STORY_STICKERS.map(sticker => (
                <TouchableOpacity
                  key={sticker.type}
                  style={styles.stickerButton}
                  onPress={() => {
                    let content = '';
                    switch (sticker.type) {
                      case 'time':
                        content = getCurrentTime();
                        break;
                      case 'weather':
                        content = getCurrentWeather();
                        break;
                      case 'location':
                        content = '📍 Current Location';
                        break;
                      case 'mention':
                        content = '@username';
                        break;
                      case 'hashtag':
                        content = '#hashtag';
                        break;
                      case 'music':
                        content = '🎵 Now Playing';
                        break;
                      default:
                        content = sticker.icon;
                    }
                    addSticker(sticker.type, content);
                  }}
                >
                  <Text style={styles.stickerIcon}>{sticker.icon}</Text>
                  <Text style={styles.stickerLabel}>{sticker.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Emoji Stickers */}
            <Text style={styles.sectionTitle}>Popular Emojis</Text>
            <View style={styles.emojiGrid}>
              {POPULAR_EMOJIS.map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.emojiButton}
                  onPress={() => addSticker('emoji', emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
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
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 1000,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  publishText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginVertical: 20,
  },
  errorButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mediaPickerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mediaPickerContent: {
    alignItems: 'center',
  },
  mediaPickerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  mediaPickerSubtitle: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 40,
  },
  mediaPickerButtons: {
    flexDirection: 'row',
    gap: 20,
  },
  mediaButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 30,
    paddingVertical: 20,
    borderRadius: 15,
    alignItems: 'center',
    minWidth: 120,
  },
  mediaButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  editingContainer: {
    flex: 1,
    position: 'relative',
  },
  editingMedia: {
    flex: 1,
    width: '100%',
    resizeMode: 'cover',
  },
  filterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  filterGradient: {
    flex: 1,
  },
  textElement: {
    position: 'absolute',
    padding: 8,
    zIndex: 10,
    minWidth: 100,
  },
  storyText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  stickerElement: {
    position: 'absolute',
    padding: 4,
    zIndex: 10,
    minWidth: 50,
    minHeight: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stickerText: {
    fontSize: 20,
    textAlign: 'center',
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
    zIndex: 1000,
  },
  uploadProgress: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 30,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 200,
  },
  uploadText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 15,
    marginBottom: 20,
  },
  progressBar: {
    width: 200,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 10,
  },
  editingControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1000,
  },
  controlButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 12,
    borderRadius: 30,
    minWidth: 60,
  },
  controlLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: height * 0.5,
  },
  textModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: height * 0.8,
  },
  stickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: height * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  filterScroll: {
    marginBottom: 10,
  },
  filterOption: {
    alignItems: 'center',
    marginRight: 15,
    padding: 10,
    borderRadius: 15,
  },
  selectedFilter: {
    backgroundColor: '#E3F2FD',
  },
  filterPreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  filterGradientPreview: {
    flex: 1,
    width: '100%',
  },
  filterNormalPreview: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f0f0f0',
  },
  filterEmoji: {
    position: 'absolute',
    fontSize: 24,
  },
  filterName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    marginTop: 10,
  },
  fontSelector: {
    marginBottom: 15,
  },
  fontOption: {
    alignItems: 'center',
    marginRight: 15,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    minWidth: 60,
  },
  selectedFontOption: {
    borderColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  fontPreview: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  fontName: {
    fontSize: 12,
    color: '#666',
  },
  colorPicker: {
    marginBottom: 15,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#007AFF',
    borderWidth: 3,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  sliderButton: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 20,
    marginHorizontal: 10,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'center',
  },
  textModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
    marginTop: 20,
  },
  textModalButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  textModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  primaryButtonText: {
    color: '#fff',
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  stickerButton: {
    alignItems: 'center',
    width: (width - 80) / 3,
    padding: 15,
    marginBottom: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
  },
  stickerIcon: {
    fontSize: 30,
    marginBottom: 8,
  },
  stickerLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emojiButton: {
    width: (width - 100) / 5,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
  emojiText: {
    fontSize: 24,
  },
});
