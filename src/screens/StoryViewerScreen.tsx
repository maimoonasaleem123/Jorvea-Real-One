import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { InstagramStoryViewer } from '../components/InstagramStoryComponents';
import { Story } from '../services/firebaseService';

interface StoryViewerParams {
  userStories: Story[];
  initialIndex?: number;
}

export default function StoryViewerScreen(): React.JSX.Element {
  const route = useRoute();
  const navigation = useNavigation();
  const { userStories, initialIndex = 0 } = route.params as StoryViewerParams;

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <InstagramStoryViewer
        visible={true}
        userStories={userStories}
        initialIndex={initialIndex}
        onClose={handleClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
