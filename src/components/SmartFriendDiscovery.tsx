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
  Switch,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');

interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  bio: string;
  followers: number;
  following: number;
  posts: number;
  isVerified: boolean;
  lastActive: Date;
  location?: string;
  interests: string[];
  mutualFriends: number;
  connectionScore: number;
  isFollowing: boolean;
  isOnline: boolean;
}

interface SmartFriendDiscoveryProps {
  userId: string;
  currentLocation?: { latitude: number; longitude: number };
}

export const SmartFriendDiscovery: React.FC<SmartFriendDiscoveryProps> = ({
  userId,
  currentLocation
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filter states
  const [filters, setFilters] = useState({
    nearbyOnly: false,
    onlineOnly: false,
    verifiedOnly: false,
    minMutualFriends: 0,
    interests: [] as string[],
    ageRange: { min: 18, max: 65 },
    sortBy: 'connectionScore' as 'connectionScore' | 'nearbyFirst' | 'mostActive' | 'newest'
  });

  // Animation refs
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardAnims = useRef<{ [key: string]: Animated.Value }>({}).current;

  const availableInterests = [
    'Photography', 'Music', 'Travel', 'Food', 'Sports', 'Art', 'Technology',
    'Fashion', 'Fitness', 'Gaming', 'Movies', 'Books', 'Dancing', 'Cooking',
    'Nature', 'Animals', 'Cars', 'Science', 'Business', 'Health'
  ];

  useEffect(() => {
    loadUsers();
    startAnimations();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [users, filters]);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    ]).start();
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      // Mock data - in real app, fetch from Firebase with smart algorithms
      const mockUsers: User[] = [
        {
          id: '1',
          name: 'Sarah Johnson',
          username: '@sarahj_photo',
          avatar: 'https://via.placeholder.com/100x100',
          bio: 'Photography enthusiast 📸 | Travel lover ✈️ | Coffee addict ☕',
          followers: 1250,
          following: 890,
          posts: 324,
          isVerified: true,
          lastActive: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
          location: 'New York, NY',
          interests: ['Photography', 'Travel', 'Coffee'],
          mutualFriends: 12,
          connectionScore: 95,
          isFollowing: false,
          isOnline: true
        },
        {
          id: '2',
          name: 'Alex Chen',
          username: '@alexc_tech',
          avatar: 'https://via.placeholder.com/100x100',
          bio: 'Tech entrepreneur | AI enthusiast | Startup founder 🚀',
          followers: 3420,
          following: 567,
          posts: 156,
          isVerified: true,
          lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          location: 'San Francisco, CA',
          interests: ['Technology', 'Business', 'AI'],
          mutualFriends: 8,
          connectionScore: 88,
          isFollowing: false,
          isOnline: false
        },
        {
          id: '3',
          name: 'Maria Garcia',
          username: '@maria_fitness',
          avatar: 'https://via.placeholder.com/100x100',
          bio: 'Fitness coach 💪 | Nutrition expert | Yoga instructor 🧘‍♀️',
          followers: 5680,
          following: 234,
          posts: 892,
          isVerified: false,
          lastActive: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
          location: 'Miami, FL',
          interests: ['Fitness', 'Health', 'Yoga'],
          mutualFriends: 15,
          connectionScore: 92,
          isFollowing: true,
          isOnline: true
        },
        {
          id: '4',
          name: 'David Kim',
          username: '@david_music',
          avatar: 'https://via.placeholder.com/100x100',
          bio: 'Music producer 🎵 | Guitar player | Studio owner 🎸',
          followers: 2340,
          following: 1890,
          posts: 445,
          isVerified: false,
          lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          location: 'Nashville, TN',
          interests: ['Music', 'Audio', 'Production'],
          mutualFriends: 6,
          connectionScore: 76,
          isFollowing: false,
          isOnline: false
        },
        {
          id: '5',
          name: 'Emma Wilson',
          username: '@emma_art',
          avatar: 'https://via.placeholder.com/100x100',
          bio: 'Digital artist 🎨 | NFT creator | Art gallery owner',
          followers: 4560,
          following: 678,
          posts: 723,
          isVerified: true,
          lastActive: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
          location: 'Los Angeles, CA',
          interests: ['Art', 'Digital Design', 'NFT'],
          mutualFriends: 20,
          connectionScore: 85,
          isFollowing: false,
          isOnline: true
        }
      ];

      setUsers(mockUsers);
      
      // Initialize card animations
      mockUsers.forEach(user => {
        if (!cardAnims[user.id]) {
          cardAnims[user.id] = new Animated.Value(0);
          Animated.timing(cardAnims[user.id], {
            toValue: 1,
            duration: 300,
            delay: Math.random() * 200,
            useNativeDriver: true,
          }).start();
        }
      });
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...users];

    if (filters.nearbyOnly && currentLocation) {
      // In real app, filter by distance
      filtered = filtered.filter(user => user.location);
    }

    if (filters.onlineOnly) {
      filtered = filtered.filter(user => user.isOnline);
    }

    if (filters.verifiedOnly) {
      filtered = filtered.filter(user => user.isVerified);
    }

    if (filters.minMutualFriends > 0) {
      filtered = filtered.filter(user => user.mutualFriends >= filters.minMutualFriends);
    }

    if (filters.interests.length > 0) {
      filtered = filtered.filter(user => 
        user.interests.some(interest => filters.interests.includes(interest))
      );
    }

    // Sort users
    switch (filters.sortBy) {
      case 'connectionScore':
        filtered.sort((a, b) => b.connectionScore - a.connectionScore);
        break;
      case 'nearbyFirst':
        // In real app, sort by distance
        filtered.sort((a, b) => b.mutualFriends - a.mutualFriends);
        break;
      case 'mostActive':
        filtered.sort((a, b) => a.lastActive.getTime() - b.lastActive.getTime());
        break;
      case 'newest':
        // In real app, sort by join date
        filtered.sort((a, b) => b.followers - a.followers);
        break;
    }

    setFilteredUsers(filtered);
  };

  const handleFollow = async (user: User) => {
    try {
      setUsers(prev => prev.map(u => 
        u.id === user.id 
          ? { 
              ...u, 
              isFollowing: !u.isFollowing,
              followers: u.isFollowing ? u.followers - 1 : u.followers + 1
            }
          : u
      ));

      // Animate the card
      if (cardAnims[user.id]) {
        Animated.sequence([
          Animated.timing(cardAnims[user.id], {
            toValue: 0.95,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(cardAnims[user.id], {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          })
        ]).start();
      }

    } catch (error) {
      console.error('Error following user:', error);
    }
  };

  const getLastActiveText = (lastActive: Date) => {
    const now = new Date();
    const diff = now.getTime() - lastActive.getTime();
    
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getConnectionScoreColor = (score: number) => {
    if (score >= 90) return '#4CAF50';
    if (score >= 75) return '#FF9800';
    if (score >= 60) return '#2196F3';
    return '#9E9E9E';
  };

  const renderUserCard = ({ item }: { item: User }) => (
    <Animated.View
      style={[
        styles.userCard,
        {
          opacity: cardAnims[item.id] || 1,
          transform: [
            {
              translateY: (cardAnims[item.id] || new Animated.Value(1)).interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0]
              })
            }
          ]
        }
      ]}
    >
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => {
          setSelectedUser(item);
          setShowUserModal(true);
        }}
      >
        <View style={styles.userHeader}>
          <View style={styles.avatarContainer}>
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
            {item.isOnline && <View style={styles.onlineIndicator} />}
            {item.isVerified && (
              <View style={styles.verifiedBadge}>
                <Icon name="checkmark-circle" size={16} color="#4CAF50" />
              </View>
            )}
          </View>
          
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.name}</Text>
            <Text style={styles.userUsername}>{item.username}</Text>
            <Text style={styles.userBio} numberOfLines={2}>{item.bio}</Text>
          </View>
        </View>

        <View style={styles.connectionScore}>
          <LinearGradient
            colors={[getConnectionScoreColor(item.connectionScore), getConnectionScoreColor(item.connectionScore) + '80']}
            style={styles.scoreCircle}
          >
            <Text style={styles.scoreText}>{item.connectionScore}</Text>
          </LinearGradient>
          <Text style={styles.scoreLabel}>Match</Text>
        </View>

        <View style={styles.userStats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{item.followers.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{item.posts}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{item.mutualFriends}</Text>
            <Text style={styles.statLabel}>Mutual</Text>
          </View>
        </View>

        <View style={styles.interestsContainer}>
          {item.interests.slice(0, 3).map((interest, index) => (
            <View key={index} style={styles.interestTag}>
              <Text style={styles.interestText}>{interest}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.lastActiveContainer}>
            <Icon name="time" size={14} color="#666" />
            <Text style={styles.lastActiveText}>{getLastActiveText(item.lastActive)}</Text>
          </View>
          
          <TouchableOpacity
            style={[
              styles.followButton,
              { backgroundColor: item.isFollowing ? '#FF6B6B' : '#4ECDC4' }
            ]}
            onPress={() => handleFollow(item)}
          >
            <Text style={styles.followButtonText}>
              {item.isFollowing ? 'Unfollow' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderFiltersModal = () => (
    <Modal
      visible={showFiltersModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowFiltersModal(false)}
          >
            <Icon name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Discovery Filters</Text>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => setFilters({
              nearbyOnly: false,
              onlineOnly: false,
              verifiedOnly: false,
              minMutualFriends: 0,
              interests: [],
              ageRange: { min: 18, max: 65 },
              sortBy: 'connectionScore'
            })}
          >
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.filtersContent}>
          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Quick Filters</Text>
            
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Nearby Only</Text>
              <Switch
                value={filters.nearbyOnly}
                onValueChange={(value) => setFilters(prev => ({ ...prev, nearbyOnly: value }))}
                trackColor={{ false: '#ccc', true: '#4ECDC4' }}
              />
            </View>
            
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Online Only</Text>
              <Switch
                value={filters.onlineOnly}
                onValueChange={(value) => setFilters(prev => ({ ...prev, onlineOnly: value }))}
                trackColor={{ false: '#ccc', true: '#4ECDC4' }}
              />
            </View>
            
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Verified Only</Text>
              <Switch
                value={filters.verifiedOnly}
                onValueChange={(value) => setFilters(prev => ({ ...prev, verifiedOnly: value }))}
                trackColor={{ false: '#ccc', true: '#4ECDC4' }}
              />
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.interestsGrid}>
              {availableInterests.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.interestFilter,
                    filters.interests.includes(interest) && styles.selectedInterest
                  ]}
                  onPress={() => {
                    setFilters(prev => ({
                      ...prev,
                      interests: prev.interests.includes(interest)
                        ? prev.interests.filter(i => i !== interest)
                        : [...prev.interests, interest]
                    }));
                  }}
                >
                  <Text style={[
                    styles.interestFilterText,
                    filters.interests.includes(interest) && styles.selectedInterestText
                  ]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterSection}>
            <Text style={styles.sectionTitle}>Sort By</Text>
            <View style={styles.sortOptions}>
              {[
                { key: 'connectionScore', label: 'Best Match' },
                { key: 'nearbyFirst', label: 'Nearby First' },
                { key: 'mostActive', label: 'Most Active' },
                { key: 'newest', label: 'Newest Users' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.sortOption,
                    filters.sortBy === option.key && styles.selectedSort
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, sortBy: option.key as any }))}
                >
                  <Text style={[
                    styles.sortOptionText,
                    filters.sortBy === option.key && styles.selectedSortText
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  const renderUserModal = () => (
    <Modal
      visible={showUserModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        {selectedUser && (
          <ScrollView style={styles.userModalContent}>
            <View style={styles.userModalHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowUserModal(false)}
              >
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
              
              <View style={styles.userModalInfo}>
                <View style={styles.userModalAvatarContainer}>
                  <Image source={{ uri: selectedUser.avatar }} style={styles.userModalAvatar} />
                  {selectedUser.isOnline && <View style={styles.userModalOnlineIndicator} />}
                </View>
                
                <Text style={styles.userModalName}>{selectedUser.name}</Text>
                <Text style={styles.userModalUsername}>{selectedUser.username}</Text>
                
                <View style={styles.userModalStats}>
                  <View style={styles.userModalStatItem}>
                    <Text style={styles.userModalStatNumber}>{selectedUser.followers.toLocaleString()}</Text>
                    <Text style={styles.userModalStatLabel}>Followers</Text>
                  </View>
                  <View style={styles.userModalStatItem}>
                    <Text style={styles.userModalStatNumber}>{selectedUser.following.toLocaleString()}</Text>
                    <Text style={styles.userModalStatLabel}>Following</Text>
                  </View>
                  <View style={styles.userModalStatItem}>
                    <Text style={styles.userModalStatNumber}>{selectedUser.posts}</Text>
                    <Text style={styles.userModalStatLabel}>Posts</Text>
                  </View>
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.userModalFollowButton,
                    { backgroundColor: selectedUser.isFollowing ? '#FF6B6B' : '#4ECDC4' }
                  ]}
                  onPress={() => handleFollow(selectedUser)}
                >
                  <Text style={styles.userModalFollowButtonText}>
                    {selectedUser.isFollowing ? 'Unfollow' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.userModalBody}>
              <Text style={styles.userModalBio}>{selectedUser.bio}</Text>
              
              {selectedUser.location && (
                <View style={styles.locationContainer}>
                  <Icon name="location" size={16} color="#666" />
                  <Text style={styles.locationText}>{selectedUser.location}</Text>
                </View>
              )}
              
              <View style={styles.userModalInterests}>
                <Text style={styles.interestsTitle}>Interests</Text>
                <View style={styles.interestsWrap}>
                  {selectedUser.interests.map((interest, index) => (
                    <View key={index} style={styles.userModalInterestTag}>
                      <Text style={styles.userModalInterestText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
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
            <Icon name="people" size={24} color="white" />
            <Text style={styles.headerTitle}>Discover Friends</Text>
          </View>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFiltersModal(true)}
          >
            <Icon name="options" size={24} color="white" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.headerSubtitle}>
          {filteredUsers.length} potential connections found
        </Text>
      </LinearGradient>

      <FlatList
        data={filteredUsers}
        renderItem={renderUserCard}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadUsers();
        }}
      />

      {renderFiltersModal()}
      {renderUserModal()}
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
    marginBottom: 10,
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
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  filterButton: {
    padding: 5,
  },
  listContainer: {
    padding: 15,
  },
  userCard: {
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
  userHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: 'white',
  },
  verifiedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  userBio: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
  },
  connectionScore: {
    position: 'absolute',
    top: 15,
    right: 15,
    alignItems: 'center',
  },
  scoreCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },
  scoreLabel: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  userStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  interestTag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 5,
  },
  interestText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastActiveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastActiveText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  closeButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  resetButton: {
    padding: 5,
  },
  resetText: {
    fontSize: 16,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  filtersContent: {
    flex: 1,
    padding: 20,
  },
  filterSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestFilter: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: 'white',
  },
  selectedInterest: {
    backgroundColor: '#4ECDC4',
    borderColor: '#4ECDC4',
  },
  interestFilterText: {
    fontSize: 14,
    color: '#666',
  },
  selectedInterestText: {
    color: 'white',
  },
  sortOptions: {
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden',
  },
  sortOption: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedSort: {
    backgroundColor: '#4ECDC4',
  },
  sortOptionText: {
    fontSize: 16,
    color: '#333',
  },
  selectedSortText: {
    color: 'white',
    fontWeight: 'bold',
  },
  userModalContent: {
    flex: 1,
  },
  userModalHeader: {
    backgroundColor: 'white',
    paddingBottom: 20,
  },
  userModalInfo: {
    alignItems: 'center',
    padding: 20,
  },
  userModalAvatarContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  userModalAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  userModalOnlineIndicator: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#4CAF50',
    borderWidth: 3,
    borderColor: 'white',
  },
  userModalName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  userModalUsername: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  userModalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  userModalStatItem: {
    alignItems: 'center',
  },
  userModalStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  userModalStatLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  userModalFollowButton: {
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 25,
  },
  userModalFollowButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userModalBody: {
    padding: 20,
  },
  userModalBio: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 20,
    textAlign: 'center',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 5,
  },
  userModalInterests: {
    marginTop: 10,
  },
  interestsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  interestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  userModalInterestTag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 10,
  },
  userModalInterestText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
  },
});
