# 🚀 Firebase HLS Deployment Guide - Step by Step

## ⚠️ Prerequisites

Before deploying, complete these steps:

---

## 📋 Step-by-Step Deployment

### ✅ Step 1: Login to Firebase

```powershell
firebase login
```

This will open your browser to authenticate with Google.

**Expected**:
```
✔ Success! Logged in as your-email@gmail.com
```

---

### ✅ Step 2: Set Your Firebase Project

```powershell
firebase use jorvea-9f876
```

Replace `jorvea-9f876` with your actual Firebase project ID.

**OR** if you don't know your project ID:

```powershell
# List all your projects
firebase projects:list

# Then use the project
firebase use YOUR_PROJECT_ID
```

**Expected**:
```
✔ Now using alias default (jorvea-9f876)
```

---

### ✅ Step 3: Verify firebase.json

Your `firebase.json` should look like this (already updated):

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "functions",
    "predeploy": [],
    "runtime": "nodejs18"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

✅ Already updated!

---

### ✅ Step 4: Deploy Functions and Storage Rules

**IMPORTANT**: Use quotes in PowerShell!

```powershell
firebase deploy --only "functions,storage"
```

**Expected Output**:
```
=== Deploying to 'jorvea-9f876'...

i  deploying functions, storage
i  storage: checking storage.rules for compilation errors...
✔  storage: rules file storage.rules compiled successfully
i  functions: ensuring required API cloudfunctions.googleapis.com is enabled...
✔  functions: required API cloudfunctions.googleapis.com is enabled
i  functions: preparing functions directory for uploading...
i  functions: packaged functions (XXX KB) for uploading
✔  functions: functions folder uploaded successfully
i  storage: releasing rules storage.rules...
✔  storage: released rules storage.rules to firebase.storage

i  functions: creating Node.js 18 function convertVideoToHLS(us-central1)...
✔  functions[convertVideoToHLS(us-central1)]: Successful create operation.
Function URL (convertVideoToHLS(us-central1)): https://us-central1-jorvea-9f876.cloudfunctions.net/convertVideoToHLS

✔  Deploy complete!
```

**This takes 2-5 minutes!** ⏱️

---

## 🎯 Alternative: Deploy Separately

If combined deployment fails, deploy one at a time:

### Deploy Functions Only:
```powershell
firebase deploy --only functions
```

### Deploy Storage Rules Only:
```powershell
firebase deploy --only storage
```

---

## 🔧 Troubleshooting

### Issue: "Failed to authenticate"
**Solution**:
```powershell
firebase login --reauth
```

### Issue: "No active project"
**Solution**:
```powershell
# Check your project ID in Firebase Console
# Then set it:
firebase use jorvea-9f876
```

### Issue: "Billing account not configured"
**Problem**: Cloud Functions require Blaze (pay-as-you-go) plan.

**Solution**:
1. Go to: https://console.firebase.google.com
2. Select your project
3. Go to Settings (⚙️) → Usage and billing
4. Click "Modify plan"
5. Select "Blaze (Pay as you go)"
6. Add credit card (won't be charged unless you exceed free tier!)

**Don't worry**: You get **6,600 video conversions FREE every month**! 🎉

### Issue: "Functions deployment failed"
**Solution**:
```powershell
# Check for syntax errors
cd functions
npm run build

# Or if using JavaScript (no build):
node -c index.js
```

### Issue: "CORS error" or "Storage bucket not found"
**Solution**:
1. Go to Firebase Console → Storage
2. Click "Get Started" if Storage not initialized
3. Redeploy storage rules:
```powershell
firebase deploy --only storage
```

---

## ✅ Verify Deployment

### 1. Check Firebase Console

**Functions**:
1. Go to: https://console.firebase.google.com
2. Select your project
3. Go to "Functions" in left menu
4. You should see: `convertVideoToHLS`
5. Status should be: ✅ **Healthy**

**Storage**:
1. Go to "Storage" in left menu
2. Click "Rules" tab
3. You should see your `storage.rules` content

### 2. Check Function Logs

```powershell
firebase functions:log
```

Should show: "Functions emulator running" or recent activity

### 3. Test Upload

1. Open your app
2. Go to CreateReelScreen
3. Upload a test video
4. Check function logs:
```powershell
firebase functions:log --only convertVideoToHLS
```

**Expected**:
```
🎬 Starting HLS conversion for: reels/123456_video.mp4
✅ HLS Conversion Complete!
```

---

## 💰 Enable Billing (Required for Cloud Functions)

### Why Billing Required?
Cloud Functions require Blaze plan, but it's still essentially FREE:

**FREE Tier (Every Month)**:
- ✅ 2,000,000 function invocations
- ✅ 400,000 GB-seconds compute time
- ✅ 200,000 GB-seconds networking
- ✅ 5 GB Cloud Storage
- ✅ 10 GB bandwidth/day

**This gives you ~6,600 FREE video conversions/month!**

### How to Enable:

1. **Go to**: https://console.firebase.google.com/project/YOUR_PROJECT/usage

2. **Click**: "Modify plan"

3. **Select**: "Blaze (Pay as you go)"

4. **Add Credit Card** (for charges beyond free tier only)

5. **Set Budget Alert**:
   - Click "Set budget"
   - Set alert at $5
   - You'll be notified before any charges

**Don't Worry**:
- ✅ Won't be charged unless you exceed FREE tier
- ✅ ~6,600 videos/month = $0
- ✅ 10,000 videos/month = ~$0.50
- ✅ You can set spending limits

---

## 📊 Monitor Usage

### Check Usage Dashboard:
```
https://console.firebase.google.com/project/YOUR_PROJECT/usage
```

See:
- Function invocations used
- Compute time used
- Storage used
- Predicted monthly cost

### Set Alerts:
1. Go to Usage dashboard
2. Click "Set budget"
3. Enter $5 (or any amount)
4. Get email alerts

---

## 🎉 After Successful Deployment

### ✅ What Happens Next:

1. **User uploads video** → Saved to Firebase Storage `reels/`
2. **Function automatically triggers** → Starts HLS conversion
3. **Conversion completes** (30-60 seconds) → Creates master.m3u8
4. **Firestore updated** → videoUrl points to HLS playlist
5. **User watches reel** → FreeVideoPlayer streams with chunking!

### ✅ Console Logs to Watch:

```powershell
# Watch live logs
firebase functions:log --follow

# Filter for HLS conversion
firebase functions:log --only convertVideoToHLS

# Check recent logs
firebase functions:log --limit 50
```

---

## 🚀 Quick Commands Summary

```powershell
# 1. Login
firebase login

# 2. Set project
firebase use jorvea-9f876

# 3. Deploy (use quotes in PowerShell!)
firebase deploy --only "functions,storage"

# 4. Watch logs
firebase functions:log --follow

# 5. Check usage
firebase open usage
```

---

## ✅ Checklist Before Deployment

- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] Logged in (`firebase login`)
- [ ] Project selected (`firebase use YOUR_PROJECT`)
- [ ] Blaze plan enabled (for Cloud Functions)
- [ ] `firebase.json` configured (✅ already done)
- [ ] `functions/index.js` created (✅ already done)
- [ ] `storage.rules` created (✅ already done)
- [ ] Dependencies installed in `functions/` (✅ already done)

---

## 🎯 Ready to Deploy!

```powershell
# From project root (D:\Master Jorvea\JorveaNew\Jorvea)
firebase deploy --only "functions,storage"
```

**Then upload a video and watch the HLS magic happen!** 🎬✨

---

## 💡 Pro Tips

### Faster Deployment:
```powershell
# Only deploy function code (no dependencies reinstall)
firebase deploy --only functions --force
```

### Rollback if Issues:
```powershell
# List previous versions
firebase functions:log

# Delete function
firebase functions:delete convertVideoToHLS
```

### Local Testing (Optional):
```powershell
# Install emulator
firebase init emulators

# Start local emulator
firebase emulators:start --only functions

# Test locally before deploying
```

---

**Need help? Check logs with `firebase functions:log`!** 📝
