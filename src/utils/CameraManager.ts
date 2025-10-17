import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import ImagePicker from 'react-native-image-crop-picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

export interface MediaFile {
  uri: string;
  type: string;
  width?: number;
  height?: number;
  size?: number;
  duration?: number;
  fileName: string;
  mediaType: 'photo' | 'video';
  timestamp: number;
}

export interface CameraOptions {
  mediaType?: 'photo' | 'video' | 'mixed';
  quality?: 'low' | 'medium' | 'high';
  allowMultiple?: boolean;
  maxFiles?: number;
  maxDuration?: number; // for videos in seconds
  enableCropping?: boolean;
  cropAspectRatio?: { width: number; height: number };
  compressImageQuality?: number;
  includeBase64?: boolean;
}

class CameraManager {
  private static instance: CameraManager;

  static getInstance(): CameraManager {
    if (!CameraManager.instance) {
      CameraManager.instance = new CameraManager();
    }
    return CameraManager.instance;
  }

  /**
   * Request camera and storage permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ];

        const results = await PermissionsAndroid.requestMultiple(permissions);

        return (
          results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
          results[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED &&
          results[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        const cameraStatus = await check(PERMISSIONS.IOS.CAMERA);
        const photoStatus = await check(PERMISSIONS.IOS.PHOTO_LIBRARY);

        let cameraGranted = cameraStatus === RESULTS.GRANTED;
        let photoGranted = photoStatus === RESULTS.GRANTED;

        if (!cameraGranted) {
          const cameraResult = await request(PERMISSIONS.IOS.CAMERA);
          cameraGranted = cameraResult === RESULTS.GRANTED;
        }

        if (!photoGranted) {
          const photoResult = await request(PERMISSIONS.IOS.PHOTO_LIBRARY);
          photoGranted = photoResult === RESULTS.GRANTED;
        }

        return cameraGranted && photoGranted;
      }
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }

  /**
   * Open camera to take a photo
   */
  async takePhoto(options: CameraOptions = {}): Promise<MediaFile | null> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Camera and storage permissions are required to take photos');
      return null;
    }

    try {
      const {
        quality = 'high',
        enableCropping = true,
        compressImageQuality = 0.8,
        cropAspectRatio,
      } = options;

      const result = await ImagePicker.openCamera({
        width: this.getImageDimensions(quality).width,
        height: this.getImageDimensions(quality).height,
        cropping: enableCropping,
        cropperCircleOverlay: false,
        compressImageQuality,
        mediaType: 'photo',
        includeBase64: options.includeBase64 || false,
        useFrontCamera: false,
        enableRotationGesture: true,
        freeStyleCropEnabled: !cropAspectRatio,
        ...(cropAspectRatio && { cropperToolbarTitle: 'Crop Image' }),
      });

      return this.formatMediaFile(result, 'photo');
    } catch (error) {
      if (error.toString().includes('cancelled')) {
        console.log('User cancelled photo capture');
        return null;
      }
      console.error('Photo capture error:', error);
      throw error;
    }
  }

  /**
   * Open camera to record a video
   */
  async recordVideo(options: CameraOptions = {}): Promise<MediaFile | null> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Camera and storage permissions are required to record videos');
      return null;
    }

    try {
      const {
        quality = 'high',
        maxDuration = 60,
      } = options;

      const result = await ImagePicker.openCamera({
        mediaType: 'video',
        videoQuality: quality,
        durationLimit: maxDuration,
        includeBase64: false,
      });

      return this.formatMediaFile(result, 'video');
    } catch (error) {
      if (error.toString().includes('cancelled')) {
        console.log('User cancelled video recording');
        return null;
      }
      console.error('Video recording error:', error);
      throw error;
    }
  }

  /**
   * Select photo(s) from gallery
   */
  async selectFromGallery(options: CameraOptions = {}): Promise<MediaFile | MediaFile[] | null> {
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Storage permission is required to access photos');
      return null;
    }

    try {
      const {
        allowMultiple = false,
        maxFiles = 10,
        quality = 'high',
        enableCropping = false,
        compressImageQuality = 0.8,
        mediaType = 'photo',
      } = options;

      if (allowMultiple) {
        const results = await ImagePicker.openPicker({
          multiple: true,
          maxFiles,
          mediaType: mediaType === 'mixed' ? 'any' : mediaType,
          compressImageQuality,
          includeBase64: options.includeBase64 || false,
        });

        return results.map((result: any) => 
          this.formatMediaFile(result, this.getMediaType(result.mime))
        );
      } else {
        const result = await ImagePicker.openPicker({
          width: enableCropping ? this.getImageDimensions(quality).width : undefined,
          height: enableCropping ? this.getImageDimensions(quality).height : undefined,
          cropping: enableCropping && mediaType === 'photo',
          compressImageQuality,
          mediaType: mediaType === 'mixed' ? 'any' : mediaType,
          includeBase64: options.includeBase64 || false,
          enableRotationGesture: true,
          freeStyleCropEnabled: true,
        });

        return this.formatMediaFile(result, this.getMediaType(result.mime));
      }
    } catch (error) {
      if (error.toString().includes('cancelled')) {
        console.log('User cancelled gallery selection');
        return null;
      }
      console.error('Gallery selection error:', error);
      throw error;
    }
  }

  /**
   * Show action sheet with camera and gallery options
   */
  async showImagePicker(options: CameraOptions = {}): Promise<MediaFile | MediaFile[] | null> {
    return new Promise((resolve) => {
      Alert.alert(
        'Select Image',
        'Choose an option',
        [
          { text: 'Camera', onPress: async () => {
            const result = await this.takePhoto(options);
            resolve(result);
          }},
          { text: 'Gallery', onPress: async () => {
            const result = await this.selectFromGallery(options);
            resolve(result);
          }},
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        ]
      );
    });
  }

  /**
   * Show action sheet with camera, video, and gallery options
   */
  async showMediaPicker(options: CameraOptions = {}): Promise<MediaFile | MediaFile[] | null> {
    return new Promise((resolve) => {
      Alert.alert(
        'Select Media',
        'Choose an option',
        [
          { text: 'Take Photo', onPress: async () => {
            const result = await this.takePhoto(options);
            resolve(result);
          }},
          { text: 'Record Video', onPress: async () => {
            const result = await this.recordVideo(options);
            resolve(result);
          }},
          { text: 'From Gallery', onPress: async () => {
            const result = await this.selectFromGallery({ ...options, mediaType: 'mixed' });
            resolve(result);
          }},
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        ]
      );
    });
  }

  /**
   * Crop an existing image
   */
  async cropImage(imagePath: string, options: CameraOptions = {}): Promise<MediaFile | null> {
    try {
      const {
        quality = 'high',
        compressImageQuality = 0.8,
        cropAspectRatio,
      } = options;

      const result = await ImagePicker.openCropper({
        path: imagePath,
        width: this.getImageDimensions(quality).width,
        height: this.getImageDimensions(quality).height,
        compressImageQuality,
        enableRotationGesture: true,
        freeStyleCropEnabled: !cropAspectRatio,
        ...(cropAspectRatio && { 
          cropperToolbarTitle: 'Crop Image',
          aspectRatio: [cropAspectRatio.width, cropAspectRatio.height],
        }),
      });

      return this.formatMediaFile(result, 'photo');
    } catch (error) {
      if (error.toString().includes('cancelled')) {
        console.log('User cancelled image cropping');
        return null;
      }
      console.error('Image cropping error:', error);
      throw error;
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanupTempFiles(): Promise<void> {
    try {
      await ImagePicker.clean();
      console.log('Temporary files cleaned up');
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  /**
   * Get image dimensions based on quality
   */
  private getImageDimensions(quality: string) {
    switch (quality) {
      case 'low': return { width: 640, height: 640 };
      case 'medium': return { width: 1080, height: 1080 };
      case 'high': return { width: 1920, height: 1920 };
      default: return { width: 1080, height: 1080 };
    }
  }

  /**
   * Determine media type from MIME type
   */
  private getMediaType(mimeType: string): 'photo' | 'video' {
    return mimeType.startsWith('video/') ? 'video' : 'photo';
  }

  /**
   * Format media file object
   */
  private formatMediaFile(result: any, mediaType: 'photo' | 'video'): MediaFile {
    const timestamp = Date.now();
    const extension = mediaType === 'video' ? 'mp4' : 'jpg';
    
    return {
      uri: result.path,
      type: result.mime,
      width: result.width,
      height: result.height,
      size: result.size,
      duration: result.duration,
      fileName: `${mediaType}_${timestamp}.${extension}`,
      mediaType,
      timestamp,
    };
  }

  /**
   * Validate file size
   */
  validateFileSize(file: MediaFile, maxSizeMB: number = 50): boolean {
    if (!file.size) return true;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  }

  /**
   * Get file size in human readable format
   */
  getFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default CameraManager;
