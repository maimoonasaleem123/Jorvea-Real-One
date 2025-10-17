import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  Alert,
  Modal,
  FlatList,
  Image,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { launchImageLibrary, MediaType, PhotoQuality } from 'react-native-image-picker';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService from '../services/firebaseService';
import DigitalOceanService from '../services/digitalOceanService';

const { width, height } = Dimensions.get('window');

interface AudioEffect {
  id: string;
  name: string;
  preview: string;
  duration: number;
  category: string;
}

interface VideoFilter {
  id: string;
  name: string;
  effect: string;
  preview: string;
}

interface RecordingSegment {
  uri: string;
  duration: number;
  filter?: VideoFilter;
}

export default function EnhancedCreateReelScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { user } = useAuth();
  const cameraRef = useRef<Camera>(null);
  const devices = useCameraDevices();
  
  // Camera states
  const [hasPermission, setHasPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideo, setRecordedVideo] = useState<string | null>(null);
  const [cameraType, setCameraType] = useState<'front' | 'back'>('back');
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  
  // Recording states
  const [recordingSegments, setRecordingSegments] = useState<RecordingSegment[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [maxDuration] = useState(30); // 30 seconds max
  
  // UI states
  const [showAudioEffects, setShowAudioEffects] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<AudioEffect | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<VideoFilter | null>(null);
  const [timerDuration, setTimerDuration] = useState(3);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [effects, setEffects] = useState({
    volume: 1,
    speed: 1,
  });

  const audioEffects: AudioEffect[] = [
    { id: '1', name: 'Original', preview: '🎵', duration: 30, category: 'original' },
    { id: '2', name: 'Echo', preview: '🔊', duration: 30, category: 'vocal' },
    { id: '3', name: 'Reverb', preview: '🎭', duration: 30, category: 'vocal' },
    { id: '4', name: 'Bass Boost', preview: '🎸', duration: 30, category: 'music' },
    { id: '5', name: 'Treble', preview: '🎼', duration: 30, category: 'music' },
  ];

  const videoFilters: VideoFilter[] = [
    { id: '1', name: 'None', effect: 'none', preview: '🎨' },
    { id: '2', name: 'Vintage', effect: 'vintage', preview: '📸' },
    { id: '3', name: 'Black & White', effect: 'bw', preview: '⚫' },
    { id: '4', name: 'Sepia', effect: 'sepia', preview: '🟤' },
    { id: '5', name: 'Cool', effect: 'cool', preview: '❄️' },
    { id: '6', name: 'Warm', effect: 'warm', preview: '🔥' },
  ];

  // Request camera permissions
  const requestCameraPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        
        const cameraGranted = granted['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED;
        const audioGranted = granted['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED;
        
        setHasPermission(cameraGranted && audioGranted);
        
        if (!cameraGranted || !audioGranted) {
          Alert.alert('Permission Required', 'Camera and microphone permissions are required to record reels.');
        }
      } else {
        const cameraPermission = await Camera.requestCameraPermission();
        const microphonePermission = await Camera.requestMicrophonePermission();
        
        setHasPermission(cameraPermission === 'granted' && microphonePermission === 'granted');
        
        if (cameraPermission !== 'granted' || microphonePermission !== 'granted') {
          Alert.alert('Permission Required', 'Camera and microphone permissions are required to record reels.');
        }
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      setHasPermission(false);
    }
  };

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const device = cameraType === 'front' 
    ? devices.find(d => d.position === 'front') 
    : devices.find(d => d.position === 'back');

  // Start recording video
  const startRecording = async () => {
    if (!cameraRef.current || !hasPermission || isRecording) return;

    try {
      setIsRecording(true);
      cameraRef.current.startRecording({
        onRecordingFinished: (video) => {
          console.log('Recording finished:', video.path);
          setRecordedVideo(video.path);
          setIsRecording(false);
          
          const newSegment: RecordingSegment = {
            uri: video.path,
            duration: 15, // Default duration
          };
          setRecordingSegments([newSegment]);
          setTotalDuration(15);
        },
        onRecordingError: (error) => {
          console.error('Recording error:', error);
          setIsRecording(false);
          Alert.alert('Error', 'Failed to record video');
        },
      });
    } catch (error) {
      console.error('Error starting recording:', error);
      setIsRecording(false);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  // Stop recording video
  const stopRecording = async () => {
    if (!cameraRef.current || !isRecording) return;

    try {
      await cameraRef.current.stopRecording();
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const toggleCamera = () => {
    setCameraType(prev => prev === 'front' ? 'back' : 'front');
  };

  const toggleFlash = () => {
    setFlashMode(prev => {
      switch (prev) {
        case 'off': return 'on';
        case 'on': return 'auto';
        case 'auto': return 'off';
        default: return 'off';
      }
    });
  };

  const startTimer = () => {
    setIsTimerActive(true);
    setShowTimer(false);
    
    let count = timerDuration;
    const timer = setInterval(() => {
      count--;
      if (count === 0) {
        clearInterval(timer);
        setIsTimerActive(false);
        startRecording();
      }
    }, 1000);
  };

  const selectFromGallery = () => {
    const options = {
      mediaType: 'video' as MediaType,
      quality: 0.8 as PhotoQuality,
    };

    launchImageLibrary(options, (response) => {
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        if (asset.uri) {
          setRecordedVideo(asset.uri);
          // Add to segments for consistency
          const newSegment: RecordingSegment = {
            uri: asset.uri,
            duration: asset.duration || 15,
          };
          setRecordingSegments([newSegment]);
          setTotalDuration(asset.duration || 15);
        }
      }
    });
  };

  const publishReel = async () => {
    if (recordingSegments.length === 0 && !recordedVideo) {
      Alert.alert('Error', 'Please record or select a video first');
      return;
    }

    setIsUploading(true);
    try {
      const mainSegment = recordedVideo ? { uri: recordedVideo, duration: 15 } : recordingSegments[0];
      
      // Upload video to Digital Ocean
      const videoUrl = await DigitalOceanService.uploadMedia(mainSegment.uri, `reel_${Date.now()}.mp4`);

      // Create reel data
      const reelData = {
        userId: user?.uid || '',
        username: user?.displayName || 'Anonymous',
        userAvatar: user?.photoURL || '',
        videoUrl,
        thumbnailUrl: videoUrl, // Use video URL as thumbnail for now
        caption: '',
        music: selectedAudio ? {
          id: selectedAudio.id,
          title: selectedAudio.name,
          artist: 'TikTok Audio',
          audioUrl: selectedAudio.name, // placeholder
          duration: selectedAudio.duration,
        } : undefined,
        filter: selectedFilter?.effect || 'none',
        duration: totalDuration,
        hashtags: [],
        mentions: [],
        isPrivate: false, // Add missing isPrivate field
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        viewsCount: 0,
        isLiked: false,
      };

      await FirebaseService.createReel(reelData);
      
      Alert.alert('Success', 'Your reel has been published!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error publishing reel:', error);
      Alert.alert('Error', 'Failed to publish reel. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const renderAudioEffect = ({ item }: { item: AudioEffect }) => (
    <TouchableOpacity
      style={[
        styles.audioEffectItem,
        selectedAudio?.id === item.id && styles.selectedAudioEffect
      ]}
      onPress={() => {
        setSelectedAudio(item);
        setShowAudioEffects(false);
      }}
    >
      <Text style={styles.audioEffectPreview}>{item.preview}</Text>
      <Text style={styles.audioEffectName}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderVideoFilter = ({ item }: { item: VideoFilter }) => (
    <TouchableOpacity
      style={[
        styles.filterItem,
        selectedFilter?.id === item.id && styles.selectedFilter
      ]}
      onPress={() => {
        setSelectedFilter(item);
        setShowFilters(false);
      }}
    >
      <Text style={styles.filterPreview}>{item.preview}</Text>
      <Text style={styles.filterName}>{item.name}</Text>
    </TouchableOpacity>
  );

  const handleVolumeChange = (value: number) => {
    setEffects(prev => ({ ...prev, volume: value }));
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Create Reel</Text>
          <Text style={styles.durationText}>
            {Math.floor(totalDuration)}s / {maxDuration}s
          </Text>
        </View>
        <TouchableOpacity 
          onPress={publishReel}
          disabled={recordingSegments.length === 0 || isUploading}
          style={[
            styles.publishButton,
            (recordingSegments.length === 0 || isUploading) && styles.disabledButton
          ]}
        >
          <Text style={styles.publishText}>
            {isUploading ? 'Publishing...' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Camera */}
      <View style={styles.cameraContainer}>
        {device && hasPermission ? (
          <Camera
            ref={cameraRef}
            style={styles.camera}
            device={device}
            isActive={true}
            video={true}
            audio={true}
            enableZoomGesture={true}
          />
        ) : (
          <View style={[styles.camera, styles.permissionContainer]}>
            <Icon name="camera-outline" size={64} color="#666" />
            <Text style={styles.permissionText}>
              {hasPermission ? 'Loading camera...' : 'Camera permission required'}
            </Text>
            {!hasPermission && (
              <TouchableOpacity onPress={requestCameraPermission} style={styles.permissionButton}>
                <Text style={styles.permissionButtonText}>Grant Permission</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View 
            style={[
              styles.progressBar, 
              { width: `${(totalDuration / maxDuration) * 100}%` }
            ]} 
          />
        </View>

        {/* Side Controls */}
        <View style={styles.sideControls}>
          <TouchableOpacity
            style={styles.sideButton}
            onPress={toggleCamera}
          >
            <Icon name="camera-reverse" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sideButton}
            onPress={toggleFlash}
          >
            <Icon 
              name={flashMode === 'on' ? 'flash' : 'flash-off'} 
              size={24} 
              color="#fff" 
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sideButton}
            onPress={() => setShowTimer(true)}
          >
            <Icon name="timer" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sideButton}
            onPress={selectFromGallery}
          >
            <Icon name="images" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Timer Countdown */}
        {isTimerActive && (
          <View style={styles.timerOverlay}>
            <Text style={styles.timerText}>{timerDuration}</Text>
          </View>
        )}
      </View>

      {/* Bottom Controls */}
      <View style={styles.bottomControls}>
        {/* Audio & Filter Buttons */}
        <View style={styles.topBottomControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setShowAudioEffects(true)}
          >
            <Icon name="musical-notes" size={20} color="#fff" />
            <Text style={styles.controlButtonText}>Audio</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setShowFilters(true)}
          >
            <Icon name="color-filter" size={20} color="#fff" />
            <Text style={styles.controlButtonText}>Filters</Text>
          </TouchableOpacity>

          <View style={styles.volumeContainer}>
            <Icon name="volume-high" size={16} color="#fff" />
            <Slider
              style={styles.volumeSlider}
              minimumValue={0}
              maximumValue={1}
              step={0.1}
              value={effects.volume}
              onValueChange={handleVolumeChange}
              minimumTrackTintColor="#E1306C"
              maximumTrackTintColor="#ccc"
              thumbTintColor="#E1306C"
            />
          </View>
        </View>

        {/* Main Controls */}
        <View style={styles.mainControls}>
          <View style={styles.spacer} />

          <TouchableOpacity
            style={[
              styles.recordButton,
              isRecording && styles.recordingButton,
              totalDuration >= maxDuration && styles.disabledRecordButton
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={totalDuration >= maxDuration}
          >
            <View style={[styles.recordButtonInner, isRecording && styles.recordingInner]} />
          </TouchableOpacity>

          <View style={styles.spacer} />
        </View>
      </View>

      {/* Audio Effects Modal */}
      <Modal visible={showAudioEffects} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Audio</Text>
              <TouchableOpacity onPress={() => setShowAudioEffects(false)}>
                <Icon name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={audioEffects}
              renderItem={renderAudioEffect}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.audioEffectsList}
            />
          </View>
        </View>
      </Modal>

      {/* Filters Modal */}
      <Modal visible={showFilters} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Filter</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Icon name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={videoFilters}
              renderItem={renderVideoFilter}
              keyExtractor={(item) => item.id}
              numColumns={3}
              contentContainerStyle={styles.filtersList}
            />
          </View>
        </View>
      </Modal>

      {/* Timer Modal */}
      <Modal visible={showTimer} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.timerModalContainer}>
            <Text style={styles.modalTitle}>Set Timer</Text>
            <View style={styles.timerSliderContainer}>
              <Text style={styles.timerValue}>{timerDuration}s</Text>
              <Slider
                style={styles.timerSlider}
                minimumValue={3}
                maximumValue={10}
                step={1}
                value={timerDuration}
                onValueChange={setTimerDuration}
                minimumTrackTintColor="#E1306C"
                maximumTrackTintColor="#ccc"
                thumbTintColor="#E1306C"
              />
            </View>
            <View style={styles.timerButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowTimer(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={startTimer}
              >
                <Text style={styles.confirmButtonText}>Start</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 20,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  durationText: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
  },
  publishButton: {
    backgroundColor: '#E1306C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disabledButton: {
    backgroundColor: '#666',
  },
  publishText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#333',
  },
  permissionText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#E1306C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#E1306C',
  },
  sideControls: {
    position: 'absolute',
    right: 16,
    top: '50%',
    transform: [{ translateY: -100 }],
  },
  sideButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  timerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  timerText: {
    fontSize: 72,
    color: '#fff',
    fontWeight: 'bold',
  },
  bottomControls: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  topBottomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  controlButton: {
    alignItems: 'center',
    marginRight: 24,
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 16,
  },
  volumeSlider: {
    flex: 1,
    height: 20,
    marginLeft: 8,
  },
  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    flex: 1,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#E1306C',
  },
  recordingButton: {
    borderColor: '#ff4444',
  },
  disabledRecordButton: {
    opacity: 0.5,
  },
  recordButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E1306C',
  },
  recordingInner: {
    backgroundColor: '#ff4444',
    borderRadius: 8,
    width: 32,
    height: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    maxHeight: height * 0.7,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  audioEffectsList: {
    padding: 20,
  },
  audioEffectItem: {
    flex: 1,
    margin: 8,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 80,
  },
  selectedAudioEffect: {
    backgroundColor: '#E1306C',
  },
  audioEffectPreview: {
    fontSize: 24,
    marginBottom: 4,
  },
  audioEffectName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  filtersList: {
    padding: 20,
  },
  filterItem: {
    flex: 1,
    margin: 6,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 70,
  },
  selectedFilter: {
    backgroundColor: '#E1306C',
  },
  filterPreview: {
    fontSize: 20,
    marginBottom: 4,
  },
  filterName: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  timerModalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 30,
    alignItems: 'center',
  },
  timerSliderContainer: {
    alignItems: 'center',
    marginVertical: 30,
  },
  timerValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  timerSlider: {
    width: 200,
    height: 40,
  },
  timerButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  cancelButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  confirmButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#E1306C',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
