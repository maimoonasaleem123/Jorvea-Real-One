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
import EnhancedPermissionService from '../services/enhancedPermissionService';

interface ReelsCameraProps {
  visible: boolean;
  onClose: () => void;
  onMediaCaptured: (media: any) => void;
}

const { width, height } = Dimensions.get('window');

export const ReelsCamera: React.FC<ReelsCameraProps> = ({
  visible,
  onClose,
  onMediaCaptured,
}) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const [quality, setQuality] = useState<'high' | 'medium' | 'low'>('high');
  
  // Animation values
  const recordButtonScale = useRef(new Animated.Value(1)).current;
  const recordingPulse = useRef(new Animated.Value(1)).current;
  const timerOpacity = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;
  
  // Recording timer
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const maxRecordingTime = 60; // 60 seconds for reels

  // Progress animation for recording
  useEffect(() => {
    if (isRecording) {
      // Start timer animation
      Animated.timing(timerOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Start progress animation
      Animated.timing(progressAnimation, {
        toValue: 1,
        duration: maxRecordingTime * 1000,
        useNativeDriver: false,
      }).start();

      // Start pulsing animation
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingPulse, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(recordingPulse, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();

      // Start recording timer
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
        pulseAnimation.stop();
        if (recordingInterval.current) {
          clearInterval(recordingInterval.current);
        }
      };
    } else {
      // Reset animations
      Animated.timing(timerOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      
      progressAnimation.setValue(0);
      recordingPulse.setValue(1);
      
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
        recordingInterval.current = null;
      }
    }
  }, [isRecording]);

  const handleStartRecording = useCallback(async () => {
    const hasPermission = await EnhancedPermissionService.requestWithAlert('camera');
    if (!hasPermission) return;

    setIsRecording(true);
    setRecordingTime(0);
    Vibration.vibrate(50); // Haptic feedback
  }, []);

  const handleStopRecording = useCallback(() => {
    setIsRecording(false);
    setRecordingTime(0);
    Vibration.vibrate([50, 50]); // Double vibration for stop
  }, []);

  const handleTakeVideo = useCallback(async () => {
    const hasPermission = await EnhancedPermissionService.requestWithAlert('camera');
    if (!hasPermission) return;

    setLoading(true);

    const options = {
      mediaType: 'video' as MediaType,
      videoQuality: quality === 'high' ? 'high' : quality === 'medium' ? 'medium' : 'low' as const,
      durationLimit: maxRecordingTime,
      cameraType: cameraType as 'front' | 'back',
      storageOptions: {
        skipBackup: true,
        path: 'reels',
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
          fileName: asset.fileName || `reel_${Date.now()}.mp4`,
          fileSize: asset.fileSize,
          duration: asset.duration,
          width: asset.width,
          height: asset.height,
        });
        onClose();
      }
    });
  }, [cameraType, quality, onMediaCaptured, onClose, maxRecordingTime]);

  const handleSelectFromGallery = useCallback(async () => {
    const options = {
      mediaType: 'video' as MediaType,
      selectionLimit: 1,
      quality: 0.8 as const,
      includeBase64: false,
      durationLimit: maxRecordingTime,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorCode) {
        console.log('Gallery selection cancelled or failed:', response.errorMessage);
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        
        // Check video duration
        if (asset.duration && asset.duration > maxRecordingTime) {
          Alert.alert(
            'Video Too Long',
            `Reels can only be up to ${maxRecordingTime} seconds. Please select a shorter video or trim it.`
          );
          return;
        }
        
        onMediaCaptured({
          uri: asset.uri,
          type: 'video',
          fileName: asset.fileName || `gallery_reel_${Date.now()}.mp4`,
          fileSize: asset.fileSize,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
        });
        onClose();
      }
    });
  }, [maxRecordingTime, onMediaCaptured, onClose]);

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

  const toggleQuality = useCallback(() => {
    setQuality(prev => {
      const qualities = ['high', 'medium', 'low'] as const;
      const currentIndex = qualities.indexOf(prev);
      return qualities[(currentIndex + 1) % qualities.length];
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

  const getQualityColor = () => {
    switch (quality) {
      case 'high': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'low': return '#F44336';
      default: return '#4CAF50';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.headerButton}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>
            
            <Animated.View style={[styles.timerContainer, { opacity: timerOpacity }]}>
              <View style={styles.recordingIndicator} />
              <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
              <Text style={styles.maxTimeText}>/ {formatTime(maxRecordingTime)}</Text>
            </Animated.View>
            
            <TouchableOpacity onPress={toggleFlash} style={styles.headerButton}>
              <Icon name={getFlashIcon()} size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <Animated.View 
              style={[
                styles.progressBar,
                {
                  width: progressAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                }
              ]} 
            />
          </View>

          {/* Camera Preview Area */}
          <View style={styles.cameraPreview}>
            <View style={styles.cameraPlaceholder}>
              <Animated.View style={{ transform: [{ scale: recordingPulse }] }}>
                <Icon 
                  name="videocam" 
                  size={100} 
                  color="rgba(255,255,255,0.8)" 
                />
              </Animated.View>
              <Text style={styles.placeholderText}>Reel Camera</Text>
              <Text style={styles.placeholderSubtext}>
                Hold to record • Up to {maxRecordingTime}s
              </Text>
              
              {/* Quality Indicator */}
              <View style={[styles.qualityBadge, { backgroundColor: getQualityColor() }]}>
                <Text style={styles.qualityText}>{quality.toUpperCase()}</Text>
              </View>
            </View>

            {/* Camera Type Indicator */}
            <View style={styles.cameraTypeIndicator}>
              <Text style={styles.cameraTypeText}>
                {cameraType === 'front' ? 'Front' : 'Back'} Camera
              </Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            {/* Gallery Button */}
            <TouchableOpacity onPress={handleSelectFromGallery} style={styles.controlButton}>
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.galleryButton}
              >
                <Icon name="photo-library" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>

            {/* Record Button */}
            <View style={styles.recordButtonContainer}>
              <Animated.View style={{ transform: [{ scale: recordButtonScale }] }}>
                <TouchableOpacity
                  onPress={handleTakeVideo}
                  style={[
                    styles.recordButton,
                    isRecording && styles.recordingButton
                  ]}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator size="large" color="#fff" />
                  ) : (
                    <LinearGradient
                      colors={isRecording ? ['#FF0000', '#CC0000'] : ['#FF6B6B', '#FF8E53']}
                      style={styles.recordGradient}
                    >
                      <Icon 
                        name={isRecording ? 'stop' : 'videocam'} 
                        size={36} 
                        color="#fff" 
                      />
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              </Animated.View>
              
              {/* Record button label */}
              <Text style={styles.recordLabel}>
                {isRecording ? 'Recording...' : 'Tap to Record'}
              </Text>
            </View>

            {/* Settings Menu */}
            <View style={styles.settingsContainer}>
              <TouchableOpacity onPress={toggleCamera} style={styles.settingButton}>
                <Icon name="flip-camera-ios" size={24} color="#fff" />
                <Text style={styles.settingLabel}>Flip</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={toggleQuality} style={styles.settingButton}>
                <Icon name="high-quality" size={24} color={getQualityColor()} />
                <Text style={styles.settingLabel}>{quality}</Text>
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
    paddingBottom: 15,
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  recordingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF0000',
    marginRight: 8,
  },
  timerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  maxTimeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginLeft: 4,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF0000',
    borderRadius: 2,
  },
  cameraPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
  },
  cameraPlaceholder: {
    alignItems: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  placeholderSubtext: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  qualityBadge: {
    position: 'absolute',
    top: -40,
    right: -60,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  qualityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  cameraTypeIndicator: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  cameraTypeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 30,
    paddingBottom: 40,
    height: 120,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  recordButtonContainer: {
    alignItems: 'center',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    overflow: 'hidden',
    marginBottom: 8,
  },
  recordingButton: {
    borderColor: '#FF0000',
  },
  recordGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  settingsContainer: {
    alignItems: 'center',
  },
  settingButton: {
    alignItems: 'center',
    marginBottom: 15,
    padding: 8,
  },
  settingLabel: {
    color: '#fff',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
});

export default ReelsCamera;
