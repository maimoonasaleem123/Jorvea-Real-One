import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Platform,
  PermissionsAndroid,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { launchCamera, launchImageLibrary, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import ImagePicker from 'react-native-image-crop-picker';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface CameraComponentProps {
  onMediaSelected: (media: any) => void;
  onClose?: () => void;
  allowVideo?: boolean;
  allowMultiple?: boolean;
  maxImages?: number;
  compressImageQuality?: number;
  showPreview?: boolean;
}

const { width, height } = Dimensions.get('window');

const ProfessionalCamera: React.FC<CameraComponentProps> = ({
  onMediaSelected,
  onClose,
  allowVideo = true,
  allowMultiple = false,
  maxImages = 10,
  compressImageQuality = 0.8,
  showPreview = true,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Permission handling
  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      if (Platform.OS === 'android') {
        const cameraPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'Jorvea needs access to your camera to take photos and videos',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        const storagePermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'Jorvea needs access to your storage to save photos and videos',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        return (
          cameraPermission === PermissionsAndroid.RESULTS.GRANTED &&
          storagePermission === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const cameraStatus = await check(PERMISSIONS.IOS.CAMERA);
        if (cameraStatus !== RESULTS.GRANTED) {
          const result = await request(PERMISSIONS.IOS.CAMERA);
          return result === RESULTS.GRANTED;
        }
        return true;
      }
    } catch (error) {
      console.error('Permission error:', error);
      return false;
    }
  };

  // Open camera for photo
  const openCamera = useCallback(async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos');
      return;
    }

    setLoading(true);
    try {
      const result = await ImagePicker.openCamera({
        width: 1080,
        height: 1080,
        cropping: true,
        cropperCircleOverlay: false,
        compressImageQuality: compressImageQuality,
        mediaType: 'photo',
        includeBase64: false,
        useFrontCamera: false,
        enableRotationGesture: true,
        freeStyleCropEnabled: true,
      });

      const media = {
        uri: result.path,
        type: result.mime,
        width: result.width,
        height: result.height,
        size: result.size,
        fileName: `image_${Date.now()}.jpg`,
        mediaType: 'photo',
      };

      setSelectedMedia([media]);
      if (showPreview) {
        setPreviewImage(result.path);
      } else {
        onMediaSelected(media);
        setModalVisible(false);
      }
    } catch (error) {
      console.log('Camera cancelled or error:', error);
    } finally {
      setLoading(false);
    }
  }, [compressImageQuality, showPreview, onMediaSelected]);

  // Open camera for video
  const openVideoCamera = useCallback(async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Camera permission is required to record videos');
      return;
    }

    setLoading(true);
    try {
      const result = await ImagePicker.openCamera({
        mediaType: 'video',
        videoQuality: 'high',
        durationLimit: 60, // 60 seconds max
        includeBase64: false,
      });

      const media = {
        uri: result.path,
        type: result.mime,
        width: result.width,
        height: result.height,
        size: result.size,
        duration: result.duration,
        fileName: `video_${Date.now()}.mp4`,
        mediaType: 'video',
      };

      setSelectedMedia([media]);
      onMediaSelected(media);
      setModalVisible(false);
    } catch (error) {
      console.log('Video camera cancelled or error:', error);
    } finally {
      setLoading(false);
    }
  }, [onMediaSelected]);

  // Open gallery for photos
  const openGallery = useCallback(async () => {
    setLoading(true);
    try {
      if (allowMultiple) {
        const results = await ImagePicker.openPicker({
          multiple: true,
          maxFiles: maxImages,
          mediaType: 'photo',
          compressImageQuality: compressImageQuality,
          cropping: false,
          includeBase64: false,
        });

        const media = results.map((result: any) => ({
          uri: result.path,
          type: result.mime,
          width: result.width,
          height: result.height,
          size: result.size,
          fileName: `image_${Date.now()}.jpg`,
          mediaType: 'photo',
        }));

        setSelectedMedia(media);
        onMediaSelected(media);
        setModalVisible(false);
      } else {
        const result = await ImagePicker.openPicker({
          width: 1080,
          height: 1080,
          cropping: true,
          compressImageQuality: compressImageQuality,
          mediaType: 'photo',
          includeBase64: false,
          enableRotationGesture: true,
          freeStyleCropEnabled: true,
        });

        const media = {
          uri: result.path,
          type: result.mime,
          width: result.width,
          height: result.height,
          size: result.size,
          fileName: `image_${Date.now()}.jpg`,
          mediaType: 'photo',
        };

        setSelectedMedia([media]);
        if (showPreview) {
          setPreviewImage(result.path);
        } else {
          onMediaSelected(media);
          setModalVisible(false);
        }
      }
    } catch (error) {
      console.log('Gallery cancelled or error:', error);
    } finally {
      setLoading(false);
    }
  }, [allowMultiple, maxImages, compressImageQuality, showPreview, onMediaSelected]);

  // Confirm selection
  const confirmSelection = useCallback(() => {
    if (selectedMedia.length > 0) {
      onMediaSelected(allowMultiple ? selectedMedia : selectedMedia[0]);
      setModalVisible(false);
      setPreviewImage(null);
      setSelectedMedia([]);
    }
  }, [selectedMedia, allowMultiple, onMediaSelected]);

  // Cancel selection
  const cancelSelection = useCallback(() => {
    setPreviewImage(null);
    setSelectedMedia([]);
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.cameraButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Icon name="camera-alt" size={24} color="#fff" />
        <Text style={styles.cameraButtonText}>Camera</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          cancelSelection();
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007bff" />
                <Text style={styles.loadingText}>Processing...</Text>
              </View>
            )}

            {previewImage && !loading && (
              <View style={styles.previewContainer}>
                <Image source={{ uri: previewImage }} style={styles.previewImage} />
                <View style={styles.previewActions}>
                  <TouchableOpacity style={styles.retakeButton} onPress={cancelSelection}>
                    <Icon name="refresh" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.confirmButton} onPress={confirmSelection}>
                    <Icon name="check" size={20} color="#fff" />
                    <Text style={styles.buttonText}>Use Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!previewImage && !loading && (
              <>
                <Text style={styles.modalTitle}>Choose an option</Text>
                
                <TouchableOpacity style={styles.optionButton} onPress={openCamera}>
                  <Icon name="camera-alt" size={30} color="#007bff" />
                  <Text style={styles.optionText}>Take Photo</Text>
                </TouchableOpacity>

                {allowVideo && (
                  <TouchableOpacity style={styles.optionButton} onPress={openVideoCamera}>
                    <Icon name="videocam" size={30} color="#007bff" />
                    <Text style={styles.optionText}>Record Video</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.optionButton} onPress={openGallery}>
                  <Icon name="photo-library" size={30} color="#007bff" />
                  <Text style={styles.optionText}>
                    {allowMultiple ? `Choose Photos (max ${maxImages})` : 'Choose from Gallery'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setModalVisible(false);
                    cancelSelection();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  cameraButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: width * 0.9,
    maxHeight: height * 0.8,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginVertical: 5,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  optionText: {
    fontSize: 16,
    marginLeft: 15,
    color: '#333',
    fontWeight: '500',
  },
  cancelButton: {
    paddingVertical: 15,
    marginTop: 10,
    backgroundColor: '#6c757d',
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewContainer: {
    alignItems: 'center',
  },
  previewImage: {
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: 10,
    resizeMode: 'cover',
  },
  previewActions: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'space-around',
    width: '100%',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6c757d',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#28a745',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
});

export default ProfessionalCamera;
