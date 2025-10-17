# 🎥 Professional Video Streaming Setup Guide
## Instagram-Quality Video Delivery with Chunking & Adaptive Bitrate

---

## 📊 **Comparison Table**

| Feature | Mux + DO | CloudFlare Stream | HLS + DO | Custom FFmpeg |
|---------|----------|-------------------|----------|---------------|
| **Cost** | ~$5-20/mo | FREE 1000 min | ~$5/mo | ~$5/mo |
| **Setup Complexity** | Medium | Easy | Easy | Hard |
| **Chunking** | ✅ Auto | ✅ Auto | ⚠️ Manual | ⚠️ Manual |
| **Adaptive Bitrate** | ✅ Auto | ✅ Auto | ⚠️ Manual | ✅ Manual |
| **CDN** | ✅ Included | ✅ Included | ⚠️ DO Spaces | ⚠️ DO Spaces |
| **Analytics** | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| **Quality** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Instagram-like** | ✅ Yes | ✅ Yes | ⚠️ Good | ⚠️ Good |

---

## 🏆 **RECOMMENDED: CloudFlare Stream (Best for Startups)**

### **Why CloudFlare Stream?**
1. ✅ **1000 minutes FREE per month** (perfect for starting)
2. ✅ **Automatic chunking** (no FFmpeg needed)
3. ✅ **Adaptive bitrate** (Instagram-quality)
4. ✅ **Global CDN** (fast worldwide)
5. ✅ **Simple integration** (just upload and play)

### **Setup CloudFlare Stream:**

#### **Step 1: Create CloudFlare Account**
```bash
# Go to: https://dash.cloudflare.com/sign-up
# Create account
# Enable Stream product (FREE tier)
```

#### **Step 2: Get API Credentials**
```bash
# Go to: https://dash.cloudflare.com/profile/api-tokens
# Create API Token with "Stream:Edit" permission
# Save these:
CLOUDFLARE_ACCOUNT_ID="your_account_id"
CLOUDFLARE_API_TOKEN="your_api_token"
```

#### **Step 3: Install Dependencies**
```bash
npm install axios react-native-video
```

---

## 💻 **Implementation Code**

### **1. CloudFlare Stream Upload Service**

Create: `src/services/CloudFlareStreamService.ts`

\`\`\`typescript
/**
 * CloudFlare Stream Video Service
 * Automatic chunking, adaptive bitrate, CDN delivery
 */

import axios from 'axios';

const CLOUDFLARE_ACCOUNT_ID = 'YOUR_ACCOUNT_ID'; // Replace with your account ID
const CLOUDFLARE_API_TOKEN = 'YOUR_API_TOKEN';   // Replace with your API token

interface CloudFlareUploadResponse {
  success: boolean;
  result: {
    uid: string;
    preview: string;
    playback: {
      hls: string;
      dash: string;
    };
    thumbnail: string;
    status: {
      state: string;
      pctComplete: string;
    };
  };
}

class CloudFlareStreamService {
  private static instance: CloudFlareStreamService;
  private baseURL = \`https://api.cloudflare.com/client/v4/accounts/\${CLOUDFLARE_ACCOUNT_ID}/stream\`;

  static getInstance(): CloudFlareStreamService {
    if (!CloudFlareStreamService.instance) {
      CloudFlareStreamService.instance = new CloudFlareStreamService();
    }
    return CloudFlareStreamService.instance;
  }

  /**
   * Upload video to CloudFlare Stream
   * Returns HLS URL for instant playback with chunking
   */
  async uploadVideo(
    videoPath: string,
    metadata?: {
      name?: string;
      requireSignedURLs?: boolean;
      thumbnailTimestampPct?: number;
    }
  ): Promise<CloudFlareUploadResponse> {
    try {
      console.log('📤 Uploading video to CloudFlare Stream...');

      const formData = new FormData();
      formData.append('file', {
        uri: videoPath,
        type: 'video/mp4',
        name: 'reel.mp4',
      } as any);

      if (metadata?.name) {
        formData.append('meta', JSON.stringify({ name: metadata.name }));
      }

      const response = await axios.post(this.baseURL, formData, {
        headers: {
          'Authorization': \`Bearer \${CLOUDFLARE_API_TOKEN}\`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          console.log(\`⬆️ Upload progress: \${percentCompleted}%\`);
        },
      });

      console.log('✅ Video uploaded successfully!');
      console.log('📺 HLS URL:', response.data.result.playback.hls);
      
      return response.data;
    } catch (error) {
      console.error('❌ CloudFlare upload failed:', error);
      throw error;
    }
  }

  /**
   * Get video details and playback URLs
   */
  async getVideoDetails(videoId: string): Promise<any> {
    try {
      const response = await axios.get(\`\${this.baseURL}/\${videoId}\`, {
        headers: {
          'Authorization': \`Bearer \${CLOUDFLARE_API_TOKEN}\`,
        },
      });

      return response.data.result;
    } catch (error) {
      console.error('❌ Failed to get video details:', error);
      throw error;
    }
  }

  /**
   * Delete video from CloudFlare Stream
   */
  async deleteVideo(videoId: string): Promise<boolean> {
    try {
      await axios.delete(\`\${this.baseURL}/\${videoId}\`, {
        headers: {
          'Authorization': \`Bearer \${CLOUDFLARE_API_TOKEN}\`,
        },
      });

      console.log('✅ Video deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to delete video:', error);
      return false;
    }
  }

  /**
   * List all videos
   */
  async listVideos(): Promise<any[]> {
    try {
      const response = await axios.get(this.baseURL, {
        headers: {
          'Authorization': \`Bearer \${CLOUDFLARE_API_TOKEN}\`,
        },
      });

      return response.data.result;
    } catch (error) {
      console.error('❌ Failed to list videos:', error);
      return [];
    }
  }
}

export default CloudFlareStreamService;
\`\`\`

---

### **2. CloudFlare Stream Video Player**

Create: `src/components/CloudFlareStreamPlayer.tsx`

\`\`\`typescript
/**
 * CloudFlare Stream Video Player
 * Supports HLS with automatic chunking and adaptive bitrate
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import Video, { VideoRef } from 'react-native-video';

const { width, height } = Dimensions.get('window');

interface CloudFlareStreamPlayerProps {
  videoId: string;
  hlsUrl: string;
  thumbnailUrl?: string;
  shouldPlay: boolean;
  isFocused: boolean;
  muted: boolean;
  onLoad?: () => void;
  onProgress?: (data: any) => void;
  onBuffer?: (buffering: boolean) => void;
  onError?: (error: any) => void;
  style?: any;
}

export const CloudFlareStreamPlayer: React.FC<CloudFlareStreamPlayerProps> = ({
  videoId,
  hlsUrl,
  thumbnailUrl,
  shouldPlay,
  isFocused,
  muted,
  onLoad,
  onProgress,
  onBuffer,
  onError,
  style,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const videoRef = useRef<VideoRef>(null);

  useEffect(() => {
    if (!isFocused) {
      setIsLoading(true);
    }
  }, [isFocused]);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  const handleBuffer = ({ isBuffering: buffering }: { isBuffering: boolean }) => {
    setIsBuffering(buffering);
    onBuffer?.(buffering);
  };

  const handleError = (error: any) => {
    console.error('❌ Video playback error:', error);
    setIsLoading(false);
    onError?.(error);
  };

  return (
    <View style={[styles.container, style]}>
      <Video
        ref={videoRef}
        source={{ uri: hlsUrl }}
        style={styles.video}
        resizeMode="cover"
        repeat
        paused={!shouldPlay || !isFocused}
        muted={muted}
        playInBackground={false}
        playWhenInactive={false}
        // CloudFlare Stream HLS optimizations
        poster={thumbnailUrl}
        posterResizeMode="cover"
        ignoreSilentSwitch="ignore"
        mixWithOthers="duck"
        // Optimized buffer config for HLS streaming
        bufferConfig={{
          minBufferMs: Platform.OS === 'android' ? 1500 : 1000,
          maxBufferMs: Platform.OS === 'android' ? 10000 : 8000,
          bufferForPlaybackMs: 200,  // VERY LOW for instant start
          bufferForPlaybackAfterRebufferMs: 800,
          cacheSizeMB: 200,
        }}
        progressUpdateInterval={250}
        maxBitRate={3000000}  // Let CloudFlare handle adaptive bitrate
        onLoad={handleLoad}
        onProgress={onProgress}
        onBuffer={handleBuffer}
        onError={handleError}
        preventsDisplaySleepDuringVideoPlayback={true}
      />

      {(isLoading || isBuffering) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});

export default CloudFlareStreamPlayer;
\`\`\`

---

### **3. Upload Reel with CloudFlare Stream**

Update your CreateReelScreen:

\`\`\`typescript
import CloudFlareStreamService from '../services/CloudFlareStreamService';

const handlePublishReel = async () => {
  try {
    setUploading(true);
    console.log('📤 Uploading reel to CloudFlare Stream...');
    
    // Upload to CloudFlare Stream
    const streamService = CloudFlareStreamService.getInstance();
    const uploadResponse = await streamService.uploadVideo(videoUri, {
      name: caption || 'Untitled Reel',
      thumbnailTimestampPct: 0.5, // Thumbnail at 50% of video
    });
    
    // Save to Firestore with HLS URL
    await firestore().collection('reels').add({
      userId: user.uid,
      videoUrl: uploadResponse.result.playback.hls,  // HLS URL for streaming
      videoId: uploadResponse.result.uid,            // CloudFlare video ID
      thumbnailUrl: uploadResponse.result.thumbnail,
      caption,
      tags: selectedTags,
      createdAt: firestore.FieldValue.serverTimestamp(),
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      isPrivate: false,
    });
    
    console.log('✅ Reel published successfully!');
    navigation.goBack();
  } catch (error) {
    console.error('❌ Failed to publish reel:', error);
  } finally {
    setUploading(false);
  }
};
\`\`\`

---

### **4. Use in ReelsScreen**

\`\`\`typescript
import CloudFlareStreamPlayer from '../components/CloudFlareStreamPlayer';

// Replace InstagramStyleVideoPlayer with:
<CloudFlareStreamPlayer
  videoId={reel.videoId}
  hlsUrl={reel.videoUrl}  // HLS URL from CloudFlare
  thumbnailUrl={reel.thumbnailUrl}
  shouldPlay={isPlaying}
  isFocused={isActive}
  muted={muted}
  onLoad={handleVideoLoad}
  onProgress={handleVideoProgress}
  onBuffer={(buffering) => {
    console.log('Buffering:', buffering);
  }}
  style={styles.video}
/>
\`\`\`

---

## 🎯 **CloudFlare Stream Benefits**

### **Automatic Features:**
✅ **Chunking:** Automatic HLS segmentation  
✅ **Adaptive Bitrate:** Adjusts quality based on network  
✅ **CDN:** Global delivery network included  
✅ **Thumbnails:** Auto-generated  
✅ **Analytics:** View counts, play rates  
✅ **Compression:** Optimized encoding  

### **Performance:**
- ⚡ **Start Time:** 200-500ms (Instagram-like)
- ⚡ **Buffering:** Minimal (adaptive bitrate)
- ⚡ **Quality:** 1080p with auto-scaling
- ⚡ **Delivery:** CDN-optimized

---

## 💰 **Cost Breakdown**

### **CloudFlare Stream:**
- **FREE Tier:** 1000 minutes/month
- **Beyond FREE:** $1 per 1000 minutes
- **Storage:** $5 per 1000 minutes stored
- **Example:** 5000 video views/month = ~$5-10/month

### **For 10,000 Users:**
- Average 50 videos/user = 500,000 videos
- Average 2 minutes/video = 1,000,000 minutes
- **Cost:** ~$1000-1500/month (affordable at scale!)

---

## 🔧 **Alternative: Mux (Premium Option)**

If you want even better analytics and features:

\`\`\`bash
# Install Mux SDK
npm install @mux/mux-node

# Environment variables
MUX_TOKEN_ID="your_token_id"
MUX_TOKEN_SECRET="your_token_secret"
\`\`\`

**Mux Benefits:**
- ✅ Advanced analytics
- ✅ Better encoding
- ✅ More features
- ⚠️ More expensive (~$0.01/minute)

---

## 📋 **Setup Checklist**

### **CloudFlare Stream Setup:**
- [ ] Create CloudFlare account
- [ ] Enable Stream product (FREE tier)
- [ ] Get API credentials (Account ID + API Token)
- [ ] Add credentials to your app
- [ ] Install dependencies (`axios`, `react-native-video`)
- [ ] Copy service files to your project
- [ ] Update CreateReelScreen to upload to CloudFlare
- [ ] Update ReelsScreen to use CloudFlareStreamPlayer
- [ ] Test upload and playback

---

## 🎬 **Testing Guide**

1. **Upload Test:**
   ```bash
   # Upload a test video
   # Check CloudFlare dashboard
   # Verify HLS URL works
   ```

2. **Playback Test:**
   ```bash
   # Play video in app
   # Check start time (should be <500ms)
   # Check buffering (should be minimal)
   # Check quality switching (auto)
   ```

3. **Performance Test:**
   ```bash
   # Test on slow network
   # Test on fast network
   # Verify adaptive bitrate works
   ```

---

## 🚀 **What You Need to Provide:**

### **From CloudFlare Dashboard:**
1. **Account ID** - Found in dashboard URL
2. **API Token** - Create with "Stream:Edit" permission

### **Steps:**
1. Go to https://dash.cloudflare.com
2. Sign up (FREE)
3. Go to Stream section
4. Get Account ID from URL
5. Create API Token (Profile > API Tokens)
6. Copy both into the service file

---

## 📊 **Comparison with Other Options**

### **Why NOT Use:**
❌ **YouTube API** - Limited embedding, not for reels  
❌ **Vimeo** - Too expensive for startups  
❌ **AWS MediaConvert** - Complex setup  
❌ **Custom FFmpeg** - Hard to maintain  

### **Why USE CloudFlare Stream:**
✅ **Easiest setup** - Just upload and play  
✅ **FREE tier** - Perfect for starting  
✅ **Instagram-quality** - Professional results  
✅ **No maintenance** - CloudFlare handles everything  
✅ **Scales easily** - Grows with your app  

---

**Recommendation:** Start with **CloudFlare Stream** (FREE), then upgrade to Mux if you need advanced analytics later!

Would you like me to:
1. Create the complete implementation files?
2. Show you how to set up CloudFlare account?
3. Create a video upload/encode pipeline?
