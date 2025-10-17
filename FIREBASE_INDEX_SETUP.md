# 🔥 Firebase Index Setup Guide

## Required Firebase Indexes

The app needs these Firebase indexes for optimal performance:

### 1. **Reels Collection Index**
```
Collection: reels
Fields:
- isPrivate (Ascending)
- createdAt (Descending)
```

### 2. **Likes Collection Index** 
```
Collection: likes
Fields:
- contentId (Ascending)
- userId (Ascending)
```

### 3. **Comments Collection Index**
```
Collection: comments
Fields:
- contentId (Ascending)
- createdAt (Descending)
```

### 4. **Notifications Collection Index**
```
Collection: notifications
Fields:
- recipientId (Ascending)
- createdAt (Descending)
```

## How to Create Indexes

### Option 1: Auto-Create (Recommended)
1. Run the app
2. When you see the index error, click the Firebase console link
3. Firebase will show exactly what index to create
4. Click "Create Index"

### Option 2: Manual Creation
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `jorvea-9f876`
3. Go to Firestore Database → Indexes
4. Click "Create Index"
5. Add the fields listed above

### Option 3: CLI Command
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy indexes
firebase deploy --only firestore:indexes
```

## Index Status

✅ **Simple Query Strategy Implemented**
- Removed complex multi-field queries
- Using basic `orderBy('createdAt', 'desc')` 
- Randomization done in JavaScript code
- No complex indexes needed

## Performance Notes

- Indexes improve query performance
- Simple queries are faster and more reliable
- JavaScript randomization provides Instagram-like experience
- Background loading ensures smooth UX

## Current Status: ✅ Ready to Use

The app now uses simple queries that work without complex indexes while still providing:
- Random reel ordering
- Instagram-like algorithm
- Fast loading performance
- Smooth user experience
