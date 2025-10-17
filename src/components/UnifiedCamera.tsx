import React, { useState, useCallback } from 'react';
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

interface UnifiedCameraProps {
  visible: boolean;
  onClose: () => void;
  onMediaCaptured: (media: any) => void;
  onCancel: () => void;
  mode?: 'photo' | 'video' | 'story';
  aspectRatio?: '1:1' | '9:16' | '16:9';
  maxDuration?: number;
  allowGallery?: boolean;
}

export const UnifiedCamera: React.FC<UnifiedCameraProps> = ({
  visible,
  onClose,
  onMediaCaptured,
  onCancel,
  mode = 'photo',
  aspectRatio = '1:1',
  maxDuration = 30,
  allowGallery = true,
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');

  const checkCameraPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      const cameraPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      const audioPermission = mode !== 'photo' ? await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO) : true;
      
      if (!cameraPermission || !audioPermission) {
        const permissions = [PermissionsAndroid.PERMISSIONS.CAMERA];
        if (mode !== 'photo') {
          permissions.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        }
        
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        return Object.values(granted).every(permission => permission === PermissionsAndroid.RESULTS.GRANTED);
      }
      return true;
    } else {
      const cameraStatus = await check(PERMISSIONS.IOS.CAMERA);
      const microphoneStatus = mode !== 'photo' ? await check(PERMISSIONS.IOS.MICROPHONE) : RESULTS.GRANTED;
      
      if (cameraStatus !== RESULTS.GRANTED || microphoneStatus !== RESULTS.GRANTED) {
        const cameraRequest = await request(PERMISSIONS.IOS.CAMERA);
        const microphoneRequest = mode !== 'photo' ? await request(PERMISSIONS.IOS.MICROPHONE) : RESULTS.GRANTED;
        
        return cameraRequest === RESULTS.GRANTED && microphoneRequest === RESULTS.GRANTED;
      }
      return true;
    }
  }, [mode]);

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
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8 as const,
      cameraType: cameraType as 'front' | 'back',
      storageOptions: {
        skipBackup: true,
        path: 'images',
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
          fileName: asset.fileName || `photo_${Date.now()}.jpg`,
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
        });
        onClose();
      }
    });
  }, [checkCameraPermission, cameraType, onMediaCaptured, onClose]);

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
      durationLimit: maxDuration,
      cameraType: cameraType as 'front' | 'back',
      includeBase64: false,
      storageOptions: {
        skipBackup: true,
        path: 'images',
      },
    };

    launchCamera(options, (response: ImagePickerResponse) => {
      setLoading(false);
      
      if (response.didCancel || response.errorCode) {
        console.log('Video recording cancelled or failed:', response.errorMessage);
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        onMediaCaptured({
          uri: asset.uri,
          type: 'video',
          fileName: asset.fileName || `video_${Date.now()}.mp4`,
          fileSize: asset.fileSize,
          duration: asset.duration,
          width: asset.width,
          height: asset.height,
        });
        onClose();
      }
    });
  }, [checkCameraPermission, maxDuration, cameraType, onMediaCaptured, onClose]);

  const handleSelectFromGallery = useCallback(() => {
    const options = {
      mediaType: (mode === 'photo' ? 'photo' : 'mixed') as MediaType,
      selectionLimit: 1,
      quality: 0.8 as const,
      includeBase64: false,
      storageOptions: {
        skipBackup: true,
        path: 'images',
      },
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorCode) {
        console.log('Gallery selection cancelled or failed:', response.errorMessage);
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const isVideo = asset.type?.startsWith('video/') || asset.fileName?.toLowerCase().includes('.mp4') || asset.fileName?.toLowerCase().includes('.mov');
        
        onMediaCaptured({
          uri: asset.uri,
          type: isVideo ? 'video' : 'image',
          fileName: asset.fileName || `gallery_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
        });
        onClose();
      }
    });
  }, [mode, onMediaCaptured, onClose]);

  const toggleCameraType = useCallback(() => {
    setCameraType(current => current === 'back' ? 'front' : 'back');
  }, []);

  const toggleFlashMode = useCallback(() => {
    setFlashMode(current => {
      const modes: Array<'off' | 'on' | 'auto'> = ['off', 'on', 'auto'];
      const currentIndex = modes.indexOf(current);
      return modes[(currentIndex + 1) % modes.length];
    });
  }, []);

  const getFlashIcon = useCallback(() => {
    switch (flashMode) {
      case 'on':
        return 'flash-on';
      case 'auto':
        return 'flash-auto';
      default:
        return 'flash-off';
    }
  }, [flashMode]);

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <StatusBar backgroundColor="#000" barStyle="light-content" />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
            <Icon name="close" size={28} color="#fff" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>
            {mode === 'photo' ? 'Take Photo' : mode === 'video' ? 'Record Video' : 'Create Story'}
          </Text>
          
          <TouchableOpacity onPress={toggleFlashMode} style={styles.headerButton}>
            <Icon name={getFlashIcon()} size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Camera Preview Placeholder */}
        <View style={[styles.cameraPreview, { aspectRatio: aspectRatio === '1:1' ? 1 : aspectRatio === '9:16' ? 9/16 : 16/9 }]}>
          <View style={styles.cameraPlaceholder}>
            <Icon name="camera-alt" size={80} color="#666" />
            <Text style={styles.placeholderText}>Camera Preview</Text>
            <Text style={styles.placeholderSubtext}>
              {mode === 'photo' ? 'Tap capture to take photo' : 'Tap record to start recording'}
            </Text>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {/* Gallery Button */}
          {allowGallery && (
            <TouchableOpacity onPress={handleSelectFromGallery} style={styles.controlButton}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.gradientButton}
              >
                <Icon name="photo-library" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Capture Button */}
          <TouchableOpacity
            onPress={mode === 'photo' ? handleTakePhoto : handleTakeVideo}
            style={styles.captureButton}
            disabled={loading}
          >
            <LinearGradient
              colors={mode === 'photo' ? ['#ff6b6b', '#ee5a24'] : ['#e74c3c', '#c0392b']}
              style={styles.captureGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <Icon 
                  name={mode === 'photo' ? 'camera-alt' : 'videocam'} 
                  size={32} 
                  color="#fff" 
                />
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Flip Camera Button */}
          <TouchableOpacity onPress={toggleCameraType} style={styles.controlButton}>
            <LinearGradient
              colors={['#74b9ff', '#0984e3']}
              style={styles.gradientButton}
            >
              <Icon name="flip-camera-android" size={24} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Mode Info */}
        <View style={styles.modeInfo}>
          <Text style={styles.modeText}>
            Mode: {mode.toUpperCase()} | Ratio: {aspectRatio}
            {mode !== 'photo' && ` | Max: ${maxDuration}s`}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  headerButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cameraPreview: {
    flex: 1,
    backgroundColor: '#111',
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cameraPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#222',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  placeholderSubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 30,
  },
  controlButton: {
    width: 60,
    height: 60,
  },
  gradientButton: {
    flex: 1,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
  },
  captureGradient: {
    flex: 1,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeInfo: {
    paddingBottom: 20,
    alignItems: 'center',
  },
  modeText: {
    color: '#999',
    fontSize: 12,
    textAlign: 'center',
  },
});
