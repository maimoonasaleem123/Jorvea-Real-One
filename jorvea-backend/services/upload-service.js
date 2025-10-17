/**
 * DigitalOcean Spaces Upload Service
 * 
 * Uploads HLS files to DigitalOcean Spaces (S3-compatible storage)
 */

const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');

class UploadService {
  /**
   * Initialize S3 client for DigitalOcean Spaces
   */
  static getS3Client() {
    const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT);
    
    return new AWS.S3({
      endpoint: spacesEndpoint,
      accessKeyId: process.env.DO_SPACES_ACCESS_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET_KEY,
      region: process.env.DO_SPACES_REGION,
    });
  }

  /**
   * Upload all HLS files (segments, playlists, thumbnail) to DigitalOcean
   */
  static async uploadHLSFiles(localDir, videoId, onProgress) {
    try {
      const s3 = this.getS3Client();
      const bucket = process.env.DO_SPACES_BUCKET;
      const hlsFolder = `reels/hls/${videoId}`;

      // Read all files in the directory
      const files = await fs.readdir(localDir);
      const totalFiles = files.length;
      let uploadedCount = 0;

      console.log(`📤 Uploading ${totalFiles} files to DigitalOcean...`);

      // Upload each file
      for (const fileName of files) {
        const filePath = path.join(localDir, fileName);
        const fileContent = await fs.readFile(filePath);
        const key = `${hlsFolder}/${fileName}`;

        // Determine content type
        const contentType = this.getContentType(fileName);

        // Upload to DigitalOcean
        await s3.upload({
          Bucket: bucket,
          Key: key,
          Body: fileContent,
          ACL: 'public-read',
          ContentType: contentType,
          CacheControl: contentType.includes('m3u8') 
            ? 'public, max-age=0' // Playlists should not be cached
            : 'public, max-age=31536000', // Media files can be cached for 1 year
        }).promise();

        uploadedCount++;
        const progress = (uploadedCount / totalFiles) * 100;
        onProgress?.(progress);
        
        console.log(`✅ Uploaded: ${fileName} (${uploadedCount}/${totalFiles})`);
      }

      // Return the master playlist URL
      const hlsUrl = `${process.env.DO_SPACES_CDN_URL}/${hlsFolder}/master.m3u8`;
      console.log(`🔗 HLS URL: ${hlsUrl}`);
      
      return hlsUrl;

    } catch (error) {
      console.error('❌ DigitalOcean upload error:', error);
      throw error;
    }
  }

  /**
   * Upload a single file to DigitalOcean
   */
  static async uploadFile(localPath, remoteKey, contentType) {
    try {
      const s3 = this.getS3Client();
      const bucket = process.env.DO_SPACES_BUCKET;
      const fileContent = await fs.readFile(localPath);

      await s3.upload({
        Bucket: bucket,
        Key: remoteKey,
        Body: fileContent,
        ACL: 'public-read',
        ContentType: contentType || 'application/octet-stream',
      }).promise();

      const fileUrl = `${process.env.DO_SPACES_CDN_URL}/${remoteKey}`;
      return fileUrl;

    } catch (error) {
      console.error('❌ Single file upload error:', error);
      throw error;
    }
  }

  /**
   * Delete files from DigitalOcean (cleanup)
   */
  static async deleteFolder(folderKey) {
    try {
      const s3 = this.getS3Client();
      const bucket = process.env.DO_SPACES_BUCKET;

      // List all objects in the folder
      const listParams = {
        Bucket: bucket,
        Prefix: folderKey,
      };

      const listedObjects = await s3.listObjectsV2(listParams).promise();

      if (listedObjects.Contents.length === 0) {
        return;
      }

      // Delete all objects
      const deleteParams = {
        Bucket: bucket,
        Delete: {
          Objects: listedObjects.Contents.map(({ Key }) => ({ Key })),
        },
      };

      await s3.deleteObjects(deleteParams).promise();
      console.log(`🗑️  Deleted ${listedObjects.Contents.length} files from ${folderKey}`);

    } catch (error) {
      console.error('❌ Delete error:', error);
      throw error;
    }
  }

  /**
   * Get appropriate content type for file
   */
  static getContentType(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    
    const contentTypes = {
      '.m3u8': 'application/vnd.apple.mpegurl',
      '.ts': 'video/MP2T',
      '.mp4': 'video/mp4',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Test DigitalOcean connection
   */
  static async testConnection() {
    try {
      const s3 = this.getS3Client();
      const bucket = process.env.DO_SPACES_BUCKET;

      await s3.headBucket({ Bucket: bucket }).promise();
      console.log('✅ DigitalOcean Spaces connection successful!');
      return true;

    } catch (error) {
      console.error('❌ DigitalOcean Spaces connection failed:', error.message);
      return false;
    }
  }
}

module.exports = UploadService;
