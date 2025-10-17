# ⚡ QUICK START GUIDE - Get Running in 15 Minutes!

## 🎯 Goal
Get your HLS video system working in 15 minutes!

---

## ✅ STEP 1: Install FFmpeg (5 minutes)

### Windows (PowerShell as Admin):
```powershell
# Option A: Using Chocolatey (recommended)
choco install ffmpeg

# Option B: Manual download
# 1. Download: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full.7z
# 2. Extract to C:\ffmpeg
# 3. Add C:\ffmpeg\bin to PATH
# 4. Restart terminal
```

### Verify Installation:
```bash
ffmpeg -version
```

Should show FFmpeg version info.

---

## ✅ STEP 2: Install Backend Dependencies (2 minutes)

```bash
cd "d:\Master Jorvea\JorveaNew\Jorvea\jorvea-backend"
npm install
```

---

## ✅ STEP 3: Test Backend Locally (1 minute)

```bash
npm start
```

Open browser: http://localhost:3000/health

Should see:
```json
{"status":"ok","ffmpeg":"ready"}
```

Press Ctrl+C to stop.

---

## ✅ STEP 4: Deploy to Railway (5 minutes)

### 4a. Create Railway Account
1. Go to: https://railway.app
2. Click "Login" → Sign up with GitHub
3. Authorize Railway

### 4b. Create New Project
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Choose your repository
4. Select the directory: `jorvea-backend`

### 4c. Add Environment Variables
1. In Railway dashboard, go to "Variables" tab
2. Click "Add Variable" for each:
   ```
   DO_SPACES_ENDPOINT = blr1.digitaloceanspaces.com
   DO_SPACES_BUCKET = jorvea
   DO_SPACES_ACCESS_KEY = DO801XPFLWMJLWB62XBX
   DO_SPACES_SECRET_KEY = abGOCo+yDJkU4pzWxArmxAPZjo84IGg6d4k3c9rM2WQ
   DO_SPACES_REGION = blr1
   DO_SPACES_CDN_URL = https://jorvea.blr1.cdn.digitaloceanspaces.com
   ```
3. Click "Deploy"

### 4d. Get Your URL
1. Wait 2-3 minutes for deployment
2. Click "Generate Domain"
3. Copy your URL: `https://your-app-name.up.railway.app`

### 4e. Test Deployment
```bash
curl https://your-app-name.up.railway.app/health
```

Should return: `{"status":"ok","ffmpeg":"ready"}`

---

## ✅ STEP 5: Update Mobile App (2 minutes)

### 5a. Open File
Open: `d:\Master Jorvea\JorveaNew\Jorvea\src\services\BackgroundVideoProcessor.ts`

### 5b. Find Line ~255
Look for:
```typescript
const BACKEND_URL = 'http://localhost:3000'; // ⚠️ CHANGE THIS!
```

### 5c. Replace with Your Railway URL
```typescript
const BACKEND_URL = 'https://your-app-name.up.railway.app';
```

Save the file (Ctrl+S).

---

## ✅ STEP 6: Rebuild Mobile App (2 minutes)

```bash
cd "d:\Master Jorvea\JorveaNew\Jorvea"
npm run android
```

Wait for build to complete.

---

## ✅ STEP 7: TEST! (2 minutes)

1. **Open app on your device**
2. **Create a new reel**:
   - Tap "+" button
   - Select a video
   - Add caption
   - Tap "Post"
3. **Watch the magic**:
   - You'll see "Uploading Video..." notification
   - Video uploads to backend
   - You can continue using the app immediately!
   - After 1-2 minutes, you'll get "🎉 Reel Posted!" notification
   - Video will appear in feed with adaptive streaming!

---

## 🎉 DONE!

Your HLS video system is now LIVE!

### What You Have:
- ✅ Videos convert to HLS (1080p, 720p, 480p)
- ✅ Adaptive streaming (quality adjusts to network)
- ✅ Background processing (no waiting)
- ✅ Push notifications
- ✅ Professional video streaming!

---

## 🐛 Quick Troubleshooting

### App says "Cannot connect to backend"
**Fix**: Check BACKEND_URL in BackgroundVideoProcessor.ts matches your Railway URL

### Backend health check fails
**Fix**: 
1. Check Railway dashboard for errors
2. Verify environment variables are set
3. Check deployment logs

### Video upload works but no HLS
**Fix**:
1. Check Railway logs: Dashboard → Your Project → Logs
2. Look for FFmpeg errors
3. Verify FFmpeg is installed (should be automatic in Railway)

### Still not working?
1. Read `jorvea-backend/DEPLOYMENT.md` for detailed troubleshooting
2. Check Railway logs for specific errors
3. Test backend locally first: `npm start`

---

## 📊 Monitor Your Backend

### Railway Dashboard:
- View real-time logs
- See CPU/Memory usage
- Check deployment status
- View error messages

### From Terminal:
```bash
# Test health
curl https://your-app-name.up.railway.app/health

# Test stats
curl https://your-app-name.up.railway.app/stats
```

---

## 💰 Cost

**Railway FREE tier includes**:
- 500 hours/month
- 100GB bandwidth
- Perfect for testing!

**After free tier**:
- $5/month for unlimited
- Still very affordable!

---

## 🎯 Next Steps

**Now that it's working**:
1. ✅ Test with different video sizes
2. ✅ Test network quality switching
3. ✅ Monitor backend logs
4. ✅ Show off your app! 🎉

**Later enhancements**:
- Add Firebase push notifications
- Set up custom domain
- Move to DigitalOcean Droplet (better performance)
- Add analytics

---

## 📚 More Information

- **Full Documentation**: `jorvea-backend/README.md`
- **Deployment Options**: `jorvea-backend/DEPLOYMENT.md`
- **Complete Solution**: `COMPLETE_HLS_SOLUTION.md`

---

## 🎊 Congratulations!

You now have a professional-grade video streaming system!

**Total time**: 15 minutes
**Cost**: FREE (Railway)
**Result**: Instagram-level video quality! 🚀

Enjoy your HLS adaptive streaming! 🎉
