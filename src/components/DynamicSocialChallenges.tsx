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
  Modal,
  SafeAreaView,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'dance' | 'fitness' | 'creative' | 'trending' | 'daily' | 'viral';
  participants: number;
  durationHours: number;
  hashtags: string[];
  prize?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  thumbnail: string;
  creator: {
    id: string;
    name: string;
    avatar: string;
  };
  submissions: number;
  trending: boolean;
  isJoined: boolean;
  endTime: Date;
}

interface DynamicSocialChallengesProps {
  userId: string;
}

export const DynamicSocialChallenges: React.FC<DynamicSocialChallengesProps> = ({ userId }) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'trending' | 'joined' | 'created'>('trending');
  const [loading, setLoading] = useState(false);
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Challenge creation state
  const [newChallenge, setNewChallenge] = useState({
    title: '',
    description: '',
    type: 'creative' as Challenge['type'],
    durationHours: 24,
    hashtags: [''],
    prize: '',
    difficulty: 'medium' as Challenge['difficulty'],
  });

  useEffect(() => {
    loadChallenges();
    startAnimations();
  }, []);

  const startAnimations = () => {
    // Slide in animation
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Pulse animation for trending challenges
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };
    pulse();
  };

  const loadChallenges = async () => {
    setLoading(true);
    try {
      // Mock data - in real app, fetch from Firebase
      const mockChallenges: Challenge[] = [
        {
          id: '1',
          title: '🔥 Viral Dance Challenge',
          description: 'Show off your best dance moves! Create a 15-second dance video that\'ll make everyone want to join in.',
          type: 'dance',
          participants: 12500,
          durationHours: 48,
          hashtags: ['#ViralDance', '#JorveaChallenge', '#DanceOff'],
          prize: '🏆 Featured on Jorvea Spotlight',
          difficulty: 'medium',
          thumbnail: 'https://via.placeholder.com/300x200',
          creator: {
            id: 'creator1',
            name: 'DanceKing',
            avatar: 'https://via.placeholder.com/50x50'
          },
          submissions: 8500,
          trending: true,
          isJoined: false,
          endTime: new Date(Date.now() + 48 * 60 * 60 * 1000)
        },
        {
          id: '2',
          title: '💪 30-Day Fitness Journey',
          description: 'Transform your fitness routine! Share your daily workout progress and inspire others.',
          type: 'fitness',
          participants: 8900,
          durationHours: 720, // 30 days
          hashtags: ['#FitnessJourney', '#JorveaFit', '#Transformation'],
          prize: '🎁 Fitness Bundle Worth $200',
          difficulty: 'hard',
          thumbnail: 'https://via.placeholder.com/300x200',
          creator: {
            id: 'creator2',
            name: 'FitnessPro',
            avatar: 'https://via.placeholder.com/50x50'
          },
          submissions: 5200,
          trending: true,
          isJoined: true,
          endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        {
          id: '3',
          title: '🎨 Creative Art Challenge',
          description: 'Express your creativity! Create stunning artwork using everyday objects.',
          type: 'creative',
          participants: 5600,
          durationHours: 72,
          hashtags: ['#CreativeArt', '#JorveaArt', '#DIYArt'],
          prize: '🎨 Art Supply Kit',
          difficulty: 'easy',
          thumbnail: 'https://via.placeholder.com/300x200',
          creator: {
            id: 'creator3',
            name: 'ArtMaster',
            avatar: 'https://via.placeholder.com/50x50'
          },
          submissions: 3400,
          trending: false,
          isJoined: false,
          endTime: new Date(Date.now() + 72 * 60 * 60 * 1000)
        },
        {
          id: '4',
          title: '📱 Daily Life Moments',
          description: 'Capture the beauty in everyday moments. Share your perspective on daily life.',
          type: 'daily',
          participants: 15200,
          durationHours: 24,
          hashtags: ['#DailyMoments', '#JorveaDaily', '#LifeCapture'],
          difficulty: 'easy',
          thumbnail: 'https://via.placeholder.com/300x200',
          creator: {
            id: 'creator4',
            name: 'LifeCapturer',
            avatar: 'https://via.placeholder.com/50x50'
          },
          submissions: 11800,
          trending: true,
          isJoined: true,
          endTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
      ];
      setChallenges(mockChallenges);
    } catch (error) {
      console.error('Error loading challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredChallenges = () => {
    switch (activeTab) {
      case 'trending':
        return challenges.filter(c => c.trending);
      case 'joined':
        return challenges.filter(c => c.isJoined);
      case 'created':
        return challenges.filter(c => c.creator.id === userId);
      default:
        return challenges;
    }
  };

  const getDifficultyColor = (difficulty: Challenge['difficulty']) => {
    switch (difficulty) {
      case 'easy':
        return '#4CAF50';
      case 'medium':
        return '#FF9800';
      case 'hard':
        return '#F44336';
      default:
        return '#666';
    }
  };

  const getTypeIcon = (type: Challenge['type']) => {
    switch (type) {
      case 'dance':
        return 'musical-notes';
      case 'fitness':
        return 'fitness';
      case 'creative':
        return 'brush';
      case 'trending':
        return 'trending-up';
      case 'daily':
        return 'calendar';
      case 'viral':
        return 'flame';
      default:
        return 'star';
    }
  };

  const formatTimeRemaining = (endTime: Date) => {
    const now = new Date();
    const remaining = endTime.getTime() - now.getTime();
    
    if (remaining <= 0) return 'Ended';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h left`;
    return `${hours}h left`;
  };

  const handleJoinChallenge = (challenge: Challenge) => {
    setChallenges(prev => prev.map(c => 
      c.id === challenge.id 
        ? { ...c, isJoined: !c.isJoined, participants: c.isJoined ? c.participants - 1 : c.participants + 1 }
        : c
    ));
    
    Alert.alert(
      challenge.isJoined ? 'Left Challenge' : 'Joined Challenge!',
      challenge.isJoined 
        ? `You left the ${challenge.title}` 
        : `You're now part of the ${challenge.title}! Start creating content with the hashtags.`,
      [{ text: 'OK' }]
    );
  };

  const handleCreateChallenge = () => {
    if (!newChallenge.title || !newChallenge.description) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const challenge: Challenge = {
      id: Date.now().toString(),
      ...newChallenge,
      participants: 1,
      submissions: 0,
      trending: false,
      isJoined: true,
      thumbnail: 'https://via.placeholder.com/300x200',
      creator: {
        id: userId,
        name: 'You',
        avatar: 'https://via.placeholder.com/50x50'
      },
      endTime: new Date(Date.now() + newChallenge.durationHours * 60 * 60 * 1000)
    };

    setChallenges(prev => [challenge, ...prev]);
    setShowCreateModal(false);
    setNewChallenge({
      title: '',
      description: '',
      type: 'creative',
      durationHours: 24,
      hashtags: [''],
      prize: '',
      difficulty: 'medium',
    });

    Alert.alert('Success!', 'Your challenge has been created and is now live!');
  };

  const renderChallengeCard = ({ item }: { item: Challenge }) => (
    <Animated.View
      style={[
        styles.challengeCard,
        {
          transform: [{
            scale: item.trending ? pulseAnim : 1
          }]
        }
      ]}
    >
      <TouchableOpacity
        onPress={() => {
          setSelectedChallenge(item);
          setShowChallengeModal(true);
        }}
        style={styles.cardContent}
      >
        {item.trending && (
          <LinearGradient
            colors={['#FF6B6B', '#4ECDC4', '#45B7D1']}
            style={styles.trendingBadge}
          >
            <Icon name="flame" size={12} color="white" />
            <Text style={styles.trendingText}>TRENDING</Text>
          </LinearGradient>
        )}

        <View style={styles.challengeHeader}>
          <View style={styles.typeIconContainer}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.typeIcon}
            >
              <Icon name={getTypeIcon(item.type)} size={20} color="white" />
            </LinearGradient>
          </View>
          
          <View style={styles.challengeInfo}>
            <Text style={styles.challengeTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.challengeDescription} numberOfLines={3}>
              {item.description}
            </Text>
          </View>
        </View>

        <View style={styles.challengeStats}>
          <View style={styles.statItem}>
            <Icon name="people" size={16} color="#666" />
            <Text style={styles.statText}>{item.participants.toLocaleString()}</Text>
          </View>
          
          <View style={styles.statItem}>
            <Icon name="camera" size={16} color="#666" />
            <Text style={styles.statText}>{item.submissions.toLocaleString()}</Text>
          </View>
          
          <View style={[styles.statItem, { backgroundColor: getDifficultyColor(item.difficulty) + '20' }]}>
            <Text style={[styles.statText, { color: getDifficultyColor(item.difficulty) }]}>
              {item.difficulty.toUpperCase()}
            </Text>
          </View>
          
          <View style={styles.statItem}>
            <Icon name="time" size={16} color="#FF6B6B" />
            <Text style={[styles.statText, { color: '#FF6B6B' }]}>
              {formatTimeRemaining(item.endTime)}
            </Text>
          </View>
        </View>

        <View style={styles.hashtagContainer}>
          {item.hashtags.slice(0, 3).map((hashtag, index) => (
            <View key={index} style={styles.hashtag}>
              <Text style={styles.hashtagText}>{hashtag}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.joinButton,
            { backgroundColor: item.isJoined ? '#FF6B6B' : '#4ECDC4' }
          ]}
          onPress={() => handleJoinChallenge(item)}
        >
          <Text style={styles.joinButtonText}>
            {item.isJoined ? 'Leave' : 'Join Challenge'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderTabButton = (tab: typeof activeTab, title: string, icon: string) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.activeTab]}
      onPress={() => setActiveTab(tab)}
    >
      <Icon name={icon} size={20} color={activeTab === tab ? 'white' : '#666'} />
      <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [50, 0]
            })
          }]
        }
      ]}
    >
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Icon name="trophy" size={24} color="white" />
            <Text style={styles.headerTitle}>Challenges</Text>
          </View>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Icon name="add-circle" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <View style={styles.tabContainer}>
          {renderTabButton('trending', 'Trending', 'flame')}
          {renderTabButton('joined', 'Joined', 'checkmark-circle')}
          {renderTabButton('created', 'Created', 'person')}
        </View>
      </LinearGradient>

      <FlatList
        data={getFilteredChallenges()}
        renderItem={renderChallengeCard}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        refreshing={loading}
        onRefresh={loadChallenges}
      />

      {/* Challenge Detail Modal */}
      <Modal
        visible={showChallengeModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          {selectedChallenge && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowChallengeModal(false)}
                >
                  <Icon name="close" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>{selectedChallenge.title}</Text>
              </View>

              <View style={styles.modalBody}>
                <Text style={styles.modalDescription}>
                  {selectedChallenge.description}
                </Text>

                {selectedChallenge.prize && (
                  <View style={styles.prizeContainer}>
                    <Icon name="gift" size={20} color="#FFD700" />
                    <Text style={styles.prizeText}>{selectedChallenge.prize}</Text>
                  </View>
                )}

                <View style={styles.modalStats}>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatNumber}>
                      {selectedChallenge.participants.toLocaleString()}
                    </Text>
                    <Text style={styles.modalStatLabel}>Participants</Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatNumber}>
                      {selectedChallenge.submissions.toLocaleString()}
                    </Text>
                    <Text style={styles.modalStatLabel}>Submissions</Text>
                  </View>
                  <View style={styles.modalStatItem}>
                    <Text style={styles.modalStatNumber}>
                      {formatTimeRemaining(selectedChallenge.endTime)}
                    </Text>
                    <Text style={styles.modalStatLabel}>Time Left</Text>
                  </View>
                </View>

                <View style={styles.hashtagGrid}>
                  {selectedChallenge.hashtags.map((hashtag, index) => (
                    <View key={index} style={styles.modalHashtag}>
                      <Text style={styles.modalHashtagText}>{hashtag}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.modalJoinButton,
                    { backgroundColor: selectedChallenge.isJoined ? '#FF6B6B' : '#4ECDC4' }
                  ]}
                  onPress={() => {
                    handleJoinChallenge(selectedChallenge);
                    setShowChallengeModal(false);
                  }}
                >
                  <Text style={styles.modalJoinButtonText}>
                    {selectedChallenge.isJoined ? 'Leave Challenge' : 'Join Challenge'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Create Challenge Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Create Challenge</Text>
            </View>

            <View style={styles.createForm}>
              <TextInput
                style={styles.input}
                placeholder="Challenge Title"
                value={newChallenge.title}
                onChangeText={(text) => setNewChallenge(prev => ({ ...prev, title: text }))}
                maxLength={50}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Challenge Description"
                value={newChallenge.description}
                onChangeText={(text) => setNewChallenge(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={4}
                maxLength={200}
              />

              <Text style={styles.sectionTitle}>Duration (hours)</Text>
              <View style={styles.durationContainer}>
                {[24, 48, 72, 168].map((hours) => (
                  <TouchableOpacity
                    key={hours}
                    style={[
                      styles.durationButton,
                      newChallenge.durationHours === hours && styles.selectedDuration
                    ]}
                    onPress={() => setNewChallenge(prev => ({ ...prev, durationHours: hours }))}
                  >
                    <Text style={[
                      styles.durationText,
                      newChallenge.durationHours === hours && styles.selectedDurationText
                    ]}>
                      {hours < 168 ? `${hours}h` : '1w'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Prize (optional)"
                value={newChallenge.prize}
                onChangeText={(text) => setNewChallenge(prev => ({ ...prev, prize: text }))}
              />

              <TouchableOpacity
                style={styles.createChallengeButton}
                onPress={handleCreateChallenge}
              >
                <LinearGradient
                  colors={['#4ECDC4', '#44A08D']}
                  style={styles.createChallengeGradient}
                >
                  <Text style={styles.createChallengeText}>Create Challenge</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    marginVertical: 15,
    borderRadius: 20,
    overflow: 'hidden',
    marginHorizontal: 15,
  },
  header: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 10,
  },
  createButton: {
    padding: 5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 25,
    padding: 5,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabText: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  activeTabText: {
    color: 'white',
  },
  listContainer: {
    padding: 15,
  },
  challengeCard: {
    backgroundColor: 'white',
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  cardContent: {
    padding: 15,
  },
  trendingBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  trendingText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 3,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  typeIconContainer: {
    marginRight: 12,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeInfo: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  challengeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  challengeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    marginBottom: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
    color: '#666',
  },
  hashtagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  hashtag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 5,
  },
  hashtagText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '600',
  },
  joinButton: {
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
  },
  joinButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    marginRight: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  modalBody: {
    padding: 20,
  },
  modalDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 20,
  },
  prizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff8e1',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  prizeText: {
    fontSize: 14,
    color: '#f57c00',
    fontWeight: '600',
    marginLeft: 8,
  },
  modalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
  },
  modalStatItem: {
    alignItems: 'center',
  },
  modalStatNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  hashtagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 30,
  },
  modalHashtag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  modalHashtagText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
  },
  modalJoinButton: {
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  modalJoinButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createForm: {
    padding: 20,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  durationContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  durationButton: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 25,
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#eee',
  },
  selectedDuration: {
    borderColor: '#4ECDC4',
    backgroundColor: '#4ECDC4',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  selectedDurationText: {
    color: 'white',
  },
  createChallengeButton: {
    borderRadius: 25,
    overflow: 'hidden',
    marginTop: 20,
  },
  createChallengeGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  createChallengeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
