/**
 * FollowersDebugService - Debug followers/following count issues
 */

import firestore from '@react-native-firebase/firestore';

class FollowersDebugService {
  /**
   * Debug followers count for a specific user
   */
  static async debugFollowersCount(userId: string) {
    console.log('🔍 Debugging followers count for user:', userId);
    
    try {
      // Check user document
      const userDoc = await firestore().collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log('👤 User document data:');
        console.log('  - followersCount:', userData?.followersCount);
        console.log('  - followingCount:', userData?.followingCount);
        console.log('  - followers array:', userData?.followers?.length || 0);
        console.log('  - following array:', userData?.following?.length || 0);
      } else {
        console.log('❌ User document does not exist');
      }

      // Check followers subcollection under user
      try {
        const followersSubCol = await firestore()
          .collection('users')
          .doc(userId)
          .collection('followers')
          .get();
        console.log('📁 Followers subcollection size:', followersSubCol.size);
      } catch (error) {
        console.log('❌ Cannot access followers subcollection:', error.message);
      }

      // Check following subcollection under user
      try {
        const followingSubCol = await firestore()
          .collection('users')
          .doc(userId)
          .collection('following')
          .get();
        console.log('📁 Following subcollection size:', followingSubCol.size);
      } catch (error) {
        console.log('❌ Cannot access following subcollection:', error.message);
      }

      // Check global followers collection
      try {
        const globalFollowers = await firestore()
          .collection('followers')
          .where('followedUserId', '==', userId)
          .get();
        console.log('🌍 Global followers collection size:', globalFollowers.size);
        
        if (globalFollowers.size > 0) {
          console.log('📋 Followers list:');
          globalFollowers.forEach(doc => {
            const data = doc.data();
            console.log(`  - ${data.followerId} follows ${data.followedUserId}`);
          });
        }
      } catch (error) {
        console.log('❌ Cannot access global followers collection:', error.message);
      }

      // Check global following collection
      try {
        const globalFollowing = await firestore()
          .collection('following')
          .where('followerId', '==', userId)
          .get();
        console.log('🌍 Global following collection size:', globalFollowing.size);
        
        if (globalFollowing.size > 0) {
          console.log('📋 Following list:');
          globalFollowing.forEach(doc => {
            const data = doc.data();
            console.log(`  - ${data.followerId} follows ${data.followedUserId}`);
          });
        }
      } catch (error) {
        console.log('❌ Cannot access global following collection:', error.message);
      }

    } catch (error) {
      console.error('❌ Error debugging followers count:', error);
    }
  }

  /**
   * Fix followers count by updating user document from actual follow data
   */
  static async fixFollowersCount(userId: string) {
    console.log('🔧 Fixing followers count for user:', userId);
    
    try {
      let followersCount = 0;
      let followingCount = 0;
      const followers: string[] = [];
      const following: string[] = [];

      // Count from global followers collection
      try {
        const globalFollowers = await firestore()
          .collection('followers')
          .where('followedUserId', '==', userId)
          .get();
        followersCount = globalFollowers.size;
        globalFollowers.forEach(doc => {
          const data = doc.data();
          followers.push(data.followerId);
        });
      } catch (error) {
        console.log('Could not read global followers:', error.message);
      }

      // Count from global following collection
      try {
        const globalFollowing = await firestore()
          .collection('following')
          .where('followerId', '==', userId)
          .get();
        followingCount = globalFollowing.size;
        globalFollowing.forEach(doc => {
          const data = doc.data();
          following.push(data.followedUserId);
        });
      } catch (error) {
        console.log('Could not read global following:', error.message);
      }

      // Update user document with correct counts
      await firestore().collection('users').doc(userId).update({
        followersCount,
        followingCount,
        followers,
        following,
        updatedAt: firestore.FieldValue.serverTimestamp()
      });

      console.log('✅ Updated user document:');
      console.log(`  - followersCount: ${followersCount}`);
      console.log(`  - followingCount: ${followingCount}`);
      console.log(`  - followers array: ${followers.length}`);
      console.log(`  - following array: ${following.length}`);

      return { followersCount, followingCount, followers, following };

    } catch (error) {
      console.error('❌ Error fixing followers count:', error);
      throw error;
    }
  }

  /**
   * Create test followers for debugging
   */
  static async createTestFollowers(userId: string, testFollowerIds: string[]) {
    console.log('🧪 Creating test followers for user:', userId);
    
    try {
      const batch = firestore().batch();

      // Add to global followers collection
      testFollowerIds.forEach(followerId => {
        const followDoc = firestore().collection('followers').doc();
        batch.set(followDoc, {
          followerId,
          followedUserId: userId,
          createdAt: firestore.FieldValue.serverTimestamp()
        });

        const followingDoc = firestore().collection('following').doc();
        batch.set(followingDoc, {
          followerId,
          followedUserId: userId,
          createdAt: firestore.FieldValue.serverTimestamp()
        });
      });

      // Update both users' documents
      const userRef = firestore().collection('users').doc(userId);
      batch.update(userRef, {
        followersCount: firestore.FieldValue.increment(testFollowerIds.length),
        followers: firestore.FieldValue.arrayUnion(...testFollowerIds)
      });

      testFollowerIds.forEach(followerId => {
        const followerRef = firestore().collection('users').doc(followerId);
        batch.update(followerRef, {
          followingCount: firestore.FieldValue.increment(1),
          following: firestore.FieldValue.arrayUnion(userId)
        });
      });

      await batch.commit();
      console.log('✅ Test followers created successfully');

    } catch (error) {
      console.error('❌ Error creating test followers:', error);
      throw error;
    }
  }
}

export default FollowersDebugService;
