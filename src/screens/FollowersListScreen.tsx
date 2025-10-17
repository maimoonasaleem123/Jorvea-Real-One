import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService from '../services/firebaseService';
import { User } from '../types';
import FollowButton from '../components/FollowButton';
import { EnhancedFollowButton } from '../components/EnhancedFollowButton';

interface FollowersListScreenProps {
  route: {
    params: {
      userId: string;
      type: 'followers' | 'following';
      username?: string;
    };
  };
}

const FollowersListScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { user: currentUser } = useAuth();
  const { userId, type, username } = route.params as FollowersListScreenProps['route']['params'];

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, [userId, type]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      let usersData: User[] = [];
      
      if (type === 'followers') {
        usersData = await FirebaseService.getFollowers(userId);
      } else {
        usersData = await FirebaseService.getFollowing(userId);
      }
      
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', `Failed to load ${type}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = (user: User) => {
    if (currentUser && user.uid === currentUser.uid) {
      // Navigate to own profile
      navigation.navigate('Profile' as never);
    } else {
      // Navigate to user profile
      navigation.navigate('UserProfile' as never, {
        userId: user.uid,
        user: user,
      } as never);
    }
  };

  const renderUser = ({ item: user }: { item: User }) => (
    <TouchableOpacity style={styles.userItem} onPress={() => handleUserPress(user)}>
      <View style={styles.userInfo}>
        <Image
          source={{
            uri: user.profilePicture || 
                 `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.username)}&background=E1306C&color=fff`
          }}
          style={styles.avatar}
        />
        <View style={styles.userDetails}>
          <Text style={styles.displayName}>{user.displayName}</Text>
          <Text style={styles.username}>@{user.username}</Text>
          {user.bio && (
            <Text style={styles.bio} numberOfLines={1}>{user.bio}</Text>
          )}
        </View>
      </View>
      
      {currentUser && user.uid !== currentUser.uid && (
        <EnhancedFollowButton
          targetUserId={user.uid}
          targetUserName={user.displayName || user.username}
          size="small"
          variant="outlined"
          onFollowChange={() => {
            // Optionally refresh the list or update local state
          }}
        />
      )}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>
            {type === 'followers' ? 'Followers' : 'Following'}
          </Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E1306C" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {type === 'followers' ? 'Followers' : 'Following'}
          {username && ` • ${username}`}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon 
            name={type === 'followers' ? 'people-outline' : 'person-add-outline'} 
            size={64} 
            color="#ccc" 
          />
          <Text style={styles.emptyTitle}>
            No {type === 'followers' ? 'followers' : 'following'} yet
          </Text>
          <Text style={styles.emptySubtitle}>
            {type === 'followers' 
              ? 'When people follow this account, they\'ll appear here.' 
              : 'When this account follows people, they\'ll appear here.'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.uid}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E7',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#262626',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  listContainer: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  bio: {
    fontSize: 14,
    color: '#262626',
  },
  followButton: {
    marginLeft: 12,
  },
});

export default FollowersListScreen;
