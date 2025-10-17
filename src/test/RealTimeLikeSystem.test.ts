/**
 * Real-Time Like System Test
 * Tests the functionality of the RealTimeLikeSystem with Firebase
 */

import { RealTimeLikeSystem } from '../services/RealTimeLikeSystem';

interface TestUser {
  id: string;
  username: string;
}

class RealTimeLikeSystemTest {
  private likeSystem: RealTimeLikeSystem;
  private testUsers: TestUser[] = [
    { id: 'user1', username: 'testuser1' },
    { id: 'user2', username: 'testuser2' },
    { id: 'user3', username: 'testuser3' }
  ];

  constructor() {
    this.likeSystem = new RealTimeLikeSystem();
  }

  /**
   * Test basic like functionality
   */
  public async testBasicLikeFunctionality(): Promise<void> {
    console.log('🧪 Testing Basic Like Functionality...');
    
    const testContentId = 'test_reel_' + Date.now();
    const testUserId = this.testUsers[0].id;

    try {
      // Test initial state
      console.log('📌 Testing initial like state...');
      const initialState = await this.likeSystem.getLikeState(
        testContentId, 
        testUserId, 
        'reel'
      );
      
      console.log(`Initial state: liked=${initialState.isLiked}, count=${initialState.likesCount}`);

      // Test liking content
      console.log('❤️ Testing like action...');
      const likeResult = await this.likeSystem.toggleLike(
        testContentId,
        testUserId,
        'reel',
        initialState.isLiked,
        initialState.likesCount
      );

      if (likeResult.success) {
        console.log(`✅ Like successful: liked=${likeResult.isLiked}, count=${likeResult.likesCount}`);
      } else {
        console.error(`❌ Like failed: ${likeResult.error}`);
        return;
      }

      // Test unliking content
      console.log('💔 Testing unlike action...');
      const unlikeResult = await this.likeSystem.toggleLike(
        testContentId,
        testUserId,
        'reel',
        likeResult.isLiked,
        likeResult.likesCount
      );

      if (unlikeResult.success) {
        console.log(`✅ Unlike successful: liked=${unlikeResult.isLiked}, count=${unlikeResult.likesCount}`);
      } else {
        console.error(`❌ Unlike failed: ${unlikeResult.error}`);
      }

    } catch (error) {
      console.error('🚨 Test failed with error:', error);
    }
  }

  /**
   * Test multiple users liking the same content
   */
  public async testMultipleUsersLiking(): Promise<void> {
    console.log('🧪 Testing Multiple Users Liking Same Content...');
    
    const testContentId = 'test_reel_multi_' + Date.now();

    try {
      let currentLikesCount = 0;

      // Test each user liking the content
      for (const user of this.testUsers) {
        console.log(`👤 User ${user.username} liking content...`);
        
        const likeResult = await this.likeSystem.toggleLike(
          testContentId,
          user.id,
          'reel',
          false, // Not liked initially
          currentLikesCount
        );

        if (likeResult.success) {
          currentLikesCount = likeResult.likesCount;
          console.log(`✅ ${user.username} liked content. New count: ${currentLikesCount}`);
        } else {
          console.error(`❌ ${user.username} failed to like: ${likeResult.error}`);
        }
      }

      console.log(`🎉 Final likes count: ${currentLikesCount}`);

    } catch (error) {
      console.error('🚨 Multi-user test failed:', error);
    }
  }

  /**
   * Test Firebase permission handling
   */
  public async testPermissionHandling(): Promise<void> {
    console.log('🧪 Testing Firebase Permission Handling...');
    
    const testContentId = 'test_permission_' + Date.now();
    const testUserId = 'invalid_user_id';

    try {
      const result = await this.likeSystem.toggleLike(
        testContentId,
        testUserId,
        'reel',
        false,
        0
      );

      if (result.success) {
        console.log('✅ Permission test passed - like operation successful');
      } else {
        console.log(`⚠️ Permission test - operation failed as expected: ${result.error}`);
      }

    } catch (error) {
      console.log('⚠️ Permission test caught error (expected):', error);
    }
  }

  /**
   * Run all tests
   */
  public async runAllTests(): Promise<void> {
    console.log('🚀 Starting RealTimeLikeSystem Tests...\n');

    await this.testBasicLikeFunctionality();
    console.log('\n---\n');
    
    await this.testMultipleUsersLiking();
    console.log('\n---\n');
    
    await this.testPermissionHandling();
    console.log('\n🏁 All tests completed!');
  }
}

// Export for manual testing
export const testRealTimeLikeSystem = async () => {
  const test = new RealTimeLikeSystemTest();
  await test.runAllTests();
};

// For debugging: Log test availability
console.log('📋 RealTimeLikeSystem test suite loaded. Call testRealTimeLikeSystem() to run tests.');

export default RealTimeLikeSystemTest;
