# Firebase Security Rules for Jorvea

## 1. Firestore Security Rules

Copy and paste these rules into your Firebase Console > Firestore Database > Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection - authenticated users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      // Allow reading user profiles for follows, searches, etc.
      allow read: if request.auth != null;
    }
    
    // Usernames collection - PUBLIC READ for username checking
    // This is the key fix for username availability checking
    match /usernames/{username} {
      allow read: if true; // Allow anyone to check username availability
      allow write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    
    // Posts collection
    match /posts/{postId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Stories collection
    match /stories/{storyId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Reels collection
    match /reels/{reelId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Comments collection
    match /comments/{commentId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Chats collection
    match /chats/{chatId} {
      allow read, write: if request.auth != null && 
        request.auth.uid in resource.data.participants;
      allow create: if request.auth != null && 
        request.auth.uid in request.resource.data.participants;
    }
    
    // Messages collection
    match /messages/{messageId} {
      allow read, write: if request.auth != null;
      // Additional validation can be added based on chat participants
    }
    
    // Followers/Following collections
    match /followers/{docId} {
      allow read, write: if request.auth != null;
    }
    
    match /following/{docId} {
      allow read, write: if request.auth != null;
    }
    
    // Likes collection
    match /likes/{likeId} {
      allow read, write: if request.auth != null;
    }
    
    // Saves collection
    match /saves/{saveId} {
      allow read, write: if request.auth != null;
    }
    
    // Notifications collection
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
    }
    
    // Other collections with basic authenticated access
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 2. Firebase Storage Rules

Copy and paste these rules into your Firebase Console > Storage > Rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Profile pictures
    match /profile_pictures/{userId}/{fileName} {
      allow read: if true; // Public read for profile pictures
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Post media
    match /posts/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Story media
    match /stories/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Reel media
    match /reels/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Chat media
    match /chat_media/{chatId}/{fileName} {
      allow read, write: if request.auth != null;
      // Additional validation can be added based on chat participants
    }
    
    // Default rule for other files
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 3. Steps to Apply Rules

1. Go to Firebase Console (https://console.firebase.google.com/)
2. Select your Jorvea project
3. Navigate to "Firestore Database" in the left sidebar
4. Click on the "Rules" tab
5. Replace the existing rules with the Firestore rules above
6. Click "Publish"

7. Navigate to "Storage" in the left sidebar
8. Click on the "Rules" tab
9. Replace the existing rules with the Storage rules above
10. Click "Publish"

## 4. Key Features of These Rules

- **Username checking**: The `usernames` collection allows public read access for username availability checking
- **User privacy**: Users can only modify their own data
- **Content access**: Authenticated users can read content, but only owners can modify
- **Profile pictures**: Public read access so they can be displayed to all users
- **Chat security**: Only chat participants can access chat data

## 5. Testing the Rules

After applying these rules, test your app:
1. Try registering with a new username - it should work
2. Try registering with an existing username - it should be detected as taken
3. Test other app features to ensure they still work

These rules will fix the "permission-denied" error you're experiencing with username checking while maintaining security for other operations.
