import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Dimensions,
  Image,
  Modal,
  Animated,
  PanResponder,
  StatusBar,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary, launchCamera, MediaType } from 'react-native-image-picker';
import Video, { VideoRef } from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/FastAuthContext';
import { DigitalOceanService } from '../services/digitalOceanService';
import { FirebaseService } from '../services/firebaseService';
import MusicService, { MusicTrack } from '../services/musicService';
import { User } from '../types';

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
  strokeWidth: number;
  strokeColor: string;
  shadowOffset: { x: number; y: number };
  shadowOpacity: number;
  shadowColor: string;
  backgroundColor?: string;
  opacity: number;
}

interface StickerElement {
  id: string;
  type: 'location' | 'time' | 'weather' | 'mention' | 'hashtag' | 'emoji' | 'music';
  x: number;
  y: number;
  scale: number;
  rotation: number;
  data: any;
}

interface FilterType {
  id: string;
  name: string;
  overlay: string[];
  intensity: number;
  brightness: number;
  contrast: number;
  saturation: number;
}

const FILTERS: FilterType[] = [
  { id: 'original', name: 'Original', overlay: ['transparent'], intensity: 1, brightness: 1, contrast: 1, saturation: 1 },
  { id: 'vintage', name: 'Vintage', overlay: ['rgba(255, 223, 186, 0.3)', 'rgba(139, 69, 19, 0.2)'], intensity: 0.8, brightness: 0.9, contrast: 1.1, saturation: 0.8 },
  { id: 'dramatic', name: 'Dramatic', overlay: ['rgba(0, 0, 0, 0.3)', 'rgba(255, 255, 255, 0.1)'], intensity: 1.2, brightness: 0.8, contrast: 1.4, saturation: 1.1 },
  { id: 'warm', name: 'Warm', overlay: ['rgba(255, 165, 0, 0.2)', 'rgba(255, 69, 0, 0.1)'], intensity: 1, brightness: 1.1, contrast: 1, saturation: 1.2 },
  { id: 'cool', name: 'Cool', overlay: ['rgba(173, 216, 230, 0.3)', 'rgba(70, 130, 180, 0.2)'], intensity: 1, brightness: 1, contrast: 1.1, saturation: 0.9 },
  { id: 'bright', name: 'Bright', overlay: ['rgba(255, 255, 255, 0.2)'], intensity: 1.3, brightness: 1.3, contrast: 1.1, saturation: 1.1 },
  { id: 'moody', name: 'Moody', overlay: ['rgba(75, 0, 130, 0.3)', 'rgba(25, 25, 112, 0.2)'], intensity: 0.9, brightness: 0.7, contrast: 1.3, saturation: 0.8 },
  { id: 'sunset', name: 'Sunset', overlay: ['rgba(255, 94, 77, 0.3)', 'rgba(255, 154, 0, 0.2)'], intensity: 1.1, brightness: 1, contrast: 1.2, saturation: 1.3 },
  { id: 'noir', name: 'Noir', overlay: ['rgba(0, 0, 0, 0.4)', 'rgba(128, 128, 128, 0.2)'], intensity: 0.8, brightness: 0.6, contrast: 1.6, saturation: 0.3 },
  { id: 'spring', name: 'Spring', overlay: ['rgba(144, 238, 144, 0.2)', 'rgba(50, 205, 50, 0.1)'], intensity: 1.1, brightness: 1.2, contrast: 1, saturation: 1.4 },
];

const FONTS = [
  { name: 'System', value: 'System' },
  { name: 'Bold', value: 'System-Bold' },
  { name: 'Light', value: 'System-Light' },
  { name: 'Italic', value: 'System-Italic' },
  { name: 'Condensed', value: 'System-Condensed' },
  { name: 'Monospace', value: 'monospace' },
];

const COLORS = [
  '#FFFFFF', '#000000', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
  '#EE5A24', '#0ABDE3', '#10AC84', '#222F3E', '#C44569',
];

export default function ComprehensivePostCreationScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { user } = useAuth();
  const videoRef = useRef<VideoRef>(null);
  
  // Media states
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [step, setStep] = useState<'select' | 'edit' | 'caption'>('select');
  
  // Filter states
  const [selectedFilter, setSelectedFilter] = useState<FilterType>(FILTERS[0]);
  const [filterIntensity, setFilterIntensity] = useState(1);
  
  // Text editing states
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [currentTextColor, setCurrentTextColor] = useState('#FFFFFF');
  const [currentFont, setCurrentFont] = useState(FONTS[0]);
  const [currentFontSize, setCurrentFontSize] = useState(24);
  
  // Sticker states
  const [stickerElements, setStickerElements] = useState<StickerElement[]>([]);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  
  // Music states
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  
  // Post states
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<User[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // UI states
  const [showTools, setShowTools] = useState(true);
  const toolsOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadMusicTracks();
  }, []);

  const loadMusicTracks = async () => {
    try {
      const tracks = await MusicService.getRandomMusic(20); // Get 20 random tracks
      setMusicTracks(tracks);
    } catch (error) {
      console.error('Error loading music tracks:', error);
    }
  };

  // Media selection functions
  const selectFromLibrary = () => {
    const options = {
      mediaType: 'mixed' as MediaType,
      quality: 0.8 as const,
      includeBase64: false,
      selectionLimit: 10,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel || response.errorMessage) return;

      if (response.assets && response.assets.length > 0) {
        const media: SelectedMedia[] = response.assets.map(asset => ({
          uri: asset.uri!,
          type: asset.type?.startsWith('video') ? 'video' : 'image',
          fileName: asset.fileName || `media_${Date.now()}`,
          fileSize: asset.fileSize || 0,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
        }));
        
        setSelectedMedia(media);
        setStep('edit');
      }
    });
  };

  const takePhoto = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as const,
      includeBase64: false,
    };

    launchCamera(options, (response) => {
      if (response.didCancel || response.errorMessage) return;

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const media: SelectedMedia = {
          uri: asset.uri!,
          type: 'image',
          fileName: asset.fileName || `photo_${Date.now()}.jpg`,
          fileSize: asset.fileSize || 0,
          width: asset.width,
          height: asset.height,
        };
        
        setSelectedMedia([media]);
        setStep('edit');
      }
    });
  };

  const takeVideo = () => {
    const options = {
      mediaType: 'video' as MediaType,
      quality: 0.8 as const,
      includeBase64: false,
      durationLimit: 60,
    };

    launchCamera(options, (response) => {
      if (response.didCancel || response.errorMessage) return;

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const media: SelectedMedia = {
          uri: asset.uri!,
          type: 'video',
          fileName: asset.fileName || `video_${Date.now()}.mp4`,
          fileSize: asset.fileSize || 0,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
        };
        
        setSelectedMedia([media]);
        setStep('edit');
      }
    });
  };

  // Text editing functions
  const addTextElement = () => {
    const newText: TextElement = {
      id: `text_${Date.now()}`,
      text: currentText || 'Add text',
      x: width / 2 - 50,
      y: height / 2 - 12,
      fontSize: currentFontSize,
      color: currentTextColor,
      fontFamily: currentFont.value,
      rotation: 0,
      scale: 1,
      strokeWidth: 0,
      strokeColor: '#000000',
      shadowOffset: { x: 0, y: 0 },
      shadowOpacity: 0,
      shadowColor: '#000000',
      opacity: 1,
    };
    
    setTextElements([...textElements, newText]);
    setSelectedTextId(newText.id);
    setShowTextEditor(true);
  };

  const updateTextElement = (id: string, updates: Partial<TextElement>) => {
    setTextElements(prev => prev.map(element => 
      element.id === id ? { ...element, ...updates } : element
    ));
  };

  const deleteTextElement = (id: string) => {
    setTextElements(prev => prev.filter(element => element.id !== id));
    setSelectedTextId(null);
  };

  // Sticker functions
  const addSticker = (type: StickerElement['type'], data: any) => {
    const newSticker: StickerElement = {
      id: `sticker_${Date.now()}`,
      type,
      x: width / 2 - 25,
      y: height / 2 - 25,
      scale: 1,
      rotation: 0,
      data,
    };
    
    setStickerElements([...stickerElements, newSticker]);
    setShowStickerPicker(false);
  };

  const updateStickerElement = (id: string, updates: Partial<StickerElement>) => {
    setStickerElements(prev => prev.map(element => 
      element.id === id ? { ...element, ...updates } : element
    ));
  };

  const deleteStickerElement = (id: string) => {
    setStickerElements(prev => prev.filter(element => element.id !== id));
  };

  // Publishing function
  const publishPost = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a post');
      return;
    }

    if (selectedMedia.length === 0) {
      Alert.alert('Error', 'Please select at least one media file');
      return;
    }

    setIsUploading(true);

    try {
      // Upload media files
      const mediaUrls: string[] = [];
      
      for (const media of selectedMedia) {
        try {
          const fileName = `posts/${user.uid}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const mimeType = media.type === 'image' ? 'image/jpeg' : 'video/mp4';
          const uploadedUrl = await DigitalOceanService.uploadMedia(media.uri, fileName, mimeType);
          
          mediaUrls.push(uploadedUrl);
        } catch (uploadError) {
          console.error('Error uploading media:', uploadError);
          throw new Error(`Failed to upload ${media.type}`);
        }
      }

      // Prepare post data
      const postData = {
        userId: user.uid,
        caption: caption.trim(),
        mediaUrls,
        mediaType: (selectedMedia.length > 1 ? 'carousel' : selectedMedia[0].type) as 'image' | 'video' | 'carousel',
        type: (selectedMedia.length > 1 ? 'carousel' : selectedMedia[0].type === 'image' ? 'photo' : 'video') as 'photo' | 'video' | 'carousel',
        location: location.trim() ? {
          name: location.trim(),
        } : undefined,
        hashtags: hashtags.length > 0 ? hashtags : [],
        mentions: [],
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        shares: 0,
        saves: [],
        isArchived: false,
        isHidden: false,
        isPrivate: isPrivate,
        viewsCount: 0,
        commentsDisabled: false,
        hideLikeCounts: false,
        music: selectedMusic ? {
          id: selectedMusic.id,
          title: selectedMusic.title,
          artist: selectedMusic.artist,
          url: selectedMusic.url,
          duration: selectedMusic.duration,
        } : undefined,
        filter: selectedFilter.id !== 'original' ? {
          id: selectedFilter.id,
          name: selectedFilter.name,
          intensity: filterIntensity,
        } : undefined,
        textElements: textElements.length > 0 ? textElements : undefined,
        stickerElements: stickerElements.length > 0 ? stickerElements : undefined,
      };

      // Create post in Firebase
      const postId = await FirebaseService.createPost(postData);
      
      Alert.alert(
        'Success!', 
        'Your post has been published successfully',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.getParent()?.navigate('Home' as never);
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error publishing post:', error);
      Alert.alert('Error', 'Failed to publish post. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  // Toggle tools visibility
  const toggleTools = () => {
    const toValue = showTools ? 0 : 1;
    setShowTools(!showTools);
    
    Animated.timing(toolsOpacity, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // Render functions
  const renderMediaSelector = () => (
    <View style={styles.mediaSelectorContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.getParent()?.navigate('Home' as never)}>
          <Icon name="close" size={28} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.selectorContent}>
        <Text style={styles.selectorTitle}>Choose Media</Text>
        <Text style={styles.selectorSubtitle}>Select photos or videos to create your post</Text>

        <View style={styles.optionsContainer}>
          <TouchableOpacity style={styles.optionButton} onPress={selectFromLibrary}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={styles.optionGradient}>
              <Icon name="images" size={32} color="#fff" />
              <Text style={styles.optionText}>Gallery</Text>
              <Text style={styles.optionSubtext}>Choose from library</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionButton} onPress={takePhoto}>
            <LinearGradient colors={['#f093fb', '#f5576c']} style={styles.optionGradient}>
              <Icon name="camera" size={32} color="#fff" />
              <Text style={styles.optionText}>Photo</Text>
              <Text style={styles.optionSubtext}>Take a photo</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionButton} onPress={takeVideo}>
            <LinearGradient colors={['#4facfe', '#00f2fe']} style={styles.optionGradient}>
              <Icon name="videocam" size={32} color="#fff" />
              <Text style={styles.optionText}>Video</Text>
              <Text style={styles.optionSubtext}>Record video</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderCurrentMedia = () => {
    const media = selectedMedia[currentMediaIndex];
    if (!media) return null;

    return (
      <View style={styles.mediaContainer}>
        {media.type === 'image' ? (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: media.uri }} style={styles.media} resizeMode="cover" />
            
            {/* Filter overlay */}
            {selectedFilter.id !== 'original' && (
              <LinearGradient
                colors={selectedFilter.overlay}
                style={[styles.filterOverlay, { opacity: filterIntensity }]}
              />
            )}
            
            {/* Text elements */}
            {textElements.map(textElement => (
              <TouchableOpacity
                key={textElement.id}
                style={[
                  styles.textElement,
                  {
                    left: textElement.x,
                    top: textElement.y,
                    transform: [
                      { scale: textElement.scale },
                      { rotate: `${textElement.rotation}deg` }
                    ],
                  }
                ]}
                onPress={() => {
                  setSelectedTextId(textElement.id);
                  setCurrentText(textElement.text);
                  setCurrentTextColor(textElement.color);
                  setCurrentFontSize(textElement.fontSize);
                  setShowTextEditor(true);
                }}
              >
                <Text
                  style={[
                    styles.textElementText,
                    {
                      fontSize: textElement.fontSize,
                      color: textElement.color,
                      fontFamily: textElement.fontFamily,
                      opacity: textElement.opacity,
                    }
                  ]}
                >
                  {textElement.text}
                </Text>
              </TouchableOpacity>
            ))}
            
            {/* Sticker elements */}
            {stickerElements.map(stickerElement => (
              <TouchableOpacity
                key={stickerElement.id}
                style={[
                  styles.stickerElement,
                  {
                    left: stickerElement.x,
                    top: stickerElement.y,
                    transform: [
                      { scale: stickerElement.scale },
                      { rotate: `${stickerElement.rotation}deg` }
                    ],
                  }
                ]}
                onLongPress={() => deleteStickerElement(stickerElement.id)}
              >
                {renderSticker(stickerElement)}
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <Video
            ref={videoRef}
            source={{ uri: media.uri }}
            style={styles.media}
            resizeMode="cover"
            repeat
            muted
          />
        )}
      </View>
    );
  };

  const renderSticker = (sticker: StickerElement) => {
    switch (sticker.type) {
      case 'time':
        return (
          <View style={styles.stickerContent}>
            <Icon name="time" size={20} color="#fff" />
            <Text style={styles.stickerText}>{new Date().toLocaleTimeString()}</Text>
          </View>
        );
      case 'location':
        return (
          <View style={styles.stickerContent}>
            <Icon name="location" size={20} color="#fff" />
            <Text style={styles.stickerText}>{sticker.data.name || 'Current Location'}</Text>
          </View>
        );
      case 'weather':
        return (
          <View style={styles.stickerContent}>
            <Icon name="partly-sunny" size={20} color="#fff" />
            <Text style={styles.stickerText}>{sticker.data.temp || '22°C'}</Text>
          </View>
        );
      case 'hashtag':
        return (
          <View style={styles.stickerContent}>
            <Text style={styles.stickerText}>#{sticker.data.tag}</Text>
          </View>
        );
      case 'mention':
        return (
          <View style={styles.stickerContent}>
            <Text style={styles.stickerText}>@{sticker.data.username}</Text>
          </View>
        );
      case 'music':
        return (
          <View style={styles.stickerContent}>
            <Icon name="musical-notes" size={20} color="#fff" />
            <Text style={styles.stickerText}>{sticker.data.title}</Text>
          </View>
        );
      default:
        return (
          <View style={styles.stickerContent}>
            <Text style={styles.stickerText}>🎉</Text>
          </View>
        );
    }
  };

  const renderEditingTools = () => (
    <Animated.View style={[styles.editingTools, { opacity: toolsOpacity }]}>
      {/* Top tools */}
      <View style={styles.topTools}>
        <TouchableOpacity 
          style={styles.toolButton}
          onPress={() => navigation.getParent()?.navigate('Home' as never)}
        >
          <Icon name="close" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.topRightTools}>
          {selectedMusic && (
            <View style={styles.musicIndicator}>
              <Icon name="musical-notes" size={16} color="#fff" />
              <Text style={styles.musicIndicatorText} numberOfLines={1}>
                {selectedMusic.title}
              </Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={toggleTools}
          >
            <Icon name={showTools ? "eye-off" : "eye"} size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom tools */}
      <View style={styles.bottomTools}>
        {/* Filter selector */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterSelector}
        >
          {FILTERS.map(filter => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterOption,
                selectedFilter.id === filter.id && styles.selectedFilter
              ]}
              onPress={() => setSelectedFilter(filter)}
            >
              <View style={styles.filterPreview}>
                <LinearGradient
                  colors={filter.overlay}
                  style={styles.filterGradient}
                />
              </View>
              <Text style={styles.filterName}>{filter.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Main tools */}
        <View style={styles.mainTools}>
          <TouchableOpacity 
            style={styles.mainToolButton}
            onPress={addTextElement}
          >
            <Icon name="text" size={24} color="#fff" />
            <Text style={styles.toolLabel}>Text</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.mainToolButton}
            onPress={() => setShowStickerPicker(true)}
          >
            <Icon name="happy" size={24} color="#fff" />
            <Text style={styles.toolLabel}>Stickers</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.mainToolButton}
            onPress={() => setShowMusicPicker(true)}
          >
            <Icon name="musical-notes" size={24} color="#fff" />
            <Text style={styles.toolLabel}>Music</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.mainToolButton}
            onPress={() => setStep('caption')}
          >
            <Icon name="checkmark" size={24} color="#fff" />
            <Text style={styles.toolLabel}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Media navigation */}
      {selectedMedia.length > 1 && (
        <View style={styles.mediaNavigation}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {selectedMedia.map((media, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.mediaThumbnail,
                  currentMediaIndex === index && styles.selectedThumbnail
                ]}
                onPress={() => setCurrentMediaIndex(index)}
              >
                <Image source={{ uri: media.uri }} style={styles.thumbnailImage} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </Animated.View>
  );

  const renderTextEditor = () => (
    <Modal visible={showTextEditor} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.textEditorModal}>
          <View style={styles.textEditorHeader}>
            <TouchableOpacity onPress={() => setShowTextEditor(false)}>
              <Icon name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.textEditorTitle}>Edit Text</Text>
            <TouchableOpacity
              onPress={() => {
                if (selectedTextId) {
                  updateTextElement(selectedTextId, { 
                    text: currentText,
                    color: currentTextColor,
                    fontSize: currentFontSize,
                    fontFamily: currentFont.value,
                  });
                }
                setShowTextEditor(false);
              }}
            >
              <Text style={styles.doneButton}>Done</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.textInput}
            value={currentText}
            onChangeText={setCurrentText}
            placeholder="Enter text..."
            multiline
            autoFocus
          />

          {/* Font selector */}
          <ScrollView horizontal style={styles.fontSelector}>
            {FONTS.map(font => (
              <TouchableOpacity
                key={font.value}
                style={[
                  styles.fontOption,
                  currentFont.value === font.value && styles.selectedFont
                ]}
                onPress={() => setCurrentFont(font)}
              >
                <Text style={[styles.fontText, { fontFamily: font.value }]}>
                  {font.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Color selector */}
          <ScrollView horizontal style={styles.colorSelector}>
            {COLORS.map(color => (
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

          {/* Font size slider */}
          <View style={styles.fontSizeContainer}>
            <Text style={styles.fontSizeLabel}>Size: {currentFontSize}</Text>
            <View style={styles.fontSizeSlider}>
              {[16, 20, 24, 28, 32, 36, 40].map(size => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.sizeOption,
                    currentFontSize === size && styles.selectedSize
                  ]}
                  onPress={() => setCurrentFontSize(size)}
                >
                  <Text style={styles.sizeText}>{size}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {selectedTextId && (
            <TouchableOpacity
              style={styles.deleteTextButton}
              onPress={() => {
                deleteTextElement(selectedTextId);
                setShowTextEditor(false);
              }}
            >
              <Icon name="trash" size={20} color="#ff4444" />
              <Text style={styles.deleteTextText}>Delete Text</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderStickerPicker = () => (
    <Modal visible={showStickerPicker} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.stickerPickerModal}>
          <View style={styles.stickerPickerHeader}>
            <TouchableOpacity onPress={() => setShowStickerPicker(false)}>
              <Icon name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.stickerPickerTitle}>Add Sticker</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.stickerOptions}>
            <TouchableOpacity
              style={styles.stickerOption}
              onPress={() => addSticker('time', { timestamp: Date.now() })}
            >
              <Icon name="time" size={24} color="#007AFF" />
              <Text style={styles.stickerOptionText}>Time</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stickerOption}
              onPress={() => addSticker('location', { name: 'Current Location' })}
            >
              <Icon name="location" size={24} color="#007AFF" />
              <Text style={styles.stickerOptionText}>Location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stickerOption}
              onPress={() => addSticker('weather', { temp: '22°C', condition: 'Sunny' })}
            >
              <Icon name="partly-sunny" size={24} color="#007AFF" />
              <Text style={styles.stickerOptionText}>Weather</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stickerOption}
              onPress={() => {
                Alert.prompt('Add Hashtag', 'Enter hashtag:', (tag) => {
                  if (tag) addSticker('hashtag', { tag });
                });
              }}
            >
              <Icon name="pricetag" size={24} color="#007AFF" />
              <Text style={styles.stickerOptionText}>Hashtag</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stickerOption}
              onPress={() => {
                Alert.prompt('Mention User', 'Enter username:', (username) => {
                  if (username) addSticker('mention', { username });
                });
              }}
            >
              <Icon name="at" size={24} color="#007AFF" />
              <Text style={styles.stickerOptionText}>Mention</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const renderMusicPicker = () => (
    <Modal visible={showMusicPicker} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.musicPickerModal}>
          <View style={styles.musicPickerHeader}>
            <TouchableOpacity onPress={() => setShowMusicPicker(false)}>
              <Icon name="close" size={24} color="#000" />
            </TouchableOpacity>
            <Text style={styles.musicPickerTitle}>Choose Music</Text>
            {selectedMusic && (
              <TouchableOpacity onPress={() => setSelectedMusic(null)}>
                <Text style={styles.removeMusic}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={musicTracks}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.musicOption,
                  selectedMusic?.id === item.id && styles.selectedMusicOption
                ]}
                onPress={() => {
                  setSelectedMusic(item);
                  setShowMusicPicker(false);
                }}
              >
                <View style={styles.musicInfo}>
                  <Text style={styles.musicTitle}>{item.title}</Text>
                  <Text style={styles.musicArtist}>{item.artist}</Text>
                </View>
                <Icon 
                  name={selectedMusic?.id === item.id ? "checkmark-circle" : "musical-notes"} 
                  size={24} 
                  color={selectedMusic?.id === item.id ? "#007AFF" : "#666"} 
                />
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  const renderCaptionStep = () => (
    <View style={styles.captionContainer}>
      <View style={styles.captionHeader}>
        <TouchableOpacity onPress={() => setStep('edit')}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.captionHeaderTitle}>Share Post</Text>
        <TouchableOpacity 
          onPress={publishPost}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Text style={styles.shareButton}>Share</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.captionContent}>
        <View style={styles.postPreview}>
          <Image 
            source={{ uri: selectedMedia[0]?.uri }} 
            style={styles.postPreviewImage}
          />
          <View style={styles.postPreviewInfo}>
            <TextInput
              style={styles.captionInput}
              placeholder="Write a caption..."
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={2200}
            />
          </View>
        </View>

        <View style={styles.postOptions}>
          <TouchableOpacity style={styles.postOption}>
            <Icon name="location-outline" size={24} color="#666" />
            <TextInput
              style={styles.postOptionInput}
              placeholder="Add location"
              value={location}
              onChangeText={setLocation}
            />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.postOption}
            onPress={() => setIsPrivate(!isPrivate)}
          >
            <Icon 
              name={isPrivate ? "lock-closed" : "lock-open-outline"} 
              size={24} 
              color={isPrivate ? "#E1306C" : "#666"} 
            />
            <Text style={[styles.postOptionText, isPrivate && { color: "#E1306C" }]}>
              {isPrivate ? "Private post" : "Public post"}
            </Text>
            <View style={[styles.toggle, isPrivate && styles.toggleActive]}>
              <View style={[styles.toggleIndicator, isPrivate && styles.toggleIndicatorActive]} />
            </View>
          </TouchableOpacity>

          {selectedMusic && (
            <View style={styles.postOption}>
              <Icon name="musical-notes" size={24} color="#666" />
              <View style={styles.selectedMusicInfo}>
                <Text style={styles.selectedMusicTitle}>{selectedMusic.title}</Text>
                <Text style={styles.selectedMusicArtist}>{selectedMusic.artist}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedMusic(null)}>
                <Icon name="close" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.postStats}>
            <Text style={styles.postStatsText}>
              {selectedMedia.length} {selectedMedia.length === 1 ? 'item' : 'items'} selected
            </Text>
            {textElements.length > 0 && (
              <Text style={styles.postStatsText}>
                {textElements.length} text {textElements.length === 1 ? 'element' : 'elements'}
              </Text>
            )}
            {stickerElements.length > 0 && (
              <Text style={styles.postStatsText}>
                {stickerElements.length} {stickerElements.length === 1 ? 'sticker' : 'stickers'}
              </Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );

  // Main render
  if (step === 'select') {
    return renderMediaSelector();
  }

  if (step === 'caption') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        {renderCaptionStep()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <View style={styles.editContainer}>
        {renderCurrentMedia()}
        {renderEditingTools()}
        {renderTextEditor()}
        {renderStickerPicker()}
        {renderMusicPicker()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  
  // Media selector styles
  mediaSelectorContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  selectorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  selectorTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  selectorSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  optionsContainer: {
    width: '100%',
  },
  optionButton: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  optionGradient: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
  },
  optionSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  
  // Edit container styles
  editContainer: {
    flex: 1,
  },
  mediaContainer: {
    flex: 1,
  },
  imageWrapper: {
    flex: 1,
    position: 'relative',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  
  // Text element styles
  textElement: {
    position: 'absolute',
    padding: 8,
  },
  textElementText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  
  // Sticker element styles
  stickerElement: {
    position: 'absolute',
    padding: 4,
  },
  stickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stickerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  
  // Editing tools styles
  editingTools: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'box-none',
  },
  topTools: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  topRightTools: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  musicIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 12,
    maxWidth: 150,
  },
  musicIndicatorText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTools: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
  },
  filterSelector: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterOption: {
    alignItems: 'center',
    marginRight: 16,
  },
  selectedFilter: {
    transform: [{ scale: 1.1 }],
  },
  filterPreview: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterGradient: {
    flex: 1,
  },
  filterName: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  mainTools: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  mainToolButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
  },
  toolLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  mediaNavigation: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
  },
  mediaThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedThumbnail: {
    borderColor: '#007AFF',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  
  // Text editor modal styles
  textEditorModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  textEditorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  textEditorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  doneButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  textInput: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  fontSelector: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  fontOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    marginRight: 8,
  },
  selectedFont: {
    backgroundColor: '#007AFF',
  },
  fontText: {
    fontSize: 14,
    color: '#000',
  },
  colorSelector: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#000',
  },
  fontSizeContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  fontSizeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  fontSizeSlider: {
    flexDirection: 'row',
  },
  sizeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    marginRight: 8,
  },
  selectedSize: {
    backgroundColor: '#007AFF',
  },
  sizeText: {
    fontSize: 14,
    color: '#000',
  },
  deleteTextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    margin: 16,
    backgroundColor: '#ffebee',
    borderRadius: 8,
  },
  deleteTextText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Sticker picker modal styles
  stickerPickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  stickerPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  stickerPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  stickerOptions: {
    padding: 16,
  },
  stickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    marginBottom: 12,
  },
  stickerOptionText: {
    fontSize: 16,
    color: '#000',
    marginLeft: 12,
  },
  
  // Music picker modal styles
  musicPickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  musicPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  musicPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  removeMusic: {
    fontSize: 16,
    color: '#ff4444',
  },
  musicOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedMusicOption: {
    backgroundColor: '#f0f8ff',
  },
  musicInfo: {
    flex: 1,
  },
  musicTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  musicArtist: {
    fontSize: 14,
    color: '#666',
  },
  
  // Caption step styles
  captionContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  captionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  captionHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  shareButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  captionContent: {
    flex: 1,
  },
  postPreview: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  postPreviewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  postPreviewInfo: {
    flex: 1,
    marginLeft: 12,
  },
  captionInput: {
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  postOptions: {
    padding: 16,
  },
  postOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  postOptionInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
  },
  postOptionText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 12,
    color: '#000',
  },
  toggle: {
    width: 44,
    height: 24,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
    justifyContent: 'center',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#E1306C',
  },
  toggleIndicator: {
    width: 20,
    height: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleIndicatorActive: {
    transform: [{ translateX: 20 }],
  },
  selectedMusicInfo: {
    flex: 1,
    marginLeft: 12,
  },
  selectedMusicTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  selectedMusicArtist: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  postStats: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  postStatsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
});
