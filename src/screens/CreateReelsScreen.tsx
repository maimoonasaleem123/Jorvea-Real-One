import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Animated,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import firestore from '@react-native-firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import PerfectVideoCompressionEngine from '../services/PerfectVideoCompressionEngine';
import PerfectChunkedUploadEngine from '../services/PerfectChunkedUploadEngine';
import AdvancedBackgroundUploadEngine from '../services/AdvancedBackgroundUploadEngine';

const { width, height } = Dimensions.get('window');

interface CreateReelsScreenProps {}

interface RecordingState {
  isRecording: boolean;
  duration: number;
  segments: VideoSegment[];
  totalDuration: number;
}

interface VideoSegment {
  uri: string;
  duration: number;
  timestamp: number;
}

interface VideoEffects {
  filter: string;
  speed: number;
  brightness: number;
  contrast: number;
  saturation: number;
}

const CreateReelsScreen: React.FC<CreateReelsScreenProps> = () => {
  const navigation = useNavigation();
  
  // Get compression and upload engines
  const compressionEngine = PerfectVideoCompressionEngine.getInstance();
  const uploadEngine = PerfectChunkedUploadEngine.getInstance();
  const backgroundUploadEngine = (() => {
    try {
      return AdvancedBackgroundUploadEngine.getInstance();
    } catch (error) {
      console.warn('⚠️ AdvancedBackgroundUploadEngine not available:', error);
      return null;
    }
  })();
  
  // Permissions state
  const [hasPermissions, setHasPermissions] = useState<boolean | null>(null);
  
  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
    segments: [],
    totalDuration: 0,
  });
  
  // Video state
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Background upload state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isBackgroundUpload, setIsBackgroundUpload] = useState(false);
  const [uploadTaskId, setUploadTaskId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Compression state
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionStatus, setCompressionStatus] = useState('');
  const [originalFileSize, setOriginalFileSize] = useState(0);
  const [compressedFileSize, setCompressedFileSize] = useState(0);
  
  // Content state
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  
  // Effects state
  const [videoEffects, setVideoEffects] = useState<VideoEffects>({
    filter: 'none',
    speed: 1.0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
  });
  
  // UI state
  const [showEffects, setShowEffects] = useState(false);
  const [activeTab, setActiveTab] = useState<'camera' | 'gallery'>('camera');
  
  // Animation values
  const recordButtonScale = useRef(new Animated.Value(1)).current;
  const effectsSlideAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    requestPermissions();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingState.isRecording) {
      interval = setInterval(() => {
        setRecordingState(prev => ({
          ...prev,
          duration: prev.duration + 100,
        }));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [recordingState.isRecording]);

  const requestPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ];
        
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        const allPermissionsGranted = Object.values(granted).every(
          permission => permission === PermissionsAndroid.RESULTS.GRANTED
        );
        
        setHasPermissions(allPermissionsGranted);
      } else {
        // For iOS, we'll assume permissions are granted for now
        setHasPermissions(true);
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      setHasPermissions(false);
    }
  };

  const startRecording = async () => {
    if (recordingState.isRecording) return;
    
    setRecordingState(prev => ({
      ...prev,
      isRecording: true,
      duration: 0,
    }));
    
    // Mock video URL for demo
    setTimeout(() => {
      const mockVideoUrl = `https://sample-videos.com/zip/10/mp4/SampleVideo_360x240_1mb.mp4?t=${Date.now()}`;
      setSelectedVideo(mockVideoUrl);
    }, 1000);
    
    // Animate record button
    Animated.loop(
      Animated.sequence([
        Animated.timing(recordButtonScale, {
          toValue: 1.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(recordButtonScale, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopRecording = async () => {
    setRecordingState(prev => ({
      ...prev,
      isRecording: false,
      totalDuration: prev.duration,
    }));
    
    // Stop animation
    recordButtonScale.stopAnimation();
    Animated.timing(recordButtonScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const pickVideoFromGallery = async () => {
    // Mock video selection for demo
    const mockVideoUrl = `https://sample-videos.com/zip/10/mp4/SampleVideo_720x480_1mb.mp4?t=${Date.now()}`;
    setSelectedVideo(mockVideoUrl);
    Alert.alert('Video Selected', 'Mock video selected from gallery');
  };

  const applyVideoEffect = (effectType: keyof VideoEffects, value: any) => {
    setVideoEffects(prev => ({
      ...prev,
      [effectType]: value,
    }));
  };

  const processVideo = async (videoUri: string): Promise<string> => {
    try {
      setIsProcessing(true);
      setIsCompressing(true);
      setCompressionProgress(0);
      setCompressionStatus('Analyzing video...');
      
      // Get file size first
      const cleanUri = videoUri.replace('file://', '');
      try {
        const RNFS = require('react-native-fs');
        const stats = await RNFS.stat(cleanUri);
        const fileSizeMB = stats.size / (1024 * 1024);
        setOriginalFileSize(fileSizeMB);
        
        console.log(`📹 Processing video: ${fileSizeMB.toFixed(2)}MB`);
        
        if (fileSizeMB > 100) {
          setCompressionStatus('Large file detected - using high compression...');
        } else if (fileSizeMB > 25) {
          setCompressionStatus('Medium file - optimizing for upload...');
        } else {
          setCompressionStatus('Small file - applying light compression...');
        }
        
      } catch (statError) {
        console.warn('Could not get file stats:', statError);
        setOriginalFileSize(0);
      }
      
      // Compress video using the compression engine
      const compressedResult = await compressionEngine.compressVideo(
        videoUri,
        {
          maxSizeMB: 25,      // Keep under 25MB to prevent OOM
          quality: 'medium',   // Good balance of quality/size
          maxWidth: 720,      // HD quality but manageable
          maxHeight: 1280,    // 9:16 aspect ratio
          fps: 24,            // Smooth but efficient
          bitrate: 1000000    // 1Mbps for good quality
        },
        (progress) => {
          setCompressionProgress(progress);
          
          if (progress < 20) {
            setCompressionStatus('Analyzing video structure...');
          } else if (progress < 50) {
            setCompressionStatus('Reducing file size...');
          } else if (progress < 80) {
            setCompressionStatus('Optimizing quality...');
          } else {
            setCompressionStatus('Finalizing compression...');
          }
        }
      );
      
      // Update compressed file size
      const compressedSizeMB = compressedResult.compressedSize / (1024 * 1024);
      setCompressedFileSize(compressedSizeMB);
      
      const compressionRatio = (originalFileSize / compressedSizeMB).toFixed(1);
      setCompressionStatus(`Compression complete! Reduced from ${originalFileSize.toFixed(1)}MB to ${compressedSizeMB.toFixed(1)}MB (${compressionRatio}x smaller)`);
      
      console.log(`✅ Compression complete: ${originalFileSize.toFixed(2)}MB → ${compressedSizeMB.toFixed(2)}MB`);
      
      return compressedResult.compressedUri;
      
    } catch (error) {
      console.error('Video processing error:', error);
      setCompressionStatus('Compression failed - using original video');
      
      // Show user-friendly error
      Alert.alert(
        'Video Processing',
        'Could not compress video. The original video will be uploaded, but it may take longer.',
        [{ text: 'Continue', style: 'default' }]
      );
      
      // Return original video as fallback
      return videoUri;
    } finally {
      setIsProcessing(false);
      setIsCompressing(false);
    }
  };

  const uploadVideoToFirebase = async (videoUri: string, userId: string): Promise<string> => {
    try {
      console.log('📤 Starting chunked upload to Firebase...');
      
      // Use chunked upload engine for memory-safe upload
      const downloadURL = await uploadEngine.smartUpload(
        videoUri,
        userId,
        (progress) => {
          // Update upload progress
          const uploadPercentage = Math.round(progress.percentage);
          setUploadProgress(30 + (uploadPercentage * 0.6)); // 30-90% range
          
          console.log(`📤 Upload progress: ${uploadPercentage}% (Chunk ${progress.currentChunk}/${progress.totalChunks})`);
        }
      );
      
      console.log('✅ Upload complete:', downloadURL);
      return downloadURL;
      
    } catch (error) {
      console.error('Upload error:', error);
      
      // Show user-friendly error
      Alert.alert(
        'Upload Failed',
        'Could not upload video to server. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
      
      throw new Error(`Upload failed: ${error.message}`);
    }
  };

  const uploadThumbnail = async (thumbnailPath: string, userId: string): Promise<string> => {
    try {
      console.log('📤 Uploading thumbnail to Firebase...');
      
      const storage = getStorage();
      const thumbnailRef = ref(storage, `thumbnails/${userId}/${Date.now()}_thumbnail.jpg`);
      
      // Read thumbnail file
      const response = await fetch(thumbnailPath);
      const blob = await response.blob();
      
      // Upload thumbnail
      await uploadBytes(thumbnailRef, blob);
      const downloadURL = await getDownloadURL(thumbnailRef);
      
      console.log('✅ Thumbnail upload complete:', downloadURL);
      return downloadURL;
      
    } catch (error) {
      console.error('Thumbnail upload error:', error);
      throw new Error(`Thumbnail upload failed: ${error.message}`);
    }
  };

  const publishReel = async () => {
    if (!caption.trim()) {
      Alert.alert('Caption Required', 'Please add a caption for your reel.');
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;
    
    if (!user) {
      Alert.alert('Authentication Error', 'Please log in to publish reels.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Use mock video or process existing one
      const videoUrl = selectedVideo || `https://sample-videos.com/zip/10/mp4/SampleVideo_360x240_1mb.mp4?t=${Date.now()}`;
      
      // Start memory-safe processing with compression
      setUploadProgress(5);
      setCompressionStatus('Starting video processing...');
      const processedVideoUri = await processVideo(videoUrl);
      setUploadProgress(15);
      
      // Generate thumbnail for immediate preview
      const thumbnailPath = `${processedVideoUri}_thumbnail.jpg`;
      // In a real implementation, generate thumbnail here
      
      // Prepare reel data
      const reelData = {
        userId: user.uid,
        userEmail: user.email,
        caption: caption.trim(),
        hashtags: hashtags.split('#').filter(tag => tag.trim().length > 0),
        effects: videoEffects,
        duration: recordingState.totalDuration || 30000,
        likes: 0,
        comments: 0,
        shares: 0,
        views: 0,
        isPublic: true,
      };
      
      // Start advanced background upload (segmented and memory-safe)
      if (backgroundUploadEngine) {
        console.log('🚀 Starting advanced background upload...');
        const uploadId = await backgroundUploadEngine.addToUploadQueue(
          processedVideoUri,
          thumbnailPath,
          reelData,
          (progress) => {
            setUploadProgress(15 + (progress * 0.85)); // 15-100% range
            console.log(`📊 Background upload progress: ${Math.round(progress)}%`);
          }
        );
        
        setUploadTaskId(uploadId);
        setIsBackgroundUpload(true);
        setUploadProgress(20);
        
        // Show immediate success - upload continues in background
        Alert.alert(
          'Upload Started!', 
          'Your reel is being uploaded in the background. You can continue using the app!',
          [
            { 
              text: 'Continue in Background', 
              onPress: () => {
                setIsMinimized(true);
                navigation.goBack();
              }
            },
            { 
              text: 'Monitor Progress', 
              onPress: () => {
                // Keep user on screen to watch progress
              }
            }
          ]
        );
      } else {
        // Fallback to regular upload if background engine not available
        console.log('⚠️ Background upload not available, using regular upload...');
        
        const videoUrl = await uploadEngine.uploadVideoChunked(
          processedVideoUri,
          user.uid,
          (progress) => {
            setUploadProgress(15 + (progress * 0.65)); // 15-80% range
          }
        );
        
        reelData.videoUrl = videoUrl;
        
        setUploadProgress(85);
        
        // Upload thumbnail (simple implementation)
        const thumbnailUrl = await uploadVideoToFirebase(thumbnailPath, user.uid);
        reelData.thumbnail = thumbnailUrl;
        
        setUploadProgress(95);
        
        // Save to Firestore
        await firestore().collection('reels').add(reelData);
        
        setUploadProgress(100);
        
        Alert.alert('Success', 'Your reel has been published!');
        navigation.goBack();
      }
      
      // Reset form immediately for background upload
      setCaption('');
      setHashtags('');
      setSelectedVideo(null);
      setRecordingState({
        isRecording: false,
        duration: 0,
        segments: [],
        totalDuration: 0,
      });
      
    } catch (error) {
      console.error('Error starting reel upload:', error);
      Alert.alert('Upload Error', 'Failed to start upload. Please try again.');
      setIsBackgroundUpload(false);
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const minimizeUpload = () => {
    setIsMinimized(true);
    navigation.goBack();
  };

  const restoreUpload = () => {
    setIsMinimized(false);
  };

  const toggleEffects = () => {
    setShowEffects(!showEffects);
    Animated.timing(effectsSlideAnimation, {
      toValue: showEffects ? 0 : 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const formatDuration = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const clearVideo = () => {
    setSelectedVideo(null);
    setRecordingState({
      isRecording: false,
      duration: 0,
      segments: [],
      totalDuration: 0,
    });
  };

  if (hasPermissions === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff3366" />
        <Text style={styles.loadingText}>Setting up camera...</Text>
      </View>
    );
  }

  if (hasPermissions === false) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionIcon}>📱</Text>
        <Text style={styles.permissionText}>Camera and storage permissions are required to create reels</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermissions}>
          <Text style={styles.permissionButtonText}>Grant Permissions</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Text style={styles.closeButton}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Reel</Text>
        <TouchableOpacity onPress={toggleEffects} style={styles.headerButton}>
          <Text style={styles.effectsButton}>✨</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'camera' && styles.activeTab]}
          onPress={() => setActiveTab('camera')}
        >
          <Text style={[styles.tabText, activeTab === 'camera' && styles.activeTabText]}>
            📹 Camera
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'gallery' && styles.activeTab]}
          onPress={() => setActiveTab('gallery')}
        >
          <Text style={[styles.tabText, activeTab === 'gallery' && styles.activeTabText]}>
            🎬 Gallery
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {activeTab === 'camera' ? (
          <View style={styles.cameraContainer}>
            <View style={styles.cameraPreview}>
              <Text style={styles.cameraPlaceholderText}>📹</Text>
              <Text style={styles.cameraPlaceholderSubtext}>Camera Preview</Text>
              {recordingState.isRecording && (
                <View style={styles.recordingIndicator}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingTimeText}>
                    REC {formatDuration(recordingState.duration)}
                  </Text>
                </View>
              )}
              {selectedVideo && (
                <View style={styles.videoPreview}>
                  <Text style={styles.videoPreviewText}>✅ Video Ready</Text>
                  <TouchableOpacity onPress={clearVideo} style={styles.clearButton}>
                    <Text style={styles.clearButtonText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Camera Controls */}
            <View style={styles.cameraControls}>
              <View style={styles.controlRow}>
                <TouchableOpacity style={styles.controlButton}>
                  <Text style={styles.controlButtonText}>⚡</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={recordingState.isRecording ? stopRecording : startRecording}
                  style={styles.recordButtonContainer}
                >
                  <Animated.View 
                    style={[
                      styles.recordButton,
                      { transform: [{ scale: recordButtonScale }] },
                      recordingState.isRecording && styles.recordButtonActive
                    ]}
                  >
                    <View style={[
                      styles.recordButtonInner,
                      recordingState.isRecording && styles.recordButtonInnerActive
                    ]} />
                  </Animated.View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton}>
                  <Text style={styles.controlButtonText}>🔄</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.galleryContainer}>
            <TouchableOpacity onPress={pickVideoFromGallery} style={styles.pickVideoButton}>
              <Text style={styles.pickVideoIcon}>🎬</Text>
              <Text style={styles.pickVideoText}>Select Video from Gallery</Text>
              <Text style={styles.pickVideoSubtext}>Choose an existing video to create your reel</Text>
            </TouchableOpacity>
            
            {selectedVideo && (
              <View style={styles.selectedVideoInfo}>
                <Text style={styles.selectedVideoText}>✅ Video Selected</Text>
                <TouchableOpacity onPress={clearVideo} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>Clear Selection</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Caption and Publish Section */}
        <View style={styles.publishSection}>
          <Text style={styles.sectionTitle}>📝 Caption & Details</Text>
          
          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption..."
            placeholderTextColor="#999"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={150}
          />
          
          <TextInput
            style={styles.hashtagInput}
            placeholder="#hashtags #viral #reels"
            placeholderTextColor="#999"
            value={hashtags}
            onChangeText={setHashtags}
          />

          <View style={styles.publishButtonContainer}>
            <TouchableOpacity 
              style={[
                styles.publishButton, 
                (isUploading || !caption.trim()) && styles.publishButtonDisabled
              ]}
              onPress={publishReel}
              disabled={isUploading || isProcessing || !caption.trim()}
            >
              {isUploading || isProcessing ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.publishButtonText}>Publishing...</Text>
                </View>
              ) : (
                <Text style={styles.publishButtonText}>🚀 Publish Reel</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Effects Panel */}
      {showEffects && (
        <Animated.View style={[
          styles.effectsPanel,
          {
            transform: [{
              translateX: effectsSlideAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [width, 0],
              })
            }]
          }
        ]}>
          <View style={styles.effectsHeader}>
            <Text style={styles.effectsTitle}>✨ Video Effects</Text>
            <TouchableOpacity onPress={toggleEffects}>
              <Text style={styles.effectsCloseButton}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.effectsScrollView} showsVerticalScrollIndicator={false}>
            {/* Speed Control */}
            <View style={styles.effectRow}>
              <Text style={styles.effectLabel}>⚡ Speed: {videoEffects.speed}x</Text>
              <View style={styles.speedButtons}>
                {[0.5, 1.0, 1.5, 2.0].map(speed => (
                  <TouchableOpacity
                    key={speed}
                    style={[
                      styles.speedButton,
                      videoEffects.speed === speed && styles.speedButtonActive
                    ]}
                    onPress={() => applyVideoEffect('speed', speed)}
                  >
                    <Text style={[
                      styles.speedButtonText,
                      videoEffects.speed === speed && styles.speedButtonTextActive
                    ]}>
                      {speed}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Filter Options */}
            <View style={styles.effectRow}>
              <Text style={styles.effectLabel}>🎨 Filters</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[
                  { name: 'none', emoji: '🔘' },
                  { name: 'vintage', emoji: '📸' },
                  { name: 'dramatic', emoji: '🎭' },
                  { name: 'bright', emoji: '☀️' },
                  { name: 'contrast', emoji: '⚡' }
                ].map(filter => (
                  <TouchableOpacity
                    key={filter.name}
                    style={[
                      styles.filterButton,
                      videoEffects.filter === filter.name && styles.filterButtonActive
                    ]}
                    onPress={() => applyVideoEffect('filter', filter.name)}
                  >
                    <Text style={styles.filterEmoji}>{filter.emoji}</Text>
                    <Text style={[
                      styles.filterButtonText,
                      videoEffects.filter === filter.name && styles.filterButtonTextActive
                    ]}>
                      {filter.name.charAt(0).toUpperCase() + filter.name.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </ScrollView>
        </Animated.View>
      )}

      {/* Background Upload Overlay */}
      {isBackgroundUpload && !isMinimized && (
        <View style={styles.uploadOverlay}>
          <View style={styles.uploadModal}>
            <View style={styles.uploadHeader}>
              <Text style={styles.uploadTitle}>📤 Publishing Reel</Text>
              <TouchableOpacity 
                onPress={minimizeUpload}
                style={styles.minimizeButton}
              >
                <Text style={styles.minimizeButtonText}>—</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.uploadContent}>
              {/* Dynamic status based on compression/upload state */}
              <Text style={styles.uploadDescription}>
                {isCompressing 
                  ? compressionStatus || 'Compressing video for faster upload...'
                  : uploadProgress < 30 
                  ? 'Preparing video for upload...'
                  : uploadProgress < 95
                  ? 'Uploading to server...'
                  : 'Finalizing your reel...'
                }
              </Text>
              
              {/* Compression Progress (when compressing) */}
              {isCompressing && (
                <View style={styles.progressContainer}>
                  <Text style={styles.progressLabel}>🗜️ Compression Progress</Text>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${compressionProgress}%`,
                          backgroundColor: '#f59e0b' // Orange for compression
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>{Math.round(compressionProgress)}%</Text>
                  {originalFileSize > 0 && compressedFileSize > 0 && (
                    <Text style={styles.compressionInfo}>
                      📉 {originalFileSize.toFixed(1)}MB → {compressedFileSize.toFixed(1)}MB
                    </Text>
                  )}
                </View>
              )}
              
              {/* Upload Progress */}
              {!isCompressing && (
                <View style={styles.progressContainer}>
                  <Text style={styles.progressLabel}>📤 Upload Progress</Text>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${uploadProgress}%`,
                          backgroundColor: '#10b981' // Green for upload
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
                  {compressedFileSize > 0 && (
                    <Text style={styles.compressionInfo}>
                      📦 Uploading {compressedFileSize.toFixed(1)}MB (optimized)
                    </Text>
                  )}
                </View>
              )}
              
              <Text style={styles.uploadHint}>
                💡 You can minimize this and continue using the app
              </Text>
              
              <TouchableOpacity 
                onPress={minimizeUpload}
                style={styles.minimizeActionButton}
              >
                <Text style={styles.minimizeActionButtonText}>
                  Continue in Background ⚡
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Minimized Upload Indicator */}
      {isBackgroundUpload && isMinimized && (
        <View style={styles.minimizedUpload}>
          <TouchableOpacity 
            onPress={restoreUpload}
            style={styles.minimizedButton}
          >
            <Text style={styles.minimizedIcon}>📤</Text>
            <Text style={styles.minimizedText}>
              Uploading... {Math.round(uploadProgress)}%
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  permissionIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: '#ff3366',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  effectsButton: {
    fontSize: 24,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
    marginVertical: 15,
    borderRadius: 25,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#ff3366',
  },
  tabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#fff',
  },
  contentContainer: {
    flex: 1,
  },
  cameraContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cameraPreview: {
    width: width - 40,
    height: (width - 40) * 1.5,
    backgroundColor: '#111',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  cameraPlaceholderText: {
    fontSize: 64,
    marginBottom: 10,
  },
  cameraPlaceholderSubtext: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 10,
  },
  recordingIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,51,102,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  recordingTimeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  videoPreview: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoPreviewText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 10,
  },
  clearButton: {
    backgroundColor: '#ff3366',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cameraControls: {
    width: '100%',
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '80%',
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonText: {
    fontSize: 24,
  },
  recordButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ff3366',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  recordButtonActive: {
    backgroundColor: '#ff1744',
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  recordButtonInnerActive: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  galleryContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pickVideoButton: {
    width: width - 40,
    height: 200,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
  },
  pickVideoIcon: {
    fontSize: 64,
    marginBottom: 10,
  },
  pickVideoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  pickVideoSubtext: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  selectedVideoInfo: {
    marginTop: 20,
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedVideoText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 15,
  },
  publishSection: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginTop: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    marginBottom: 15,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  hashtagInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 15,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  publishButtonContainer: {
    alignItems: 'center',
  },
  publishButton: {
    backgroundColor: '#ff3366',
    borderRadius: 25,
    paddingVertical: 15,
    paddingHorizontal: 40,
    alignItems: 'center',
    width: '100%',
  },
  publishButtonDisabled: {
    backgroundColor: 'rgba(255,51,102,0.5)',
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  effectsPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: width * 0.85,
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.95)',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  effectsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  effectsTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  effectsCloseButton: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  effectsScrollView: {
    flex: 1,
    padding: 20,
  },
  effectRow: {
    marginBottom: 30,
  },
  effectLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  speedButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  speedButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  speedButtonActive: {
    backgroundColor: '#ff3366',
    borderColor: '#ff3366',
  },
  speedButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  speedButtonTextActive: {
    color: '#fff',
  },
  filterButton: {
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    minWidth: 80,
  },
  filterButtonActive: {
    backgroundColor: '#ff3366',
    borderColor: '#ff3366',
  },
  filterEmoji: {
    fontSize: 20,
    marginBottom: 5,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  // Background Upload Styles
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
  uploadModal: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    margin: 20,
    width: width - 40,
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  uploadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  uploadTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  minimizeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  minimizeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  uploadContent: {
    alignItems: 'center',
  },
  uploadDescription: {
    color: '#ccc',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  progressText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  compressionInfo: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  uploadHint: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  minimizeActionButton: {
    backgroundColor: '#ff3366',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  minimizeActionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Minimized Upload Styles
  minimizedUpload: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    zIndex: 1000,
  },
  minimizedButton: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  minimizedIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  minimizedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CreateReelsScreen;
