/**
 * HomeScreen - Instagram-Style Feed
 * Simple and clean implementation
 */

import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import InstagramFeedScreen from './InstagramFeedScreen';

const HomeScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <InstagramFeedScreen />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default HomeScreen;
