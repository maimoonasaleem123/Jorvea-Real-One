import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../context/FastAuthContext';
import { useTheme } from '../context/ThemeContext';
import FirebaseService, { Reel } from '../services/firebaseService';
import { ReelsProfilePicture } from '../components/DynamicProfilePicture';

const { width } = Dimensions.get('window');
const itemSize = (width - 30) / 3;

interface SavedItem {
  id: string;
  reelId: string;
  userId: string;
  createdAt: string;
  reel?: Reel;
}

const SavedPostsScreen: React.FC = () => {
  const { user } = useAuth();
  const { theme, isDarkMode } = useTheme();
  const navigation = useNavigation();
  
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [savedReels, setSavedReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch saved posts and reels
  const fetchSavedItems = useCallback(async (refresh = false) => {
    if (!user?.uid) return;

    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Get saved items from Firebase
      const savedQuery = await firestore()
        .collection('saves')
        .where('userId', '==', user.uid)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const savedItemsData = savedQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SavedItem));

      setSavedItems(savedItemsData);

      // Get reel details for saved items
      const reelIds = savedItemsData
        .filter(item => item.reelId)
        .map(item => item.reelId);

      if (reelIds.length > 0) {
        const reelsData: Reel[] = [];
        
        // Fetch reels in batches
        const batchSize = 10;
        for (let i = 0; i < reelIds.length; i += batchSize) {
          const batch = reelIds.slice(i, i + batchSize);
          const reelsQuery = await firestore()
            .collection('reels')
            .where(firestore.FieldPath.documentId(), 'in', batch)
            .get();
            
          const batchReels = reelsQuery.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Reel));
          
          reelsData.push(...batchReels);
        }
        
        setSavedReels(reelsData);
      }

    } catch (error) {
      console.error('Error fetching saved items:', error);
      Alert.alert('Error', 'Failed to load saved posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  // Remove item from saved
  const removeSavedItem = useCallback(async (reelId: string) => {
    if (!user?.uid) return;

    try {
      const saveRef = firestore()
        .collection('saves')
        .doc(`${reelId}_${user.uid}`);
      
      await saveRef.delete();
      
      // Update local state
      setSavedItems(prev => prev.filter(item => item.reelId !== reelId));
      setSavedReels(prev => prev.filter(reel => reel.id !== reelId));
      
    } catch (error) {
      console.error('Error removing saved item:', error);
      Alert.alert('Error', 'Failed to remove saved item');
    }
  }, [user?.uid]);

  // Navigate to reel
  const openReel = useCallback((reel: Reel) => {
    (navigation as any).navigate('Reels', { 
      initialReelId: reel.id,
      fromProfile: true 
    });
  }, [navigation]);

  // Initial load
  useEffect(() => {
    fetchSavedItems();
  }, [fetchSavedItems]);

  // Render saved reel item
  const renderSavedItem = ({ item: savedItem }: { item: SavedItem }) => {
    const reel = savedReels.find(r => r.id === savedItem.reelId);
    
    if (!reel) return null;

    return (
      <TouchableOpacity
        style={styles.savedItem}
        onPress={() => openReel(reel)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: reel.thumbnailUrl || reel.videoUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        
        {/* Overlay */}
        <View style={styles.overlay}>
          <View style={styles.overlayTop}>
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => {
                Alert.alert(
                  'Remove from Saved',
                  'Are you sure you want to remove this from saved posts?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Remove', 
                      style: 'destructive',
                      onPress: () => removeSavedItem(reel.id)
                    }
                  ]
                );
              }}
            >
              <Icon name="bookmark" size={20} color="#ffd700" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.overlayBottom}>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Icon name="favorite" size={16} color="#fff" />
                <Text style={styles.statText}>{reel.likesCount || 0}</Text>
              </View>
              <View style={styles.stat}>
                <Icon name="visibility" size={16} color="#fff" />
                <Text style={styles.statText}>{reel.viewsCount || 0}</Text>
              </View>
            </View>
            
            {reel.user && (
              <View style={styles.userInfo}>
                <ReelsProfilePicture
                  userId={reel.user.id}
                  size={24}
                />
                <Text style={styles.username} numberOfLines={1}>
                  {reel.user.username}
                </Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Video indicator */}
        <View style={styles.videoIndicator}>
          <Icon name="play-arrow" size={20} color="#fff" />
        </View>
      </TouchableOpacity>
    );
  };

  // Empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="bookmark-border" size={80} color={isDarkMode ? '#666' : '#999'} />
      <Text style={[styles.emptyTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
        No Saved Posts
      </Text>
      <Text style={[styles.emptySubtitle, { color: isDarkMode ? '#999' : '#666' }]}>
        Posts and reels you save will appear here
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={24} color={isDarkMode ? '#fff' : '#000'} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
            Saved
          </Text>
          <View style={styles.headerRight} />
        </View>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1DA1F2" />
          <Text style={[styles.loadingText, { color: isDarkMode ? '#999' : '#666' }]}>
            Loading saved posts...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#000' : '#fff' }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={isDarkMode ? '#fff' : '#000'} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#000' }]}>
          Saved
        </Text>
        <TouchableOpacity
          style={styles.headerRight}
          onPress={() => fetchSavedItems(true)}
        >
          <Icon name="refresh" size={24} color={isDarkMode ? '#fff' : '#000'} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={savedItems}
        keyExtractor={(item) => item.id}
        renderItem={renderSavedItem}
        numColumns={3}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchSavedItems(true)}
            colors={['#1DA1F2']}
            tintColor={'#1DA1F2'}
          />
        }
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
        columnWrapperStyle={styles.row}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  grid: {
    padding: 2,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  savedItem: {
    width: itemSize,
    height: itemSize,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 1,
    marginVertical: 1,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'space-between',
    padding: 8,
  },
  overlayTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  removeButton: {
    padding: 4,
  },
  overlayBottom: {
    gap: 8,
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  username: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default SavedPostsScreen;
