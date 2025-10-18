# 🔥 Firebase Manual Configuration Guide

**Date:** October 18, 2025  
**Purpose:** Manual steps to fix Firebase permission errors and add required indexes

---

## 🚨 Issues Fixed

### 1. ✅ Story Permission Error
**Error:** `[firestore/permission-denied] The caller does not have permission to execute the specified operation`

**Fixed In Code:** `firestore.rules` (line 94)

### 2. ✅ Story Video Upload Error  
**Fixed In Code:** `firebaseService.ts` - Now uploads to Firebase Storage

### 3. ✅ Create Reel Caption Crash
**Fixed In Code:** `CreateReelScreen.tsx` - Added null safety for caption

---

## 📋 Manual Firebase Console Steps

### Step 1: Update Firestore Security Rules

1. **Go to Firebase Console**
   - Open: https://console.firebase.google.com/
   - Select your project: **jorvea-9f876**

2. **Navigate to Firestore Rules**
   - Click **Firestore Database** in left menu
   - Click **Rules** tab at the top

3. **Update Stories Rule**
   
   Find this section (around line 87-95):
   ```javascript
   // Stories collection - ENHANCED
   match /stories/{storyId} {
     allow read: if true; // Anyone can read stories
     allow write: if request.auth != null && request.auth.uid == resource.data.userId;
     allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
     allow update: if request.auth != null && (
       request.auth.uid == resource.data.userId || // Story owner
       request.resource.data.diff(resource.data).affectedKeys().hasOnly(['viewsCount', 'viewers', 'likesCount', 'views']) // OLD - Missing viewedBy
     );
     allow delete: if request.auth != null && request.auth.uid == resource.data.userId;
   ```

   **Change line 94 to:**
   ```javascript
       request.resource.data.diff(resource.data).affectedKeys().hasOnly(['viewsCount', 'viewers', 'viewedBy', 'likesCount', 'views']) // ✅ FIXED: Added viewedBy
   ```

4. **Click "Publish"** button to deploy the rules

---

### Step 2: Add Required Firestore Indexes

Firebase requires composite indexes for certain queries. Here are the indexes needed:

#### **Index 1: Stories by userId and createdAt**

1. Go to **Firestore Database** → **Indexes** tab
2. Click **Create Index**
3. Configure:
   - **Collection ID:** `stories`
   - **Fields to index:**
     * Field: `userId` | Order: `Ascending`
     * Field: `createdAt` | Order: `Descending`
   - **Query scope:** Collection
4. Click **Create**

#### **Index 2: Reels by userId and createdAt**

1. Click **Create Index**
2. Configure:
   - **Collection ID:** `reels`
   - **Fields to index:**
     * Field: `userId` | Order: `Ascending`
     * Field: `createdAt` | Order: `Descending`
   - **Query scope:** Collection
3. Click **Create**

#### **Index 3: Posts by userId and createdAt**

1. Click **Create Index**
2. Configure:
   - **Collection ID:** `posts`
   - **Fields to index:**
     * Field: `userId` | Order: `Ascending`
     * Field: `createdAt` | Order: `Descending`
   - **Query scope:** Collection
3. Click **Create**

#### **Index 4: Likes by userId and type**

1. Click **Create Index**
2. Configure:
   - **Collection ID:** `likes`
   - **Fields to index:**
     * Field: `userId` | Order: `Ascending`
     * Field: `type` | Order: `Ascending`
   - **Query scope:** Collection
3. Click **Create**

#### **Index 5: Follows by followerId**

1. Click **Create Index**
2. Configure:
   - **Collection ID:** `follows`
   - **Fields to index:**
     * Field: `followerId` | Order: `Ascending`
     * Field: `createdAt` | Order: `Descending` (optional, for sorting)
   - **Query scope:** Collection
3. Click **Create**

---

### Step 3: Verify Firebase Storage Rules

1. **Navigate to Storage**
   - Click **Storage** in left menu
   - Click **Rules** tab

2. **Verify Rules Allow Story Uploads**
   
   Your storage rules should look like this:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       // Allow authenticated users to upload to their own folders
       match /images/{userId}/{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null && request.auth.uid == userId;
       }
       
       match /videos/{userId}/{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null && request.auth.uid == userId;
       }
       
       // Story uploads
       match /stories/{userId}/{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null && request.auth.uid == userId;
       }
       
       // Reel uploads
       match /reels/{userId}/{allPaths=**} {
         allow read: if true;
         allow write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

3. **Click "Publish"** if you made changes

---

## 🔍 How to Find Index Creation Links from Error Messages

When you see an error like:
```
The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/jorvea-9f876/firestore/indexes?create_composite=...
```

**Simply click the URL** in the error message! Firebase automatically generates the exact index configuration you need.

**Steps:**
1. Copy the full URL from the error
2. Paste it in your browser
3. Click "Create Index"
4. Wait 2-5 minutes for index to build

---

## ✅ Verification Steps

### Test Story Viewing
1. Open app
2. Create a story (photo or video)
3. View someone else's story
4. Check console - should NOT see permission errors

### Test Story Video Upload
1. Create a video story
2. Watch upload progress
3. View story on another account/device
4. Video should play correctly

### Test Create Reel with Caption
1. Go to Create Reel screen
2. Select a video
3. Click "Add Caption"
4. Type a caption
5. Click "Share" or "Next"
6. App should NOT crash

---

## 📊 Index Build Times

| Index | Typical Build Time |
|-------|-------------------|
| Stories (userId + createdAt) | 2-3 minutes |
| Reels (userId + createdAt) | 2-3 minutes |
| Posts (userId + createdAt) | 2-3 minutes |
| Likes (userId + type) | 1-2 minutes |
| Follows (followerId) | 1-2 minutes |

**Total time:** ~10-15 minutes for all indexes

---

## 🚨 Common Issues & Solutions

### Issue: "Index already exists"
**Solution:** Skip that index, it's already created

### Issue: "Collection doesn't exist"
**Solution:** Create at least one document in that collection first, then create the index

### Issue: "Index creation failed"
**Solution:**  
1. Check you're signed in to correct Firebase project
2. Verify you have owner/editor permissions
3. Try refreshing the page and creating again

### Issue: Story still shows "Failed to load"
**Solution:**
1. Check Firebase Storage rules (Step 3 above)
2. Verify video uploaded to Firebase Storage (check Storage tab)
3. Check video URL in Firestore document
4. Ensure CDN URLs are accessible (try opening in browser)

---

## 🎯 Quick Checklist

- [ ] Updated Firestore Rules (added `viewedBy` to stories)
- [ ] Published Firestore Rules
- [ ] Created Index: stories (userId + createdAt)
- [ ] Created Index: reels (userId + createdAt)  
- [ ] Created Index: posts (userId + createdAt)
- [ ] Created Index: likes (userId + type)
- [ ] Created Index: follows (followerId)
- [ ] Verified Storage Rules allow story uploads
- [ ] Tested story viewing (no permission errors)
- [ ] Tested story video upload and playback
- [ ] Tested create reel with caption (no crash)

---

## 📞 Support

If you encounter issues:

1. **Check Firebase Console Logs:**
   - Go to Firebase Console → Functions → Logs
   - Look for error messages

2. **Check App Console:**
   - Look for red error messages
   - Copy full error text

3. **Index Creation:**
   - Always use the URL from error messages
   - Wait 2-5 minutes after creation
   - Refresh app after indexes are ready

---

## 🎉 Success Indicators

✅ **Stories Work Perfectly:**
- No permission denied errors
- Views count increments
- viewedBy array updates
- Story videos play on all devices

✅ **Reels Work Perfectly:**
- Caption saves correctly
- No crash when clicking Next
- Background upload starts
- Notifications work

✅ **No Index Errors:**
- All queries run smoothly
- No "requires an index" errors
- Feed loads instantly

---

**Status:** All fixes implemented in code ✅  
**Manual Steps:** Follow this guide for Firebase Console ✅  
**Estimated Time:** 15-20 minutes total ✅
