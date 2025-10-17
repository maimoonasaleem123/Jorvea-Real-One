import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Platform,
  PermissionsAndroid,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { launchImageLibrary, launchCamera, MediaType, ImagePickerResponse } from 'react-native-image-picker';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';

interface StoryCameraProps {
  visible: boolean;
  onClose: () => void;
  onMediaCaptured: (media: any) => void;
}

const { width, height } = Dimensions.get('window');

export const StoryCamera: React.FC<StoryCameraProps> = ({
  visible,
  onClose,
  onMediaCaptured,
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [mediaMode, setMediaMode] = useState<'photo' | 'video'>('photo');
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const [filterMode, setFilterMode] = useState<'none' | 'vintage' | 'cool' | 'warm'>('none');

  const checkCameraPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      const cameraPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      const audioPermission = mediaMode === 'video' ? 
        await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) : true;
      
      if (!cameraPermission || !audioPermission) {
        const permissions = [PermissionsAndroid.PERMISSIONS.CAMERA];
        if (mediaMode === 'video') {
          permissions.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        }
        
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        return Object.values(granted).every(permission => permission === PermissionsAndroid.RESULTS.GRANTED);
      }
      return true;
    } else {
      const cameraStatus = await check(PERMISSIONS.IOS.CAMERA);
      const microphoneStatus = mediaMode === 'video' ? 
        await check(PERMISSIONS.IOS.MICROPHONE) : RESULTS.GRANTED;
      
      if (cameraStatus !== RESULTS.GRANTED || microphoneStatus !== RESULTS.GRANTED) {
        const cameraRequest = await request(PERMISSIONS.IOS.CAMERA);
        const microphoneRequest = mediaMode === 'video' ? 
          await request(PERMISSIONS.IOS.MICROPHONE) : RESULTS.GRANTED;
        
        return cameraRequest === RESULTS.GRANTED && microphoneRequest === RESULTS.GRANTED;
      }
      return true;
    }
  }, [mediaMode]);

  const handleTakePhoto = useCallback(async () => {
    const hasPermission = await checkCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Camera permission is required to take photos.');
      return;
    }

    setLoading(true);

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
          filter: filterMode,
          isStory: true,
        });
        onClose();
      }
    });
  }, [checkCameraPermission, cameraType, filterMode, onMediaCaptured, onClose]);

  const handleTakeVideo = useCallback(async () => {
    const hasPermission = await checkCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Camera and microphone permissions are required to record videos.');
      return;
    }

    setLoading(true);

    const options = {
      mediaType: 'video' as MediaType,
      videoQuality: 'high' as const,
      durationLimit: 15, // Story videos are shorter
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
          filter: filterMode,
          isStory: true,
        });
        onClose();
      }
    });
  }, [checkCameraPermission, cameraType, filterMode, onMediaCaptured, onClose]);

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
          filter: filterMode,
          isStory: true,
        });
        onClose();
      }
    });
  }, [filterMode, onMediaCaptured, onClose]);

  const toggleCamera = useCallback(() => {
    setCameraType(prev => prev === 'front' ? 'back' : 'front');
  }, []);

  const toggleFlash = useCallback(() => {
    setFlashMode(prev => {
      switch (prev) {
        case 'off': return 'on';
        case 'on': return 'auto';
        case 'auto': return 'off';
        default: return 'off';
      }
    });
  }, []);

  const toggleFilter = useCallback(() => {
    setFilterMode(prev => {
      switch (prev) {
        case 'none': return 'vintage';
        case 'vintage': return 'cool';
        case 'cool': return 'warm';
        case 'warm': return 'none';
        default: return 'none';
      }
    });
  }, []);

  const getFlashIcon = () => {
    switch (flashMode) {
      case 'on': return 'flash-on';
      case 'off': return 'flash-off';
      case 'auto': return 'flash-auto';
      default: return 'flash-off';
    }
  };

  const getFilterColor = () => {
    switch (filterMode) {
      case 'vintage': return '#F4D03F';
      case 'cool': return '#85C1E9';
      case 'warm': return '#F1948A';
      default: return '#fff';
    }
  };

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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Your Story</Text>
            <TouchableOpacity onPress={toggleFlash} style={styles.headerButton}>
              <Icon name={getFlashIcon()} size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Filter Indicator */}
          <View style={styles.filterIndicator}>
            <Text style={styles.filterText}>
              Filter: {filterMode.charAt(0).toUpperCase() + filterMode.slice(1)}
            </Text>
          </View>

          {/* Camera Preview Placeholder */}
          <View style={[styles.cameraPreview, { borderColor: getFilterColor() }]}>
            <View style={styles.cameraPlaceholder}>
              <Icon 
                name={mediaMode === 'photo' ? 'camera-alt' : 'videocam'} 
                size={80} 
                color={getFilterColor()} 
              />
              <Text style={[styles.placeholderText, { color: getFilterColor() }]}>
                Story Camera
              </Text>
              <Text style={styles.placeholderSubtext}>
                {mediaMode === 'photo' ? 'Tap to capture' : 'Hold to record (15s max)'}
              </Text>
              <View style={styles.storyFeatures}>
                <Text style={styles.featureText}>✨ AR Filters</Text>
                <Text style={styles.featureText}>🎵 Add Music</Text>
                <Text style={styles.featureText}>📝 Add Text</Text>
              </View>
            </View>
          </View>

          {/* Mode Toggle */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              onPress={() => setMediaMode('photo')}
              style={[styles.modeButton, mediaMode === 'photo' && styles.activeModeButton]}
            >
              <Text style={[styles.modeText, mediaMode === 'photo' && styles.activeModeText]}>
                Photo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMediaMode('video')}
              style={[styles.modeButton, mediaMode === 'video' && styles.activeModeButton]}
            >
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
            </TouchableOpacity>

            {/* Capture Button */}
            <TouchableOpacity
              onPress={mediaMode === 'photo' ? handleTakePhoto : handleTakeVideo}
              style={styles.captureButton}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <View style={styles.captureRing}>
                  <View style={styles.captureInner}>
                    <Icon 
                      name={mediaMode === 'photo' ? 'camera-alt' : 'videocam'} 
                      size={28} 
                      color="#fff" 
                    />
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Camera Switch & Filter */}
            <View style={styles.rightControls}>
              <TouchableOpacity onPress={toggleCamera} style={styles.smallControlButton}>
                <Icon name="flip-camera-ios" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleFilter} style={styles.smallControlButton}>
                <Icon name="filter" size={24} color={getFilterColor()} />
              </TouchableOpacity>
            </View>
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
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  filterIndicator: {
    alignItems: 'center',
    marginBottom: 10,
  },
  filterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cameraPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 3,
    borderStyle: 'dashed',
  },
  cameraPlaceholder: {
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  placeholderSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  storyFeatures: {
    marginTop: 20,
    alignItems: 'center',
  },
  featureText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginVertical: 2,
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  activeModeButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  modeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  activeModeText: {
    color: '#000',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  controlButton: {
    width: 50,
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
  captureButton: {
    alignItems: 'center',
  },
  captureRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightControls: {
    alignItems: 'center',
    width: 50,
  },
  smallControlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
});

export default StoryCamera;
