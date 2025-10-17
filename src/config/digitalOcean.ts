import { S3 } from 'aws-sdk';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';
import uuid from 'react-native-uuid';
import Config from 'react-native-config';
import { Buffer } from 'buffer';

// Digital Ocean Spaces configuration
const spacesConfig = {
  endpoint: Config.DO_SPACES_ENDPOINT || 'https://blr1.digitaloceanspaces.com',
  accessKeyId: Config.DO_SPACES_KEY || 'DO801XPFLWMJLWB62XBX',
  secretAccessKey: Config.DO_SPACES_SECRET || 'abGOCo+yDJkU4pzWxArmxAPZjo84IGg6d4k3c9rM2WQ',
  region: Config.DO_SPACES_REGION || 'blr1',
  s3ForcePathStyle: false,
  signatureVersion: 'v4',
};

const BUCKET_NAME = Config.DO_SPACES_BUCKET || 'jorvea';
const CDN_URL = Config.DO_SPACES_CDN_URL || 'https://jorvea.blr1.cdn.digitaloceanspaces.com';

// Initialize S3 client for Digital Ocean Spaces
const s3Client = new S3(spacesConfig);

export interface UploadOptions {
  folder?: string;
  filename?: string;
  contentType?: string;
  isPublic?: boolean;
  quality?: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  url: string;
  key: string;
  cdnUrl: string;
  size: number;
}

class DigitalOceanSpaces {
  
  /**
   * Upload a file to Digital Ocean Spaces
   */
  async uploadFile(
    fileUri: string, 
    options: UploadOptions = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      const { 
        folder = 'general', 
        filename, 
        contentType = 'application/octet-stream',
        isPublic = true 
      } = options;

      // Generate unique filename if not provided
      const fileExtension = fileUri.split('.').pop() || '';
      const uniqueFilename = filename || `${uuid.v4()}.${fileExtension}`;
      const key = `${folder}/${uniqueFilename}`;

      // Read file data
      const fileData = await RNFS.readFile(fileUri, 'base64');
      const buffer = Buffer.from(fileData, 'base64');

      // Get file stats
      const fileStat = await RNFS.stat(fileUri);
      const fileSize = fileStat.size;

      // Upload parameters
      const uploadParams = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: isPublic ? 'public-read' : 'private',
        CacheControl: 'max-age=31536000', // 1 year cache
      };

      // Create upload request
      const upload = s3Client.upload(uploadParams);

      // Track progress if callback provided
      if (onProgress) {
        upload.on('httpUploadProgress', (progress) => {
          const percentage = Math.round((progress.loaded / progress.total) * 100);
          onProgress({
            loaded: progress.loaded,
            total: progress.total,
            percentage,
          });
        });
      }

      // Execute upload
      const result = await upload.promise();

      return {
        url: result.Location,
        key: result.Key,
        cdnUrl: `${CDN_URL}/${result.Key}`,
        size: fileSize,
      };

    } catch (error: any) {
      console.error('Error uploading file to Digital Ocean Spaces:', error);
      throw new Error(`Upload failed: ${error?.message || 'Unknown error'}`);
    }
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(
    fileUris: string[],
    options: UploadOptions = {},
    onProgress?: (fileIndex: number, progress: UploadProgress) => void
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (let i = 0; i < fileUris.length; i++) {
      const fileUri = fileUris[i];
      const result = await this.uploadFile(
        fileUri,
        options,
        onProgress ? (progress) => onProgress(i, progress) : undefined
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Upload image with compression
   */
  async uploadImage(
    imageUri: string,
    options: UploadOptions & { 
      maxWidth?: number; 
      maxHeight?: number; 
      quality?: number 
    } = {}
  ): Promise<UploadResult> {
    const { 
      maxWidth = 1080, 
      maxHeight = 1080, 
      quality = 0.8,
      folder = 'images',
      ...uploadOptions 
    } = options;

    try {
      // TODO: Add image compression here using react-native-image-resizer
      // For now, upload as is
      return await this.uploadFile(imageUri, {
        ...uploadOptions,
        folder,
        contentType: 'image/jpeg',
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  }

  /**
   * Upload video with compression
   */
  async uploadVideo(
    videoUri: string,
    options: UploadOptions & { 
      quality?: 'low' | 'medium' | 'high';
      maxDuration?: number;
    } = {},
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const { 
      quality = 'medium',
      folder = 'videos',
      ...uploadOptions 
    } = options;

    try {
      // TODO: Add video compression here
      // For now, upload as is
      return await this.uploadFile(videoUri, {
        ...uploadOptions,
        folder,
        contentType: 'video/mp4',
      }, onProgress);
    } catch (error) {
      console.error('Error uploading video:', error);
      throw error;
    }
  }

  /**
   * Upload audio file
   */
  async uploadAudio(
    audioUri: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const { folder = 'audio', ...uploadOptions } = options;

    return await this.uploadFile(audioUri, {
      ...uploadOptions,
      folder,
      contentType: 'audio/mpeg',
    });
  }

  /**
   * Delete file from Spaces
   */
  async deleteFile(key: string): Promise<void> {
    try {
      console.log('🗑️ Deleting file from DigitalOcean Spaces:', key);
      
      await s3Client.deleteObject({
        Bucket: BUCKET_NAME,
        Key: key,
      }).promise();
      
      console.log('✅ File deleted successfully from DigitalOcean Spaces');
    } catch (error) {
      console.error('❌ Error deleting file from Digital Ocean Spaces:', error);
      throw error;
    }
  }

  /**
   * Delete multiple files from Spaces
   */
  async deleteFiles(keys: string[]): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    try {
      console.log(`🗑️ Deleting ${keys.length} files from DigitalOcean Spaces...`);
      
      // Delete files in batches of 10 (to avoid API limits)
      const batches = [];
      for (let i = 0; i < keys.length; i += 10) {
        batches.push(keys.slice(i, i + 10));
      }

      for (const batch of batches) {
        const deleteParams = {
          Bucket: BUCKET_NAME,
          Delete: {
            Objects: batch.map(key => ({ Key: key })),
            Quiet: false,
          },
        };

        try {
          const result = await s3Client.deleteObjects(deleteParams).promise();
          
          // Track successful deletions
          if (result.Deleted) {
            result.Deleted.forEach(deleted => {
              if (deleted.Key) {
                success.push(deleted.Key);
              }
            });
          }

          // Track failed deletions
          if (result.Errors) {
            result.Errors.forEach(error => {
              if (error.Key) {
                failed.push(error.Key);
                console.error(`Failed to delete ${error.Key}:`, error.Message);
              }
            });
          }
        } catch (batchError) {
          console.error('Error in batch deletion:', batchError);
          failed.push(...batch);
        }
      }

      console.log(`✅ Deletion complete: ${success.length} success, ${failed.length} failed`);
      return { success, failed };
    } catch (error) {
      console.error('❌ Error in bulk file deletion:', error);
      return { success, failed: keys };
    }
  }

  /**
   * Check if file exists in Spaces
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      await s3Client.headObject({
        Bucket: BUCKET_NAME,
        Key: key,
      }).promise();
      return true;
    } catch (error: any) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string) {
    try {
      const result = await s3Client.headObject({
        Bucket: BUCKET_NAME,
        Key: key,
      }).promise();

      return {
        contentType: result.ContentType,
        contentLength: result.ContentLength,
        lastModified: result.LastModified,
        etag: result.ETag,
        metadata: result.Metadata,
      };
    } catch (error) {
      console.error('Error getting file metadata:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const digitalOceanSpaces = new DigitalOceanSpaces();

// Helper functions
export const getMediaType = (uri: string): 'image' | 'video' | 'audio' | 'other' => {
  const extension = uri.split('.').pop()?.toLowerCase() || '';
  
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension)) {
    return 'image';
  }
  
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'].includes(extension)) {
    return 'video';
  }
  
  if (['mp3', 'wav', 'aac', 'ogg', 'm4a'].includes(extension)) {
    return 'audio';
  }
  
  return 'other';
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default digitalOceanSpaces;
