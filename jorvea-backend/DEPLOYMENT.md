# 🚀 Jorvea Backend - Complete Deployment Guide

## 📋 What You Need to Do

This guide will help you deploy your Node.js backend that converts videos to HLS format.

---

## ⚡ OPTION 1: Railway (EASIEST - FREE)

**Best for**: Quick deployment, no credit card needed initially

### Steps:

1. **Create Railway Account**
   - Go to: https://railway.app
   - Sign up with GitHub (free)

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `Jorvea` repository
   - Select `jorvea-backend` directory

3. **Add Environment Variables**
   - In Railway dashboard, go to "Variables"
   - Add all variables from `.env` file:
     ```
     DO_SPACES_ENDPOINT=blr1.digitaloceanspaces.com
     DO_SPACES_BUCKET=jorvea
     DO_SPACES_ACCESS_KEY=DO801XPFLWMJLWB62XBX
     DO_SPACES_SECRET_KEY=abGOCo+yDJkU4pzWxArmxAPZjo84IGg6d4k3c9rM2WQ
     DO_SPACES_REGION=blr1
     DO_SPACES_CDN_URL=https://jorvea.blr1.cdn.digitaloceanspaces.com
     ```

4. **Deploy**
   - Click "Deploy"
   - Wait 2-3 minutes
   - Get your URL: `https://your-app.up.railway.app`

5. **Test**
   ```bash
   curl https://your-app.up.railway.app/health
   ```

6. **Update Mobile App**
   - Open `src/services/BackgroundVideoProcessor.ts`
   - Change line ~255:
     ```typescript
     const BACKEND_URL = 'https://your-app.up.railway.app';
     ```

**Cost**: FREE for first 500 hours/month, then $5/month

---

## ⚡ OPTION 2: Render (EASIEST - FREE)

**Best for**: No credit card needed, permanent free tier

### Steps:

1. **Create Render Account**
   - Go to: https://render.com
   - Sign up with GitHub (free)

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select `jorvea` repository

3. **Configure Service**
   - Name: `jorvea-video-backend`
   - Region: Choose closest to you
   - Branch: `main` or `master`
   - Root Directory: `jorvea-backend`
   - Runtime: Node
   - Build Command: `npm install`
   - Start Command: `node server.js`

4. **Add Environment Variables**
   - In "Environment" tab, add all variables from `.env`

5. **Deploy**
   - Click "Create Web Service"
   - Wait 5-10 minutes (first deploy takes longer)
   - Get your URL: `https://jorvea-video-backend.onrender.com`

6. **Update Mobile App**
   ```typescript
   const BACKEND_URL = 'https://jorvea-video-backend.onrender.com';
   ```

**Cost**: FREE forever (with some limitations), or $7/month for faster

**⚠️ Note**: Free tier sleeps after 15 min inactivity (30s wake-up time)

---

## ⚡ OPTION 3: DigitalOcean Droplet (BEST PERFORMANCE)

**Best for**: Full control, best performance, same provider as your storage

### Steps:

1. **Create Droplet**
   - Go to DigitalOcean dashboard
   - Create → Droplets
   - Choose:
     - Image: Ubuntu 22.04 LTS
     - Plan: Basic ($5/month)
     - CPU: Regular Intel (cheapest)
     - Region: Same as your Spaces (blr1 - Bangalore)
   - Add SSH key or use password
   - Click "Create Droplet"
   - Note your droplet's IP address

2. **SSH into Droplet**
   ```bash
   ssh root@your-droplet-ip
   ```

3. **Install Node.js**
   ```bash
   # Update system
   apt update && apt upgrade -y

   # Install Node.js 18
   curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
   apt install -y nodejs

   # Verify
   node --version
   npm --version
   ```

4. **Install FFmpeg**
   ```bash
   apt install -y ffmpeg

   # Verify
   ffmpeg -version
   ```

5. **Install Git**
   ```bash
   apt install -y git
   ```

6. **Clone Your Repository**
   ```bash
   # If your repo is private, you'll need to set up GitHub access
   git clone https://github.com/your-username/jorvea.git
   cd jorvea/jorvea-backend
   ```

7. **Install Dependencies**
   ```bash
   npm install
   ```

8. **Create .env File**
   ```bash
   nano .env
   ```
   Paste your environment variables, then save (Ctrl+X, Y, Enter)

9. **Install PM2 (Process Manager)**
   ```bash
   npm install -g pm2
   ```

10. **Start Backend**
    ```bash
    pm2 start server.js --name jorvea-backend
    pm2 save
    pm2 startup
    # (copy and run the command it outputs)
    ```

11. **Configure Firewall**
    ```bash
    ufw allow 22      # SSH
    ufw allow 80      # HTTP
    ufw allow 443     # HTTPS
    ufw allow 3000    # Backend
    ufw enable
    ```

12. **Test**
    ```bash
    curl http://your-droplet-ip:3000/health
    ```

13. **Update Mobile App**
    ```typescript
    const BACKEND_URL = 'http://your-droplet-ip:3000';
    ```

14. **Optional: Setup Domain & HTTPS**
    - Point your domain to droplet IP
    - Install Nginx:
      ```bash
      apt install -y nginx certbot python3-certbot-nginx
      ```
    - Configure Nginx:
      ```bash
      nano /etc/nginx/sites-available/jorvea-backend
      ```
      Paste:
      ```nginx
      server {
          listen 80;
          server_name api.yourdomain.com;

          location / {
              proxy_pass http://localhost:3000;
              proxy_http_version 1.1;
              proxy_set_header Upgrade $http_upgrade;
              proxy_set_header Connection 'upgrade';
              proxy_set_header Host $host;
              proxy_cache_bypass $http_upgrade;
          }
      }
      ```
    - Enable site:
      ```bash
      ln -s /etc/nginx/sites-available/jorvea-backend /etc/nginx/sites-enabled/
      nginx -t
      systemctl restart nginx
      ```
    - Get SSL certificate:
      ```bash
      certbot --nginx -d api.yourdomain.com
      ```

**Cost**: $5/month (same droplet for everything!)

---

## ⚡ OPTION 4: Vercel (EASIEST BUT LIMITED)

**Best for**: Quickest deployment, but has file size limits

### Steps:

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Navigate to Backend**
   ```bash
   cd jorvea-backend
   ```

3. **Deploy**
   ```bash
   vercel
   ```
   - Login with GitHub
   - Follow prompts
   - Get URL: `https://your-project.vercel.app`

4. **Add Environment Variables**
   ```bash
   vercel env add DO_SPACES_ENDPOINT
   # (paste value, press Enter)
   # Repeat for all variables
   ```

5. **Redeploy**
   ```bash
   vercel --prod
   ```

6. **Update Mobile App**
   ```typescript
   const BACKEND_URL = 'https://your-project.vercel.app';
   ```

**Cost**: FREE for 100GB bandwidth/month

**⚠️ Limitations**:
- 50MB request limit (may not work for large videos)
- 10s execution limit on free tier
- Better for smaller videos or use with compression

---

## 📱 Update Mobile App (FOR ALL OPTIONS)

After deploying, update your mobile app:

1. **Open**: `src/services/BackgroundVideoProcessor.ts`

2. **Find line ~255** (in `uploadToBackend` method):
   ```typescript
   const BACKEND_URL = 'http://localhost:3000'; // ⚠️ CHANGE THIS!
   ```

3. **Replace with your deployed URL**:
   ```typescript
   // Railway
   const BACKEND_URL = 'https://your-app.up.railway.app';

   // Render
   const BACKEND_URL = 'https://jorvea-video-backend.onrender.com';

   // DigitalOcean Droplet
   const BACKEND_URL = 'http://your-droplet-ip:3000';
   // Or with domain: 'https://api.yourdomain.com';

   // Vercel
   const BACKEND_URL = 'https://your-project.vercel.app';
   ```

4. **Rebuild mobile app**:
   ```bash
   cd d:\Master Jorvea\JorveaNew\Jorvea
   npm run android
   ```

---

## ✅ Testing Your Deployment

### 1. Test Health Endpoint
```bash
curl https://your-backend-url.com/health
```

Should return:
```json
{
  "status": "ok",
  "service": "jorvea-video-backend",
  "ffmpeg": "ready"
}
```

### 2. Test Video Upload (from your computer)
```bash
curl -X POST https://your-backend-url.com/convert-hls \
  -F "video=@test-video.mp4" \
  -F "videoId=test_123" \
  -F "userId=user_123" \
  -F "caption=Test"
```

### 3. Test from Mobile App
- Open your app
- Try to post a reel
- Check console logs
- Video should upload to backend

---

## 🔍 Monitoring & Debugging

### Railway
- Dashboard → Your Project → Logs
- Real-time logs available

### Render
- Dashboard → Your Service → Logs
- Recent logs visible

### DigitalOcean Droplet
```bash
ssh root@your-droplet-ip
pm2 logs jorvea-backend
```

### Check if Backend is Running
```bash
curl https://your-backend-url.com/stats
```

---

## 🐛 Common Issues

### Issue: "Cannot connect to backend"
**Solution**: 
- Check backend URL in mobile app
- Verify backend is running: `curl https://your-backend-url.com/health`
- Check firewall settings

### Issue: "FFmpeg not found"
**Solution**:
- On Railway/Render: Use Dockerfile (already configured)
- On Droplet: Run `apt install ffmpeg`

### Issue: "Upload failed"
**Solution**:
- Check DigitalOcean credentials in .env
- Verify bucket permissions (public-read)
- Check CORS settings

### Issue: "Request timeout"
**Solution**:
- Video may be too large
- Increase timeout in mobile app
- Use video compression first

---

## 💡 Recommended Setup

**For Development/Testing**:
- Use Railway (FREE, instant deployment)

**For Production**:
- Use DigitalOcean Droplet ($5/month)
- Same provider as your storage
- Best performance
- Full control

---

## 📊 What Happens When You Deploy

1. **User posts reel** → Mobile app compresses video
2. **Upload to backend** → Video sent to your server
3. **Backend converts** → FFmpeg creates HLS (1080p, 720p, 480p)
4. **Upload to DigitalOcean** → All HLS files uploaded
5. **Notification sent** → User gets "Reel posted!" notification
6. **Video plays** → Adaptive streaming based on network speed

---

## 🎉 You're Done!

Choose one of the options above and deploy your backend!

**Quick Recommendation**:
1. Start with **Railway** (easiest, FREE)
2. Test everything works
3. Later migrate to **DigitalOcean Droplet** (best performance)

Questions? Check the logs or test the health endpoint!
