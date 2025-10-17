import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Animated,
  Image,
  TextInput,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import FirebaseService from '../services/firebaseService';

const { width, height } = Dimensions.get('window');

// Types for Dynamic Story Collaboration
interface CollaborativeStory {
  id: string;
  title: string;
  description: string;
  initiatorId: string;
  initiator: {
    username: string;
    profilePicture?: string;
    displayName: string;
  };
  collaborators: StoryCollaborator[];
  segments: StorySegment[];
  status: 'open' | 'active' | 'completed';
  maxCollaborators: number;
  category: 'adventure' | 'creative' | 'challenge' | 'daily' | 'mystery';
  timeLimit?: number; // hours
  createdAt: Date;
  completedAt?: Date;
  likes: number;
  views: number;
  isPublic: boolean;
}

interface StoryCollaborator {
  userId: string;
  username: string;
  profilePicture?: string;
  joinedAt: Date;
  contributionCount: number;
  role: 'contributor' | 'viewer' | 'moderator';
}

interface StorySegment {
  id: string;
  userId: string;
  username: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio';
  timestamp: Date;
  likes: number;
  reactions: StoryReaction[];
  orderIndex: number;
}

interface StoryReaction {
  userId: string;
  type: 'love' | 'laugh' | 'wow' | 'creative' | 'continue';
  timestamp: Date;
}

interface DynamicStoryCollaborationProps {
  visible: boolean;
  onClose: () => void;
  initialStory?: CollaborativeStory;
}

export const DynamicStoryCollaboration: React.FC<DynamicStoryCollaborationProps> = ({
  visible,
  onClose,
  initialStory,
}) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  
  const [stories, setStories] = useState<CollaborativeStory[]>([]);
  const [activeStory, setActiveStory] = useState<CollaborativeStory | null>(initialStory || null);
  const [viewMode, setViewMode] = useState<'discover' | 'create' | 'collaborate'>('discover');
  const [loading, setLoading] = useState(false);
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newStoryDescription, setNewStoryDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CollaborativeStory['category']>('adventure');
  const [newSegmentContent, setNewSegmentContent] = useState('');
  
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Animation effects
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Load collaborative stories
  useEffect(() => {
    if (visible) {
      loadCollaborativeStories();
    }
  }, [visible]);

  const loadCollaborativeStories = async () => {
    setLoading(true);
    try {
      // Mock data for now - replace with Firebase integration
      const mockStories: CollaborativeStory[] = [
        {
          id: '1',
          title: '🌟 Weekend Adventure Planning',
          description: 'Help me decide what to do this weekend!',
          initiatorId: 'user1',
          initiator: {
            username: 'sarah_adventures',
            displayName: 'Sarah Johnson',
            profilePicture: 'https://randomuser.me/api/portraits/women/1.jpg',
          },
          collaborators: [
            {
              userId: 'user2',
              username: 'mike_explorer',
              profilePicture: 'https://randomuser.me/api/portraits/men/1.jpg',
              joinedAt: new Date(),
              contributionCount: 3,
              role: 'contributor',
            },
          ],
          segments: [
            {
              id: 'seg1',
              userId: 'user1',
              username: 'sarah_adventures',
              content: 'I have Saturday free and want to try something new! What should I do?',
              timestamp: new Date(),
              likes: 5,
              reactions: [],
              orderIndex: 0,
            },
            {
              id: 'seg2',
              userId: 'user2',
              username: 'mike_explorer',
              content: 'How about rock climbing? There\'s a great indoor place downtown!',
              timestamp: new Date(),
              likes: 3,
              reactions: [],
              orderIndex: 1,
            },
          ],
          status: 'active',
          maxCollaborators: 5,
          category: 'adventure',
          timeLimit: 24,
          createdAt: new Date(),
          likes: 12,
          views: 45,
          isPublic: true,
        },
        {
          id: '2',
          title: '🎨 Collaborative Art Project',
          description: 'Creating a digital masterpiece together!',
          initiatorId: 'user3',
          initiator: {
            username: 'artist_alex',
            displayName: 'Alex Chen',
            profilePicture: 'https://randomuser.me/api/portraits/men/2.jpg',
          },
          collaborators: [],
          segments: [
            {
              id: 'seg3',
              userId: 'user3',
              username: 'artist_alex',
              content: 'Starting with a sunset theme... who wants to add the next element?',
              timestamp: new Date(),
              likes: 8,
              reactions: [],
              orderIndex: 0,
            },
          ],
          status: 'open',
          maxCollaborators: 8,
          category: 'creative',
          createdAt: new Date(),
          likes: 6,
          views: 23,
          isPublic: true,
        },
      ];
      
      setStories(mockStories);
    } catch (error) {
      console.error('Error loading collaborative stories:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: CollaborativeStory['category']) => {
    switch (category) {
      case 'adventure': return 'mountain';
      case 'creative': return 'palette';
      case 'challenge': return 'trophy';
      case 'daily': return 'calendar';
      case 'mystery': return 'help-circle';
      default: return 'chatbubble-ellipses';
    }
  };

  const getCategoryColors = (category: CollaborativeStory['category']) => {
    switch (category) {
      case 'adventure': return ['#FF6B6B', '#4ECDC4'];
      case 'creative': return ['#A8E6CF', '#FFD93D'];
      case 'challenge': return ['#FF8A65', '#FFAB40'];
      case 'daily': return ['#81C784', '#64B5F6'];
      case 'mystery': return ['#BA68C8', '#7986CB'];
      default: return ['#90CAF9', '#CE93D8'];
    }
  };

  const renderStoryCard = ({ item }: { item: CollaborativeStory }) => {
    const categoryColors = getCategoryColors(item.category);
    
    return (
      <TouchableOpacity
        style={styles.storyCard}
        onPress={() => {
          setActiveStory(item);
          setViewMode('collaborate');
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={categoryColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.storyCardGradient}
        >
          <View style={styles.storyCardHeader}>
            <View style={styles.categoryBadge}>
              <Icon name={getCategoryIcon(item.category)} size={16} color="#fff" />
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            <View style={styles.storyStats}>
              <View style={styles.statItem}>
                <Icon name="heart" size={12} color="#fff" />
                <Text style={styles.statText}>{item.likes}</Text>
              </View>
              <View style={styles.statItem}>
                <Icon name="eye" size={12} color="#fff" />
                <Text style={styles.statText}>{item.views}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.storyTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.storyDescription} numberOfLines={3}>
            {item.description}
          </Text>

          <View style={styles.storyCardFooter}>
            <View style={styles.initiatorInfo}>
              <Image
                source={{ uri: item.initiator.profilePicture || 'https://via.placeholder.com/30' }}
                style={styles.initiatorAvatar}
              />
              <Text style={styles.initiatorName}>{item.initiator.username}</Text>
            </View>

            <View style={styles.collaboratorCount}>
              <Icon name="people" size={14} color="#fff" />
              <Text style={styles.collaboratorText}>
                {item.collaborators.length}/{item.maxCollaborators}
              </Text>
            </View>
          </View>

          {item.timeLimit && (
            <View style={styles.timeIndicator}>
              <Icon name="time" size={12} color="#fff" />
              <Text style={styles.timeText}>{item.timeLimit}h left</Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderCreateStoryForm = () => (
    <ScrollView style={styles.createForm} showsVerticalScrollIndicator={false}>
      <Text style={styles.createTitle}>✨ Start a Collaborative Story</Text>
      
      <View style={styles.formGroup}>
        <Text style={styles.label}>Story Title</Text>
        <TextInput
          style={styles.input}
          value={newStoryTitle}
          onChangeText={setNewStoryTitle}
          placeholder="What's your story about?"
          placeholderTextColor="#999"
          maxLength={60}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={newStoryDescription}
          onChangeText={setNewStoryDescription}
          placeholder="Describe what kind of collaboration you want..."
          placeholderTextColor="#999"
          multiline
          numberOfLines={3}
          maxLength={200}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Category</Text>
        <FlatList
          data={['adventure', 'creative', 'challenge', 'daily', 'mystery']}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item;
            const categoryColors = getCategoryColors(item as CollaborativeStory['category']);
            
            return (
              <TouchableOpacity
                style={[styles.categoryOption, isSelected && styles.selectedCategory]}
                onPress={() => setSelectedCategory(item as CollaborativeStory['category'])}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={categoryColors}
                    style={styles.categoryGradient}
                  >
                    <Icon name={getCategoryIcon(item as CollaborativeStory['category'])} size={20} color="#fff" />
                    <Text style={styles.categoryOptionText}>{item}</Text>
                  </LinearGradient>
                ) : (
                  <View style={styles.categoryDefault}>
                    <Icon name={getCategoryIcon(item as CollaborativeStory['category'])} size={20} color="#666" />
                    <Text style={[styles.categoryOptionText, { color: '#666' }]}>{item}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.categoryList}
        />
      </View>

      <TouchableOpacity style={styles.createButton} onPress={handleCreateStory}>
        <LinearGradient
          colors={getCategoryColors(selectedCategory)}
          style={styles.createButtonGradient}
        >
          <Icon name="add-circle" size={20} color="#fff" />
          <Text style={styles.createButtonText}>Start Collaboration</Text>
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );

  const handleCreateStory = async () => {
    if (!newStoryTitle.trim() || !newStoryDescription.trim()) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      
      // Create new collaborative story
      const newStory: CollaborativeStory = {
        id: Date.now().toString(),
        title: newStoryTitle,
        description: newStoryDescription,
        initiatorId: user?.uid || '',
        initiator: {
          username: user?.username || 'You',
          displayName: user?.displayName || 'You',
          profilePicture: user?.profilePicture,
        },
        collaborators: [],
        segments: [],
        status: 'open',
        maxCollaborators: 5,
        category: selectedCategory,
        timeLimit: 24,
        createdAt: new Date(),
        likes: 0,
        views: 0,
        isPublic: true,
      };

      // Add to stories list
      setStories(prev => [newStory, ...prev]);
      
      // Reset form
      setNewStoryTitle('');
      setNewStoryDescription('');
      setSelectedCategory('adventure');
      
      // Switch to collaboration view
      setActiveStory(newStory);
      setViewMode('collaborate');
      
      Alert.alert('Success!', 'Your collaborative story has been created!');
    } catch (error) {
      console.error('Error creating story:', error);
      Alert.alert('Error', 'Failed to create story. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, viewMode === 'discover' && styles.activeTab]}
        onPress={() => setViewMode('discover')}
      >
        <Icon 
          name="compass" 
          size={20} 
          color={viewMode === 'discover' ? '#FF6B6B' : '#666'} 
        />
        <Text style={[styles.tabText, viewMode === 'discover' && styles.activeTabText]}>
          Discover
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, viewMode === 'create' && styles.activeTab]}
        onPress={() => setViewMode('create')}
      >
        <Icon 
          name="add-circle" 
          size={20} 
          color={viewMode === 'create' ? '#FF6B6B' : '#666'} 
        />
        <Text style={[styles.tabText, viewMode === 'create' && styles.activeTabText]}>
          Create
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.container,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <SafeAreaView style={styles.safeArea}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
              
              <Text style={styles.headerTitle}>
                {viewMode === 'collaborate' ? activeStory?.title : 'Collaborative Stories'}
              </Text>
              
              <View style={styles.headerRight} />
            </View>

            {/* Content */}
            {viewMode === 'collaborate' && activeStory ? (
              <CollaborationView 
                story={activeStory} 
                onBack={() => setViewMode('discover')}
              />
            ) : (
              <>
                {renderTabBar()}
                
                {viewMode === 'discover' ? (
                  <FlatList
                    data={stories}
                    renderItem={renderStoryCard}
                    keyExtractor={(item) => item.id}
                    numColumns={2}
                    columnWrapperStyle={stories.length > 1 ? styles.row : undefined}
                    contentContainerStyle={styles.storiesGrid}
                    showsVerticalScrollIndicator={false}
                  />
                ) : (
                  renderCreateStoryForm()
                )}
              </>
            )}
          </SafeAreaView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

// Collaboration View Component
const CollaborationView: React.FC<{
  story: CollaborativeStory;
  onBack: () => void;
}> = ({ story, onBack }) => {
  const { user } = useAuth();
  const [newSegment, setNewSegment] = useState('');
  
  const handleAddSegment = () => {
    if (!newSegment.trim()) return;
    
    // Add new segment logic here
    Alert.alert('Success!', 'Your contribution has been added!');
    setNewSegment('');
  };

  return (
    <View style={styles.collaborationView}>
      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Icon name="arrow-back" size={20} color="#666" />
        <Text style={styles.backText}>Back to Stories</Text>
      </TouchableOpacity>

      <FlatList
        data={story.segments}
        renderItem={({ item }) => (
          <View style={styles.segmentCard}>
            <View style={styles.segmentHeader}>
              <Text style={styles.segmentUser}>@{item.username}</Text>
              <Text style={styles.segmentTime}>
                {item.timestamp.toLocaleTimeString()}
              </Text>
            </View>
            <Text style={styles.segmentContent}>{item.content}</Text>
            <View style={styles.segmentFooter}>
              <TouchableOpacity style={styles.segmentAction}>
                <Icon name="heart-outline" size={16} color="#666" />
                <Text style={styles.segmentActionText}>{item.likes}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        keyExtractor={(item) => item.id}
        style={styles.segmentsList}
      />

      <View style={styles.addSegmentContainer}>
        <TextInput
          style={styles.segmentInput}
          value={newSegment}
          onChangeText={setNewSegment}
          placeholder="Add your part to the story..."
          placeholderTextColor="#999"
          multiline
        />
        <TouchableOpacity 
          style={styles.sendButton}
          onPress={handleAddSegment}
          disabled={!newSegment.trim()}
        >
          <Icon name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    height: height * 0.95,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f8f8f8',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  storiesGrid: {
    padding: 16,
  },
  row: {
    justifyContent: 'space-between',
  },
  storyCard: {
    width: (width - 48) / 2,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  storyCardGradient: {
    padding: 16,
    minHeight: 180,
  },
  storyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  storyStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  statText: {
    color: '#fff',
    fontSize: 10,
    marginLeft: 2,
    fontWeight: '500',
  },
  storyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    lineHeight: 18,
  },
  storyDescription: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 16,
    marginBottom: 12,
  },
  storyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  initiatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  initiatorAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  initiatorName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  collaboratorCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  collaboratorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 2,
  },
  timeIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  timeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 2,
  },
  createForm: {
    flex: 1,
    padding: 20,
  },
  createTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f8f8f8',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryList: {
    paddingHorizontal: 0,
  },
  categoryOption: {
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  selectedCategory: {
    transform: [{ scale: 1.05 }],
  },
  categoryGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  categoryDefault: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    minWidth: 80,
  },
  categoryOptionText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'capitalize',
    color: '#fff',
  },
  createButton: {
    marginTop: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  collaborationView: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
  },
  segmentsList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  segmentCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
  },
  segmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  segmentUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  segmentTime: {
    fontSize: 12,
    color: '#999',
  },
  segmentContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  segmentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  segmentAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmentActionText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  addSegmentContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  segmentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default DynamicStoryCollaboration;
