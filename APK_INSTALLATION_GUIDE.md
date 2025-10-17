# Jorvea APK Installation Guide

## ✅ APK Successfully Built!

**File Location:** `android\app\build\outputs\apk\release\app-release.apk`
**File Size:** ~107 MB
**Build Date:** August 16, 2025 5:01 PM

## 📱 How to Install the APK

### Method 1: Direct Installation on Android Device

1. **Transfer the APK to your Android device:**
   - Copy `app-release.apk` to your phone via USB, email, or cloud storage
   - Or use ADB: `adb install android\app\build\outputs\apk\release\app-release.apk`

2. **Enable Unknown Sources:**
   - Go to Settings > Security > Unknown Sources (Enable)
   - Or Settings > Apps > Special Access > Install Unknown Apps

3. **Install the APK:**
   - Open file manager on your phone
   - Navigate to the APK file
   - Tap on `app-release.apk`
   - Tap "Install"

### Method 2: ADB Installation (If device connected)

```powershell
# From project root directory
adb install android\app\build\outputs\apk\release\app-release.apk
```

### Method 3: Share via Cloud/Email

1. Upload `app-release.apk` to Google Drive, Dropbox, or email
2. Download on target device
3. Install as described in Method 1

## 🔧 Troubleshooting

### If installation fails:
- **"App not installed"**: Enable Unknown Sources
- **"Parse error"**: Ensure device supports Android API 24+ (Android 7.0+)
- **"Insufficient storage"**: Free up ~200MB space for installation

### If app crashes on startup:
- Check device has required permissions (Camera, Storage, Microphone)
- Ensure stable internet connection for Firebase services
- Try clearing app data and restarting

## 📋 App Requirements

- **Minimum Android Version:** Android 7.0 (API 24)
- **Target Android Version:** Android 14 (API 34)
- **Required Permissions:**
  - Camera (for photo/video capture)
  - Microphone (for video calls)
  - Storage (for saving media)
  - Location (for location features)
  - Contacts (for finding friends)

## 🔄 Updating the App

To build a new version:
```powershell
# Clean previous build
cd android
.\gradlew clean
cd ..

# Build new release APK
npm run build:release
```

## 📤 Distribution

This APK can be shared with:
- Beta testers
- Friends and family
- Internal team members

**Note:** For Play Store distribution, you'll need to:
1. Create a Google Play Console account
2. Generate a signed AAB (Android App Bundle)
3. Follow Play Store publishing guidelines

## 🔐 Security Note

This APK is signed with a debug keystore for testing. For production:
- Generate a production keystore
- Sign with production keys
- Enable ProGuard/R8 for code obfuscation
