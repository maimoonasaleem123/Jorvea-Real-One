import { Platform } from 'react-native';
import DocumentPicker, { DocumentPickerResponse } from '@react-native-documents/picker';
import { launchImageLibrary, launchCamera, ImagePickerResponse } from 'react-native-image-picker';
import Config from 'react-native-config';
import AWS from 'aws-sdk';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';

// Test Buffer availability in DigitalOceanService
console.log('✅ DigitalOceanService: Buffer is available:', typeof Buffer !== 'undefined');

// Digital Ocean Spaces configuration
const DO_SPACES_CONFIG = {
  endpoint: Config.DO_SPACES_ENDPOINT || 'https://blr1.digitaloceanspaces.com',
  bucket: Config.DO_SPACES_BUCKET || 'jorvea',
  accessKeyId: Config.DO_SPACES_KEY || 'DO801XPFLWMJLWB62XBX',
  secretAccessKey: Config.DO_SPACES_SECRET || 'abGOCo+yDJkU4pzWxArmxAPZjo84IGg6d4k3c9rM2WQ',
  region: Config.DO_SPACES_REGION || 'blr1',
  cdnUrl: Config.DO_SPACES_CDN_URL || 'https://jorvea.blr1.cdn.digitaloceanspaces.com',
};

export interface MediaUploadOptions {
  folder?: string;
  quality?: 'low' | 'medium' | 'high';
  maxWidth?: number;
  maxHeight?: number;
}

export interface UploadedMedia {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  duration?: number;
}

export class DigitalOceanService {
  private static generateFileName(extension: string, folder?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const fileName = `${timestamp}_${random}.${extension}`;
    return folder ? `${folder}/${fileName}` : fileName;
  }

  private static async uploadToSpaces(
    fileUri: string,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    try {
      console.log('Uploading to Digital Ocean Spaces:', fileName);
      
      // Configure AWS SDK for Digital Ocean Spaces
      const spacesEndpoint = new AWS.Endpoint(DO_SPACES_CONFIG.endpoint);
      const s3 = new AWS.S3({
        endpoint: spacesEndpoint,
        accessKeyId: DO_SPACES_CONFIG.accessKeyId,
        secretAccessKey: DO_SPACES_CONFIG.secretAccessKey,
        region: DO_SPACES_CONFIG.region,
        s3ForcePathStyle: false, // Configures to use subdomain/virtual calling format.
        signatureVersion: 'v4'
      });

      // Read file data
      const fileData = await RNFS.readFile(fileUri, 'base64');
      const buffer = Buffer.from(fileData, 'base64');

      // Upload parameters
      const uploadParams = {
        Bucket: DO_SPACES_CONFIG.bucket,
        Key: fileName,
        Body: buffer,
        ContentType: mimeType,
        ACL: 'public-read'
      };

      // Upload to Digital Ocean Spaces
      const data = await s3.upload(uploadParams).promise();
      const publicUrl = `${DO_SPACES_CONFIG.cdnUrl}/${fileName}`;
      
      console.log('✅ Upload completed:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading to Digital Ocean Spaces:', error);
      throw error;
    }
  }

  static async pickImageFromGallery(options: MediaUploadOptions = {}): Promise<UploadedMedia | null> {
    return new Promise((resolve) => {
      launchImageLibrary(
        {
          mediaType: 'photo',
          quality: (options.quality || 'high') as any,
          maxWidth: options.maxWidth || 1920,
          maxHeight: options.maxHeight || 1920,
          includeBase64: false,
        },
        async (response: ImagePickerResponse) => {
          if (response.didCancel || response.errorMessage || !response.assets?.[0]) {
            resolve(null);
            return;
          }

          try {
            const asset = response.assets[0];
            const extension = asset.fileName?.split('.').pop() || 'jpg';
            const fileName = this.generateFileName(extension, options.folder || 'images');
            
            const uploadedUrl = await this.uploadToSpaces(
              asset.uri!,
              fileName,
              asset.type || 'image/jpeg'
            );

            resolve({
              url: uploadedUrl,
              fileName,
              fileSize: asset.fileSize || 0,
              mimeType: asset.type || 'image/jpeg',
              width: asset.width,
              height: asset.height,
            });
          } catch (error) {
            console.error('Error uploading image:', error);
            resolve(null);
          }
        }
      );
    });
  }

  static async pickVideoFromGallery(options: MediaUploadOptions = {}): Promise<UploadedMedia | null> {
    return new Promise((resolve) => {
      launchImageLibrary(
        {
          mediaType: 'video',
          quality: (options.quality || 'high') as any,
          includeBase64: false,
        },
        async (response: ImagePickerResponse) => {
          if (response.didCancel || response.errorMessage || !response.assets?.[0]) {
            resolve(null);
            return;
          }

          try {
            const asset = response.assets[0];
            const extension = asset.fileName?.split('.').pop() || 'mp4';
            const fileName = this.generateFileName(extension, options.folder || 'videos');
            
            const uploadedUrl = await this.uploadToSpaces(
              asset.uri!,
              fileName,
              asset.type || 'video/mp4'
            );

            resolve({
              url: uploadedUrl,
              fileName,
              fileSize: asset.fileSize || 0,
              mimeType: asset.type || 'video/mp4',
              width: asset.width,
              height: asset.height,
              duration: asset.duration,
            });
          } catch (error) {
            console.error('Error uploading video:', error);
            resolve(null);
          }
        }
      );
    });
  }

  static async takePhoto(options: MediaUploadOptions = {}): Promise<UploadedMedia | null> {
    return new Promise((resolve) => {
      launchCamera(
        {
          mediaType: 'photo',
          quality: (options.quality || 'high') as any,
          maxWidth: options.maxWidth || 1920,
          maxHeight: options.maxHeight || 1920,
          includeBase64: false,
        },
        async (response: ImagePickerResponse) => {
          if (response.didCancel || response.errorMessage || !response.assets?.[0]) {
            resolve(null);
            return;
          }

          try {
            const asset = response.assets[0];
            const extension = asset.fileName?.split('.').pop() || 'jpg';
            const fileName = this.generateFileName(extension, options.folder || 'images');
            
            const uploadedUrl = await this.uploadToSpaces(
              asset.uri!,
              fileName,
              asset.type || 'image/jpeg'
            );

            resolve({
              url: uploadedUrl,
              fileName,
              fileSize: asset.fileSize || 0,
              mimeType: asset.type || 'image/jpeg',
              width: asset.width,
              height: asset.height,
            });
          } catch (error) {
            console.error('Error uploading photo:', error);
            resolve(null);
          }
        }
      );
    });
  }

  static async recordVideo(options: MediaUploadOptions = {}): Promise<UploadedMedia | null> {
    return new Promise((resolve) => {
      launchCamera(
        {
          mediaType: 'video',
          quality: (options.quality || 'high') as any,
          includeBase64: false,
          videoQuality: 'medium',
          durationLimit: 60, // 60 seconds limit for reels
        },
        async (response: ImagePickerResponse) => {
          if (response.didCancel || response.errorMessage || !response.assets?.[0]) {
            resolve(null);
            return;
          }

          try {
            const asset = response.assets[0];
            const extension = asset.fileName?.split('.').pop() || 'mp4';
            const fileName = this.generateFileName(extension, options.folder || 'videos');
            
            const uploadedUrl = await this.uploadToSpaces(
              asset.uri!,
              fileName,
              asset.type || 'video/mp4'
            );

            resolve({
              url: uploadedUrl,
              fileName,
              fileSize: asset.fileSize || 0,
              mimeType: asset.type || 'video/mp4',
              width: asset.width,
              height: asset.height,
              duration: asset.duration,
            });
          } catch (error) {
            console.error('Error uploading video:', error);
            resolve(null);
          }
        }
      );
    });
  }

  static async pickDocument(): Promise<UploadedMedia | null> {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
        copyTo: 'documentDirectory',
      });

      if (result && result.length > 0) {
        const document = result[0];
        const extension = document.name?.split('.').pop() || 'file';
        const fileName = this.generateFileName(extension, 'documents');
        
        const uploadedUrl = await this.uploadToSpaces(
          document.uri,
          fileName,
          document.type || 'application/octet-stream'
        );

        return {
          url: uploadedUrl,
          fileName,
          fileSize: document.size || 0,
          mimeType: document.type || 'application/octet-stream',
        };
      }

      return null;
    } catch (error) {
      if (error && (error as any).code === 'DOCUMENT_PICKER_CANCELED') {
        return null;
      }
      console.error('Error picking document:', error);
      throw error;
    }
  }

  static async uploadProfilePicture(imageUri: string): Promise<UploadedMedia | null> {
    try {
      const fileName = this.generateFileName('jpg', 'profile-pictures');
      
      const uploadedUrl = await this.uploadToSpaces(
        imageUri,
        fileName,
        'image/jpeg'
      );

      return {
        url: uploadedUrl,
        fileName,
        fileSize: 0, // We don't have size info for custom URIs
        mimeType: 'image/jpeg',
      };
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      throw error;
    }
  }

  static async deleteFile(fileName: string): Promise<boolean> {
    try {
      // Implementation for deleting files from Digital Ocean Spaces
      // This would require using the S3-compatible API
      console.log('Deleting file from Digital Ocean Spaces:', fileName);
      
      // Mock implementation - replace with actual deletion logic
      await new Promise<void>(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  static async uploadMedia(fileUri: string, fileName: string, mimeType?: string): Promise<string> {
    try {
      const uploadedUrl = await this.uploadToSpaces(
        fileUri,
        fileName,
        mimeType || 'application/octet-stream'
      );
      return uploadedUrl;
    } catch (error) {
      console.error('Error uploading media:', error);
      throw error;
    }
  }

  static getImageUrl(fileName: string): string {
    return `${DO_SPACES_CONFIG.endpoint}/${DO_SPACES_CONFIG.bucket}/${fileName}`;
  }

  static getThumbnailUrl(fileName: string, width: number = 300, height: number = 300): string {
    // For Digital Ocean Spaces, you might want to implement image resizing
    // This is a basic implementation that returns the original image
    // You could integrate with a service like ImageKit or Cloudinary for dynamic resizing
    return this.getImageUrl(fileName);
  }

  static validateFileSize(fileSize: number, maxSizeMB: number = 50): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return fileSize <= maxSizeBytes;
  }

  static validateFileType(mimeType: string, allowedTypes: string[]): boolean {
    return allowedTypes.includes(mimeType);
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default DigitalOceanService;
