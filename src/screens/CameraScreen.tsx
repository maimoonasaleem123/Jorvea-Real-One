import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import CameraManager, { MediaFile, CameraOptions } from '../utils/CameraManager';

interface CameraScreenProps {
  navigation: any;
  route?: any;
  onMediaCaptured?: (media: MediaFile | MediaFile[]) => void;
  allowMultiple?: boolean;
  maxFiles?: number;
  mediaType?: 'photo' | 'video' | 'mixed';
}

const { width, height } = Dimensions.get('window');

const CameraScreen: React.FC<CameraScreenProps> = ({
  navigation,
  route,
  onMediaCaptured,
  allowMultiple = false,
  maxFiles = 10,
  mediaType = 'mixed',
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaFile[]>([]);
  const [flashMode, setFlashMode] = useState<'on' | 'off' | 'auto'>('auto');
  const cameraManager = useRef(CameraManager.getInstance()).current;

  useEffect(() => {
    // Cleanup temp files when component unmounts
    return () => {
      cameraManager.cleanupTempFiles();
    };
  }, []);

  const handleTakePhoto = async () => {
    setLoading(true);
    try {
      const options: CameraOptions = {
        quality: 'high',
        enableCropping: true,
        compressImageQuality: 0.8,
      };

      const result = await cameraManager.takePhoto(options);
      if (result) {
        if (allowMultiple) {
          setSelectedMedia(prev => [...prev, result]);
        } else {
          if (onMediaCaptured) {
            onMediaCaptured(result);
          }
          navigation.goBack();
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
      console.error('Photo capture error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordVideo = async () => {
    setLoading(true);
    try {
      const options: CameraOptions = {
        quality: 'high',
        maxDuration: 60, // 60 seconds
      };

      const result = await cameraManager.recordVideo(options);
      if (result) {
        if (allowMultiple) {
          setSelectedMedia(prev => [...prev, result]);
        } else {
          if (onMediaCaptured) {
            onMediaCaptured(result);
          }
          navigation.goBack();
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to record video. Please try again.');
      console.error('Video recording error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFromGallery = async () => {
    setLoading(true);
    try {
      const options: CameraOptions = {
        allowMultiple,
        maxFiles,
        mediaType,
        quality: 'high',
        enableCropping: !allowMultiple,
        compressImageQuality: 0.8,
      };

      const result = await cameraManager.selectFromGallery(options);
      if (result) {
        if (Array.isArray(result)) {
          setSelectedMedia(prev => [...prev, ...result]);
        } else {
          if (allowMultiple) {
            setSelectedMedia(prev => [...prev, result]);
          } else {
            if (onMediaCaptured) {
              onMediaCaptured(result);
            }
            navigation.goBack();
          }
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select from gallery. Please try again.');
      console.error('Gallery selection error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSelection = () => {
    if (selectedMedia.length > 0) {
      if (onMediaCaptured) {
        onMediaCaptured(allowMultiple ? selectedMedia : selectedMedia[0]);
      }
      navigation.goBack();
    }
  };

  const handleRemoveMedia = (index: number) => {
    setSelectedMedia(prev => prev.filter((_, i) => i !== index));
  };

  const renderSelectedMedia = () => {
    if (selectedMedia.length === 0) return null;

    return (
      <View style={styles.selectedMediaContainer}>
        <Text style={styles.selectedMediaTitle}>
          Selected ({selectedMedia.length}/{maxFiles})
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {selectedMedia.map((media, index) => (
            <View key={index} style={styles.selectedMediaItem}>
              <Image source={{ uri: media.uri }} style={styles.selectedMediaImage} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveMedia(index)}
              >
                <Icon name="close" size={16} color="#fff" />
              </TouchableOpacity>
              {media.mediaType === 'video' && (
                <View style={styles.videoIndicator}>
                  <Icon name="play-arrow" size={20} color="#fff" />
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Icon name="close" size={24} color="#fff" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Camera</Text>
        
        <TouchableOpacity
          onPress={() => setFlashMode(prev => 
            prev === 'auto' ? 'on' : prev === 'on' ? 'off' : 'auto'
          )}
          style={styles.headerButton}
        >
          <Icon 
            name={flashMode === 'on' ? 'flash-on' : flashMode === 'off' ? 'flash-off' : 'flash-auto'} 
            size={24} 
            color="#fff" 
          />
        </TouchableOpacity>
      </View>

      {/* Camera Placeholder - This would be the actual camera view */}
      <View style={styles.cameraContainer}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.cameraPlaceholder}
        >
          <Icon name="camera-alt" size={80} color="rgba(255,255,255,0.3)" />
          <Text style={styles.cameraPlaceholderText}>Camera View</Text>
        </LinearGradient>
      </View>

      {/* Selected Media */}
      {renderSelectedMedia()}

      {/* Controls */}
      <View style={styles.controlsContainer}>
        {/* Gallery Button */}
        <TouchableOpacity onPress={handleSelectFromGallery} style={styles.galleryButton}>
          <Icon name="photo-library" size={30} color="#fff" />
        </TouchableOpacity>

        {/* Capture Button */}
        <View style={styles.captureButtonContainer}>
          {mediaType === 'photo' || mediaType === 'mixed' ? (
            <TouchableOpacity
              onPress={handleTakePhoto}
              style={[styles.captureButton, loading && styles.captureButtonDisabled]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="large" color="#fff" />
              ) : (
                <View style={styles.captureButtonInner} />
              )}
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Video Button */}
        {(mediaType === 'video' || mediaType === 'mixed') && (
          <TouchableOpacity onPress={handleRecordVideo} style={styles.videoButton}>
            <Icon name="videocam" size={30} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom Actions */}
      {allowMultiple && selectedMedia.length > 0 && (
        <View style={styles.bottomActions}>
          <TouchableOpacity
            onPress={() => setSelectedMedia([])}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleConfirmSelection}
            style={styles.confirmButton}
          >
            <Text style={styles.confirmButtonText}>
              Use {selectedMedia.length} {selectedMedia.length === 1 ? 'Item' : 'Items'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading Overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Processing...</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  headerButton: {
    padding: 5,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraPlaceholderText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginTop: 10,
  },
  selectedMediaContainer: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 10,
  },
  selectedMediaTitle: {
    color: '#fff',
    fontSize: 14,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  selectedMediaItem: {
    width: 60,
    height: 60,
    marginHorizontal: 5,
    marginLeft: 20,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  selectedMediaImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonContainer: {
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  videoButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  clearButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#6c757d',
    borderRadius: 20,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  confirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007bff',
    borderRadius: 20,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
});

export default CameraScreen;
