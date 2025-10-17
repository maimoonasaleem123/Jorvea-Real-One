import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  coverUrl: string;
  audioUrl: string;
  category: string;
  trending?: boolean;
}

interface MusicSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelectMusic: (track: MusicTrack | null) => void;
  selectedMusic: MusicTrack | null;
}

export const MusicSelector: React.FC<MusicSelectorProps> = ({
  visible,
  onClose,
  onSelectMusic,
  selectedMusic,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('trending');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<MusicTrack[]>([]);

  // Mock music data - in real app this would come from a music API
  const mockTracks: MusicTrack[] = [
    {
      id: '1',
      title: 'Blinding Lights',
      artist: 'The Weeknd',
      duration: 200,
      coverUrl: 'https://picsum.photos/200/200?random=1',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      category: 'trending',
      trending: true,
    },
    {
      id: '2',
      title: 'Good 4 U',
      artist: 'Olivia Rodrigo',
      duration: 178,
      coverUrl: 'https://picsum.photos/200/200?random=2',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
      category: 'trending',
      trending: true,
    },
    {
      id: '3',
      title: 'Stay',
      artist: 'The Kid LAROI & Justin Bieber',
      duration: 141,
      coverUrl: 'https://picsum.photos/200/200?random=3',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
      category: 'trending',
      trending: true,
    },
    {
      id: '4',
      title: 'Levitating',
      artist: 'Dua Lipa',
      duration: 203,
      coverUrl: 'https://picsum.photos/200/200?random=4',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
      category: 'pop',
    },
    {
      id: '5',
      title: 'Industry Baby',
      artist: 'Lil Nas X & Jack Harlow',
      duration: 212,
      coverUrl: 'https://picsum.photos/200/200?random=5',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
      category: 'hip-hop',
    },
    {
      id: '6',
      title: 'Heat Waves',
      artist: 'Glass Animals',
      duration: 238,
      coverUrl: 'https://picsum.photos/200/200?random=6',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
      category: 'indie',
    },
    {
      id: '7',
      title: 'Bad Habits',
      artist: 'Ed Sheeran',
      duration: 231,
      coverUrl: 'https://picsum.photos/200/200?random=7',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
      category: 'pop',
    },
    {
      id: '8',
      title: 'Montero',
      artist: 'Lil Nas X',
      duration: 137,
      coverUrl: 'https://picsum.photos/200/200?random=8',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
      category: 'hip-hop',
    },
  ];

  const categories = [
    { id: 'trending', label: 'Trending', icon: 'trending-up' },
    { id: 'pop', label: 'Pop', icon: 'music-note' },
    { id: 'hip-hop', label: 'Hip Hop', icon: 'headset' },
    { id: 'indie', label: 'Indie', icon: 'album' },
    { id: 'electronic', label: 'Electronic', icon: 'equalizer' },
  ];

  useEffect(() => {
    setTracks(mockTracks);
  }, []);

  useEffect(() => {
    let filtered = tracks;

    if (selectedCategory !== 'trending') {
      filtered = tracks.filter(track => track.category === selectedCategory);
    } else {
      filtered = tracks.filter(track => track.trending);
    }

    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(
        track =>
          track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          track.artist.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTracks(filtered);
  }, [tracks, selectedCategory, searchQuery]);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSelectTrack = (track: MusicTrack) => {
    onSelectMusic(track);
    onClose();
  };

  const handleRemoveMusic = () => {
    onSelectMusic(null);
    onClose();
  };

  const renderCategoryItem = ({ item }: { item: typeof categories[0] }) => (
    <TouchableOpacity
      style={[
        styles.categoryItem,
        selectedCategory === item.id && styles.categoryItemSelected,
      ]}
      onPress={() => setSelectedCategory(item.id)}
    >
      <Icon
        name={item.icon}
        size={20}
        color={selectedCategory === item.id ? '#fff' : '#666'}
      />
      <Text
        style={[
          styles.categoryItemText,
          selectedCategory === item.id && styles.categoryItemTextSelected,
        ]}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const renderTrackItem = ({ item }: { item: MusicTrack }) => (
    <TouchableOpacity
      style={[
        styles.trackItem,
        selectedMusic?.id === item.id && styles.trackItemSelected,
      ]}
      onPress={() => handleSelectTrack(item)}
    >
      <Image source={{ uri: item.coverUrl }} style={styles.trackCover} />
      <View style={styles.trackInfo}>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {item.artist}
        </Text>
        <Text style={styles.trackDuration}>{formatDuration(item.duration)}</Text>
      </View>
      {item.trending && (
        <View style={styles.trendingBadge}>
          <Icon name="trending-up" size={12} color="#fff" />
        </View>
      )}
      {selectedMusic?.id === item.id && (
        <Icon name="check-circle" size={24} color="#1DA1F2" />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Music</Text>
          {selectedMusic && (
            <TouchableOpacity onPress={handleRemoveMusic}>
              <Text style={styles.removeButton}>Remove</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for music..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.categoriesContainer}>
          <FlatList
            horizontal
            data={categories}
            keyExtractor={(item) => item.id}
            renderItem={renderCategoryItem}
            showsHorizontalScrollIndicator={false}
            style={styles.categoriesList}
          />
        </View>

        {selectedMusic && (
          <View style={styles.selectedMusicContainer}>
            <Text style={styles.selectedMusicLabel}>Selected Music:</Text>
            <View style={styles.selectedMusicInfo}>
              <Image source={{ uri: selectedMusic.coverUrl }} style={styles.selectedMusicCover} />
              <View style={styles.selectedMusicDetails}>
                <Text style={styles.selectedMusicTitle}>{selectedMusic.title}</Text>
                <Text style={styles.selectedMusicArtist}>{selectedMusic.artist}</Text>
              </View>
              <Icon name="music-note" size={24} color="#1DA1F2" />
            </View>
          </View>
        )}

        <FlatList
          data={filteredTracks}
          keyExtractor={(item) => item.id}
          renderItem={renderTrackItem}
          style={styles.tracksList}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  removeButton: {
    fontSize: 16,
    color: '#FF4444',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  categoriesContainer: {
    paddingVertical: 8,
  },
  categoriesList: {
    paddingHorizontal: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  categoryItemSelected: {
    backgroundColor: '#1DA1F2',
  },
  categoryItemText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6,
    fontWeight: '500',
  },
  categoryItemTextSelected: {
    color: '#fff',
  },
  selectedMusicContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectedMusicLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  selectedMusicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedMusicCover: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 12,
  },
  selectedMusicDetails: {
    flex: 1,
  },
  selectedMusicTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  selectedMusicArtist: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  tracksList: {
    flex: 1,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    position: 'relative',
  },
  trackItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  trackCover: {
    width: 50,
    height: 50,
    borderRadius: 6,
    marginRight: 12,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  trackArtist: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  trackDuration: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  trendingBadge: {
    position: 'absolute',
    top: 8,
    right: 60,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
