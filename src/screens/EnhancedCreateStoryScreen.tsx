import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Dimensions,
  TextInput,
  Alert,
  PanResponder,
  Animated,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary, MediaType, PhotoQuality } from 'react-native-image-picker';
import { useAuth } from '../context/FastAuthContext';
import FirebaseService from '../services/firebaseService';
import DigitalOceanService from '../services/digitalOceanService';

const { width, height } = Dimensions.get('window');

interface StoryFilter {
  id: string;
  name: string;
  preview: string;
  filter: string;
}

interface StorySticker {
  id: string;
  type: 'emoji' | 'gif' | 'location' | 'mention' | 'poll' | 'question';
  content: string;
  position: { x: number; y: number };
  size: number;
  rotation: number;
}

export default function EnhancedCreateStoryScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [storyText, setStoryText] = useState('');
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<StoryFilter | null>(null);
  const [stickers, setStickers] = useState<StorySticker[]>([]);
  const [uploading, setUploading] = useState(false);

  const filters: StoryFilter[] = [
    { id: 'none', name: 'Original', preview: '', filter: 'none' },
    { id: 'vintage', name: 'Vintage', preview: '🌅', filter: 'sepia(0.8) contrast(1.2)' },
    { id: 'bw', name: 'B&W', preview: '⚫', filter: 'grayscale(1)' },
    { id: 'bright', name: 'Bright', preview: '☀️', filter: 'brightness(1.3) contrast(1.1)' },
    { id: 'cold', name: 'Cold', preview: '❄️', filter: 'hue-rotate(180deg) saturate(1.2)' },
    { id: 'warm', name: 'Warm', preview: '🔥', filter: 'hue-rotate(20deg) saturate(1.3)' },
  ];

  const emojiStickers = ['😀', '😍', '🔥', '💯', '❤️', '👌', '🎉', '✨', '🌟', '💫'];

  const selectMedia = () => {
    const options = {
      mediaType: 'mixed' as MediaType,
      quality: 0.8 as PhotoQuality,
      videoQuality: 'medium' as any,
    };

    launchImageLibrary(options, (response) => {
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setSelectedMedia(asset.uri!);
        setMediaType(asset.type?.startsWith('video') ? 'video' : 'image');
      }
    });
  };

  const addTextSticker = () => {
    if (storyText.trim()) {
      const newSticker: StorySticker = {
        id: Date.now().toString(),
        type: 'emoji',
        content: storyText,
        position: { x: width / 2, y: height / 2 },
        size: 1,
        rotation: 0,
      };
      setStickers([...stickers, newSticker]);
      setStoryText('');
      setShowTextEditor(false);
    }
  };

  const addEmojiSticker = (emoji: string) => {
    const newSticker: StorySticker = {
      id: Date.now().toString(),
      type: 'emoji',
      content: emoji,
      position: { x: width / 2, y: height / 2 },
      size: 1,
      rotation: 0,
    };
    setStickers([...stickers, newSticker]);
    setShowStickers(false);
  };

  const addPollSticker = () => {
    Alert.prompt(
      'Create Poll',
      'What do you want to ask?',
      (question) => {
        if (question) {
          const newSticker: StorySticker = {
            id: Date.now().toString(),
            type: 'poll',
            content: JSON.stringify({
              question,
              options: ['Yes', 'No'],
              votes: { Yes: 0, No: 0 }
            }),
            position: { x: width / 2, y: height / 2 },
            size: 1,
            rotation: 0,
          };
          setStickers([...stickers, newSticker]);
          setShowStickers(false);
        }
      }
    );
  };

  const createSticker = (position: { x: number; y: number }, sticker: StorySticker) => {
    const pan = useRef(new Animated.ValueXY()).current;
    const scale = useRef(new Animated.Value(1)).current;
    const rotation = useRef(new Animated.Value(0)).current;

    const panResponder = PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        Animated.spring(scale, { toValue: 1.1, useNativeDriver: false }).start();
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();
      },
    });

    return (
      <Animated.View
        key={sticker.id}
        style={[
          styles.sticker,
          {
            left: position.x - 50,
            top: position.y - 25,
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale },
              { rotate: rotation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }) },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        {sticker.type === 'poll' ? (
          <View style={styles.pollSticker}>
            <Text style={styles.pollQuestion}>
              {JSON.parse(sticker.content).question}
            </Text>
            <View style={styles.pollOptions}>
              <TouchableOpacity style={styles.pollOption}>
                <Text style={styles.pollOptionText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pollOption}>
                <Text style={styles.pollOptionText}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={styles.stickerText}>{sticker.content}</Text>
        )}
        <TouchableOpacity
          style={styles.removeSticker}
          onPress={() => setStickers(stickers.filter(s => s.id !== sticker.id))}
        >
          <Icon name="close-circle" size={20} color="#ff3040" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const publishStory = async () => {
    if (!selectedMedia || !user) return;

    setUploading(true);
    try {
      // Upload media to Firebase Storage
      const mediaUrl = await DigitalOceanService.uploadMedia(selectedMedia, `story_${Date.now()}`);
      
      // Create story with enhanced features
      const storyData: any = {
        userId: user.uid,
        mediaUrl,
        mediaType,
        duration: mediaType === 'video' ? 15 : 5,
        viewsCount: 0,
        viewers: [],
        likesCount: 0,
        isLiked: false,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      };

      // Only add optional fields if they have values
      if (storyText) {
        storyData.caption = storyText;
      }
      if (selectedFilter && selectedFilter.filter !== 'none') {
        storyData.filter = selectedFilter;
      }
      if (stickers.length > 0) {
        storyData.stickers = stickers;
      }

      await FirebaseService.createStory(storyData);
      
      Alert.alert('Success', 'Your story has been published!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      console.error('Error publishing story:', error);
      Alert.alert('Error', 'Failed to publish story. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Story</Text>
        <TouchableOpacity 
          onPress={publishStory}
          disabled={!selectedMedia || uploading}
          style={[styles.publishButton, (!selectedMedia || uploading) && styles.disabledButton]}
        >
          <Text style={styles.publishText}>
            {uploading ? 'Publishing...' : 'Share'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Media Preview */}
      <View style={styles.mediaContainer}>
        {selectedMedia ? (
          <View style={styles.mediaPreview}>
            <Image
              source={{ uri: selectedMedia }}
              style={styles.media}
              resizeMode="cover"
            />
            
            {/* Render Stickers */}
            {stickers.map((sticker) => 
              createSticker(sticker.position, sticker)
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.selectMediaButton} onPress={selectMedia}>
            <Icon name="camera" size={48} color="#ccc" />
            <Text style={styles.selectMediaText}>Tap to select photo or video</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tools */}
      {selectedMedia && (
        <View style={styles.toolsContainer}>
          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => setShowTextEditor(true)}
          >
            <Icon name="text" size={24} color="#000" />
            <Text style={styles.toolLabel}>Text</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => setShowStickers(true)}
          >
            <Icon name="happy" size={24} color="#000" />
            <Text style={styles.toolLabel}>Stickers</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.toolButton}
            onPress={() => setShowFilters(true)}
          >
            <Icon name="color-filter" size={24} color="#000" />
            <Text style={styles.toolLabel}>Filters</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.toolButton}
            onPress={addPollSticker}
          >
            <Icon name="bar-chart" size={24} color="#000" />
            <Text style={styles.toolLabel}>Poll</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Text Editor Modal */}
      <Modal visible={showTextEditor} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.textEditorContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Enter your text..."
              value={storyText}
              onChangeText={setStoryText}
              multiline
              autoFocus
            />
            <View style={styles.textEditorButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => setShowTextEditor(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={addTextSticker}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filters Modal */}
      <Modal visible={showFilters} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.filtersContainer}>
            <Text style={styles.modalTitle}>Choose Filter</Text>
            <View style={styles.filtersGrid}>
              {filters.map((filter) => (
                <TouchableOpacity
                  key={filter.id}
                  style={[
                    styles.filterItem,
                    selectedFilter?.id === filter.id && styles.selectedFilter
                  ]}
                  onPress={() => {
                    setSelectedFilter(filter);
                    setShowFilters(false);
                  }}
                >
                  <Text style={styles.filterPreview}>{filter.preview}</Text>
                  <Text style={styles.filterName}>{filter.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Stickers Modal */}
      <Modal visible={showStickers} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.stickersContainer}>
            <Text style={styles.modalTitle}>Add Stickers</Text>
            <View style={styles.stickersGrid}>
              {emojiStickers.map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.stickerItem}
                  onPress={() => addEmojiSticker(emoji)}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={() => setShowStickers(false)}
            >
              <Text style={styles.closeModalText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  publishButton: {
    backgroundColor: '#E1306C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  publishText: {
    color: '#fff',
    fontWeight: '600',
  },
  mediaContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  selectMediaButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  selectMediaText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  mediaPreview: {
    flex: 1,
    position: 'relative',
  },
  media: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  sticker: {
    position: 'absolute',
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    minWidth: 100,
  },
  stickerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  removeSticker: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  pollSticker: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 12,
    padding: 12,
    minWidth: 200,
  },
  pollQuestion: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  pollOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  pollOption: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  pollOptionText: {
    color: '#fff',
    fontWeight: '500',
  },
  toolsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
  },
  toolButton: {
    alignItems: 'center',
    padding: 8,
  },
  toolLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textEditorContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: width - 40,
    maxHeight: 300,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  textEditorButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  cancelButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  addButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#E1306C',
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: width - 40,
    maxHeight: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  filtersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  filterItem: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
  },
  selectedFilter: {
    borderColor: '#E1306C',
  },
  filterPreview: {
    fontSize: 24,
    marginBottom: 4,
  },
  filterName: {
    fontSize: 12,
    color: '#666',
  },
  stickersContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: width - 40,
    maxHeight: 400,
  },
  stickersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  stickerItem: {
    width: '18%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emoji: {
    fontSize: 32,
  },
  closeModalButton: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#E1306C',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalText: {
    color: '#fff',
    fontWeight: '600',
  },
});
