/**
 * Advanced Background Upload Engine
 * Handles segmented video upload with memory optimization
 * Zero memory pressure, super fast processing
 */

import RNFS from 'react-native-fs';
import { firebaseStorage, firebaseFirestore, COLLECTIONS } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UploadSegment {
  id: string;
  reelId: string;
  segmentIndex: number;
  segmentPath: string;
  segmentSize: number;
  uploadUrl?: string;
  uploadProgress: number;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  retryCount: number;
}

interface BackgroundUpload {
  id: string;
  originalVideoPath: string;
  thumbnailPath: string;
  reelData: any;
  segments: UploadSegment[];
  totalSegments: number;
  overallProgress: number;
  status: 'processing' | 'uploading' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
}

class AdvancedBackgroundUploadEngine {
  private static instance: AdvancedBackgroundUploadEngine;
  private uploadQueue: Map<string, BackgroundUpload> = new Map();
  private isProcessing: boolean = false;
  private maxConcurrentUploads: number = 2;
  private segmentSizeKB: number = 512; // 512KB segments for memory safety
  private maxRetries: number = 3;

  static getInstance(): AdvancedBackgroundUploadEngine {
    if (!AdvancedBackgroundUploadEngine.instance) {
      AdvancedBackgroundUploadEngine.instance = new AdvancedBackgroundUploadEngine();
    }
    return AdvancedBackgroundUploadEngine.instance;
  }

  /**
   * Add video to background upload queue
   */
  async addToUploadQueue(
    videoPath: string, 
    thumbnailPath: string, 
    reelData: any,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      console.log('🚀 Adding video to background upload queue...');
      
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create background upload entry
      const backgroundUpload: BackgroundUpload = {
        id: uploadId,
        originalVideoPath: videoPath,
        thumbnailPath: thumbnailPath,
        reelData: {
          ...reelData,
          uploadId: uploadId,
          status: 'processing'
        },
        segments: [],
        totalSegments: 0,
        overallProgress: 0,
        status: 'processing',
        createdAt: new Date().toISOString()
      };

      this.uploadQueue.set(uploadId, backgroundUpload);
      
      // Save to persistent storage
      await this.saveUploadQueue();
      
      // Start processing immediately
      this.processUploadQueue();
      
      // Create preliminary reel entry in Firestore with processing status
      await this.createPreliminaryReelEntry(uploadId, reelData);
      
      console.log(`✅ Added to upload queue: ${uploadId}`);
      return uploadId;
      
    } catch (error) {
      console.error('❌ Error adding to upload queue:', error);
      throw error;
    }
  }

  /**
   * Create preliminary reel entry for immediate UI display
   */
  private async createPreliminaryReelEntry(uploadId: string, reelData: any): Promise<void> {
    try {
      const preliminaryReel = {
        ...reelData,
        uploadId: uploadId,
        status: 'processing',
        videoUrl: '', // Will be updated when upload completes
        thumbnailUrl: '', // Will be updated when upload completes
        isProcessing: true,
        uploadProgress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await firebaseFirestore.collection(COLLECTIONS.REELS).doc(uploadId).set(preliminaryReel);
      console.log(`✅ Created preliminary reel entry: ${uploadId}`);
      
    } catch (error) {
      console.error('❌ Error creating preliminary reel entry:', error);
    }
  }

  /**
   * Process upload queue in background
   */
  private async processUploadQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    console.log('🔄 Processing upload queue...');

    try {
      const pendingUploads = Array.from(this.uploadQueue.values())
        .filter(upload => upload.status === 'processing' || upload.status === 'uploading');

      for (const upload of pendingUploads.slice(0, this.maxConcurrentUploads)) {
        this.processIndividualUpload(upload);
      }
      
    } catch (error) {
      console.error('❌ Error processing upload queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual upload with segmentation
   */
  private async processIndividualUpload(upload: BackgroundUpload): Promise<void> {
    try {
      console.log(`🎬 Processing upload: ${upload.id}`);
      
      // Step 1: Segment the video
      if (upload.segments.length === 0) {
        await this.segmentVideo(upload);
      }
      
      // Step 2: Upload thumbnail first (small and fast)
      await this.uploadThumbnail(upload);
      
      // Step 3: Upload video segments
      await this.uploadSegments(upload);
      
      // Step 4: Combine segments and finalize
      await this.finalizeUpload(upload);
      
    } catch (error) {
      console.error(`❌ Error processing upload ${upload.id}:`, error);
      upload.status = 'failed';
      await this.updateReelStatus(upload.id, 'failed');
    }
  }

  /**
   * Segment video into memory-safe chunks
   */
  private async segmentVideo(upload: BackgroundUpload): Promise<void> {
    try {
      console.log(`✂️ Segmenting video: ${upload.id}`);
      
      const videoStats = await RNFS.stat(upload.originalVideoPath);
      const totalSize = videoStats.size;
      const segmentSizeBytes = this.segmentSizeKB * 1024;
      const totalSegments = Math.ceil(totalSize / segmentSizeBytes);
      
      upload.totalSegments = totalSegments;
      
      for (let i = 0; i < totalSegments; i++) {
        const segmentId = `${upload.id}_segment_${i}`;
        const segmentPath = `${RNFS.CachesDirectoryPath}/${segmentId}.mp4`;
        
        const startByte = i * segmentSizeBytes;
        const endByte = Math.min(startByte + segmentSizeBytes - 1, totalSize - 1);
        const actualSegmentSize = endByte - startByte + 1;
        
        // Create segment using file slicing
        await this.createVideoSegment(upload.originalVideoPath, segmentPath, startByte, actualSegmentSize);
        
        const segment: UploadSegment = {
          id: segmentId,
          reelId: upload.id,
          segmentIndex: i,
          segmentPath: segmentPath,
          segmentSize: actualSegmentSize,
          uploadProgress: 0,
          status: 'pending',
          retryCount: 0
        };
        
        upload.segments.push(segment);
      }
      
      console.log(`✅ Created ${totalSegments} segments for ${upload.id}`);
      await this.saveUploadQueue();
      
    } catch (error) {
      console.error(`❌ Error segmenting video ${upload.id}:`, error);
      throw error;
    }
  }

  /**
   * Create video segment using memory-safe file operations
   */
  private async createVideoSegment(
    sourcePath: string, 
    segmentPath: string, 
    startByte: number, 
    size: number
  ): Promise<void> {
    try {
      // Read segment in small chunks to avoid memory issues
      const chunkSize = 64 * 1024; // 64KB chunks
      let bytesRead = 0;
      
      // Clear destination file
      if (await RNFS.exists(segmentPath)) {
        await RNFS.unlink(segmentPath);
      }
      
      while (bytesRead < size) {
        const currentChunkSize = Math.min(chunkSize, size - bytesRead);
        const currentPosition = startByte + bytesRead;
        
        const chunk = await RNFS.read(sourcePath, currentChunkSize, currentPosition, 'base64');
        await RNFS.appendFile(segmentPath, chunk, 'base64');
        
        bytesRead += currentChunkSize;
      }
      
    } catch (error) {
      console.error('❌ Error creating video segment:', error);
      throw error;
    }
  }

  /**
   * Upload thumbnail first for immediate preview
   */
  private async uploadThumbnail(upload: BackgroundUpload): Promise<void> {
    try {
      console.log(`📸 Uploading thumbnail: ${upload.id}`);
      
      const thumbnailRef = firebaseStorage.ref(`reels/${upload.id}/thumbnail.jpg`);
      const thumbnailBlob = await RNFS.readFile(upload.thumbnailPath, 'base64');
      
      await thumbnailRef.putString(thumbnailBlob, 'base64');
      const thumbnailUrl = await thumbnailRef.getDownloadURL();
      
      // Update reel with thumbnail URL
      await firebaseFirestore.collection(COLLECTIONS.REELS).doc(upload.id).update({
        thumbnailUrl: thumbnailUrl,
        uploadProgress: 10, // 10% for thumbnail
        updatedAt: new Date().toISOString()
      });
      
      console.log(`✅ Thumbnail uploaded: ${upload.id}`);
      
    } catch (error) {
      console.error(`❌ Error uploading thumbnail ${upload.id}:`, error);
      throw error;
    }
  }

  /**
   * Upload video segments with progress tracking
   */
  private async uploadSegments(upload: BackgroundUpload): Promise<void> {
    try {
      console.log(`📤 Uploading segments: ${upload.id}`);
      
      const maxConcurrentSegments = 3; // Upload 3 segments concurrently
      const segmentPromises: Promise<void>[] = [];
      
      for (let i = 0; i < upload.segments.length; i += maxConcurrentSegments) {
        const batch = upload.segments.slice(i, i + maxConcurrentSegments);
        
        const batchPromises = batch.map(segment => this.uploadSingleSegment(upload, segment));
        await Promise.all(batchPromises);
        
        // Update overall progress
        const completedSegments = upload.segments.filter(s => s.status === 'completed').length;
        upload.overallProgress = 10 + (completedSegments / upload.totalSegments) * 80; // 10% thumbnail + 80% segments
        
        // Update Firestore progress
        await firebaseFirestore.collection(COLLECTIONS.REELS).doc(upload.id).update({
          uploadProgress: Math.round(upload.overallProgress),
          updatedAt: new Date().toISOString()
        });
        
        console.log(`📊 Upload progress: ${upload.id} - ${Math.round(upload.overallProgress)}%`);
      }
      
      console.log(`✅ All segments uploaded: ${upload.id}`);
      
    } catch (error) {
      console.error(`❌ Error uploading segments ${upload.id}:`, error);
      throw error;
    }
  }

  /**
   * Upload single segment with retry logic
   */
  private async uploadSingleSegment(upload: BackgroundUpload, segment: UploadSegment): Promise<void> {
    try {
      segment.status = 'uploading';
      
      const segmentRef = firebaseStorage.ref(`reels/${upload.id}/segments/segment_${segment.segmentIndex}.mp4`);
      const segmentBlob = await RNFS.readFile(segment.segmentPath, 'base64');
      
      await segmentRef.putString(segmentBlob, 'base64');
      segment.uploadUrl = await segmentRef.getDownloadURL();
      segment.status = 'completed';
      segment.uploadProgress = 100;
      
      // Clean up local segment file
      await RNFS.unlink(segment.segmentPath);
      
    } catch (error) {
      console.error(`❌ Error uploading segment ${segment.id}:`, error);
      segment.retryCount++;
      
      if (segment.retryCount < this.maxRetries) {
        console.log(`🔄 Retrying segment ${segment.id} (${segment.retryCount}/${this.maxRetries})`);
        await this.uploadSingleSegment(upload, segment);
      } else {
        segment.status = 'failed';
        throw error;
      }
    }
  }

  /**
   * Finalize upload by creating segment manifest
   */
  private async finalizeUpload(upload: BackgroundUpload): Promise<void> {
    try {
      console.log(`🏁 Finalizing upload: ${upload.id}`);
      
      // Create segment manifest
      const segmentManifest = {
        totalSegments: upload.totalSegments,
        segments: upload.segments.map(segment => ({
          index: segment.segmentIndex,
          url: segment.uploadUrl,
          size: segment.segmentSize
        }))
      };
      
      // Upload manifest
      const manifestRef = firebaseStorage.ref(`reels/${upload.id}/manifest.json`);
      await manifestRef.putString(JSON.stringify(segmentManifest), 'raw');
      const manifestUrl = await manifestRef.getDownloadURL();
      
      // Update reel with final data
      await firebaseFirestore.collection(COLLECTIONS.REELS).doc(upload.id).update({
        videoUrl: manifestUrl, // Points to segment manifest
        isSegmented: true,
        totalSegments: upload.totalSegments,
        status: 'completed',
        isProcessing: false,
        uploadProgress: 100,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      upload.status = 'completed';
      upload.completedAt = new Date().toISOString();
      upload.overallProgress = 100;
      
      // Clean up
      await RNFS.unlink(upload.originalVideoPath);
      await RNFS.unlink(upload.thumbnailPath);
      
      console.log(`✅ Upload completed: ${upload.id}`);
      
    } catch (error) {
      console.error(`❌ Error finalizing upload ${upload.id}:`, error);
      throw error;
    }
  }

  /**
   * Update reel status in Firestore
   */
  private async updateReelStatus(reelId: string, status: string): Promise<void> {
    try {
      await firebaseFirestore.collection(COLLECTIONS.REELS).doc(reelId).update({
        status: status,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(`❌ Error updating reel status ${reelId}:`, error);
    }
  }

  /**
   * Save upload queue to persistent storage
   */
  private async saveUploadQueue(): Promise<void> {
    try {
      const queueData = JSON.stringify(Array.from(this.uploadQueue.entries()));
      await AsyncStorage.setItem('background_upload_queue', queueData);
    } catch (error) {
      console.error('❌ Error saving upload queue:', error);
    }
  }

  /**
   * Load upload queue from persistent storage
   */
  async loadUploadQueue(): Promise<void> {
    try {
      const queueData = await AsyncStorage.getItem('background_upload_queue');
      if (queueData) {
        const entries = JSON.parse(queueData);
        this.uploadQueue = new Map(entries);
        
        // Resume pending uploads
        this.processUploadQueue();
      }
    } catch (error) {
      console.error('❌ Error loading upload queue:', error);
    }
  }

  /**
   * Get upload progress for a specific upload
   */
  getUploadProgress(uploadId: string): number {
    const upload = this.uploadQueue.get(uploadId);
    return upload ? upload.overallProgress : 0;
  }

  /**
   * Cancel upload
   */
  async cancelUpload(uploadId: string): Promise<void> {
    try {
      const upload = this.uploadQueue.get(uploadId);
      if (upload) {
        // Clean up local files
        if (await RNFS.exists(upload.originalVideoPath)) {
          await RNFS.unlink(upload.originalVideoPath);
        }
        if (await RNFS.exists(upload.thumbnailPath)) {
          await RNFS.unlink(upload.thumbnailPath);
        }
        
        // Clean up segments
        for (const segment of upload.segments) {
          if (await RNFS.exists(segment.segmentPath)) {
            await RNFS.unlink(segment.segmentPath);
          }
        }
        
        // Remove from queue
        this.uploadQueue.delete(uploadId);
        await this.saveUploadQueue();
        
        // Update Firestore
        await this.updateReelStatus(uploadId, 'cancelled');
      }
    } catch (error) {
      console.error(`❌ Error cancelling upload ${uploadId}:`, error);
    }
  }

  /**
   * Get all active uploads
   */
  getActiveUploads(): BackgroundUpload[] {
    return Array.from(this.uploadQueue.values())
      .filter(upload => upload.status === 'processing' || upload.status === 'uploading');
  }

  /**
   * Initialize the engine
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing Advanced Background Upload Engine...');
    await this.loadUploadQueue();
    console.log('✅ Advanced Background Upload Engine initialized');
  }
}

export default AdvancedBackgroundUploadEngine;
