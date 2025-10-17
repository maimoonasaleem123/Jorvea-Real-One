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

interface PostCameraProps {
  visible: boolean;
  onClose: () => void;
  onMediaCaptured: (media: any) => void;
  allowVideo?: boolean;
}

const { width, height } = Dimensions.get('window');

export const PostCamera: React.FC<PostCameraProps> = ({
  visible,
  onClose,
  onMediaCaptured,
  allowVideo = true,
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [mediaMode, setMediaMode] = useState<'photo' | 'video'>('photo');

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
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8 as const,
      cameraType: cameraType as 'front' | 'back',
      storageOptions: {
        skipBackup: true,
        path: 'posts',
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
          fileName: asset.fileName || `post_photo_${Date.now()}.jpg`,
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
      durationLimit: 30,
      cameraType: cameraType as 'front' | 'back',
      storageOptions: {
        skipBackup: true,
        path: 'posts',
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
          fileName: asset.fileName || `post_video_${Date.now()}.mp4`,
          fileSize: asset.fileSize,
          duration: asset.duration,
          width: asset.width,
          height: asset.height,
        });
        onClose();
      }
    });
  }, [checkCameraPermission, cameraType, onMediaCaptured, onClose]);

  const handleSelectFromGallery = useCallback(() => {
    const options = {
      mediaType: (allowVideo ? 'mixed' : 'photo') as MediaType,
      selectionLimit: 1,
      quality: 0.8 as const,
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
          fileName: asset.fileName || `gallery_post_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
        });
        onClose();
      }
    });
  }, [allowVideo, onMediaCaptured, onClose]);

  const toggleCamera = useCallback(() => {
    setCameraType(prev => prev === 'front' ? 'back' : 'front');
  }, []);

  const toggleMediaMode = useCallback(() => {
    if (allowVideo) {
      setMediaMode(prev => prev === 'photo' ? 'video' : 'photo');
    }
  }, [allowVideo]);

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
          colors={['#1a1a1a', '#000000']}
          style={styles.background}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Post</Text>
            <TouchableOpacity onPress={toggleCamera} style={styles.headerButton}>
              <Icon name="flip-camera-ios" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Mode Selector */}
          {allowVideo && (
            <View style={styles.modeSelector}>
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
          )}

          {/* Camera Preview Placeholder */}
          <View style={styles.cameraPreview}>
            <View style={styles.cameraPlaceholder}>
              <Icon 
                name={mediaMode === 'photo' ? 'camera-alt' : 'videocam'} 
                size={80} 
                color="#666" 
              />
              <Text style={styles.placeholderText}>
                {mediaMode === 'photo' ? 'Photo Camera' : 'Video Camera'}
              </Text>
              <Text style={styles.placeholderSubtext}>
                {mediaMode === 'photo' ? 'Tap to take photo' : 'Tap to record video'}
              </Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            {/* Gallery Button */}
            <TouchableOpacity onPress={handleSelectFromGallery} style={styles.controlButton}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.gradientButton}
              >
                <Icon name="photo-library" size={24} color="#fff" />
              </LinearGradient>
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

            {/* Effects Button */}
            <TouchableOpacity style={styles.controlButton}>
              <LinearGradient
                colors={['#FF6B6B', '#FF8E53']}
                style={styles.gradientButton}
              >
                <Icon name="auto-fix-high" size={24} color="#fff" />
              </LinearGradient>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
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
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  activeModeButton: {
    backgroundColor: '#fff',
  },
  modeText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
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
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
  },
  cameraPlaceholder: {
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  placeholderSubtext: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 40,
  },
  controlButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  gradientButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
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

export default PostCamera;
