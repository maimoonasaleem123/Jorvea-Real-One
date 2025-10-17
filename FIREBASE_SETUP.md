# Firebase Setup Instructions

## Firebase Firestore Indexes Setup

The chat system requires composite indexes in Firestore. Follow these steps:

### 1. Firebase CLI Setup (if not already done)
```bash
npm install -g firebase-tools
firebase login
firebase init
```

### 2. Deploy Indexes
```bash
firebase deploy --only firestore:indexes
```

### 3. Manual Index Creation (Alternative)
If you prefer to create indexes manually in the Firebase Console:

1. Go to https://console.firebase.google.com
2. Select your project
3. Navigate to Firestore Database > Indexes
4. Create the following composite indexes:

#### For Messages Collection:
- **Index 1**: chatId (Ascending) + createdAt (Ascending)
- **Index 2**: chatId (Ascending) + createdAt (Descending) 
- **Index 3**: chatId (Ascending) + readBy (Array-contains)

#### For CallLogs Collection:
- **Index 4**: chatId (Ascending) + createdAt (Descending)

### 4. Index URLs (from Console)
When you see index requirement errors in the app logs, Firebase will provide direct URLs to create the needed indexes. Click these URLs to automatically create the required indexes.

## Error Resolution Status

✅ **Fixed undefined field value errors in:**
- Comment creation (CommentsScreen)
- Message sending (FirebaseService.sendMessage)
- Call log creation (FirebaseService.createCallLog)

✅ **Fixed placeholder username issues:**
- Removed sample post creation from HomeScreen
- Enhanced username display with proper fallbacks

🔄 **Pending:**
- Firebase index deployment (requires authentication)
- Testing complete chat system functionality

## Next Steps
1. Authenticate Firebase CLI: `firebase login`
2. Deploy indexes: `firebase deploy --only firestore:indexes`
3. Test chat system functionality
4. Verify all social media features work properly
