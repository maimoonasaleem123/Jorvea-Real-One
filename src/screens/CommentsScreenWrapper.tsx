import React from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';
import { CommentsScreen } from '../components/CommentsScreen';

export default function CommentsScreenWrapper() {
  const route = useRoute();
  const navigation = useNavigation();
  
  const { reelId, postId, contentType = 'reel' } = route.params as {
    reelId?: string;
    postId?: string;
    contentType?: 'post' | 'reel';
  };

  return (
    <CommentsScreen
      visible={true}
      onClose={() => navigation.goBack()}
      reelId={reelId}
      postId={postId}
      contentType={contentType}
    />
  );
}
