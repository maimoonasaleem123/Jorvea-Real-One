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
  Modal,
  ScrollView,
  Dimensions,
  Image,
  Animated,
  FlatList,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary, launchCamera, MediaType } from 'react-native-image-picker';
import Video, { VideoRef } from 'react-native-video';
import Slider from '@react-native-community/slider';
import { useAuth } from '../context/FastAuthContext';
import EnhancedReelsCamera from '../components/EnhancedReelsCamera';
import DigitalOceanService from '../services/digitalOceanService';
import FreeHLSService from '../services/FreeHLSService';
import FirebaseService from '../services/firebaseService';
import MusicService, { MusicTrack, MusicCategory } from '../services/musicService';
import VideoCompressor from '../services/VideoCompressor';
import VideoThumbnailService from '../services/VideoThumbnailService';
import BackgroundVideoProcessor from '../services/BackgroundVideoProcessor';

const { width, height } = Dimensions.get('window');

interface SelectedVideo {
  uri: string;
  duration: number;
  type: string;
  fileName: string;
  fileSize: number;
  thumbnailUrl?: string;
}

interface Filter {
  id: string;
  name: string;
  preview: string;
  intensity: number;
}

interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  rotation: number;
  scale: number;
}

const FILTERS: Filter[] = [
  { id: 'none', name: 'Original', preview: '🎬', intensity: 0 },
  { id: 'vintage', name: 'Vintage', preview: '📸', intensity: 0.8 },
  { id: 'dramatic', name: 'Dramatic', preview: '🎭', intensity: 0.9 },
  { id: 'bright', name: 'Bright', preview: '☀️', intensity: 0.7 },
  { id: 'dark', name: 'Dark', preview: '🌙', intensity: 0.6 },
  { id: 'cool', name: 'Cool', preview: '❄️', intensity: 0.5 },
  { id: 'warm', name: 'Warm', preview: '🔥', intensity: 0.5 },
  { id: 'sepia', name: 'Sepia', preview: '🍂', intensity: 0.8 },
];

export default function CreateReelScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { user } = useAuth();
  const videoRef = useRef<VideoRef>(null);
  
  // Video states
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(null);
  const [recordedVideo, setRecordedVideo] = useState<SelectedVideo | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState('');
  const [caption, setCaption] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  
  // UI states
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [showCameraView, setShowCameraView] = useState(false);
  const [showReelsCamera, setShowReelsCamera] = useState(false);
  
  // Content states
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<Filter>(FILTERS[0]);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [trendingMusic, setTrendingMusic] = useState<MusicTrack[]>([]);
  const [musicCategories, setMusicCategories] = useState<MusicCategory[]>([]);
  const [selectedMusicCategory, setSelectedMusicCategory] = useState('Trending');
  
  // Text editing states
  const [currentTextOverlay, setCurrentTextOverlay] = useState<TextOverlay | null>(null);
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textFontSize, setTextFontSize] = useState(24);
  
  // Camera states
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Load trending music on component mount
  useEffect(() => {
    loadMusicData();
  }, [selectedMusicCategory]);

  const loadMusicData = async () => {
    try {
      // Load music categories
      const categories = MusicService.getAllCategories();
      setMusicCategories(categories);
      
      // Load music based on selected category
      let music: MusicTrack[];
      if (selectedMusicCategory === 'Trending') {
        music = await MusicService.getTrendingMusic(20);
      } else {
        music = await MusicService.getMusicByCategory(selectedMusicCategory.toLowerCase());
      }
      setTrendingMusic(music);
    } catch (error) {
      console.error('Error loading music:', error);
      // Fallback to random music
      const fallback = await MusicService.getRandomMusic(10);
      setTrendingMusic(fallback);
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'App needs camera permission to record videos',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const openCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission denied', 'Camera permission is required to record videos');
      return;
    }
    
    Alert.alert(
      'Record Video',
      'Choose how you want to record your reel',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Record Now',
          onPress: () => recordVideo(),
        },
        {
          text: 'Open Camera App',
          onPress: () => launchCameraApp(),
        },
      ]
    );
  };

  const recordVideo = () => {
    const options = {
      mediaType: 'video' as MediaType,
      videoQuality: 'high' as const,
      durationLimit: 60, // 60 seconds max for reels
      includeBase64: false,
      cameraType: cameraType as 'front' | 'back',
    };

    launchCamera(options, (response) => {
      if (response.didCancel || response.errorMessage) {
        if (response.errorMessage) {
          Alert.alert('Error', response.errorMessage);
        }
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        if (asset.uri && asset.type && asset.fileName) {
          setSelectedVideo({
            uri: asset.uri,
            duration: asset.duration || 0,
            type: asset.type,
            fileName: asset.fileName,
            fileSize: asset.fileSize || 0,
            thumbnailUrl: asset.uri, // Use video URI as thumbnail for now
          });
          setIsPlaying(true);
        }
      }
    });
  };

  const launchCameraApp = () => {
    setShowReelsCamera(true);
  };

  const selectVideoFromLibrary = async () => {
    const options = {
      mediaType: 'video' as MediaType,
      videoQuality: 'high' as const,
      includeBase64: false,
    };

    launchImageLibrary(options, async (response) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        if (asset.uri && asset.type && asset.fileName) {
          
          // Show processing indicator
          setIsProcessing(true);
          setProcessingMessage('📹 Analyzing video...');
          
          try {
            // Validate video duration and properties
            const validation = await VideoCompressor.validateVideo(asset.uri);
            
            if (!validation.isValid) {
              setIsProcessing(false);
              Alert.alert('Invalid Video', validation.error || 'Please select a different video.');
              return;
            }

            let processedUri = asset.uri;
            const videoDuration = validation.duration || 0;

            // Automatically trim if longer than 60 seconds
            if (videoDuration > 60) {
              setProcessingMessage(`⏱️ Trimming video from ${Math.round(videoDuration)}s to 60s...`);
              console.log(`🎬 Auto-trimming video from ${videoDuration}s to 60 seconds...`);
              
              // Trim video to 60 seconds
              processedUri = await VideoCompressor.trimVideoTo60Seconds(asset.uri, videoDuration);
              
              // Show success message
              Alert.alert(
                '✂️ Video Trimmed',
                `Your ${Math.round(videoDuration)}s video has been trimmed to 60 seconds for Instagram Reels format.`,
                [{ text: 'OK' }]
              );
            }

            // Process video with compression
            await processVideoWithCompression(
              { ...asset, uri: processedUri }, 
              Math.min(videoDuration, 60)
            );

          } catch (error) {
            setIsProcessing(false);
            console.error('Error processing video:', error);
            Alert.alert('Error', 'Failed to process video. Please try again.');
          }
        }
      }
    });
  };

  const processVideoWithCompression = async (asset: any, duration: number) => {
    try {
      setProcessingMessage('🗜️ Optimizing video quality...');
      
      // Compress video for optimal upload
      const compressionResult = await VideoCompressor.compressVideo(asset.uri, (progress) => {
        setProcessingMessage(`🗜️ Compressing video... ${progress}%`);
      });
      
      if (!compressionResult.success) {
        setIsProcessing(false);
        Alert.alert('Optimization Failed', compressionResult.error || 'Failed to optimize video.');
        return;
      }

      // Log compression results
      if (compressionResult.originalSize && compressionResult.compressedSize) {
        const compressionRatio = ((compressionResult.originalSize - compressionResult.compressedSize) / compressionResult.originalSize * 100).toFixed(1);
        const originalSizeMB = (compressionResult.originalSize / (1024 * 1024)).toFixed(1);
        const compressedSizeMB = (compressionResult.compressedSize / (1024 * 1024)).toFixed(1);
        
        console.log(`✅ Video optimized: ${originalSizeMB}MB → ${compressedSizeMB}MB (${compressionRatio}% reduction)`);
        
        // Show optimization success
        if (compressionResult.originalSize > 10 * 1024 * 1024) { // Show only for large videos
          Alert.alert(
            '✅ Video Optimized!',
            `Original: ${originalSizeMB}MB\nOptimized: ${compressedSizeMB}MB\nSaved: ${compressionRatio}%`,
            [{ text: 'Great!' }]
          );
        }
      }

      // Set the optimized video
      setSelectedVideo({
        uri: compressionResult.compressedUri || asset.uri,
        duration: Math.min(duration, 60), // Cap at 60 seconds
        type: asset.type,
        fileName: asset.fileName,
        fileSize: compressionResult.compressedSize || asset.fileSize,
        thumbnailUrl: compressionResult.compressedUri || asset.uri,
      });
      
      setIsPlaying(true);
      setProcessingMessage('');
      setIsProcessing(false);
      
      console.log('✅ Video ready for upload!');

    } catch (error) {
      setIsProcessing(false);
      console.error('Error processing video:', error);
      Alert.alert('Error', 'Failed to optimize video. Please try again.');
    }
  };

  const handleNext = () => {
    if (!selectedVideo) {
      Alert.alert('No Video', 'Please select a video first');
      return;
    }
    setShowCaptionModal(true);
  };

  const uploadVideoToDigitalOcean = async (videoUri: string, fileName: string): Promise<string> => {
    try {
      const uploadedUrl = await DigitalOceanService.uploadMedia(videoUri, `reels/${fileName}`, 'video/mp4');
      return uploadedUrl;
    } catch (error) {
      console.error('Error uploading to Digital Ocean:', error);
      throw new Error('Failed to upload video');
    }
  };

  const createReel = async () => {
    if (!selectedVideo || !user) {
      Alert.alert('Error', 'Please select a video first');
      return;
    }

    setIsUploading(true);
    
    try {
      console.log('� Starting reel creation...');
      console.log('📹 Video URI:', selectedVideo.uri);
      console.log('👤 User ID:', user.uid);
      console.log('� Caption:', caption?.trim() || '(none)');
      
      // ✅ VALIDATE: Check if BackgroundVideoProcessor is available
      if (!BackgroundVideoProcessor || !BackgroundVideoProcessor.getInstance) {
        console.error('❌ BackgroundVideoProcessor not available');
        throw new Error('Video processing service not available. Please restart the app.');
      }

      console.log('📤 Adding video to background queue...');
      
      // Add to background processing queue with comprehensive error handling
      const uploadId = await BackgroundVideoProcessor.getInstance().addToQueue(
        selectedVideo.uri,
        user.uid,
        caption?.trim() || '' // ✅ FIXED: Safe caption handling with fallback
      ).catch((queueError) => {
        console.error('❌ Failed to add to queue:', queueError);
        throw new Error(`Queue error: ${queueError.message || 'Unknown error'}`);
      });

      console.log('✅ Video added to background queue:', uploadId);
      console.log('🔔 User will be notified when upload completes!');

      // Reset form
      setSelectedVideo(null);
      setCaption('');
      setSelectedMusic(null);
      setTextOverlays([]);
      setShowCaptionModal(false);
      setIsUploading(false);

      // 🎉 Show success and return immediately!
      Alert.alert(
        '🎉 Reel Queued!',
        'Your video is being processed in the background. You\'ll get a notification when it\'s live!\n\nYou can continue using the app normally.',
        [
          {
            text: 'OK',
            onPress: () => {
              try {
                navigation.goBack();
              } catch (navError) {
                console.error('Navigation error:', navError);
              }
            },
          },
        ]
      );

      return; // User can continue immediately!

      // OLD CODE BELOW - User had to wait for upload/conversion
      // ============================================================
      /*
      // Upload and convert using FREE HLS Service
      const conversionResult = await FreeHLSService
        .getInstance()
        .uploadAndConvertVideo(
          selectedVideo.uri,
          user.uid,
          (progress) => {
            console.log(`[${progress.phase}] ${progress.message} - ${progress.progress}%`);
          }
        );

      const videoUrl = conversionResult.hlsUrl;
      const thumbnailUrl = conversionResult.thumbnailUrl;

      // Create reel data with HLS URLs
      const reelData = {
        userId: user.uid,
        videoUrl,
        caption: caption.trim(),
        thumbnailUrl,
        duration: conversionResult.duration,
        isPrivate: isPrivate,
        isHLS: true,
        resolutions: conversionResult.resolutions,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        viewsCount: 0,
        hashtags: extractHashtags(caption),
        mentions: extractMentions(caption),
        musicTitle: selectedMusic?.title,
        musicArtist: selectedMusic?.artist,
        musicId: selectedMusic?.id,
        filter: selectedFilter.id !== 'none' ? selectedFilter.id : undefined,
        textOverlays: textOverlays.length > 0 ? textOverlays : undefined,
        fileSize: selectedVideo.fileSize,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save reel to Firestore
      await FirebaseService.createReel(reelData);

      Alert.alert(
        '🎉 FREE Reel Created!', 
        `HLS conversion complete!\nResolutions: ${conversionResult.resolutions.join(', ')}\nCost: $0.00 (FREE tier)`,
        [
          {
            text: 'View Reels',
            onPress: () => {
              // Reset navigation to MainFlow with Reels tab active
              navigation.reset({
                index: 0,
                routes: [
                  {
                    name: 'MainFlow',
                    state: {
                      routes: [{ name: 'Reels' }],
                      index: 0,
                    },
                  },
                ],
              } as never);
            },
          },
          {
            text: 'Create Another',
            onPress: () => {
              // Reset the form
              setSelectedVideo(null);
              setCaption('');
              setSelectedMusic(null);
              setSelectedFilter(FILTERS[0]);
              setTextOverlays([]);
              setIsPrivate(false);
            },
          },
        ]
      );
      */
      // END OLD CODE
      // ============================================================
      
    } catch (error) {
      console.error('❌❌❌ CRITICAL ERROR creating reel:', error);
      console.error('Error type:', typeof error);
      console.error('Error name:', error?.name);
      console.error('Error message:', error?.message);
      console.error('Error stack:', error?.stack);
      
      setIsUploading(false);
      setShowCaptionModal(false);
      
      let errorMessage = 'Failed to create reel. Please try again.';
      let errorTitle = 'Upload Failed';
      
      if (error instanceof Error) {
        console.error('Error instance details:', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
        
        if (error.message.includes('file size')) {
          errorMessage = 'Video file is too large. Please try a shorter video.';
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('processing service')) {
          errorMessage = 'Video processing service unavailable. Please restart the app.';
        } else if (error.message.includes('Queue error')) {
          errorMessage = `Upload queue error: ${error.message}`;
        } else {
          errorMessage = `Error: ${error.message}\n\nPlease try again or restart the app.`;
        }
      }
      
      Alert.alert(
        errorTitle, 
        errorMessage,
        [
          {
            text: 'Close',
            onPress: () => {
              // Try to go back safely
              try {
                navigation.goBack();
              } catch (navError) {
                console.error('Navigation error on close:', navError);
              }
            }
          }
        ]
      );
    } finally {
      // Always reset uploading state
      setIsUploading(false);
    }
  };

  const extractHashtags = (text: string): string[] => {
    const hashtagRegex = /#[a-zA-Z0-9_]+/g;
    return text.match(hashtagRegex) || [];
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@[a-zA-Z0-9_]+/g;
    return text.match(mentionRegex) || [];
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Text Overlay Functions
  const addTextOverlay = () => {
    const newOverlay: TextOverlay = {
      id: Date.now().toString(),
      text: textInput || 'Tap to edit',
      x: width / 2 - 50,
      y: height / 2 - 12,
      fontSize: textFontSize,
      color: textColor,
      fontFamily: 'System',
      rotation: 0,
      scale: 1,
    };
    setTextOverlays([...textOverlays, newOverlay]);
    setTextInput('');
    setShowTextModal(false);
  };

  const updateTextOverlay = (id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(textOverlays.map(overlay => 
      overlay.id === id ? { ...overlay, ...updates } : overlay
    ));
  };

  const deleteTextOverlay = (id: string) => {
    setTextOverlays(textOverlays.filter(overlay => overlay.id !== id));
  };

  // Music Functions
  const selectMusic = (music: MusicTrack) => {
    setSelectedMusic(music);
    setShowMusicModal(false);
  };

  const removeMusic = () => {
    setSelectedMusic(null);
  };

  // Filter Functions
  const applyFilter = (filter: Filter) => {
    setSelectedFilter(filter);
    setShowFiltersModal(false);
  };

  // Camera Functions
  const toggleCamera = () => {
    setCameraType(cameraType === 'front' ? 'back' : 'front');
  };

  const toggleFlash = () => {
    const modes: Array<'off' | 'on' | 'auto'> = ['off', 'on', 'auto'];
    const currentIndex = modes.indexOf(flashMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setFlashMode(modes[nextIndex]);
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);
    // Start recording timer
    const interval = setInterval(() => {
      setRecordingDuration(prev => {
        if (prev >= 60) { // Max 60 seconds
          stopRecording();
          clearInterval(interval);
          return 60;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    // Stop recording and process video
  };

  const getVideoWithEffects = () => {
    // This would apply filters and text overlays to the video
    // In a real implementation, you would use video processing libraries
    return selectedVideo;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Icon name="close" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Reel</Text>
        {selectedVideo && (
          <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
            <Text style={styles.nextButtonText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>

      {selectedVideo ? (
        <View style={styles.videoContainer}>
          <Video
            ref={videoRef}
            source={{ uri: selectedVideo.uri }}
            style={styles.video}
            resizeMode="cover"
            repeat={true}
            paused={!isPlaying}
            onProgress={(data) => setCurrentTime(data.currentTime)}
            onLoad={(data) => setDuration(data.duration)}
          />
          
          {/* Video Controls */}
          <TouchableOpacity 
            style={styles.playPauseButton}
            onPress={togglePlayPause}
          >
            <Icon 
              name={isPlaying ? 'pause' : 'play'} 
              size={40} 
              color="#ffffff" 
            />
          </TouchableOpacity>

          {/* Text Overlays */}
          {textOverlays.map((overlay) => (
            <TouchableOpacity
              key={overlay.id}
              style={[
                styles.textOverlay,
                {
                  left: overlay.x,
                  top: overlay.y,
                  transform: [
                    { scale: overlay.scale },
                    { rotate: `${overlay.rotation}deg` }
                  ]
                }
              ]}
              onPress={() => setCurrentTextOverlay(overlay)}
              onLongPress={() => deleteTextOverlay(overlay.id)}
            >
              <Text
                style={[
                  styles.overlayText,
                  {
                    fontSize: overlay.fontSize,
                    color: overlay.color,
                    fontFamily: overlay.fontFamily,
                  }
                ]}
              >
                {overlay.text}
              </Text>
            </TouchableOpacity>
          ))}

          {/* Video Progress */}
          <View style={styles.progressContainer}>
            <Text style={styles.timeText}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </Text>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${(currentTime / duration) * 100}%` }
                ]} 
              />
            </View>
          </View>

          {/* Video Info Display */}
          <View style={styles.videoInfoContainer}>
            <View style={styles.videoInfoItem}>
              <Icon name="time-outline" size={14} color="#ffffff" />
              <Text style={styles.videoInfoText}>
                {Math.round(selectedVideo.duration)}s
              </Text>
            </View>
            <View style={styles.videoInfoItem}>
              <Icon name="document-outline" size={14} color="#ffffff" />
              <Text style={styles.videoInfoText}>
                {formatFileSize(selectedVideo.fileSize)}
              </Text>
            </View>
            {selectedVideo.duration <= 60 && (
              <View style={styles.videoInfoItem}>
                <Icon name="checkmark-circle" size={14} color="#4CAF50" />
                <Text style={[styles.videoInfoText, { color: '#4CAF50' }]}>
                  Optimized
                </Text>
              </View>
            )}
          </View>

          {/* Selected Music Display */}
          {selectedMusic && (
            <View style={styles.musicInfo}>
              <Icon name="musical-notes" size={16} color="#ffffff" />
              <Text style={styles.musicText}>
                {selectedMusic.title} - {selectedMusic.artist}
              </Text>
              <TouchableOpacity onPress={removeMusic}>
                <Icon name="close" size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Side Controls */}
          <View style={styles.sideControls}>
            <TouchableOpacity 
              style={styles.sideButton}
              onPress={() => setSelectedVideo(null)}
            >
              <Icon name="refresh" size={24} color="#ffffff" />
              <Text style={styles.sideButtonText}>Replace</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.sideButton}
              onPress={() => setShowMusicModal(true)}
            >
              <Icon name="musical-notes" size={24} color="#ffffff" />
              <Text style={styles.sideButtonText}>Music</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sideButton}
              onPress={() => setShowFiltersModal(true)}
            >
              <Icon name="color-filter" size={24} color="#ffffff" />
              <Text style={styles.sideButtonText}>Filters</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sideButton}
              onPress={() => setShowTextModal(true)}
            >
              <Icon name="text" size={24} color="#ffffff" />
              <Text style={styles.sideButtonText}>Text</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.sideButton}
              onPress={() => {
                Alert.alert(
                  'Effects Coming Soon',
                  'Video effects and AR filters will be available in the next update!',
                  [{ text: 'OK' }]
                );
              }}
            >
              <Icon name="sparkles" size={24} color="#ffffff" />
              <Text style={styles.sideButtonText}>Effects</Text>
            </TouchableOpacity>

            {/* Video Quality Info */}
            <View style={styles.videoInfo}>
              <Text style={styles.videoInfoText}>
                {Math.floor(selectedVideo.duration)}s
              </Text>
              <Text style={styles.videoInfoText}>
                {(selectedVideo.fileSize / (1024 * 1024)).toFixed(1)}MB
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <Icon name="videocam-outline" size={80} color="#ffffff" />
          <Text style={styles.title}>Create Reel</Text>
          <Text style={styles.subtitle}>
            Share your moment with a 60-second video
          </Text>
          <Text style={styles.reelGuideText}>
            📹 Videos longer than 60s will be trimmed automatically
          </Text>
          <Text style={styles.reelGuideText}>
            🎬 Your video will be optimized for best quality and fast upload
          </Text>
          
          <TouchableOpacity 
            style={styles.selectButton}
            onPress={selectVideoFromLibrary}
          >
            <Icon name="images" size={24} color="#ffffff" />
            <Text style={styles.selectButtonText}>Select from Gallery</Text>
          </TouchableOpacity>
          
          {/* Camera Type Selection */}
          <View style={styles.cameraOptions}>
            <Text style={styles.cameraOptionsTitle}>Record Video</Text>
            <View style={styles.cameraTypeButtons}>
              <TouchableOpacity 
                style={[
                  styles.cameraTypeButton,
                  cameraType === 'back' && styles.selectedCameraType
                ]}
                onPress={() => setCameraType('back')}
              >
                <Icon name="camera" size={20} color={cameraType === 'back' ? '#ffffff' : '#999'} />
                <Text style={[
                  styles.cameraTypeText,
                  cameraType === 'back' && styles.selectedCameraTypeText
                ]}>Back Camera</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.cameraTypeButton,
                  cameraType === 'front' && styles.selectedCameraType
                ]}
                onPress={() => setCameraType('front')}
              >
                <Icon name="camera-reverse" size={20} color={cameraType === 'front' ? '#ffffff' : '#999'} />
                <Text style={[
                  styles.cameraTypeText,
                  cameraType === 'front' && styles.selectedCameraTypeText
                ]}>Front Camera</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity 
            style={styles.recordButton}
            onPress={openCamera}
          >
            <View style={styles.recordButtonInner}>
              <Icon name="videocam" size={32} color="#ffffff" />
            </View>
          </TouchableOpacity>
          
          <Text style={styles.recordText}>Tap to record with {cameraType} camera</Text>
        </View>
      )}

      {/* Caption Modal */}
      <Modal
        visible={showCaptionModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowCaptionModal(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Caption</Text>
            <TouchableOpacity 
              onPress={createReel}
              style={[styles.modalButton, { opacity: isUploading ? 0.5 : 1 }]}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#E1306C" />
              ) : (
                <Text style={[styles.modalButtonText, { color: '#E1306C' }]}>
                  Share
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <TextInput
              style={styles.captionInput}
              placeholder="Write a caption..."
              placeholderTextColor="#999"
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={500}
              autoFocus
            />
            
            <Text style={styles.captionCounter}>
              {caption.length}/500
            </Text>

            <View style={styles.captionTips}>
              <Text style={styles.tipsTitle}>Tips:</Text>
              <Text style={styles.tipText}>• Use #hashtags to reach more people</Text>
              <Text style={styles.tipText}>• Tag friends with @username</Text>
              <Text style={styles.tipText}>• Keep it engaging and fun!</Text>
            </View>

            <TouchableOpacity 
              style={styles.privacyOption}
              onPress={() => setIsPrivate(!isPrivate)}
            >
              <Icon 
                name={isPrivate ? "lock-closed" : "lock-open-outline"} 
                size={24} 
                color={isPrivate ? "#E1306C" : "#666"} 
              />
              <Text style={[styles.privacyText, isPrivate && { color: "#E1306C" }]}>
                {isPrivate ? "Private reel" : "Public reel"}
              </Text>
              <View style={[styles.toggle, isPrivate && styles.toggleActive]}>
                <View style={[styles.toggleIndicator, isPrivate && styles.toggleIndicatorActive]} />
              </View>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Music Modal */}
      <Modal
        visible={showMusicModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowMusicModal(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Music</Text>
            <View style={styles.modalButton} />
          </View>

          <View style={styles.musicCategories}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {musicCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryButton,
                    selectedMusicCategory === category.name && styles.selectedCategoryButton
                  ]}
                  onPress={() => setSelectedMusicCategory(category.name)}
                >
                  <Text style={[
                    styles.categoryText,
                    selectedMusicCategory === category.name && styles.selectedCategoryText
                  ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <FlatList
            data={trendingMusic}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.musicItem}
                onPress={() => selectMusic(item)}
              >
                <View style={styles.musicItemLeft}>
                  <Image 
                    source={{ uri: item.image || 'https://via.placeholder.com/50' }} 
                    style={styles.musicCover as any} 
                  />
                  <View style={styles.musicInfo}>
                    <Text style={styles.musicTitle}>{item.title}</Text>
                    <Text style={styles.musicArtist}>{item.artist}</Text>
                  </View>
                </View>
                <View style={styles.musicItemRight}>
                  <Text style={styles.musicDuration}>
                    {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
                  </Text>
                  <Icon name="play-circle" size={24} color="#E1306C" />
                </View>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Filters Modal */}
      <Modal
        visible={showFiltersModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowFiltersModal(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filters</Text>
            <View style={styles.modalButton} />
          </View>

          <FlatList
            data={FILTERS}
            keyExtractor={(item) => item.id}
            numColumns={3}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.filterItem,
                  selectedFilter.id === item.id && styles.selectedFilterItem
                ]}
                onPress={() => applyFilter(item)}
              >
                <Text style={styles.filterPreview}>{item.preview}</Text>
                <Text style={styles.filterName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Text Modal */}
      <Modal
        visible={showTextModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowTextModal(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Text</Text>
            <TouchableOpacity 
              onPress={addTextOverlay}
              style={styles.modalButton}
            >
              <Text style={[styles.modalButtonText, { color: '#E1306C' }]}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.textEditor}>
            <TextInput
              style={styles.textInput}
              placeholder="Enter text..."
              placeholderTextColor="#999"
              value={textInput}
              onChangeText={setTextInput}
              multiline
            />
            
            <View style={styles.textControls}>
              <Text style={styles.controlLabel}>Color:</Text>
              <View style={styles.colorPicker}>
                {['#FFFFFF', '#000000', '#E1306C', '#FF6B35', '#F7931E', '#FFD23F', '#06FFA5', '#00D4FF'].map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      textColor === color && styles.selectedColorOption
                    ]}
                    onPress={() => setTextColor(color)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.textControls}>
              <Text style={styles.controlLabel}>Size:</Text>
              <View style={styles.sizeSlider}>
                <Text style={styles.sizeValue}>{textFontSize}px</Text>
                <Slider
                  style={{ flex: 1, height: 40, marginHorizontal: 10 }}
                  minimumValue={14}
                  maximumValue={72}
                  step={2}
                  value={textFontSize}
                  onValueChange={setTextFontSize}
                  minimumTrackTintColor="#E1306C"
                  maximumTrackTintColor="#E0E0E0"
                  thumbTintColor="#E1306C"
                />
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Enhanced Reels Camera Component */}
      <EnhancedReelsCamera
        visible={showReelsCamera}
        onClose={() => setShowReelsCamera(false)}
        onMediaCaptured={async (media) => {
          setShowReelsCamera(false);
          if (media.uri) {
            // Process recorded video silently in background
            setIsUploading(true);
            
            try {
              // Validate and compress the recorded video
              const validation = await VideoCompressor.validateVideo(media.uri);
              
              if (!validation.isValid) {
                setIsUploading(false);
                Alert.alert('Recording Error', validation.error || 'Please record again.');
                return;
              }

              // Compress the recorded video silently
              const compressionResult = await VideoCompressor.compressVideo(media.uri);
              
              if (!compressionResult.success) {
                setIsUploading(false);
                Alert.alert('Processing Failed', compressionResult.error || 'Failed to optimize video.');
                return;
              }

              // Log compression results for debugging
              if (compressionResult.originalSize && compressionResult.compressedSize) {
                const compressionRatio = ((compressionResult.originalSize - compressionResult.compressedSize) / compressionResult.originalSize * 100).toFixed(1);
                console.log(`🎬 Recorded video compressed: ${compressionRatio}% size reduction`);
              }

              setSelectedVideo({
                uri: compressionResult.compressedUri || media.uri,
                duration: Math.min(media.duration || 0, 60),
                type: 'video/mp4',
                fileName: media.fileName || `reel_${Date.now()}.mp4`,
                fileSize: compressionResult.compressedSize,
                thumbnailUrl: compressionResult.compressedUri || media.uri,
              });
              setIsUploading(false);
              
            } catch (error) {
              setIsUploading(false);
              console.error('Error processing recorded video:', error);
              Alert.alert('Error', 'Failed to process recorded video. Please try again.');
            }
          }
        }}
      />

      {/* Processing/Upload Overlay */}
      {(isProcessing || isUploading) && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#E1306C" />
            <Text style={styles.processingTitle}>
              {isProcessing ? '🎬 Processing Video' : '📤 Uploading Reel'}
            </Text>
            <Text style={styles.processingMessage}>
              {processingMessage || uploadPhase || 'Please wait...'}
            </Text>
            {uploadProgress > 0 && (
              <View style={styles.progressBarContainer}>
                <View 
                  style={[
                    styles.uploadProgressBar, 
                    { width: `${uploadProgress}%` }
                  ]} 
                />
              </View>
            )}
            <Text style={styles.processingHint}>
              {isProcessing 
                ? '✂️ Auto-trimming and optimizing your video...' 
                : '🚀 Your reel will be ready soon!'}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  nextButton: {
    backgroundColor: '#E1306C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  nextButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 24,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 40,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E1306C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginBottom: 40,
  },
  selectButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E1306C',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recordButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordText: {
    color: '#ffffff',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  // Camera Options Styles
  cameraOptions: {
    marginTop: 20,
    marginBottom: 10,
    alignItems: 'center',
  },
  cameraOptionsTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  cameraTypeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  cameraTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  selectedCameraType: {
    backgroundColor: '#E1306C',
    borderColor: '#E1306C',
  },
  cameraTypeText: {
    color: '#999',
    fontSize: 14,
    marginLeft: 6,
  },
  selectedCameraTypeText: {
    color: '#ffffff',
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    width: width,
    height: height * 0.7,
  },
  playPauseButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
  },
  timeText: {
    color: '#ffffff',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1.5,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 1.5,
  },
  sideControls: {
    position: 'absolute',
    right: 16,
    bottom: 120,
  },
  sideButton: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 8,
  },
  sideButtonText: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalButton: {
    padding: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  captionInput: {
    fontSize: 16,
    color: '#000',
    marginTop: 20,
    marginBottom: 8,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  captionCounter: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginBottom: 20,
  },
  captionTips: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  // Text Overlay Styles
  textOverlay: {
    position: 'absolute',
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
  },
  overlayText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  // Music Styles
  musicInfo: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  musicText: {
    color: '#ffffff',
    fontSize: 12,
    flex: 1,
    marginLeft: 8,
    marginRight: 8,
  },
  musicCategories: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  selectedCategoryButton: {
    backgroundColor: '#E1306C',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  selectedCategoryText: {
    color: '#ffffff',
  },
  musicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  musicItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  musicCover: {
    width: 50,
    height: 50,
    borderRadius: 4,
    marginRight: 12,
  },
  musicTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  musicArtist: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  musicItemRight: {
    alignItems: 'center',
  },
  musicDuration: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  // Filter Styles
  filterItem: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    margin: 8,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  selectedFilterItem: {
    backgroundColor: '#E1306C',
  },
  filterPreview: {
    fontSize: 24,
    marginBottom: 8,
  },
  filterName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  // Text Editor Styles
  textEditor: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  textInput: {
    fontSize: 18,
    color: '#000',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingVertical: 12,
    marginBottom: 20,
  },
  textControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginRight: 16,
    width: 60,
  },
  colorPicker: {
    flexDirection: 'row',
    flex: 1,
  },
  colorOption: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColorOption: {
    borderColor: '#E1306C',
  },
  sizeSlider: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sizeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginRight: 16,
  },
  // Video Info Styles
  videoInfo: {
    marginTop: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  videoInfoText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  privacyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
  },
  privacyText: {
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
    alignSelf: 'flex-end',
  },
  reelGuideText: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
    marginVertical: 8,
    paddingHorizontal: 20,
  },
  // Processing Overlay Styles
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  processingContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    minWidth: width * 0.8,
    maxWidth: width * 0.9,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  processingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 20,
    marginBottom: 12,
    textAlign: 'center',
  },
  processingMessage: {
    fontSize: 16,
    color: '#E1306C',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  processingHint: {
    fontSize: 14,
    color: '#999999',
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: '#333333',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 12,
  },
  uploadProgressBar: {
    height: '100%',
    backgroundColor: '#E1306C',
    borderRadius: 3,
  },
  toggleIndicatorActive: {
    transform: [{ translateX: 20 }],
  },
  videoInfoContainer: {
    position: 'absolute',
    top: 20,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  videoInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  reelGuideText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    textAlign: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    lineHeight: 18,
  },
});
