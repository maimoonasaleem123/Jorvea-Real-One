import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { launchImageLibrary, MediaType } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

interface MediaItem {
  id: string;
  uri: string;
  type: 'image' | 'video';
}

interface MultiMediaSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelectMedia: (media: MediaItem[]) => void;
  selectedMedia: MediaItem[];
  maxSelection: number;
}

export const MultiMediaSelector: React.FC<MultiMediaSelectorProps> = ({
  visible,
  onClose,
  onSelectMedia,
  selectedMedia,
  maxSelection = 10,
}) => {
  const [tempSelectedMedia, setTempSelectedMedia] = useState<MediaItem[]>(selectedMedia);

  const handleSelectFromGallery = () => {
    const options = {
      mediaType: 'mixed' as MediaType,
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      selectionLimit: maxSelection - tempSelectedMedia.length,
    };

    launchImageLibrary(options, (response) => {
      if (response.assets) {
        const newMedia: MediaItem[] = response.assets.map((asset, index) => ({
          id: `${Date.now()}_${index}`,
          uri: asset.uri || '',
          type: asset.type?.includes('video') ? 'video' : 'image',
        }));
        setTempSelectedMedia(prev => [...prev, ...newMedia]);
      }
    });
  };

  const handleRemoveMedia = (id: string) => {
    setTempSelectedMedia(prev => prev.filter(item => item.id !== id));
  };

  const handleDone = () => {
    onSelectMedia(tempSelectedMedia);
    onClose();
  };

  const handleCancel = () => {
    setTempSelectedMedia(selectedMedia);
    onClose();
  };

  const renderMediaItem = ({ item, index }: { item: MediaItem; index: number }) => (
    <View style={styles.mediaItem}>
      <Image source={{ uri: item.uri }} style={styles.mediaImage} />
      {item.type === 'video' && (
        <View style={styles.videoIndicator}>
          <Icon name="play-circle-filled" size={24} color="#fff" />
        </View>
      )}
      <View style={styles.mediaOrder}>
        <Text style={styles.mediaOrderText}>{index + 1}</Text>
      </View>
      <TouchableOpacity
        style={styles.removeMediaButton}
        onPress={() => handleRemoveMedia(item.id)}
      >
        <Icon name="close" size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Media ({tempSelectedMedia.length}/{maxSelection})</Text>
          <TouchableOpacity onPress={handleDone}>
            <Text style={styles.doneButton}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {tempSelectedMedia.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon name="photo-library" size={64} color="#ccc" />
              <Text style={styles.emptyStateText}>No media selected</Text>
              <Text style={styles.emptyStateSubtext}>You can select up to {maxSelection} photos or videos</Text>
            </View>
          ) : (
            <FlatList
              data={tempSelectedMedia}
              keyExtractor={(item) => item.id}
              renderItem={renderMediaItem}
              numColumns={2}
              style={styles.mediaList}
              contentContainerStyle={styles.mediaListContent}
            />
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.selectButton,
              tempSelectedMedia.length >= maxSelection && styles.selectButtonDisabled,
            ]}
            onPress={handleSelectFromGallery}
            disabled={tempSelectedMedia.length >= maxSelection}
          >
            <Icon name="add-photo-alternate" size={24} color="#fff" />
            <Text style={styles.selectButtonText}>Add Media</Text>
          </TouchableOpacity>
        </View>
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
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  doneButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1DA1F2',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  mediaList: {
    flex: 1,
  },
  mediaListContent: {
    padding: 8,
  },
  mediaItem: {
    width: (width - 32) / 2,
    height: (width - 32) / 2,
    margin: 4,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoIndicator: {
    position: 'absolute',
    bottom: 8,
    left: 8,
  },
  mediaOrder: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaOrderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  removeMediaButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 68, 68, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1DA1F2',
    paddingVertical: 12,
    borderRadius: 8,
  },
  selectButtonDisabled: {
    backgroundColor: '#ccc',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
