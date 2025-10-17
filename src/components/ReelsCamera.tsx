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
  PanResponder,
  Vibration,
} from 'react-native';
import { launchImageLibrary, launchCamera, MediaType, ImagePickerResponse } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import EnhancedPermissionService from '../services/enhancedPermissionService';tate, useRef, useCallback } from 'react';
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

interface ReelsCameraProps {
  visible: boolean;
  onClose: () => void;
  onVideoRecorded: (video: any) => void;
  maxDuration?: number;
}

const { width, height } = Dimensions.get('window');

export const ReelsCamera: React.FC<ReelsCameraProps> = ({
  visible,
  onClose,
  onVideoRecorded,
  maxDuration = 60,
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [isRecording, setIsRecording] = useState(false);

  const checkCameraPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      const cameraPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      const audioPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      
      if (!cameraPermission || !audioPermission) {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        ];
        
        const granted = await PermissionsAndroid.requestMultiple(permissions);
        
        return Object.values(granted).every(permission => permission === PermissionsAndroid.RESULTS.GRANTED);
      }
      return true;
    } else {
      const cameraStatus = await check(PERMISSIONS.IOS.CAMERA);
      const microphoneStatus = await check(PERMISSIONS.IOS.MICROPHONE);
      
      if (cameraStatus !== RESULTS.GRANTED || microphoneStatus !== RESULTS.GRANTED) {
        const cameraRequest = await request(PERMISSIONS.IOS.CAMERA);
        const microphoneRequest = await request(PERMISSIONS.IOS.MICROPHONE);
        
        return cameraRequest === RESULTS.GRANTED && microphoneRequest === RESULTS.GRANTED;
      }
      return true;
    }
  }, []);

  const handleRecordVideo = useCallback(async () => {
    const hasPermission = await checkCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permissions Required', 'Camera and microphone permissions are needed to record reels.');
      return;
    }

    setLoading(true);
    setIsRecording(true);

    const options = {
      mediaType: 'video' as MediaType,
      videoQuality: 'high' as const,
      durationLimit: maxDuration,
      cameraType: cameraType as 'front' | 'back',
      storageOptions: {
        skipBackup: true,
        path: 'reels',
      },
    };

    launchCamera(options, (response: ImagePickerResponse) => {
      setLoading(false);
      setIsRecording(false);
      
      if (response.didCancel || response.errorCode) {
        console.log('Video recording cancelled or failed:', response.errorMessage);
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        onVideoRecorded({
          uri: asset.uri,
          type: 'video',
          fileName: asset.fileName || `reel_${Date.now()}.mp4`,
          fileSize: asset.fileSize,
          duration: asset.duration,
          width: asset.width,
          height: asset.height,
        });
        onClose();
      }
    });
  }, [checkCameraPermission, cameraType, onVideoRecorded, onClose, maxDuration]);

  const handleSelectFromGallery = useCallback(() => {
    const options = {
      mediaType: 'video' as MediaType,
      selectionLimit: 1,
      quality: 0.8 as const,
      videoQuality: 'high' as const,
      includeBase64: false,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorCode) {
        console.log('Gallery selection cancelled or failed:', response.errorMessage);
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        onVideoRecorded({
          uri: asset.uri,
          type: 'video',
          fileName: asset.fileName || `gallery_reel_${Date.now()}.mp4`,
          fileSize: asset.fileSize,
          duration: asset.duration,
          width: asset.width,
          height: asset.height,
        });
        onClose();
      }
    });
  }, [onVideoRecorded, onClose]);

  const toggleCamera = useCallback(() => {
    setCameraType(prev => prev === 'front' ? 'back' : 'front');
  }, []);

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
            <Text style={styles.headerTitle}>Record Reel</Text>
            <TouchableOpacity onPress={toggleCamera} style={styles.headerButton}>
              <Icon name="flip-camera-ios" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Camera Preview Placeholder */}
          <View style={styles.cameraPreview}>
            <View style={styles.cameraPlaceholder}>
              <Icon name="videocam" size={80} color="#666" />
              <Text style={styles.placeholderText}>Video Camera</Text>
              <Text style={styles.placeholderSubtext}>
                Record your reel (max {maxDuration}s)
              </Text>
            </View>
          </View>

          {/* Duration Info */}
          <View style={styles.durationInfo}>
            <Text style={styles.durationText}>Max Duration: {maxDuration} seconds</Text>
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

            {/* Record Button */}
            <TouchableOpacity
              onPress={handleRecordVideo}
              style={[styles.recordButton, isRecording && styles.recordingButton]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <LinearGradient
                  colors={isRecording ? ['#FF3B30', '#FF6B6B'] : ['#FF5722', '#FF8A65']}
                  style={styles.recordGradient}
                >
                  <Icon 
                    name={isRecording ? "stop" : "fiber-manual-record"} 
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

          {/* Recording Status */}
          {isRecording && (
            <View style={styles.recordingStatus}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>Recording...</Text>
            </View>
          )}
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
  durationInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  durationText: {
    color: '#ccc',
    fontSize: 14,
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
  recordButton: {
    borderRadius: 35,
    overflow: 'hidden',
  },
  recordingButton: {
    transform: [{ scale: 1.1 }],
  },
  recordGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingStatus: {
    position: 'absolute',
    top: 100,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  recordingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default ReelsCamera;
