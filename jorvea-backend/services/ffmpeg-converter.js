/**
 * FFmpeg Converter Service
 * 
 * Converts videos to HLS format with multiple resolutions
 * Uses direct FFmpeg CLI - NO deprecated npm packages!
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class FFmpegConverter {
  /**
   * Convert video to HLS with multiple resolutions
   * Creates 720p and 480p variants for adaptive streaming
   * (Removed 1080p to reduce memory usage and prevent crashes)
   */
  static async convertToHLS(inputPath, outputDir, videoId, onProgress) {
    const resolutions = [
      { name: '720p', width: 1280, height: 720, bitrate: '2500k', audioBitrate: '128k' },
      { name: '480p', width: 854, height: 480, bitrate: '1200k', audioBitrate: '96k' },
    ];

    try {
      // Get video duration first (for progress calculation)
      const duration = await this.getVideoDuration(inputPath);
      console.log(`📹 Video duration: ${duration.toFixed(2)}s`);

      // Convert each resolution sequentially (not parallel to save memory)
      let completedResolutions = 0;
      for (const res of resolutions) {
        console.log(`🎬 Converting ${res.name}...`);
        
        await this.convertResolution(inputPath, outputDir, res, duration, (progress) => {
          // Calculate total progress across all resolutions
          const totalProgress = ((completedResolutions + progress) / resolutions.length) * 80;
          onProgress?.(totalProgress);
        });
        
        completedResolutions++;
        console.log(`✅ ${res.name} complete`);
      }

      // Create master playlist
      onProgress?.(85);
      await this.createMasterPlaylist(outputDir, resolutions);
      console.log('✅ Master playlist created');
      
      // Generate thumbnail
      onProgress?.(90);
      await this.generateThumbnail(inputPath, outputDir);
      console.log('✅ Thumbnail generated');
      
      onProgress?.(100);
      console.log('🎉 HLS conversion complete!');

    } catch (error) {
      console.error('❌ HLS conversion error:', error);
      throw error;
    }
  }

  /**
   * Get video duration using FFprobe
   */
  static getVideoDuration(inputPath) {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn('ffprobe', [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        inputPath
      ]);

      let duration = '';
      
      ffprobe.stdout.on('data', (data) => {
        duration += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        console.error('FFprobe stderr:', data.toString());
      });

      ffprobe.on('close', (code) => {
        if (code === 0 && duration) {
          resolve(parseFloat(duration.trim()));
        } else {
          reject(new Error('Failed to get video duration'));
        }
      });

      ffprobe.on('error', (err) => {
        reject(new Error(`FFprobe error: ${err.message}`));
      });
    });
  }

  /**
   * Convert single resolution
   */
  static convertResolution(inputPath, outputDir, resolution, totalDuration, onProgress) {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', inputPath,
        '-vf', `scale=${resolution.width}:${resolution.height}:force_original_aspect_ratio=decrease,pad=${resolution.width}:${resolution.height}:(ow-iw)/2:(oh-ih)/2`,
        '-c:v', 'libx264',
        '-preset', 'veryfast', // Changed from 'fast' to 'veryfast' for less memory
        '-crf', '28', // Increased from 23 to reduce quality slightly and save memory
        '-maxrate', resolution.bitrate,
        '-bufsize', `${parseInt(resolution.bitrate) * 2}`,
        '-c:a', 'aac',
        '-b:a', resolution.audioBitrate,
        '-ac', '2',
        '-ar', '44100',
        '-hls_time', '6',
        '-hls_list_size', '0',
        '-hls_segment_type', 'mpegts',
        '-hls_playlist_type', 'vod',
        '-hls_flags', 'independent_segments',
        '-hls_segment_filename', path.join(outputDir, `${resolution.name}_%03d.ts`),
        '-threads', '2', // Limit threads to reduce memory usage
        '-max_muxing_queue_size', '1024', // Prevent memory overflow
        '-f', 'hls',
        path.join(outputDir, `${resolution.name}.m3u8`)
      ];

      const ffmpeg = spawn('ffmpeg', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      let currentTime = 0;
      let lastProgress = 0;
      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        errorOutput += output; // Capture error output
        
        // Parse time from: "time=00:01:23.45"
        const timeMatch = output.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch) {
          currentTime = parseInt(timeMatch[1]) * 3600 + 
                       parseInt(timeMatch[2]) * 60 + 
                       parseFloat(timeMatch[3]);
          
          const progress = Math.min((currentTime / totalDuration), 1.0);
          
          // Only report significant progress changes (to reduce noise)
          if (progress - lastProgress >= 0.05) {
            onProgress?.(progress);
            console.log(`📊 Conversion progress: ${Math.round(progress * 100)}%`);
            lastProgress = progress;
          }
        }
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          onProgress?.(1.0);
          resolve();
        } else {
          console.error(`❌ FFmpeg error output for ${resolution.name}:`, errorOutput);
          reject(new Error(`FFmpeg exited with code ${code} for ${resolution.name}. Last error: ${errorOutput.slice(-500)}`));
        }
      });

      ffmpeg.on('error', (err) => {
        console.error(`❌ FFmpeg spawn error for ${resolution.name}:`, err);
        reject(new Error(`FFmpeg spawn error: ${err.message}`));
      });

      // Handle process termination
      process.on('SIGTERM', () => {
        console.log('⚠️ Received SIGTERM, killing FFmpeg process...');
        ffmpeg.kill('SIGTERM');
      });

      process.on('SIGINT', () => {
        console.log('⚠️ Received SIGINT, killing FFmpeg process...');
        ffmpeg.kill('SIGINT');
      });
    });
  }

  /**
   * Create master HLS playlist that references all resolution variants
   */
  static async createMasterPlaylist(outputDir, resolutions) {
    let playlist = '#EXTM3U\n';
    playlist += '#EXT-X-VERSION:3\n';
    playlist += '\n';
    
    for (const res of resolutions) {
      const bandwidth = parseInt(res.bitrate) * 1000;
      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${res.width}x${res.height},NAME="${res.name}"\n`;
      playlist += `${res.name}.m3u8\n`;
      playlist += '\n';
    }

    await fs.writeFile(path.join(outputDir, 'master.m3u8'), playlist, 'utf8');
  }

  /**
   * Generate thumbnail from video (1 second in)
   */
  static generateThumbnail(inputPath, outputDir) {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', inputPath,
        '-ss', '00:00:01',
        '-vframes', '1',
        '-vf', 'scale=640:-1',
        '-q:v', '2',
        path.join(outputDir, 'thumbnail.jpg')
      ];

      const ffmpeg = spawn('ffmpeg', args);
      
      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Thumbnail generation failed with code ${code}: ${errorOutput}`));
        }
      });

      ffmpeg.on('error', (err) => {
        reject(new Error(`FFmpeg spawn error: ${err.message}`));
      });
    });
  }

  /**
   * Validate that FFmpeg is installed
   */
  static async checkFFmpegInstallation() {
    return new Promise((resolve) => {
      const ffmpeg = spawn('ffmpeg', ['-version']);
      
      ffmpeg.on('close', (code) => {
        resolve(code === 0);
      });

      ffmpeg.on('error', () => {
        resolve(false);
      });
    });
  }
}

module.exports = FFmpegConverter;
