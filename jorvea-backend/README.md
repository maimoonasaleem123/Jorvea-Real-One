# 🎬 Jorvea Video Backend

Node.js backend for converting videos to HLS format with adaptive streaming.

## ✨ Features

- ✅ **HLS Conversion**: Converts videos to HTTP Live Streaming format
- ✅ **Adaptive Streaming**: 3 quality levels (1080p, 720p, 480p)
- ✅ **Background Processing**: Videos process asynchronously
- ✅ **DigitalOcean Upload**: Automatic upload to cloud storage
- ✅ **Push Notifications**: Notifies users when conversion complete
- ✅ **Progress Tracking**: Real-time conversion progress
- ✅ **Automatic Cleanup**: Removes temporary files
- ✅ **Error Handling**: Retry logic and failure notifications

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- FFmpeg installed on your system
- DigitalOcean Spaces account
- Firebase project (for push notifications - optional)

### Installation

1. **Clone/Navigate to backend directory**:
   ```bash
   cd jorvea-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Install FFmpeg** (if not already installed):

   **Mac**:
   ```bash
   brew install ffmpeg
   ```

   **Ubuntu/Debian**:
   ```bash
   sudo apt update
   sudo apt install ffmpeg
   ```

   **Windows**:
   - Download from: https://ffmpeg.org/download.html
   - Add to PATH

   **Verify installation**:
   ```bash
   ffmpeg -versionSet-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
   ```

4. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in your values:
   ```env
   PORT=3000
   DO_SPACES_ENDPOINT=blr1.digitaloceanspaces.com
   DO_SPACES_BUCKET=your-bucket-name
   DO_SPACES_ACCESS_KEY=your-access-key
   DO_SPACES_SECRET_KEY=your-secret-key
   DO_SPACES_REGION=blr1
   DO_SPACES_CDN_URL=https://your-bucket.blr1.cdn.digitaloceanspaces.com
   ```

5. **Start the server**:
   ```bash
   # Development (with auto-reload)
   npm run dev

   # Production
   npm start
   ```

6. **Test the server**:
   ```bash
   curl http://localhost:3000/health
   ```

   You should see:
   ```json
   {
     "status": "ok",
     "service": "jorvea-video-backend",
     "ffmpeg": "ready"
   }
   ```

## 📡 API Endpoints

### Health Check
```http
GET /health
```

Response:
```json
{
  "status": "ok",
  "service": "jorvea-video-backend",
  "version": "1.0.0",
  "ffmpeg": "ready",
  "timestamp": "2025-01-17T10:30:00.000Z"
}
```

### Convert Video to HLS
```http
POST /convert-hls
Content-Type: multipart/form-data

Fields:
- video: (file) The video file to convert
- videoId: (string) Unique video identifier
- userId: (string) User ID for notifications
- caption: (string) Optional caption
```

Response:
```json
{
  "success": true,
  "jobId": "video_1234567890",
  "message": "Video processing started in background",
  "estimatedTime": "2-5 minutes",
  "status": "processing"
}
```

### Get Server Stats
```http
GET /stats
```

Response:
```json
{
  "pendingUploads": 2,
  "processingJobs": 1,
  "uptime": 3600,
  "memory": {...}
}
```

## 🐳 Docker Deployment

### Build Docker Image
```bash
docker build -t jorvea-video-backend .
```

### Run Container
```bash
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name jorvea-backend \
  jorvea-video-backend
```

### Docker Compose (Recommended)
```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./uploads:/app/uploads
      - ./output:/app/output
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

## ☁️ Deployment Options

### Option 1: Vercel (FREE)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

**Note**: Vercel has 50MB request limit, may need adjustments for large videos.

### Option 2: DigitalOcean App Platform ($5/month)
1. Push code to GitHub
2. Go to DigitalOcean → Apps → Create App
3. Connect GitHub repository
4. Choose `jorvea-backend` directory
5. Set environment variables
6. Deploy!

### Option 3: DigitalOcean Droplet ($5/month)
```bash
# SSH into your droplet
ssh root@your-droplet-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install FFmpeg
apt-get install -y ffmpeg

# Clone your code
git clone your-repo-url
cd jorvea-backend

# Install dependencies
npm install

# Install PM2 for process management
npm install -g pm2

# Create .env file
nano .env
# (paste your environment variables)

# Start with PM2
pm2 start server.js --name jorvea-backend
pm2 save
pm2 startup
```

### Option 4: Railway (FREE tier available)
1. Go to railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Add environment variables
5. Deploy!

### Option 5: Render (FREE tier)
1. Go to render.com
2. New → Web Service
3. Connect GitHub repository
4. Build Command: `npm install`
5. Start Command: `node server.js`
6. Add environment variables
7. Deploy!

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3000 |
| `NODE_ENV` | Environment (development/production) | No | development |
| `DO_SPACES_ENDPOINT` | DigitalOcean Spaces endpoint | Yes | - |
| `DO_SPACES_BUCKET` | Bucket name | Yes | - |
| `DO_SPACES_ACCESS_KEY` | Access key | Yes | - |
| `DO_SPACES_SECRET_KEY` | Secret key | Yes | - |
| `DO_SPACES_REGION` | Region | Yes | - |
| `DO_SPACES_CDN_URL` | CDN URL | Yes | - |
| `FIREBASE_PROJECT_ID` | Firebase project ID (optional) | No | - |

## 📱 Mobile App Integration

### Update Mobile App

In `src/services/BackgroundVideoProcessor.ts`, change the `BACKEND_URL`:

```typescript
const BACKEND_URL = 'https://your-backend-url.com'; // Replace with your deployed URL
```

### Test Connection
```typescript
// Test from mobile app
const response = await fetch('https://your-backend-url.com/health');
const data = await response.json();
console.log('Backend status:', data.status);
```

## 🧪 Testing

### Test with cURL
```bash
# Upload a test video
curl -X POST http://localhost:3000/convert-hls \
  -F "video=@test-video.mp4" \
  -F "videoId=test_123" \
  -F "userId=user_123" \
  -F "caption=Test video"
```

### Test with Postman
1. Open Postman
2. Create new POST request to `http://localhost:3000/convert-hls`
3. Go to Body → form-data
4. Add fields:
   - `video` (file): Select your video file
   - `videoId` (text): `test_123`
   - `userId` (text): `user_123`
   - `caption` (text): `Test video`
5. Send request

## 📊 Monitoring

### Check Logs
```bash
# Docker
docker logs jorvea-backend -f

# PM2
pm2 logs jorvea-backend

# Direct
tail -f server.log
```

### Server Stats
```bash
curl http://localhost:3000/stats
```

## 🐛 Troubleshooting

### FFmpeg Not Found
```bash
# Check if FFmpeg is installed
ffmpeg -version

# Install if missing (Ubuntu)
sudo apt install ffmpeg
```

### Port Already in Use
```bash
# Change PORT in .env file
PORT=3001
```

### Memory Issues
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" node server.js
```

### DigitalOcean Upload Fails
1. Check your credentials in `.env`
2. Verify bucket permissions (must be public-read)
3. Check CORS settings in DigitalOcean dashboard

## 📈 Performance

- **Conversion Speed**: ~0.5-1x video duration (30s video = 15-30s conversion)
- **File Size Reduction**: ~40-60% smaller than original
- **Memory Usage**: ~500MB-1GB per conversion
- **Concurrent Jobs**: Supports multiple simultaneous conversions

## 🔐 Security

- ✅ File type validation (video only)
- ✅ File size limits (500MB max)
- ✅ CORS enabled
- ✅ Environment variables for secrets
- ⚠️ Add authentication in production
- ⚠️ Rate limiting recommended
- ⚠️ HTTPS required in production

## 💰 Cost Estimation

| Service | Free Tier | Cost After |
|---------|-----------|------------|
| Vercel | 100GB bandwidth/month | $20/month |
| Railway | 500 hours/month | $5/month |
| DigitalOcean | None | $5-10/month |
| Render | 750 hours/month | $7/month |

**Recommendation**: Start with Railway (FREE) or DigitalOcean ($5/month)

## 📝 License

MIT License - feel free to use for your project!

## 🤝 Support

Questions? Issues?
1. Check the logs: `pm2 logs` or `docker logs`
2. Verify FFmpeg: `ffmpeg -version`
3. Test health endpoint: `curl http://localhost:3000/health`

## 🎉 You're Ready!

Your backend is now set up to convert videos to HLS with adaptive streaming!

**Next Steps**:
1. ✅ Deploy to cloud (Vercel/Railway/DigitalOcean)
2. ✅ Update mobile app with backend URL
3. ✅ Test video upload from mobile app
4. ✅ Monitor logs and performance
5. ✅ Enjoy HLS adaptive streaming! 🚀
