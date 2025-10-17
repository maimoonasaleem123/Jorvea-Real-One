import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  SafeAreaView,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary, launchCamera, MediaType, ImagePickerResponse, PhotoQuality } from 'react-native-image-picker';
import { useAuth } from '../context/FastAuthContext';

const { width, height } = Dimensions.get('window');

export default function SafeStoryCreationScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video'>('photo');
  const [isLoading, setIsLoading] = useState(false);

  const handleImagePicker = () => {
    Alert.alert(
      'Select Media',
      'Choose how you want to add media',
      [
        { text: 'Camera', onPress: openCamera },
        { text: 'Gallery', onPress: openGallery },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const openCamera = () => {
    const options = {
      mediaType: 'mixed' as MediaType,
      quality: 0.8 as PhotoQuality,
      includeBase64: false,
    };

    launchCamera(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setSelectedMedia(asset.uri || '');
        setMediaType(asset.type?.includes('video') ? 'video' : 'photo');
      }
    });
  };

  const openGallery = () => {
    const options = {
      mediaType: 'mixed' as MediaType,
      quality: 0.8 as PhotoQuality,
      includeBase64: false,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setSelectedMedia(asset.uri || '');
        setMediaType(asset.type?.includes('video') ? 'video' : 'photo');
      }
    });
  };

  const handleNext = () => {
    if (!selectedMedia) {
      Alert.alert('No Media', 'Please select a photo or video first');
      return;
    }

    // Navigate back with the selected media
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Create Story</Text>
        <TouchableOpacity onPress={handleNext} disabled={!selectedMedia}>
          <Text style={[styles.nextButton, !selectedMedia && styles.disabled]}>
            Next
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mediaContainer}>
        {selectedMedia ? (
          <View style={styles.mediaPreview}>
            <Image source={{ uri: selectedMedia }} style={styles.media} />
            {mediaType === 'video' && (
              <View style={styles.videoIndicator}>
                <Icon name="play-circle" size={50} color="white" />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Icon name="camera-outline" size={80} color="#ccc" />
            <Text style={styles.emptyText}>No media selected</Text>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.selectButton} onPress={handleImagePicker}>
          <Icon name="add-circle" size={24} color="white" />
          <Text style={styles.selectText}>Select Media</Text>
        </TouchableOpacity>
      </View>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  nextButton: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007bff',
  },
  disabled: {
    color: '#ccc',
  },
  mediaContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaPreview: {
    width: width,
    height: height * 0.7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoIndicator: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#ccc',
    marginTop: 16,
  },
  controls: {
    padding: 20,
    alignItems: 'center',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  selectText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 16,
    fontSize: 16,
  },
});
