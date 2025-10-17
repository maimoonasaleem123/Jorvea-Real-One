    import React, { useState, useRef, useCallback } from 'react';
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
} from 'react-native';
import { launchImageLibrary, launchCamera, MediaType, ImagePickerResponse } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import EnhancedPermissionService from '../services/enhancedPermissionService';
import ImageWatermarkService from '../services/imageWatermarkService';

interface PostCameraProps {
  visible: boolean;
  onClose: () => void;
  onMediaCaptured: (media: any) => void;
  allowVideo?: boolean;
}

const { width, height } = Dimensions.get('window');

export const EnhancedPostCamera: React.FC<PostCameraProps> = ({
  visible,
  onClose,
  onMediaCaptured,
  allowVideo = true,
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [mediaMode, setMediaMode] = useState<'photo' | 'video'>('photo');
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '16:9'>('1:1');
  
  // Animation values
  const modeButtonScale = useRef(new Animated.Value(1)).current;
  const captureButtonScale = useRef(new Animated.Value(1)).current;
  const flashButtonRotate = useRef(new Animated.Value(0)).current;

  // Aspect ratio options
  const aspectRatioOptions = [
    { key: '1:1', label: 'Square', icon: 'crop-square' },
    { key: '4:5', label: 'Portrait', icon: 'crop-portrait' },
    { key: '16:9', label: 'Landscape', icon: 'crop-landscape' },
  ];

  const handleTakePhoto = useCallback(async () => {
    const hasPermission = await EnhancedPermissionService.requestWithAlert('photo');
    if (!hasPermission) return;

    setLoading(true);
    Vibration.vibrate(50);

    // Animate capture button
    Animated.sequence([
      Animated.timing(captureButtonScale, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(captureButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    const options = {
      mediaType: 'photo' as MediaType,
      includeBase64: false,
      maxHeight: aspectRatio === '1:1' ? 2000 : aspectRatio === '4:5' ? 2500 : 1500,
      maxWidth: aspectRatio === '1:1' ? 2000 : aspectRatio === '4:5' ? 2000 : 2000,
      quality: 0.9 as const,
      cameraType: cameraType as 'front' | 'back',
      storageOptions: {
        skipBackup: true,
        path: 'posts',
      },
    };

    launchCamera(options, async (response: ImagePickerResponse) => {
      setLoading(false);
      
      if (response.didCancel || response.errorCode) {
        console.log('Photo capture cancelled or failed:', response.errorMessage);
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        
        // Add watermark metadata
        const watermarkResult = await ImageWatermarkService.applySimpleWatermark(
          asset.uri || '',
          'post',
          user?.username || user?.displayName
        );
        
        onMediaCaptured({
          uri: watermarkResult.uri,
          type: 'image',
          fileName: asset.fileName || `post_photo_${Date.now()}.jpg`,
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
          aspectRatio,
          watermarked: watermarkResult.watermarked,
          watermarkText: watermarkResult.metadata.watermarkText,
          metadata: watermarkResult.metadata,
        });
        onClose();
      }
    });
  }, [cameraType, aspectRatio, onMediaCaptured, onClose, captureButtonScale]);

  const handleTakeVideo = useCallback(async () => {
    const hasPermission = await EnhancedPermissionService.requestWithAlert('camera');
    if (!hasPermission) return;

    setLoading(true);
    Vibration.vibrate(50);

    const options = {
      mediaType: 'video' as MediaType,
      videoQuality: 'high' as const,
      durationLimit: 30,
      cameraType: cameraType as 'front' | 'back',
      storageOptions: {
        skipBackup: true,
        path: 'posts',
      },
    };

    launchCamera(options, async (response: ImagePickerResponse) => {
      setLoading(false);
      
      if (response.didCancel || response.errorCode) {
        console.log('Video capture cancelled or failed:', response.errorMessage);
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        
        // Add watermark metadata for video
        const watermarkResult = await ImageWatermarkService.applySimpleWatermark(
          asset.uri || '',
          'post',
          user?.username || user?.displayName
        );
        
        onMediaCaptured({
          uri: watermarkResult.uri,
          type: 'video',
          fileName: asset.fileName || `post_video_${Date.now()}.mp4`,
          fileSize: asset.fileSize,
          duration: asset.duration,
          width: asset.width,
          height: asset.height,
          aspectRatio,
          watermarked: watermarkResult.watermarked,
          watermarkText: watermarkResult.metadata.watermarkText,
          metadata: watermarkResult.metadata,
        });
        onClose();
      }
    });
  }, [cameraType, aspectRatio, onMediaCaptured, onClose]);

  const handleSelectFromGallery = useCallback(() => {
    const options = {
      mediaType: (allowVideo ? 'mixed' : 'photo') as MediaType,
      selectionLimit: 1,
      quality: 0.9 as const,
      includeBase64: false,
    };

    launchImageLibrary(options, async (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorCode) {
        console.log('Gallery selection cancelled or failed:', response.errorMessage);
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const isVideo = asset.type?.startsWith('video/') || asset.fileName?.toLowerCase().includes('.mp4');
        
        // Add watermark metadata
        const watermarkResult = await ImageWatermarkService.applySimpleWatermark(
          asset.uri || '',
          'post',
          user?.username || user?.displayName
        );
        
        onMediaCaptured({
          uri: watermarkResult.uri,
          type: isVideo ? 'video' : 'image',
          fileName: asset.fileName || `gallery_post_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
          aspectRatio,
          watermarked: watermarkResult.watermarked,
          watermarkText: watermarkResult.metadata.watermarkText,
          metadata: watermarkResult.metadata,
        });
        onClose();
      }
    });
  }, [allowVideo, aspectRatio, onMediaCaptured, onClose]);

  const toggleCamera = useCallback(() => {
    setCameraType(prev => prev === 'front' ? 'back' : 'front');
    Vibration.vibrate(30);
  }, []);

  const toggleFlash = useCallback(() => {
    setFlashMode(prev => {
      const modes = ['off', 'on', 'auto'] as const;
      const currentIndex = modes.indexOf(prev);
      const newMode = modes[(currentIndex + 1) % modes.length];
      
      // Animate flash button with fixed animation
      Animated.timing(flashButtonRotate, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        flashButtonRotate.setValue(0);
      });
      
      Vibration.vibrate(30);
      return newMode;
    });
  }, [flashButtonRotate]);

  const toggleMediaMode = useCallback(() => {
    if (!allowVideo) return;
    
    setMediaMode(prev => {
      const newMode = prev === 'photo' ? 'video' : 'photo';
      
      // Animate mode button
      Animated.sequence([
        Animated.timing(modeButtonScale, {
          toValue: 0.9,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(modeButtonScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
      
      Vibration.vibrate(30);
      return newMode;
    });
  }, [allowVideo, modeButtonScale]);

  const selectAspectRatio = useCallback((ratio: '1:1' | '4:5' | '16:9') => {
    setAspectRatio(ratio);
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

  const getFlashColor = () => {
    switch (flashMode) {
      case 'on': return '#FFD700';
      case 'auto': return '#4CAF50';
      default: return '#fff';
    }
  };

  const renderAspectRatioOption = ({ item }: { item: typeof aspectRatioOptions[0] }) => (
    <TouchableOpacity
      onPress={() => selectAspectRatio(item.key as any)}
      style={[
        styles.aspectRatioOption,
        aspectRatio === item.key && styles.selectedAspectRatio
      ]}
    >
      <Icon 
        name={item.icon} 
        size={20} 
        color={aspectRatio === item.key ? colors.primary : '#fff'} 
      />
      <Text 
        style={[
          styles.aspectRatioText,
          { color: aspectRatio === item.key ? colors.primary : '#fff' }
        ]}
      >
        {item.label}
      </Text>
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
          colors={['#667eea', '#764ba2']}
          style={styles.background}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Post</Text>
            <Animated.View style={{ transform: [{ rotate: flashButtonRotate.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '360deg'],
            })}]}}>
              <TouchableOpacity onPress={toggleFlash} style={styles.headerButton}>
                <Icon name={getFlashIcon()} size={24} color={getFlashColor()} />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Aspect Ratio Selector */}
          <View style={styles.aspectRatioContainer}>
            <FlatList
              data={aspectRatioOptions}
              renderItem={renderAspectRatioOption}
              keyExtractor={(item) => item.key}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.aspectRatioList}
            />
          </View>

          {/* Mode Selector */}
          {allowVideo && (
            <View style={styles.modeSelector}>
              <Animated.View style={{ transform: [{ scale: modeButtonScale }] }}>
                <TouchableOpacity
                  onPress={() => setMediaMode('photo')}
                  style={[styles.modeButton, mediaMode === 'photo' && styles.activeModeButton]}
                >
                  <Icon 
                    name="camera-alt" 
                    size={20} 
                    color={mediaMode === 'photo' ? '#000' : '#fff'} 
                  />
                  <Text style={[styles.modeText, mediaMode === 'photo' && styles.activeModeText]}>
                    Photo
                  </Text>
                </TouchableOpacity>
              </Animated.View>
              
              <Animated.View style={{ transform: [{ scale: modeButtonScale }] }}>
                <TouchableOpacity
                  onPress={toggleMediaMode}
                  style={[styles.modeButton, mediaMode === 'video' && styles.activeModeButton]}
                >
                  <Icon 
                    name="videocam" 
                    size={20} 
                    color={mediaMode === 'video' ? '#000' : '#fff'} 
                  />
                  <Text style={[styles.modeText, mediaMode === 'video' && styles.activeModeText]}>
                    Video
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}

          {/* Camera Preview Placeholder */}
          <View style={[styles.cameraPreview, getPreviewStyle()]}>
            <View style={styles.cameraPlaceholder}>
              <Icon 
                name={mediaMode === 'photo' ? 'camera-alt' : 'videocam'} 
                size={80} 
                color="rgba(255,255,255,0.8)" 
              />
              <Text style={styles.placeholderText}>
                {mediaMode === 'photo' ? 'Photo Camera' : 'Video Camera'}
              </Text>
              <Text style={styles.placeholderSubtext}>
                {mediaMode === 'photo' ? 'Tap to take photo' : 'Tap to record video (30s max)'}
              </Text>
              <Text style={styles.aspectRatioLabel}>
                {aspectRatio} • {cameraType === 'front' ? 'Front' : 'Back'} Camera
              </Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            {/* Gallery Button */}
            <TouchableOpacity onPress={handleSelectFromGallery} style={styles.controlButton}>
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.gradientButton}
              >
                <Icon name="photo-library" size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.controlLabel}>Gallery</Text>
            </TouchableOpacity>

            {/* Capture Button */}
            <Animated.View style={{ transform: [{ scale: captureButtonScale }] }}>
              <TouchableOpacity
                onPress={mediaMode === 'photo' ? handleTakePhoto : handleTakeVideo}
                style={styles.captureButton}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="large" color="#fff" />
                ) : (
                  <LinearGradient
                    colors={['#0095f6', '#00d4ff']}
                    style={styles.captureGradient}
                  >
                    <Icon 
                      name={mediaMode === 'photo' ? 'camera-alt' : 'videocam'} 
                      size={32} 
                      color="#fff" 
                    />
                  </LinearGradient>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Camera Switch Button */}
            <TouchableOpacity onPress={toggleCamera} style={styles.controlButton}>
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.gradientButton}
              >
                <Icon name="flip-camera-ios" size={24} color="#fff" />
              </LinearGradient>
              <Text style={styles.controlLabel}>Flip</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    </Modal>
  );

  function getPreviewStyle() {
    switch (aspectRatio) {
      case '1:1':
        return { aspectRatio: 1 };
      case '4:5':
        return { aspectRatio: 4/5 };
      case '16:9':
        return { aspectRatio: 16/9 };
      default:
        return { aspectRatio: 1 };
    }
  }
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
    paddingBottom: 15,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  aspectRatioContainer: {
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  aspectRatioList: {
    alignItems: 'center',
  },
  aspectRatioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  selectedAspectRatio: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  aspectRatioText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    marginHorizontal: 80,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  activeModeButton: {
    backgroundColor: '#fff',
  },
  modeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  activeModeText: {
    color: '#000',
  },
  cameraPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderStyle: 'dashed',
    maxHeight: height * 0.5,
  },
  cameraPlaceholder: {
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  placeholderSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  aspectRatioLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
    height: 120,
  },
  controlButton: {
    alignItems: 'center',
  },
  gradientButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  controlLabel: {
    color: '#fff',
    fontSize: 11,
    marginTop: 8,
    fontWeight: '600',
  },
  captureButton: {
    borderRadius: 35,
    overflow: 'hidden',
  },
  captureGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default EnhancedPostCamera;
