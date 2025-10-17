# 🔧 DigitalOcean FFmpeg Setup

## Issue
FFmpeg is not installed in the DigitalOcean container, causing video conversion to fail with:
```
Error: spawn ffprobe ENOENT
```

## Solution

### Files Added:
1. **Aptfile** - Tells DigitalOcean to install FFmpeg via apt
2. **install-ffmpeg.sh** - Manual installation script (backup)
3. **package.json** - Updated with build script

### DigitalOcean Configuration:

#### Option 1: Use Aptfile (Automatic - Recommended)
DigitalOcean's Node.js buildpack should automatically detect `Aptfile` and install packages.

**Aptfile contents:**
```
ffmpeg
```

#### Option 2: Manual Configuration
If Aptfile doesn't work, add this to your App Spec:

1. Go to DigitalOcean Dashboard
2. Your app → Settings → App Spec
3. Add `build_command`:

```yaml
services:
- name: jorvea-real-one-jorvea-backend2
  build_command: |
    npm install
    apt-get update && apt-get install -y ffmpeg
  run_command: npm start
```

#### Option 3: Use Dockerfile (Most Reliable)
If above options don't work, use the existing Dockerfile:

1. In App Settings, change:
   - **Resource Type**: Web Service
   - **Builder**: Dockerfile
   - **Dockerfile Path**: `/jorvea-backend/Dockerfile`

Our Dockerfile already includes FFmpeg installation!

## Verification

After deployment, check Runtime Logs for:
```
✅ FFmpeg installed successfully
✅ FFprobe installed successfully
```

Then test health endpoint:
```bash
curl https://jorvea-jgg3d.ondigitalocean.app/health
```

Should return:
```json
{
  "status": "ok",
  "ffmpeg": "ready"
}
```

## Next Steps

1. ✅ Code pushed to GitHub
2. ⏳ Wait for auto-redeploy (3-5 minutes)
3. ✅ Check Runtime Logs for FFmpeg installation
4. ✅ Test video upload again
