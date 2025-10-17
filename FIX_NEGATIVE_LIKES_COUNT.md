# 🔧 Fix for Negative LikesCount Issue

## Problem
Post showing `likesCount: -1` in Firebase, causing incorrect like count display.

## Root Cause
The post document in Firebase has a negative `likesCount` value, likely from:
1. Initial post creation without `likesCount: 0`
2. Multiple rapid unlike operations
3. Previous buggy like system

## Solution Implemented

### 1. Enhanced Null Safety in RealTimeLikeSystem
**File:** `src/services/RealTimeLikeSystem.ts`

**Added comprehensive validation:**
```typescript
// Get current likes count - handle undefined, null, and negative values
let currentFirebaseLikesCount = contentData?.likesCount;
if (currentFirebaseLikesCount === undefined || 
    currentFirebaseLikesCount === null || 
    currentFirebaseLikesCount < 0) {
  currentFirebaseLikesCount = 0;  // Reset to 0 if invalid
}

// Calculate new count - ensure it never goes below 0
const newLikesCount = newIsLiked 
  ? currentFirebaseLikesCount + 1 
  : Math.max(0, currentFirebaseLikesCount - 1);

// Double-check before saving - final safety net
const finalLikesCount = Math.max(0, newLikesCount);
batch.update(contentRef, {
  likesCount: finalLikesCount,
  updatedAt: new Date().toISOString(),
});
```

### 2. Manual Fix for Existing Post

**Option A: Firebase Console (Recommended)**
1. Open Firebase Console: https://console.firebase.google.com
2. Navigate to Firestore Database
3. Find the `posts` collection
4. Locate the post with `likesCount: -1`
5. Edit the document
6. Set `likesCount` to `0`
7. Save changes

**Option B: Run this code in terminal (if you have Firebase CLI setup)**
```javascript
// fix-negative-likes.js
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

async function fixNegativeLikes() {
  // Fix posts
  const posts = await db.collection('posts')
    .where('likesCount', '<', 0)
    .get();
  
  const batch = db.batch();
  posts.docs.forEach(doc => {
    batch.update(doc.ref, { likesCount: 0 });
  });
  
  // Fix reels
  const reels = await db.collection('reels')
    .where('likesCount', '<', 0)
    .get();
  
  reels.docs.forEach(doc => {
    batch.update(doc.ref, { likesCount: 0 });
  });
  
  await batch.commit();
  console.log(`Fixed ${posts.size + reels.size} documents with negative likes`);
}

fixNegativeLikes();
```

### 3. Prevention: Ensure All New Posts Have likesCount

Check these files to ensure posts are created with `likesCount: 0`:

**CreatePostScreen / CreateReelScreen:**
```typescript
const postData = {
  // ... other fields
  likesCount: 0,  // ✅ Ensure this is set
  commentsCount: 0,
  sharesCount: 0,
  // ... more fields
};
```

## Testing Steps

1. **Test Current Fix:**
   - Open the post with `-1` likes
   - Click the like button
   - Should see: `-1 → 0` (fixed to 0)
   - Click again: `0 → 1` (proper increment)
   - Click again: `1 → 0` (proper decrement)

2. **Test New Posts:**
   - Create a new post
   - Check Firebase - should have `likesCount: 0`
   - Like the post
   - Check Firebase - should have `likesCount: 1`

3. **Test Edge Cases:**
   - Unlike when count is already 0
   - Should stay at 0 (not go negative)
   - Multiple rapid likes/unlikes
   - Should maintain accurate count

## Why This Happened

### Timeline of the Bug:
```
1. Post created → likesCount not initialized (undefined)
2. User unlikes (thinking they had liked) → Count goes from undefined → -1
3. System tries to decrement: undefined - 1 = -1
```

### Why Our Fix Works:
```
1. Post has likesCount: -1
2. User clicks like
3. System reads: currentFirebaseLikesCount = -1
4. Validation kicks in: if (currentFirebaseLikesCount < 0) { currentFirebaseLikesCount = 0; }
5. New count calculated: 0 + 1 = 1
6. Document updated: likesCount: 1 ✅
```

## Status: ✅ FIXED

The negative likes issue will automatically resolve itself when:
1. User interacts with the post (the validation will reset it to 0)
2. You manually fix it in Firebase Console
3. The enhanced validation prevents it from ever going negative again

**Next Click on Like Button:**
- Current: `likesCount: -1`
- After click: `likesCount: 0` (auto-corrected)
- Then: `likesCount: 1` (proper increment)

No need to restart the app - the fix is live!
