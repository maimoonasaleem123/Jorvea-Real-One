import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  PermissionsAndroid,
  Platform,
  Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary, launchCamera, MediaType, ImagePickerResponse, PhotoQuality } from 'react-native-image-picker';
import Video, { VideoRef } from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import { useInstagramFastPosts } from '../context/InstagramFastPostsContext';
import { BeautifulHeader } from '../components/BeautifulHeader';
import { BeautifulButton } from '../components/BeautifulButton';
import FirebaseService from '../services/firebaseService';
import DigitalOceanService from '../services/digitalOceanService';
import { User } from '../types';
import EnhancedPostCamera from '../components/EnhancedPostCamera';

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

interface PostFilter {
  id: string;
  name: string;
  colors: string[];
  intensity: number;
  emoji: string;
}

const POST_FILTERS: PostFilter[] = [
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
  { id: 'sepia', name: 'Sepia', colors: ['#D2B48C', '#8B7355'], intensity: 0.35, emoji: '🕰️' },
  { id: 'royal', name: 'Royal', colors: ['#4B0082', '#9932CC'], intensity: 0.3, emoji: '👑' },
];

const CreatePostScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { addPost, refreshPosts } = useInstagramFastPosts();
  
  // Media states
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<PostFilter>(POST_FILTERS[0]);
  
  // Content states
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  
  // Privacy states
  const [isPublic, setIsPublic] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  const [allowLikes, setAllowLikes] = useState(true);
  
  // Progress state
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Animation refs
  const filterOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        // For Android 13+ we need different permissions
        const permissions = [
          PermissionsAndroid.PERMISSIONS.CAMERA,
        ];

        // Add storage permissions for older Android versions
        if (Platform.Version < 33) {
          permissions.push(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          );
        } else {
          // For Android 13+, we need media permissions
          permissions.push(
            'android.permission.READ_MEDIA_IMAGES' as any,
            'android.permission.READ_MEDIA_VIDEO' as any,
          );
        }
        
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        console.log('Permissions granted:', granted);
        
        // Check if camera permission is granted
        const cameraGranted = granted[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
        
        if (!cameraGranted) {
          Alert.alert(
            'Camera Permission Required', 
            'Please grant camera permission to take photos and videos.',
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Open Settings',
                onPress: () => {
                  // You can add logic to open app settings here
                  Alert.alert('Please enable camera permission in app settings');
                },
              },
            ]
          );
          return false;
        }
        
        return cameraGranted;
      } catch (err) {
        console.error('Permission request error:', err);
        Alert.alert('Error', 'Failed to request camera permission');
        return false;
      }
    }
    return true; // iOS permissions are handled by the image picker
  };

  const selectMediaFromGallery = useCallback(() => {
    const options = {
      mediaType: 'mixed' as MediaType,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8 as PhotoQuality,
      selectionLimit: 10,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) return;

      if (response.assets) {
        const newMedia: SelectedMedia[] = response.assets.map((asset) => ({
          uri: asset.uri || '',
          type: asset.type?.startsWith('video') ? 'video' : 'image',
          fileName: asset.fileName || 'media',
          fileSize: asset.fileSize || 0,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
        }));

        setSelectedMedia(prev => [...prev, ...newMedia]);
      }
    });
  }, []);

  const captureWithCamera = useCallback(async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      return;
    }

    Alert.alert(
      'Select Camera Mode',
      'Choose how to capture your media',
      [
        {
          text: 'Take Photo',
          onPress: () => takePicture(),
        },
        {
          text: 'Record Video',
          onPress: () => recordVideo(),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  }, []);

  const takePicture = useCallback(() => {
    const options = {
      mediaType: 'photo' as MediaType,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8 as PhotoQuality,
    };

    launchCamera(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        if (response.errorMessage) {
          console.error('Camera error:', response.errorMessage);
          Alert.alert('Camera Error', response.errorMessage);
        }
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const newMedia: SelectedMedia = {
          uri: asset.uri || '',
          type: 'image',
          fileName: asset.fileName || `photo_${Date.now()}.jpg`,
          fileSize: asset.fileSize || 0,
          width: asset.width,
          height: asset.height,
        };

        setSelectedMedia(prev => [...prev, newMedia]);
        console.log('Photo captured successfully:', newMedia);
      }
    });
  }, []);

  const recordVideo = useCallback(() => {
    const options = {
      mediaType: 'video' as MediaType,
      videoQuality: 'high' as const,
      durationLimit: 60,
      includeBase64: false,
    };

    launchCamera(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        if (response.errorMessage) {
          console.error('Camera error:', response.errorMessage);
          Alert.alert('Camera Error', response.errorMessage);
        }
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const newMedia: SelectedMedia = {
          uri: asset.uri || '',
          type: 'video',
          fileName: asset.fileName || `video_${Date.now()}.mp4`,
          fileSize: asset.fileSize || 0,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
        };

        setSelectedMedia(prev => [...prev, newMedia]);
        console.log('Video recorded successfully:', newMedia);
      }
    });
  }, []);

  const handleCameraCapture = useCallback((mediaUri: string, type: 'image' | 'video') => {
    const newMedia: SelectedMedia = {
      uri: mediaUri,
      type,
      fileName: `${type}_${Date.now()}`,
      fileSize: 0,
    };

    setSelectedMedia(prev => [...prev, newMedia]);
    setShowCamera(false);
  }, []);

  const removeMedia = useCallback((index: number) => {
    setSelectedMedia(prev => {
      const newMedia = prev.filter((_, i) => i !== index);
      if (currentMediaIndex >= newMedia.length && newMedia.length > 0) {
        setCurrentMediaIndex(newMedia.length - 1);
      }
      return newMedia;
    });
  }, [currentMediaIndex]);

  const addTag = useCallback(() => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags(prev => [...prev, tagInput.trim()]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  const uploadMediaToDigitalOcean = async (media: SelectedMedia): Promise<string> => {
    try {
      console.log('🔄 Uploading media to DigitalOcean:', media.fileName);
      
      // Create a unique file name with proper extension
      const timestamp = Date.now();
      const extension = media.fileName?.split('.').pop() || (media.type === 'video' ? 'mp4' : 'jpg');
      const fileName = `${media.type}s/${user?.uid}/${timestamp}_${Math.random().toString(36).substring(7)}.${extension}`;
      
      // Determine MIME type
      const mimeType = media.type === 'video' ? 'video/mp4' : 'image/jpeg';
      
      // Upload to DigitalOcean using the imported service
      const uploadedUrl = await DigitalOceanService.uploadMedia(media.uri, fileName, mimeType);
      
      console.log('✅ Media uploaded successfully:', uploadedUrl);
      
      // Ensure URL is properly formatted
      const fullUrl = uploadedUrl.startsWith('http') ? uploadedUrl : 
        `https://jorvea.blr1.cdn.digitaloceanspaces.com/${uploadedUrl.replace(/^\/+/, '')}`;
        
      return fullUrl;
    } catch (error) {
      console.error('❌ Media upload error:', error);
      
      // More user-friendly error handling
      Alert.alert(
        'Upload Failed',
        'Failed to upload media. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
      
      throw error;
    }
  };

  const createPost = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a post');
      return;
    }

    if (selectedMedia.length === 0 && !caption.trim()) {
      Alert.alert('Error', 'Please add media or write a caption');
      return;
    }

    setIsLoading(true);
    setUploadProgress(0);

    try {
      // Upload media files to DigitalOcean
      const mediaUrls: string[] = [];
      const mediaTypes: string[] = [];
      
      for (let i = 0; i < selectedMedia.length; i++) {
        const progressValue = (i / selectedMedia.length) * 0.8;
        setUploadProgress(progressValue);
        
        console.log(`🔄 Uploading media ${i + 1}/${selectedMedia.length}`);
        
        const url = await uploadMediaToDigitalOcean(selectedMedia[i]);
        mediaUrls.push(url);
        mediaTypes.push(selectedMedia[i].type);
        
        console.log(`✅ Media ${i + 1} uploaded: ${url}`);
      }

      setUploadProgress(0.9);

      // Create post data with proper media information
      const postData = {
        userId: user.uid,
        mediaUrls,
        mediaTypes, // Include media types array
        mediaType: selectedMedia.length > 1 ? 'carousel' as const : selectedMedia[0]?.type === 'video' ? 'video' as const : 'image' as const,
        type: selectedMedia.length > 1 ? 'carousel' as const : selectedMedia[0]?.type === 'video' ? 'video' as const : 'photo' as const,
        caption: caption.trim(),
        ...(location.trim() && {
          location: {
            id: `loc_${Date.now()}`,
            name: location.trim(),
            address: location.trim(),
            city: '',
            country: '',
            latitude: 0,
            longitude: 0,
            postsCount: 1,
          }
        }),
        hashtags: tags,
        mentions: [],
        tags,
        likes: [],
        comments: [],
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        shares: 0,
        saves: [],
        isArchived: false,
        isHidden: false,
        isPrivate: !isPublic,
        commentsDisabled: !allowComments,
        hideLikeCounts: !allowLikes,
        viewsCount: 0,
        isLiked: false,
        isSaved: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save to Firebase
      const postId = await FirebaseService.createPost(postData);
      
      // Create the post object with the returned ID
      const newPost = {
        id: postId,
        ...postData,
        user: {
          uid: user!.uid,
          username: user!.displayName || user!.email?.split('@')[0] || 'Unknown',
          displayName: user!.displayName || user!.email || 'Unknown',
          profilePicture: user!.photoURL || '',
          isVerified: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Add to local state immediately for instant UI update
      addPost(newPost);
      
      setUploadProgress(1);

      Alert.alert(
        'Success!',
        'Your post has been created successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setSelectedMedia([]);
              setCaption('');
              setLocation('');
              setTags([]);
              setTagInput('');
              setSelectedFilter(POST_FILTERS[0]);
              
              // Just go back to previous screen, posts context will automatically update
              navigation.goBack();
              
              // Refresh posts in background to sync with server
              setTimeout(() => {
                refreshPosts();
              }, 500);
            },
          },
        ]
      );

    } catch (error) {
      console.error('Create post error:', error);
      Alert.alert('Error', 'Failed to create post. Please try again.');
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const applyFilter = useCallback((filter: PostFilter) => {
    setSelectedFilter(filter);
    setShowFilters(false);
    
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

  const renderMediaPreview = () => {
    if (selectedMedia.length === 0) {
      return (
        <View style={styles.emptyMediaContainer}>
          <Icon name="camera-outline" size={60} color="#666" />
          <Text style={styles.emptyMediaText}>Add photos or videos</Text>
          <View style={styles.mediaButtons}>
            <TouchableOpacity style={styles.mediaButton} onPress={captureWithCamera}>
              <Icon name="camera" size={24} color="#fff" />
              <Text style={styles.mediaButtonText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.mediaButton} onPress={selectMediaFromGallery}>
              <Icon name="images" size={24} color="#fff" />
              <Text style={styles.mediaButtonText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    const currentMedia = selectedMedia[currentMediaIndex];

    return (
      <View style={styles.mediaPreviewContainer}>
        <View style={styles.mediaContainer}>
          {currentMedia.type === 'image' ? (
            <Image 
              source={{ uri: currentMedia.uri }} 
              style={styles.mediaPreview}
              resizeMode="cover"
            />
          ) : (
            <Video
              source={{ uri: currentMedia.uri }}
              style={styles.mediaPreview}
              resizeMode="cover"
              paused={false}
              muted={true}
              repeat={true}
            />
          )}
          
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

          <TouchableOpacity 
            style={styles.removeMediaButton}
            onPress={() => removeMedia(currentMediaIndex)}
          >
            <Icon name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {selectedMedia.length > 1 && (
          <FlatList
            data={selectedMedia}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mediaThumbnails}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.thumbnail,
                  index === currentMediaIndex && styles.activeThumbnail
                ]}
                onPress={() => setCurrentMediaIndex(index)}
              >
                <Image source={{ uri: item.uri }} style={styles.thumbnailImage} />
              </TouchableOpacity>
            )}
            keyExtractor={(_, index) => index.toString()}
          />
        )}

        <View style={styles.mediaActions}>
          <TouchableOpacity style={styles.actionButton} onPress={captureWithCamera}>
            <Icon name="camera" size={20} color="#007bff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={selectMediaFromGallery}>
            <Icon name="images" size={20} color="#007bff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => setShowFilters(true)}>
            <Icon name="color-filter" size={20} color="#007bff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderFilters = () => (
    <Modal visible={showFilters} animationType="slide" transparent>
      <View style={styles.filterModal}>
        <View style={styles.filterContainer}>
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Choose Filter</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Icon name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
            {POST_FILTERS.map(filter => (
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
  );

  const { colors, isDarkMode } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      
      {/* Beautiful Header */}
      <BeautifulHeader
        title="Create Post"
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        rightComponent={
          <BeautifulButton
            title={isLoading ? "Posting..." : "Share"}
            onPress={createPost}
            loading={isLoading}
            disabled={isLoading || (selectedMedia.length === 0 && !caption.trim())}
            size="sm"
            gradient={true}
          />
        }
      />

      <ScrollView 
        style={[styles.content, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: keyboardHeight + 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Media Preview */}
        {renderMediaPreview()}

        {/* Caption Input */}
        <View style={styles.inputSection}>
          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption..."
            placeholderTextColor="#666"
            multiline
            value={caption}
            onChangeText={setCaption}
            maxLength={2200}
          />
          <Text style={styles.characterCount}>{caption.length}/2200</Text>
        </View>

        {/* Location Input */}
        <View style={styles.inputSection}>
          <View style={styles.inputRow}>
            <Icon name="location-outline" size={20} color="#666" />
            <TextInput
              style={styles.locationInput}
              placeholder="Add location"
              placeholderTextColor="#666"
              value={location}
              onChangeText={setLocation}
            />
          </View>
        </View>

        {/* Tags Section */}
        <View style={styles.inputSection}>
          <View style={styles.inputRow}>
            <Icon name="pricetag-outline" size={20} color="#666" />
            <TextInput
              style={styles.tagInput}
              placeholder="Add tags (press Enter to add)"
              placeholderTextColor="#666"
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              returnKeyType="done"
            />
          </View>
          
          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.tag}
                  onPress={() => removeTag(tag)}
                >
                  <Text style={styles.tagText}>#{tag}</Text>
                  <Icon name="close" size={14} color="#007bff" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Privacy Settings */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Privacy Settings</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Icon name="globe-outline" size={20} color="#666" />
              <Text style={styles.settingLabel}>Public Post</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, isPublic && styles.toggleActive]}
              onPress={() => setIsPublic(!isPublic)}
            >
              <View style={[styles.toggleThumb, isPublic && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Icon name="chatbubble-outline" size={20} color="#666" />
              <Text style={styles.settingLabel}>Allow Comments</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, allowComments && styles.toggleActive]}
              onPress={() => setAllowComments(!allowComments)}
            >
              <View style={[styles.toggleThumb, allowComments && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Icon name="heart-outline" size={20} color="#666" />
              <Text style={styles.settingLabel}>Allow Likes</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, allowLikes && styles.toggleActive]}
              onPress={() => setAllowLikes(!allowLikes)}
            >
              <View style={[styles.toggleThumb, allowLikes && styles.toggleThumbActive]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Upload Progress */}
        {isLoading && (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {uploadProgress < 0.9 ? 'Uploading media...' : 'Creating post...'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Enhanced Post Camera */}
      <EnhancedPostCamera
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        allowVideo={true}
        onMediaCaptured={(media) => {
          const newMedia: SelectedMedia = {
            uri: media.uri,
            type: media.type,
            fileName: media.fileName || `media_${Date.now()}`,
            fileSize: media.fileSize || 0,
            width: media.width,
            height: media.height,
            duration: media.duration,
          };
          setSelectedMedia(prev => [...prev, newMedia]);
          setShowCamera(false);
        }}
      />

      {/* Filters Modal */}
      {renderFilters()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
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
    color: '#333',
  },
  shareButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  shareButtonDisabled: {
    backgroundColor: '#ccc',
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  emptyMediaContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    margin: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  emptyMediaText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    marginBottom: 20,
  },
  mediaButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007bff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  mediaButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  mediaPreviewContainer: {
    margin: 16,
  },
  mediaContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  mediaPreview: {
    width: '100%',
    height: 300,
    backgroundColor: '#f0f0f0',
  },
  filterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  removeMediaButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaThumbnails: {
    marginTop: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeThumbnail: {
    borderColor: '#007bff',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  mediaActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 20,
  },
  actionButton: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  inputSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  captionInput: {
    fontSize: 16,
    color: '#333',
    minHeight: 100,
    textAlignVertical: 'top',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  characterCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  locationInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    padding: 8,
  },
  tagInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
    padding: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  tagText: {
    color: '#007bff',
    fontSize: 14,
    fontWeight: '500',
  },
  settingsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#007bff',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  progressSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007bff',
    borderRadius: 2,
  },
  progressText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
  },
  filterModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  filterScroll: {
    paddingHorizontal: 20,
  },
  filterOption: {
    alignItems: 'center',
    marginRight: 15,
    padding: 8,
    borderRadius: 8,
  },
  selectedFilter: {
    backgroundColor: '#e3f2fd',
  },
  filterPreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  filterGradientPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  filterNormalPreview: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  filterEmoji: {
    position: 'absolute',
    fontSize: 20,
  },
  filterGradient: {
    width: '100%',
    height: '100%',
  },
  filterName: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
});

export default CreatePostScreen;
