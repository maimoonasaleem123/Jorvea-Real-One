import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Story } from '../services/firebaseService';
import { BeautifulCard } from './BeautifulCard';

const { width } = Dimensions.get('window');

// Rainbow border component for stories
const RainbowBorder: React.FC<{ 
  children: React.ReactNode; 
  size?: number; 
  hasStory?: boolean;
  isViewed?: boolean;
}> = ({ 
  children, 
  size = 64, 
  hasStory = false,
  isViewed = false
}) => {
  if (!hasStory) {
    return <>{children}</>;
  }

  const borderStyle = isViewed ? styles.viewedBorder : styles.rainbowBorder;

  return (
    <View style={[borderStyle, { width: size + 6, height: size + 6, borderRadius: (size + 6) / 2 }]}>
      <View style={[styles.rainbowInner, { width: size, height: size, borderRadius: size / 2 }]}>
        {children}
      </View>
    </View>
  );
};

interface GroupedStory {
  id: string;
  user: Story['user'];
  stories: Story[];
  hasViewed: boolean;
  hasUnviewed: boolean;
  totalStories: number;
}

interface StoryListProps {
  stories: Story[];
  currentUserId?: string;
  onCreateStory?: () => void;
  onViewStory?: (story: Story, groupedStories?: Story[]) => void;
  showCreateButton?: boolean;
}

export const StoryList: React.FC<StoryListProps> = ({
  stories,
  currentUserId,
  onCreateStory,
  onViewStory,
  showCreateButton = true,
}) => {
  // Group stories by user
  const groupStoriesByUser = (stories: Story[]): GroupedStory[] => {
    const grouped: { [userId: string]: GroupedStory } = {};
    
    stories.forEach(story => {
      if (story.id === 'your-story') {
        // Handle "Your Story" separately
        grouped['your-story'] = {
          id: 'your-story',
          user: story.user,
          stories: [story],
          hasViewed: false,
          hasUnviewed: false,
          totalStories: 1,
        };
        return;
      }

      const userId = story.user?.uid || story.id;
      if (!grouped[userId]) {
        grouped[userId] = {
          id: userId,
          user: story.user,
          stories: [],
          hasViewed: false,
          hasUnviewed: false,
          totalStories: 0,
        };
      }
      
      grouped[userId].stories.push(story);
      grouped[userId].totalStories = grouped[userId].stories.length;
      
      // Update viewed status
      if (story.isViewed) {
        grouped[userId].hasViewed = true;
      } else {
        grouped[userId].hasUnviewed = true;
      }
    });
    
    return Object.values(grouped);
  };

  const groupedStories = groupStoriesByUser(stories);

  const renderStoryItem = ({ item: groupedStory }: { item: GroupedStory }) => {
    const isYourStory = groupedStory.id === 'your-story';
    const hasValidMedia = groupedStory.stories.some(story => 
      story.mediaUrl && story.mediaUrl.trim() !== ''
    );
    const latestStory = groupedStory.stories[groupedStory.stories.length - 1];

    return (
      <TouchableOpacity
        style={styles.storyItem}
        onPress={() => {
          if (isYourStory) {
            onCreateStory?.();
          } else if (hasValidMedia) {
            onViewStory?.(latestStory, groupedStory.stories);
          } else {
            Alert.alert('No Story', 'This user has no active story to view.');
          }
        }}
      >
        <RainbowBorder 
          hasStory={!!(hasValidMedia)} 
          isViewed={groupedStory.hasViewed && !groupedStory.hasUnviewed}
          size={64}
        >
          <BeautifulCard
            style={StyleSheet.flatten([
              styles.storyImageContainer,
              isYourStory && styles.yourStoryContainer,
              hasValidMedia && !groupedStory.hasUnviewed && styles.viewedStoryContainer,
            ])}
          >
            {(groupedStory.user?.profilePicture || groupedStory.user?.photoURL) ? (
              <Image
                source={{ uri: groupedStory.user.profilePicture || groupedStory.user.photoURL }}
                style={styles.storyImage}
              />
            ) : (
              <View style={styles.defaultAvatar}>
                <Text style={styles.defaultAvatarText}>
                  {groupedStory.user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            
            {isYourStory && (
              <View style={styles.addStoryIcon}>
                <Icon name="add" size={16} color="#fff" />
              </View>
            )}
            
            {hasValidMedia && groupedStory.hasUnviewed && (
              <View style={styles.newStoryIndicator} />
            )}

            {/* Story count indicator for multiple stories */}
            {groupedStory.totalStories > 1 && !isYourStory && (
              <View style={styles.storyCountIndicator}>
                <Text style={styles.storyCountText}>{groupedStory.totalStories}</Text>
              </View>
            )}

            {/* Progress bars for multiple stories */}
            {groupedStory.totalStories > 1 && !isYourStory && (
              <View style={styles.storyProgressContainer}>
                {groupedStory.stories.map((story, index) => (
                  <View
                    key={story.id}
                    style={[
                      styles.storyProgressBar,
                      {
                        backgroundColor: story.isViewed ? '#666' : '#fff',
                        width: (56 - (groupedStory.totalStories - 1) * 2) / groupedStory.totalStories,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </BeautifulCard>
        </RainbowBorder>
        
        <Text style={styles.storyUsername} numberOfLines={1}>
          {isYourStory
            ? 'Your Story'
            : groupedStory.user?.username || groupedStory.user?.displayName || 'User'}
        </Text>
      </TouchableOpacity>
    );
  };

  if (groupedStories.length === 0 && !showCreateButton) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={groupedStories}
        renderItem={renderStoryItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesList}
      />
    </View>
  );
};

// Individual story item component for grid display
interface StoryGridItemProps {
  story: Story;
  onPress: () => void;
  size?: number;
}

export const StoryGridItem: React.FC<StoryGridItemProps> = ({
  story,
  onPress,
  size = 80,
}) => {
  return (
    <TouchableOpacity style={[styles.gridStoryItem, { width: size, height: size }]} onPress={onPress}>
      <BeautifulCard
        style={StyleSheet.flatten([
          styles.gridStoryContainer,
          { width: size, height: size },
          story.isViewed && styles.viewedStoryContainer,
        ])}
      >
        {story.mediaUrl ? (
          <Image source={{ uri: story.mediaUrl }} style={styles.gridStoryImage} />
        ) : (story.user?.profilePicture || story.user?.photoURL) ? (
          <Image source={{ uri: story.user.profilePicture || story.user.photoURL }} style={styles.gridStoryImage} />
        ) : (
          <View style={styles.defaultGridAvatar}>
            <Text style={styles.defaultGridAvatarText}>
              {story.user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
        )}
        
        {!story.isViewed && story.mediaUrl && (
          <View style={styles.newGridStoryIndicator} />
        )}
      </BeautifulCard>
      
      <View style={styles.gridStoryUserInfo}>
        <Image
          source={{ uri: story.user?.profilePicture || story.user?.photoURL }}
          style={styles.gridStoryUserAvatar}
        />
      </View>
    </TouchableOpacity>
  );
};

// Story highlights section for profile
interface StoryHighlightsProps {
  highlights: Story[][];
  onCreateHighlight?: () => void;
  onViewHighlight?: (highlight: Story[]) => void;
}

export const StoryHighlights: React.FC<StoryHighlightsProps> = ({
  highlights,
  onCreateHighlight,
  onViewHighlight,
}) => {
  const renderHighlight = ({ item: highlight, index }: { item: Story[]; index: number }) => {
    const coverStory = highlight[0];
    const isCreateButton = index === 0 && onCreateHighlight;

    return (
      <TouchableOpacity
        style={styles.highlightItem}
        onPress={() => {
          if (isCreateButton) {
            onCreateHighlight?.();
          } else {
            onViewHighlight?.(highlight);
          }
        }}
      >
        <BeautifulCard style={StyleSheet.flatten([styles.highlightContainer, isCreateButton && styles.createHighlightContainer])}>
          {isCreateButton ? (
            <Icon name="add" size={24} color="#666" />
          ) : coverStory?.mediaUrl ? (
            <Image source={{ uri: coverStory.mediaUrl }} style={styles.highlightImage} />
          ) : (
            <View style={styles.defaultHighlightAvatar}>
              <Text style={styles.defaultHighlightAvatarText}>
                {coverStory?.user?.displayName?.charAt(0)?.toUpperCase() || 'H'}
              </Text>
            </View>
          )}
        </BeautifulCard>
        <Text style={styles.highlightTitle} numberOfLines={1}>
          {isCreateButton ? 'New' : `Highlight ${index}`}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.highlightsContainer}>
      <Text style={styles.highlightsTitle}>Story Highlights</Text>
      <FlatList
        data={[[], ...highlights]} // Add empty array for create button
        renderItem={renderHighlight}
        keyExtractor={(_, index) => `highlight-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.highlightsList}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
  },
  storiesList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  storyItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  storyImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 2,
    marginBottom: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  yourStoryContainer: {
    backgroundColor: '#F2F2F7',
    borderWidth: 2,
    borderColor: '#E5E5E7',
    borderStyle: 'dashed',
  },
  viewedStoryContainer: {
    opacity: 0.6,
  },
  newStoryContainer: {
    borderWidth: 3,
    borderColor: 'transparent',
    // Using a rainbow gradient effect - Instagram style
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 3,
    elevation: 3,
    backgroundColor: '#fff',
    // Linear gradient colors for rainbow effect
    borderStyle: 'solid',
    position: 'relative',
  },
  storyImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  defaultAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  addStoryIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  newStoryIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: '#fff',
  },
  storyUsername: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
    fontWeight: '500',
  },
  
  // Grid story styles
  gridStoryItem: {
    margin: 4,
    position: 'relative',
  },
  gridStoryContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  gridStoryImage: {
    width: '100%',
    height: '100%',
  },
  defaultGridAvatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultGridAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  newGridStoryIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  gridStoryUserInfo: {
    position: 'absolute',
    bottom: 4,
    left: 4,
  },
  gridStoryUserAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fff',
  },
  
  // Highlights styles
  highlightsContainer: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  highlightsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  highlightsList: {
    paddingHorizontal: 16,
  },
  highlightItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 70,
  },
  highlightContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 6,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createHighlightContainer: {
    backgroundColor: '#F2F2F7',
    borderWidth: 2,
    borderColor: '#E5E5E7',
    borderStyle: 'dashed',
  },
  highlightImage: {
    width: '100%',
    height: '100%',
  },
  defaultHighlightAvatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultHighlightAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  highlightTitle: {
    fontSize: 12,
    color: '#000',
    textAlign: 'center',
    fontWeight: '500',
  },
  rainbowBorder: {
    backgroundColor: 'conic-gradient(from 0deg, #ff006e, #ff7700, #ffe900, #8fff00, #00ff91, #0091ff, #6a00ff, #ff006e)',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    // Simulate rainbow gradient with multiple shadows for better effect
    shadowColor: '#ff006e',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  viewedBorder: {
    backgroundColor: '#C7C7CC',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  rainbowInner: {
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  storyCountIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  storyCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  storyProgressContainer: {
    position: 'absolute',
    bottom: 2,
    left: 4,
    right: 4,
    flexDirection: 'row',
    gap: 2,
  },
  storyProgressBar: {
    height: 2,
    borderRadius: 1,
  },
});
