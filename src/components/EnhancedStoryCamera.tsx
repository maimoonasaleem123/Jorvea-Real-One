import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Platform,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  Animated,
  Vibration,
  FlatList,
  PanResponder,
} from 'react-native';
import { launchImageLibrary, launchCamera, MediaType, ImagePickerResponse } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import EnhancedPermissionService from '../services/enhancedPermissionService';

interface StoryCameraProps {
  visible: boolean;
  onClose: () => void;
  onMediaCaptured: (media: any) => void;
}

const { width, height } = Dimensions.get('window');

interface Filter {
  id: string;
  name: string;
  colors: string[];
  overlay?: string;
}

const storyFilters: Filter[] = [
  { id: 'none', name: 'Original', colors: ['transparent', 'transparent'] },
  { id: 'warm', name: 'Warm', colors: ['rgba(255,200,150,0.3)', 'rgba(255,180,120,0.2)'] },
  { id: 'cool', name: 'Cool', colors: ['rgba(150,200,255,0.3)', 'rgba(120,180,255,0.2)'] },
  { id: 'vintage', name: 'Vintage', colors: ['rgba(255,220,150,0.4)', 'rgba(200,180,140,0.3)'] },
  { id: 'dramatic', name: 'Dramatic', colors: ['rgba(0,0,0,0.4)', 'rgba(50,50,50,0.2)'] },
  { id: 'bright', name: 'Bright', colors: ['rgba(255,255,255,0.2)', 'rgba(240,240,240,0.1)'] },
];

export const EnhancedStoryCamera: React.FC<StoryCameraProps> = ({
  visible,
  onClose,
  onMediaCaptured,
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('front'); // Stories typically start with front camera
  const [mediaMode, setMediaMode] = useState<'photo' | 'video'>('photo');
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const [selectedFilter, setSelectedFilter] = useState<Filter>(storyFilters[0]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Animation values
  const filterAnimation = useRef(new Animated.Value(0)).current;
  const recordButtonScale = useRef(new Animated.Value(1)).current;
  const flashAnimation = useRef(new Animated.Value(0)).current;
  const boomerangRotation = useRef(new Animated.Value(0)).current;
  
  // Recording timer
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const maxRecordingTime = 15; // 15 seconds for stories

  // Pan responder for filter switching
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 20;
      },
      onPanResponderMove: (evt, gestureState) => {
        // Swipe left/right to change filters
        if (Math.abs(gestureState.dx) > 50) {
          const direction = gestureState.dx > 0 ? 1 : -1;
          switchFilter(direction);
        }
      },
    })
  ).current;

  const switchFilter = useCallback((direction: number) => {
    const currentIndex = storyFilters.findIndex(f => f.id === selectedFilter.id);
    let newIndex = currentIndex + direction;
    
    if (newIndex < 0) newIndex = storyFilters.length - 1;
    if (newIndex >= storyFilters.length) newIndex = 0;
    
    setSelectedFilter(storyFilters[newIndex]);
    
    // Animate filter change
    Animated.sequence([
      Animated.timing(filterAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(filterAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    
    Vibration.vibrate(30);
  }, [selectedFilter, filterAnimation]);

  // Recording timer effect
  useEffect(() => {
    if (isRecording) {
      recordingInterval.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxRecordingTime - 1) {
            handleStopRecording();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);

      return () => {
        if (recordingInterval.current) {
          clearInterval(recordingInterval.current);
        }
      };
    } else {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
    }
  }, [isRecording]);

  const handleStartRecording = useCallback(() => {
    setIsRecording(true);
    setRecordingTime(0);
    
    // Animate record button
    Animated.timing(recordButtonScale, {
      toValue: 1.2,
      duration: 100,
      useNativeDriver: true,
    }).start();
    
    Vibration.vibrate(50);
  }, [recordButtonScale]);

  const handleStopRecording = useCallback(() => {
    setIsRecording(false);
    setRecordingTime(0);
    
    // Reset record button
    Animated.timing(recordButtonScale, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
    
    Vibration.vibrate([50, 50]);
  }, [recordButtonScale]);

  const handleTakePhoto = useCallback(async () => {
    const hasPermission = await EnhancedPermissionService.requestWithAlert('photo');
    if (!hasPermission) return;

    setLoading(true);
    
    // Flash animation
    Animated.sequence([
      Animated.timing(flashAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(flashAnimation, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    const options = {
      mediaType: 'photo' as MediaType,
      includeBase64: false,
      maxHeight: 1920,
      maxWidth: 1080,
      quality: 0.9 as const,
      cameraType: cameraType as 'front' | 'back',
      storageOptions: {
        skipBackup: true,
        path: 'stories',
      },
    };

    launchCamera(options, (response: ImagePickerResponse) => {
      setLoading(false);
      
      if (response.didCancel || response.errorCode) {
        console.log('Photo capture cancelled or failed:', response.errorMessage);
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        onMediaCaptured({
          uri: asset.uri,
          type: 'image',
          fileName: asset.fileName || `story_photo_${Date.now()}.jpg`,
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
          filter: selectedFilter,
          isStory: true,
        });
        onClose();
      }
    });
  }, [cameraType, selectedFilter, onMediaCaptured, onClose, flashAnimation]);

  const handleTakeVideo = useCallback(async () => {
    const hasPermission = await EnhancedPermissionService.requestWithAlert('camera');
    if (!hasPermission) return;

    setLoading(true);

    const options = {
      mediaType: 'video' as MediaType,
      videoQuality: 'high' as const,
      durationLimit: maxRecordingTime,
      cameraType: cameraType as 'front' | 'back',
      storageOptions: {
        skipBackup: true,
        path: 'stories',
      },
    };

    launchCamera(options, (response: ImagePickerResponse) => {
      setLoading(false);
      
      if (response.didCancel || response.errorCode) {
        console.log('Video capture cancelled or failed:', response.errorMessage);
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        onMediaCaptured({
          uri: asset.uri,
          type: 'video',
          fileName: asset.fileName || `story_video_${Date.now()}.mp4`,
          fileSize: asset.fileSize,
          duration: asset.duration,
          width: asset.width,
          height: asset.height,
          filter: selectedFilter,
          isStory: true,
        });
        onClose();
      }
    });
  }, [cameraType, selectedFilter, maxRecordingTime, onMediaCaptured, onClose]);

  const handleSelectFromGallery = useCallback(() => {
    const options = {
      mediaType: 'mixed' as MediaType,
      selectionLimit: 1,
      quality: 0.9 as const,
      includeBase64: false,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorCode) {
        console.log('Gallery selection cancelled or failed:', response.errorMessage);
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const isVideo = asset.type?.startsWith('video/') || asset.fileName?.toLowerCase().includes('.mp4');
        
        onMediaCaptured({
          uri: asset.uri,
          type: isVideo ? 'video' : 'image',
          fileName: asset.fileName || `gallery_story_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
          filter: selectedFilter,
          isStory: true,
        });
        onClose();
      }
    });
  }, [selectedFilter, onMediaCaptured, onClose]);

  const toggleCamera = useCallback(() => {
    setCameraType(prev => prev === 'front' ? 'back' : 'front');
    Vibration.vibrate(30);
  }, []);

  const toggleFlash = useCallback(() => {
    setFlashMode(prev => {
      const modes = ['off', 'on', 'auto'] as const;
      const currentIndex = modes.indexOf(prev);
      return modes[(currentIndex + 1) % modes.length];
    });
    Vibration.vibrate(30);
  }, []);

  const getFlashIcon = () => {
    switch (flashMode) {
      case 'on': return 'flash-on';
      case 'off': return 'flash-off';
      case 'auto': return 'flash-auto';
      default: return 'flash-off';
    }
  };

  const formatTime = (seconds: number) => {
    const secs = seconds % 60;
    return `${secs.toString().padStart(2, '0')}s`;
  };

  const renderFilterOption = ({ item }: { item: Filter }) => (
    <TouchableOpacity
      onPress={() => setSelectedFilter(item)}
      style={[
        styles.filterOption,
        selectedFilter.id === item.id && styles.selectedFilter
      ]}
    >
      <LinearGradient
        colors={item.colors}
        style={styles.filterPreview}
      >
        <Text style={styles.filterName}>{item.name}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#833ab4', '#fd1d1d', '#fcb045']}
          style={styles.background}
        >
          {/* Flash Overlay */}
          <Animated.View 
            style={[
              styles.flashOverlay,
              {
                opacity: flashAnimation,
              }
            ]}
          />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Your Story</Text>
              {isRecording && (
                <Text style={styles.recordingTimer}>{formatTime(recordingTime)}</Text>
              )}
            </View>
            
            <TouchableOpacity onPress={toggleFlash} style={styles.headerButton}>
              <Icon name={getFlashIcon()} size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Filter Indicator */}
          <Animated.View 
            style={[
              styles.filterIndicator,
              {
                transform: [{
                  scale: filterAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.1],
                  }),
                }],
              }
            ]}
          >
            <LinearGradient
              colors={selectedFilter.colors}
              style={styles.filterBadge}
            >
              <Text style={styles.filterText}>{selectedFilter.name}</Text>
            </LinearGradient>
          </Animated.View>

          {/* Camera Preview with Filter Overlay */}
          <View style={styles.cameraPreview} {...panResponder.panHandlers}>
            <LinearGradient
              colors={selectedFilter.colors}
              style={styles.filterOverlay}
            >
              <View style={styles.cameraPlaceholder}>
                <Icon 
                  name={mediaMode === 'photo' ? 'camera-alt' : 'videocam'} 
                  size={80} 
                  color="rgba(255,255,255,0.9)" 
                />
                <Text style={styles.placeholderText}>Story Camera</Text>
                <Text style={styles.placeholderSubtext}>
                  {mediaMode === 'photo' ? 'Tap to capture' : `Hold to record (${maxRecordingTime}s max)`}
                </Text>
                <Text style={styles.swipeHint}>← Swipe to change filters →</Text>
              </View>
            </LinearGradient>

            {/* Camera Info */}
            <View style={styles.cameraInfo}>
              <Text style={styles.cameraInfoText}>
                {cameraType === 'front' ? '🤳' : '📷'} {cameraType.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Filter Selection */}
          <View style={styles.filtersContainer}>
            <FlatList
              data={storyFilters}
              renderItem={renderFilterOption}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersList}
            />
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              onPress={() => setMediaMode('photo')}
              style={[styles.modeButton, mediaMode === 'photo' && styles.activeModeButton]}
            >
              <Icon 
                name="camera-alt" 
                size={18} 
                color={mediaMode === 'photo' ? '#000' : '#fff'} 
              />
              <Text style={[styles.modeText, mediaMode === 'photo' && styles.activeModeText]}>
                Photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMediaMode('video')}
              style={[styles.modeButton, mediaMode === 'video' && styles.activeModeButton]}
            >
              <Icon 
                name="videocam" 
                size={18} 
                color={mediaMode === 'video' ? '#000' : '#fff'} 
              />
              <Text style={[styles.modeText, mediaMode === 'video' && styles.activeModeText]}>
                Video
              </Text>
            </TouchableOpacity>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            {/* Gallery Button */}
            <TouchableOpacity onPress={handleSelectFromGallery} style={styles.controlButton}>
              <View style={styles.galleryButton}>
                <Icon name="photo-library" size={24} color="#fff" />
              </View>
              <Text style={styles.controlLabel}>Gallery</Text>
            </TouchableOpacity>

            {/* Capture Button */}
            <Animated.View style={{ transform: [{ scale: recordButtonScale }] }}>
              <TouchableOpacity
                onPress={mediaMode === 'photo' ? handleTakePhoto : handleTakeVideo}
                style={[styles.captureButton, isRecording && styles.recordingButton]}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="large" color="#fff" />
                ) : (
                  <View style={styles.captureInner}>
                    <Icon 
                      name={mediaMode === 'photo' ? 'camera-alt' : (isRecording ? 'stop' : 'videocam')} 
                      size={28} 
                      color="#fff" 
                    />
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Camera Switch */}
            <TouchableOpacity onPress={toggleCamera} style={styles.controlButton}>
              <View style={styles.switchButton}>
                <Icon name="flip-camera-ios" size={24} color="#fff" />
              </View>
              <Text style={styles.controlLabel}>Flip</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  recordingTimer: {
    color: '#FF0000',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  filterIndicator: {
    alignItems: 'center',
    marginBottom: 10,
  },
  filterBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  filterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cameraPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
    position: 'relative',
  },
  filterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraPlaceholder: {
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  placeholderSubtext: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  swipeHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 20,
    textAlign: 'center',
  },
  cameraInfo: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cameraInfoText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  filtersContainer: {
    paddingVertical: 10,
  },
  filtersList: {
    paddingHorizontal: 20,
  },
  filterOption: {
    marginHorizontal: 5,
    borderRadius: 20,
    overflow: 'hidden',
  },
  selectedFilter: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  filterPreview: {
    width: 60,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
  },
  filterName: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  modeToggle: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    marginHorizontal: 100,
    padding: 3,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  activeModeButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  modeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  activeModeText: {
    color: '#000',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  controlButton: {
    alignItems: 'center',
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  controlLabel: {
    color: '#fff',
    fontSize: 10,
    marginTop: 6,
    fontWeight: '600',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  recordingButton: {
    borderColor: '#FF0000',
    backgroundColor: 'rgba(255,0,0,0.2)',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});

export default EnhancedStoryCamera;
