import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import ImagePicker from 'react-native-image-crop-picker';
import { Platform, Alert, PermissionsAndroid } from 'react-native';
import RNFS from 'react-native-fs';
import { digitalOceanSpaces, UploadResult } from '../config/digitalOcean';
import { FirebaseService } from './firebaseService';

export interface ImageUploadOptions {
  storage: 'digitalocean' | 'base64';
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  allowMultiple?: boolean;
  cropping?: boolean;
  folder?: string;
}

export interface UploadedImage {
  uri: string;
  url?: string;
  base64?: string;
  width?: number;
  height?: number;
  size?: number;
  fileName?: string;
  type?: string;
}

export interface ImagePickerOptions {
  title?: string;
  cancelButtonTitle?: string;
  takePhotoButtonTitle?: string;
  chooseFromLibraryButtonTitle?: string;
  allowsEditing?: boolean;
  mediaType?: MediaType;
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  includeBase64?: boolean;
}

class ImageUploadService {
  
  /**
   * Request camera permissions for Android
   */
  private async requestCameraPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'App needs camera permission to take photos',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  }

  /**
   * Show image picker options
   */
  private showImagePicker(options: ImagePickerOptions = {}): Promise<ImagePickerResponse> {
    return new Promise((resolve, reject) => {
      const pickerOptions = {
        title: options.title || 'Select Image',
        cancelButtonTitle: options.cancelButtonTitle || 'Cancel',
        takePhotoButtonTitle: options.takePhotoButtonTitle || 'Take Photo',
        chooseFromLibraryButtonTitle: options.chooseFromLibraryButtonTitle || 'Choose from Library',
        allowsEditing: options.allowsEditing || false,
        mediaType: options.mediaType || 'photo' as MediaType,
        quality: (options.quality || 0.8) as any,
        maxWidth: options.maxWidth || 1080,
        maxHeight: options.maxHeight || 1080,
        includeBase64: options.includeBase64 || false,
        storageOptions: {
          skipBackup: true,
          path: 'images',
        },
      };

      Alert.alert(
        pickerOptions.title,
        'Please choose an option',
        [
          {
            text: pickerOptions.cancelButtonTitle,
            style: 'cancel',
            onPress: () => reject(new Error('User cancelled')),
          },
          {
            text: pickerOptions.takePhotoButtonTitle,
            onPress: async () => {
              const hasPermission = await this.requestCameraPermission();
              if (!hasPermission) {
                reject(new Error('Camera permission denied'));
                return;
              }
              
              launchCamera(pickerOptions, (response) => {
                if (response.didCancel || response.errorMessage) {
                  reject(new Error(response.errorMessage || 'User cancelled'));
                } else {
                  resolve(response);
                }
              });
            },
          },
          {
            text: pickerOptions.chooseFromLibraryButtonTitle,
            onPress: () => {
              launchImageLibrary(pickerOptions, (response) => {
                if (response.didCancel || response.errorMessage) {
                  reject(new Error(response.errorMessage || 'User cancelled'));
                } else {
                  resolve(response);
                }
              });
            },
          },
        ]
      );
    });
  }

  /**
   * Pick and crop image using react-native-image-crop-picker
   */
  private async pickAndCropImage(options: ImageUploadOptions): Promise<any> {
    try {
      const image = await ImagePicker.openPicker({
        width: options.maxWidth || 400,
        height: options.maxHeight || 400,
        cropping: options.cropping !== false,
        cropperCircleOverlay: true,
        compressImageMaxWidth: options.maxWidth || 400,
        compressImageMaxHeight: options.maxHeight || 400,
        compressImageQuality: options.quality || 0.8,
        includeBase64: options.storage === 'base64',
        mediaType: 'photo',
        multiple: options.allowMultiple || false,
      });

      return image;
    } catch (error: any) {
      if (error.code === 'E_PICKER_CANCELLED') {
        throw new Error('User cancelled image selection');
      }
      throw error;
    }
  }

  /**
   * Take photo using camera with cropping
   */
  private async takePhotoWithCrop(options: ImageUploadOptions): Promise<any> {
    try {
      const hasPermission = await this.requestCameraPermission();
      if (!hasPermission) {
        throw new Error('Camera permission denied');
      }

      const image = await ImagePicker.openCamera({
        width: options.maxWidth || 400,
        height: options.maxHeight || 400,
        cropping: options.cropping !== false,
        cropperCircleOverlay: true,
        compressImageMaxWidth: options.maxWidth || 400,
        compressImageMaxHeight: options.maxHeight || 400,
        compressImageQuality: options.quality || 0.8,
        includeBase64: options.storage === 'base64',
        mediaType: 'photo',
      });

      return image;
    } catch (error: any) {
      if (error.code === 'E_PICKER_CANCELLED') {
        throw new Error('User cancelled photo capture');
      }
      throw error;
    }
  }

  /**
   * Convert image to base64
   */
  private async imageToBase64(imageUri: string): Promise<string> {
    try {
      const base64 = await RNFS.readFile(imageUri, 'base64');
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw new Error('Failed to convert image to base64');
    }
  }

  /**
   * Upload image to DigitalOcean Spaces
   */
  private async uploadToDigitalOcean(
    imageUri: string, 
    options: ImageUploadOptions
  ): Promise<UploadResult> {
    try {
      return await digitalOceanSpaces.uploadImage(imageUri, {
        folder: options.folder || 'profile-pictures',
        quality: options.quality || 0.8,
        maxWidth: options.maxWidth || 400,
        maxHeight: options.maxHeight || 400,
      });
    } catch (error) {
      console.error('Error uploading to DigitalOcean:', error);
      throw new Error('Failed to upload image to DigitalOcean');
    }
  }

  /**
   * Show image selection dialog
   */
  private showImageSourceDialog(): Promise<'camera' | 'library'> {
    return new Promise((resolve, reject) => {
      Alert.alert(
        'Select Image Source',
        'Choose where to get your profile picture',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => reject(new Error('User cancelled')),
          },
          {
            text: 'Camera',
            onPress: () => resolve('camera'),
          },
          {
            text: 'Photo Library',
            onPress: () => resolve('library'),
          },
        ]
      );
    });
  }

  /**
   * Main method to upload profile picture
   */
  async uploadProfilePicture(
    userId: string,
    options: ImageUploadOptions = { storage: 'digitalocean' }
  ): Promise<UploadedImage> {
    try {
      // Show source selection dialog
      const source = await this.showImageSourceDialog();
      
      // Pick/take image based on source
      let image: any;
      if (source === 'camera') {
        image = await this.takePhotoWithCrop(options);
      } else {
        image = await this.pickAndCropImage(options);
      }

      // Handle multiple images if allowed
      const selectedImage = Array.isArray(image) ? image[0] : image;
      
      const result: UploadedImage = {
        uri: selectedImage.path,
        width: selectedImage.width,
        height: selectedImage.height,
        size: selectedImage.size,
        fileName: selectedImage.filename || 'profile-picture.jpg',
        type: selectedImage.mime,
      };

      if (options.storage === 'base64') {
        // Store as base64 in Firestore
        const base64 = selectedImage.data || await this.imageToBase64(selectedImage.path);
        result.base64 = base64;
        
        // Update user profile with base64 image
        await FirebaseService.updateUserProfile(userId, {
          profilePicture: base64,
          profilePictureType: 'base64',
        });
        
      } else {
        // Try to upload to DigitalOcean first, fallback to base64 if it fails
        try {
          console.log('Attempting to upload to DigitalOcean...');
          const uploadResult = await this.uploadToDigitalOcean(selectedImage.path, options);
          result.url = uploadResult.cdnUrl;
          
          // Update user profile with DigitalOcean URL
          await FirebaseService.updateUserProfile(userId, {
            profilePicture: uploadResult.cdnUrl,
            profilePictureType: 'url',
            profilePictureKey: uploadResult.key,
          });
          
          console.log('Successfully uploaded to DigitalOcean');
        } catch (digitalOceanError) {
          console.warn('DigitalOcean upload failed, falling back to base64:', digitalOceanError);
          
          // Fallback to base64 storage
          const base64 = selectedImage.data || await this.imageToBase64(selectedImage.path);
          result.base64 = base64;
          
          // Update user profile with base64 image
          await FirebaseService.updateUserProfile(userId, {
            profilePicture: base64,
            profilePictureType: 'base64',
          });
          
          console.log('Successfully stored as base64 fallback');
        }
      }

      return result;

    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      throw new Error(error.message || 'Failed to upload profile picture');
    }
  }

  /**
   * Upload multiple images
   */
  async uploadMultipleImages(
    options: ImageUploadOptions & { allowMultiple: true }
  ): Promise<UploadedImage[]> {
    try {
      const images = await this.pickAndCropImage(options);
      const imageArray = Array.isArray(images) ? images : [images];
      const results: UploadedImage[] = [];

      for (const image of imageArray) {
        const result: UploadedImage = {
          uri: image.path,
          width: image.width,
          height: image.height,
          size: image.size,
          fileName: image.filename || 'image.jpg',
          type: image.mime,
        };

        if (options.storage === 'base64') {
          const base64 = image.data || await this.imageToBase64(image.path);
          result.base64 = base64;
        } else {
          const uploadResult = await this.uploadToDigitalOcean(image.path, options);
          result.url = uploadResult.cdnUrl;
        }

        results.push(result);
      }

      return results;

    } catch (error: any) {
      console.error('Error uploading multiple images:', error);
      throw new Error(error.message || 'Failed to upload images');
    }
  }

  /**
   * Delete profile picture from storage
   */
  async deleteProfilePicture(userId: string, pictureKey?: string): Promise<void> {
    try {
      // Delete from DigitalOcean if key is provided
      if (pictureKey) {
        await digitalOceanSpaces.deleteFile(pictureKey);
      }

      // Remove from user profile
      await FirebaseService.updateUserProfile(userId, {
        profilePicture: undefined,
        profilePictureType: undefined,
        profilePictureKey: undefined,
      });

    } catch (error) {
      console.error('Error deleting profile picture:', error);
      throw new Error('Failed to delete profile picture');
    }
  }

  /**
   * Get optimized image URL
   */
  getOptimizedImageUrl(imageUrl: string, width?: number, height?: number): string {
    if (!imageUrl) return '';
    
    // If it's a base64 image, return as is
    if (imageUrl.startsWith('data:image')) {
      return imageUrl;
    }

    // If it's a DigitalOcean CDN URL, we can add query parameters for optimization
    if (imageUrl.includes('digitaloceanspaces.com')) {
      const params = new URLSearchParams();
      if (width) params.append('w', width.toString());
      if (height) params.append('h', height.toString());
      params.append('f', 'auto');
      params.append('q', '80');
      
      const queryString = params.toString();
      return queryString ? `${imageUrl}?${queryString}` : imageUrl;
    }

    return imageUrl;
  }
}

export const imageUploadService = new ImageUploadService();
export default imageUploadService;
