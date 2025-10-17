import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView, 
  TouchableOpacity, 
  ScrollView,
  Dimensions,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

function CreateScreen(): React.JSX.Element {
  const navigation = useNavigation();

  const createOptions = [
    {
      id: 'post',
      title: 'Post',
      subtitle: 'Share photos and videos with filters & effects',
      icon: 'image-outline',
      color: '#0095f6',
      screen: 'CreatePost',
    },
    {
      id: 'story',
      title: 'Story',
      subtitle: 'Instagram-style with filters & effects',
      icon: 'sparkles-outline',
      color: '#ff9500',
      screen: 'ComprehensiveStoryCreation',
    },
    {
      id: 'reel',
      title: 'Reel',
      subtitle: 'Short entertaining videos',
      icon: 'videocam-outline',
      color: '#ff5722',
      screen: 'CreateReel',
    },
    {
      id: 'live',
      title: 'Live',
      subtitle: 'Go live with your audience',
      icon: 'radio-outline',
      color: '#9c27b0',
      screen: null, // Not implemented yet
    },
  ];

  const handleCreateOption = (option: any) => {
    if (option.screen) {
      navigation.navigate(option.screen as never);
    } else {
      Alert.alert('Coming Soon', 'This feature is being worked on!');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings' as never)}
        >
          <Icon name="settings-outline" size={24} color="#262626" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>What would you like to create?</Text>
        
        <View style={styles.optionsContainer}>
          {createOptions.map((option, index) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.optionCard,
                index % 2 === 0 ? styles.leftCard : styles.rightCard
              ]}
              onPress={() => handleCreateOption(option)}
              activeOpacity={0.8}
            >
              <View style={[styles.iconContainer, { backgroundColor: option.color }]}>
                <Icon name={option.icon} size={32} color="#ffffff" />
              </View>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('CreatePost' as never)}
          >
            <Icon name="camera-outline" size={24} color="#0095f6" />
            <Text style={styles.quickActionText}>Take Photo</Text>
            <Icon name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('CreateReel' as never)}
          >
            <Icon name="videocam-outline" size={24} color="#ff5722" />
            <Text style={styles.quickActionText}>Record Video</Text>
            <Icon name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionButton}
            onPress={() => navigation.navigate('ComprehensiveStoryCreation' as never)}
          >
            <Icon name="sparkles-outline" size={24} color="#e91e63" />
            <Text style={styles.quickActionText}>Create Story</Text>
            <Icon name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>

        <View style={styles.tips}>
          <Text style={styles.sectionTitle}>Tips for Creating</Text>
          
          <View style={styles.tipCard}>
            <Icon name="bulb-outline" size={20} color="#ffa726" />
            <Text style={styles.tipText}>
              Use good lighting and stable hands for better quality content
            </Text>
          </View>
          
          <View style={styles.tipCard}>
            <Icon name="heart-outline" size={20} color="#e91e63" />
            <Text style={styles.tipText}>
              Engage with your audience by responding to comments
            </Text>
          </View>
          
          <View style={styles.tipCard}>
            <Icon name="trending-up-outline" size={20} color="#4caf50" />
            <Text style={styles.tipText}>
              Post consistently to grow your following
            </Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#262626',
  },
  settingsButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
    marginTop: 24,
    marginBottom: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  optionCard: {
    width: (width - 48) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  leftCard: {
    marginRight: 8,
  },
  rightCard: {
    marginLeft: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 16,
  },
  quickActions: {
    marginTop: 8,
  },
  quickActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    marginBottom: 8,
  },
  quickActionText: {
    flex: 1,
    fontSize: 16,
    color: '#262626',
    marginLeft: 12,
    fontWeight: '500',
  },
  tips: {
    marginTop: 8,
    paddingBottom: 32,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#495057',
    marginLeft: 12,
    lineHeight: 20,
  },
});

export default CreateScreen;
