import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/FastAuthContext';
import ProfilePictureUpload from '../components/ProfilePictureUpload';
import { FirebaseService } from '../services/firebaseService';
import { User } from '../types';

export default function EditProfileScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { user: authUser } = useAuth();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form states
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [storageType, setStorageType] = useState<'digitalocean' | 'base64'>('digitalocean');

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      if (!authUser?.uid) return;
      
      setLoading(true);
      let userProfile = await FirebaseService.getUserProfile(authUser.uid);
      
      // If user doesn't exist, create one with dynamic data
      if (!userProfile) {
        userProfile = await FirebaseService.createOrGetDynamicUser(authUser.uid, authUser.email);
      }
      
      setUser(userProfile);
      setDisplayName(userProfile.displayName || '');
      setUsername(userProfile.username || '');
      setBio(userProfile.bio || '');
      setWebsite(userProfile.website || '');
      setPhone(userProfile.phoneNumber || '');
      setIsPrivate(userProfile.isPrivate || false);
      
    } catch (error) {
      console.error('Error loading user profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!authUser?.uid) return;
      
      setSaving(true);
      
      await FirebaseService.updateUserProfile(authUser.uid, {
        displayName,
        username,
        bio,
        website,
        phoneNumber: phone,
        isPrivate,
      });
      
      Alert.alert('Success', 'Profile updated successfully!');
      navigation.goBack();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleProfilePictureUpload = (imageUrl: string) => {
    if (user) {
      setUser({
        ...user,
        profilePicture: imageUrl,
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <Icon name="close" size={24} color="#262626" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity 
          onPress={handleSave} 
          style={styles.headerButton}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#E1306C" />
          ) : (
            <Icon name="checkmark" size={24} color="#E1306C" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Picture Upload Section */}
        <ProfilePictureUpload
          userId={authUser?.uid || ''}
          currentProfilePicture={user?.profilePicture}
          onUploadComplete={handleProfilePictureUpload}
          storage={storageType}
        />

        {/* Storage Type Selection */}
        <View style={styles.storageSection}>
          <Text style={styles.sectionTitle}>Storage Options</Text>
          <View style={styles.storageOption}>
            <TouchableOpacity 
              style={styles.storageButton}
              onPress={() => setStorageType('digitalocean')}
            >
              <View style={styles.radioButton}>
                {storageType === 'digitalocean' && <View style={styles.radioSelected} />}
              </View>
              <Text style={styles.storageLabel}>DigitalOcean Spaces (Recommended)</Text>
            </TouchableOpacity>
            <Text style={styles.storageDescription}>Fast CDN delivery, optimized for performance</Text>
          </View>
          
          <View style={styles.storageOption}>
            <TouchableOpacity 
              style={styles.storageButton}
              onPress={() => setStorageType('base64')}
            >
              <View style={styles.radioButton}>
                {storageType === 'base64' && <View style={styles.radioSelected} />}
              </View>
              <Text style={styles.storageLabel}>Base64 in Firestore</Text>
            </TouchableOpacity>
            <Text style={styles.storageDescription}>Stored directly in database, slower loading</Text>
          </View>
        </View>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your display name"
              placeholderTextColor="#999"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              placeholderTextColor="#999"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell people about yourself..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Website</Text>
            <TextInput
              style={styles.input}
              value={website}
              onChangeText={setWebsite}
              placeholder="https://yourwebsite.com"
              placeholderTextColor="#999"
              autoCapitalize="none"
              keyboardType="url"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="Phone number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
          </View>

          {/* Privacy Settings */}
          <View style={styles.inputGroup}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.label}>Private Account</Text>
                <Text style={styles.switchDescription}>
                  Only followers can see your posts
                </Text>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={setIsPrivate}
                trackColor={{ false: '#E0E0E0', true: '#E1306C' }}
                thumbColor={isPrivate ? '#FFF' : '#F4F3F4'}
              />
            </View>
          </View>

          {/* Current User Info Display */}
          <View style={styles.userInfoSection}>
            <Text style={styles.sectionTitle}>Account Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{authUser?.email || 'Not set'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>User ID:</Text>
              <Text style={styles.infoValue}>{authUser?.uid || 'Not available'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Joined:</Text>
              <Text style={styles.infoValue}>
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  content: {
    flex: 1,
  },
  storageSection: {
    backgroundColor: '#F8F9FA',
    margin: 15,
    padding: 15,
    borderRadius: 10,
  },
  storageOption: {
    marginVertical: 8,
  },
  storageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  storageLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#262626',
  },
  storageDescription: {
    fontSize: 14,
    color: '#666',
    marginLeft: 30,
  },
  formSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DBDBDB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#262626',
    backgroundColor: '#FAFAFA',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
    marginRight: 15,
  },
  switchDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  userInfoSection: {
    backgroundColor: '#F8F9FA',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#262626',
    flex: 1,
    textAlign: 'right',
    marginLeft: 15,
  },
});
