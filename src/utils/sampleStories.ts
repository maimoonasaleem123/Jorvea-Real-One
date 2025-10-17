// Sample Stories for Testing - Dynamic Content
// This file creates realistic sample stories that work with our Firebase service

import FirebaseService from '../services/firebaseService';

export const createSampleStories = async () => {
  try {
    console.log('Creating sample stories for testing...');

    // Sample story data with real image URLs
    const sampleStories = [
      {
        mediaUri: 'https://picsum.photos/1080/1920/1',
        mediaType: 'photo' as const,
        caption: 'Beautiful sunset at the beach 🌅',
        userId: 'sample_user_1',
      },
      {
        mediaUri: 'https://picsum.photos/1080/1920/2',
        mediaType: 'photo' as const,
        caption: 'Coffee time ☕ #MorningVibes',
        userId: 'sample_user_2',
      },
      {
        mediaUri: 'https://picsum.photos/1080/1920/3',
        mediaType: 'photo' as const,
        caption: 'Weekend adventures! 🏔️',
        userId: 'sample_user_3',
      },
      {
        mediaUri: 'https://picsum.photos/1080/1920/4',
        mediaType: 'photo' as const,
        caption: 'Good food, good mood 🍕',
        userId: 'sample_user_4',
      },
      {
        mediaUri: 'https://picsum.photos/1080/1920/5',
        mediaType: 'photo' as const,
        caption: 'City lights tonight ✨',
        userId: 'sample_user_5',
      },
    ];

    // Create stories with proper Firebase integration
    for (const story of sampleStories) {
      try {
        const storyId = await FirebaseService.createStory(story);
        console.log(`Created sample story: ${storyId}`);
      } catch (error) {
        console.error('Error creating sample story:', error);
      }
    }

    console.log('Sample stories created successfully!');
  } catch (error) {
    console.error('Error creating sample stories:', error);
  }
};

// Helper function to get stories with proper viewing state
export const getStoriesWithViewingState = async (currentUserId: string) => {
  try {
    const stories = await FirebaseService.getStories();
    
    // Map stories with proper viewing state
    return stories.map(story => ({
      ...story,
      isViewed: story.viewedBy?.includes(currentUserId) || false,
    }));
  } catch (error) {
    console.error('Error fetching stories with viewing state:', error);
    return [];
  }
};

// Test function to simulate story viewing
export const testStoryViewing = async (storyId: string, userId: string) => {
  try {
    await FirebaseService.markStoryAsViewed(storyId, userId);
    console.log(`Story ${storyId} marked as viewed by ${userId}`);
  } catch (error) {
    console.error('Error marking story as viewed:', error);
  }
};

export default {
  createSampleStories,
  getStoriesWithViewingState,
  testStoryViewing,
};
