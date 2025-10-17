import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  TextInput,
  ScrollView,
  Animated,
  Alert,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService, { StoryFilter, StoryText, StorySticker } from '../services/firebaseService';

// Lazy load camera to prevent startup crashes
let Camera: any = null;
let useCameraDevices: any = null;
let useFrameProcessor: any = null;

const loadCameraModule = async () => {
  try {
    const cameraModule = await import('react-native-vision-camera');
    Camera = cameraModule.Camera;
    useCameraDevices = cameraModule.useCameraDevices;
    useFrameProcessor = cameraModule.useFrameProcessor;
    return true;
  } catch (error) {
    console.log('Camera module not available:', error);
    return false;
  }
};

const { width, height } = Dimensions.get('window');

const STORY_FILTERS: StoryFilter[] = [
  { id: 'none', name: 'Normal', colors: [], intensity: 0 },
  { id: 'vintage', name: 'Vintage', colors: ['#8B4513', '#DEB887'], intensity: 0.3 },
  { id: 'bright', name: 'Bright', colors: ['#FFD700', '#FFA500'], intensity: 0.2 },
  { id: 'cool', name: 'Cool', colors: ['#00CED1', '#4169E1'], intensity: 0.25 },
  { id: 'warm', name: 'Warm', colors: ['#FF6347', '#FF4500'], intensity: 0.2 },
  { id: 'dramatic', name: 'Dramatic', colors: ['#800080', '#4B0082'], intensity: 0.4 },
  { id: 'sunset', name: 'Sunset', colors: ['#FF8C00', '#FF1493'], intensity: 0.3 },
  { id: 'ocean', name: 'Ocean', colors: ['#0077BE', '#00CED1'], intensity: 0.25 },
];

const TEXT_COLORS = [
  '#FFFFFF', '#000000', '#FF3040', '#FF6B35', '#F7931E',
  '#FFD23F', '#00C896', '#00A8CC', '#0078FF', '#8B5CF6',
  '#F472B6', '#EF4444'
];

const FONT_FAMILIES = [
  'System',
  'HelveticaNeue-Bold',
  'HelveticaNeue-Light',
  'American Typewriter',
  'Avenir-Heavy',
  'Charter-Roman',
];

export default function AdvancedStoryCreationScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  
  // Safe camera initialization
  const [cameraLoaded, setCameraLoaded] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);
  const [device, setDevice] = useState<any>(null);
  const cameraRef = useRef<any>(null);
  
  // State management
  const [hasPermission, setHasPermission] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const [cameraType, setCameraType] = useState<'back' | 'front'>('back');
  const [capturedMedia, setCapturedMedia] = useState<{
    uri: string;
    type: 'photo' | 'video';
    duration?: number;
  } | null>(null);
  
  // Story editing states
  const [selectedFilter, setSelectedFilter] = useState<StoryFilter>(STORY_FILTERS[0]);
  const [storyTexts, setStoryTexts] = useState<StoryText[]>([]);
  const [storyStickers, setStoryStickers] = useState<StorySticker[]>([]);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showFilterSelector, setShowFilterSelector] = useState(false);
  const [showStickerSelector, setShowStickerSelector] = useState(false);
  const [currentTextEdit, setCurrentTextEdit] = useState<StoryText | null>(null);
  
  // Animations
  const recordingScale = useRef(new Animated.Value(1)).current;
  const filterOpacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const initializeCamera = async () => {
      try {
        // Load camera module safely
        const cameraAvailable = await loadCameraModule();
        if (!cameraAvailable) {
          console.log('Camera not available, using image picker fallback');
          return;
        }
        
        // Get camera devices
        const cameraDevices = Camera?.getAvailableCameraDevices?.() || [];
        setDevices(cameraDevices);
        setDevice(cameraDevices.find((d: any) => d.position === 'back') || cameraDevices[0]);
        setCameraLoaded(true);
        
        // Request permissions after camera is loaded
        requestCameraPermission();
      } catch (error) {
        console.log('Camera initialization failed:', error);
        setCameraLoaded(false);
      }
    };

    // Initialize camera after a delay to ensure React Native is ready
    const timer = setTimeout(initializeCamera, 2000);
    
    return () => {
      clearTimeout(timer);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const requestCameraPermission = async () => {
    try {
      if (!Camera) return;
      
      const permission = await Camera.requestCameraPermission();
      const micPermission = await Camera.requestMicrophonePermission();
      setHasPermission(permission === 'granted' && micPermission === 'granted');
    } catch (error) {
      console.log('Camera permission request failed:', error);
      setHasPermission(false);
    }
  };

  const startRecording = async () => {
    if (!cameraRef.current || isRecording) return;
    
    try {
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start recording animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingScale, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(recordingScale, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 15) { // Max 15 seconds for story
            stopRecording();
            return prev;
          }
          return prev + 0.1;
        });
      }, 100);
      
      // Start actual recording
      await cameraRef.current.startRecording({
        flash: flashMode === 'auto' ? 'off' : flashMode,
        onRecordingFinished: (video: any) => {
          setCapturedMedia({
            uri: video.path,
            type: 'video',
            duration: recordingTime,
          });
        },
        onRecordingError: (error: any) => {
          console.error('Recording error:', error);
          setIsRecording(false);
        },
      });
    } catch (error) {
      console.error('Start recording error:', error);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!cameraRef.current || !isRecording) return;
    
    try {
      setIsRecording(false);
      recordingScale.stopAnimation();
      recordingScale.setValue(1);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      await cameraRef.current.stopRecording();
    } catch (error) {
      console.error('Stop recording error:', error);
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    
    try {
      const photo = await cameraRef.current.takePhoto({
        flash: flashMode === 'auto' ? 'off' : flashMode,
        enableShutterSound: false,
      });
      
      setCapturedMedia({
        uri: photo.path,
        type: 'photo',
      });
    } catch (error) {
      console.error('Take photo error:', error);
    }
  };

  const pickFromGallery = () => {
    launchImageLibrary(
      {
        mediaType: 'mixed',
        quality: 1,
        videoQuality: 'high',
      },
      (response) => {
        if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          setCapturedMedia({
            uri: asset.uri!,
            type: asset.type?.startsWith('video') ? 'video' : 'photo',
            duration: asset.duration,
          });
        }
      }
    );
  };

  const toggleCamera = () => {
    setCameraType(prev => prev === 'back' ? 'front' : 'back');
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

  const addText = () => {
    const newText: StoryText = {
      id: Date.now().toString(),
      text: 'Tap to edit',
      color: '#FFFFFF',
      fontSize: 24,
      fontFamily: 'System',
      position: { x: width / 2, y: height / 2 },
      rotation: 0,
      scale: 1,
      opacity: 1,
      strokeColor: '#000000',
      strokeWidth: 0,
      shadowColor: 'rgba(0,0,0,0.5)',
      shadowOffset: { x: 2, y: 2 },
      shadowBlur: 4,
    };
    
    setStoryTexts(prev => [...prev, newText]);
    setCurrentTextEdit(newText);
    setShowTextEditor(true);
  };

  const updateText = (textId: string, updates: Partial<StoryText>) => {
    setStoryTexts(prev => prev.map(text => 
      text.id === textId ? { ...text, ...updates } : text
    ));
  };

  const deleteText = (textId: string) => {
    setStoryTexts(prev => prev.filter(text => text.id !== textId));
  };

  const applyFilter = (filter: StoryFilter) => {
    setSelectedFilter(filter);
    setShowFilterSelector(false);
    
    // Animate filter application
    Animated.sequence([
      Animated.timing(filterOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(filterOpacity, {
        toValue: filter.intensity,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const publishStory = async () => {
    if (!capturedMedia || !user) {
      Alert.alert('Error', 'Please capture a photo or video first');
      return;
    }

    try {
      // Show loading state
      Alert.alert('Publishing', 'Uploading your story...', [], { cancelable: false });

      // Create story data
      const storyData = {
        mediaUri: capturedMedia.uri,
        mediaType: capturedMedia.type,
        duration: capturedMedia.duration,
        filter: selectedFilter,
        texts: storyTexts,
        stickers: storyStickers,
      };

      // Upload to Firebase
      await FirebaseService.createStory(storyData);
      
      Alert.alert(
        'Success!', 
        'Your story has been published',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Publish story error:', error);
      Alert.alert('Error', 'Failed to publish story. Please try again.');
    }
  };

  const renderCameraView = () => {
    if (!device || !hasPermission) {
      return (
        <View style={styles.permissionContainer}>
          <Icon name="camera-outline" size={80} color={colors.text} />
          <Text style={[styles.permissionText, { color: colors.text }]}>
            Camera permission required
          </Text>
          <TouchableOpacity 
            style={styles.permissionButton} 
            onPress={requestCameraPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cameraContainer}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          device={cameraType === 'back' ? 
            devices?.find(d => d.position === 'back') || device! : 
            devices?.find(d => d.position === 'front') || device!}
          isActive={!capturedMedia}
          video={true}
          audio={true}
          enableZoomGesture
        />
        
        {/* Filter Overlay */}
        {selectedFilter.id !== 'none' && (
          <Animated.View 
            style={[
              styles.filterOverlay,
              { opacity: filterOpacity }
            ]}
          >
            <LinearGradient
              colors={selectedFilter.colors}
              style={styles.filterGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>
        )}
        
        {/* Recording Timer */}
        {isRecording && (
          <View style={styles.recordingTimer}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>
              {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toFixed(1).padStart(4, '0')}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderEditingView = () => {
    if (!capturedMedia) return null;

    return (
      <View style={styles.editingContainer}>
        <Image source={{ uri: capturedMedia.uri }} style={styles.editingMedia} />
        
        {/* Filter Overlay */}
        {selectedFilter.id !== 'none' && (
          <Animated.View 
            style={[
              styles.filterOverlay,
              { opacity: filterOpacity }
            ]}
          >
            <LinearGradient
              colors={selectedFilter.colors}
              style={styles.filterGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>
        )}
        
        {/* Text Elements */}
        {storyTexts.map(textElement => (
          <TouchableOpacity
            key={textElement.id}
            style={[
              styles.textElement,
              {
                left: textElement.position.x - 50,
                top: textElement.position.y - 20,
                transform: [
                  { rotate: `${textElement.rotation}deg` },
                  { scale: textElement.scale },
                ],
              },
            ]}
            onPress={() => {
              setCurrentTextEdit(textElement);
              setShowTextEditor(true);
            }}
          >
            <Text
              style={[
                styles.storyText,
                {
                  color: textElement.color,
                  fontSize: textElement.fontSize,
                  fontFamily: textElement.fontFamily,
                },
              ]}
            >
              {textElement.text}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderControls = () => {
    if (capturedMedia) {
      return (
        <View style={styles.editingControls}>
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={() => setCapturedMedia(null)}
          >
            <Icon name="close" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={() => setShowFilterSelector(true)}
          >
            <Icon name="color-filter-outline" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={addText}
          >
            <Icon name="text-outline" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.controlButton}
            onPress={() => setShowStickerSelector(true)}
          >
            <Icon name="happy-outline" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.publishButton}
            onPress={publishStory}
          >
            <Text style={styles.publishButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.cameraControls}>
        <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
          <Icon 
            name={flashMode === 'off' ? 'flash-off' : flashMode === 'on' ? 'flash' : 'flash-outline'} 
            size={24} 
            color="#fff" 
          />
        </TouchableOpacity>
        
        <View style={styles.captureContainer}>
          <TouchableOpacity style={styles.galleryButton} onPress={pickFromGallery}>
            <Icon name="images-outline" size={24} color="#fff" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.captureButton, isRecording && styles.recordingButton]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
            onPress={takePhoto}
          >
            <Animated.View 
              style={[
                styles.captureButtonInner,
                { transform: [{ scale: recordingScale }] }
              ]}
            />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.switchButton} onPress={toggleCamera}>
            <Icon name="camera-reverse-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={() => setShowFilterSelector(true)}
        >
          <Icon name="color-filter-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="close" size={28} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Create Story</Text>
        
        <View style={styles.headerButton} />
      </View>
      
      {/* Main Content */}
      {capturedMedia ? renderEditingView() : renderCameraView()}
      
      {/* Controls */}
      {renderControls()}
      
      {/* Filter Selector Modal */}
      <Modal
        visible={showFilterSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterSelector(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.filterModal}>
            <Text style={styles.modalTitle}>Choose Filter</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {STORY_FILTERS.map(filter => (
                <TouchableOpacity
                  key={filter.id}
                  style={[
                    styles.filterOption,
                    selectedFilter.id === filter.id && styles.selectedFilter
                  ]}
                  onPress={() => applyFilter(filter)}
                >
                  <View style={styles.filterPreview}>
                    {filter.colors.length > 0 && (
                      <LinearGradient
                        colors={filter.colors}
                        style={styles.filterGradientPreview}
                      />
                    )}
                  </View>
                  <Text style={styles.filterName}>{filter.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Text Editor Modal */}
      <Modal
        visible={showTextEditor}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTextEditor(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.textModal}>
            <Text style={styles.modalTitle}>Add Text</Text>
            
            <TextInput
              style={styles.textInput}
              value={currentTextEdit?.text || ''}
              onChangeText={(text) => {
                if (currentTextEdit) {
                  updateText(currentTextEdit.id, { text });
                  setCurrentTextEdit({ ...currentTextEdit, text });
                }
              }}
              placeholder="Type something..."
              placeholderTextColor="#999"
              multiline
            />
            
            <ScrollView horizontal style={styles.colorPicker}>
              {TEXT_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    currentTextEdit?.color === color && styles.selectedColor
                  ]}
                  onPress={() => {
                    if (currentTextEdit) {
                      updateText(currentTextEdit.id, { color });
                      setCurrentTextEdit({ ...currentTextEdit, color });
                    }
                  }}
                />
              ))}
            </ScrollView>
            
            <View style={styles.textModalButtons}>
              <TouchableOpacity
                style={styles.textModalButton}
                onPress={() => {
                  if (currentTextEdit) {
                    deleteText(currentTextEdit.id);
                  }
                  setShowTextEditor(false);
                }}
              >
                <Text style={styles.textModalButtonText}>Delete</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.textModalButton, styles.primaryButton]}
                onPress={() => setShowTextEditor(false)}
              >
                <Text style={[styles.textModalButtonText, styles.primaryButtonText]}>Done</Text>
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
    zIndex: 1000,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    fontSize: 18,
    textAlign: 'center',
    marginVertical: 20,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  filterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  filterGradient: {
    flex: 1,
  },
  recordingTimer: {
    position: 'absolute',
    top: 20,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 2,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3040',
    marginRight: 8,
  },
  recordingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  editingContainer: {
    flex: 1,
    position: 'relative',
  },
  editingMedia: {
    flex: 1,
    width: '100%',
  },
  textElement: {
    position: 'absolute',
    padding: 8,
    zIndex: 10,
  },
  storyText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 30,
    zIndex: 1000,
  },
  editingControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 1000,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  galleryButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  recordingButton: {
    backgroundColor: 'rgba(255,48,64,0.8)',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  switchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: height * 0.4,
  },
  textModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: height * 0.6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  filterOption: {
    alignItems: 'center',
    marginRight: 15,
    padding: 10,
    borderRadius: 10,
  },
  selectedFilter: {
    backgroundColor: '#E3F2FD',
  },
  filterPreview: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0f0f0',
    marginBottom: 8,
    overflow: 'hidden',
  },
  filterGradientPreview: {
    flex: 1,
  },
  filterName: {
    fontSize: 12,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  colorPicker: {
    marginBottom: 20,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: '#007AFF',
  },
  textModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  textModalButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  textModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  primaryButtonText: {
    color: '#fff',
  },
});
