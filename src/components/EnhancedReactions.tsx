import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  Modal,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');

interface Reaction {
  id: string;
  emoji: string;
  name: string;
  color: string[];
  animation: 'bounce' | 'pulse' | 'rotate' | 'shake' | 'flip';
  sound?: string;
  description: string;
}

interface EnhancedReactionsProps {
  postId: string;
  currentReaction?: string;
  reactionCounts: { [key: string]: number };
  onReaction: (reactionId: string) => void;
  showAsRow?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const EnhancedReactions: React.FC<EnhancedReactionsProps> = ({
  postId,
  currentReaction,
  reactionCounts,
  onReaction,
  showAsRow = false,
  size = 'medium',
}) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [animatingReactions, setAnimatingReactions] = useState<Set<string>>(new Set());
  const [selectedReaction, setSelectedReaction] = useState<string | null>(currentReaction || null);
  
  // Animation refs
  const scaleAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const rotateAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const bounceAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const pulseAnims = useRef<{ [key: string]: Animated.Value }>({}).current;

  // Enhanced reaction types
  const reactions: Reaction[] = [
    {
      id: 'love',
      emoji: '❤️',
      name: 'Love',
      color: ['#FF6B6B', '#FF8E53'],
      animation: 'pulse',
      description: 'Show your love!'
    },
    {
      id: 'like',
      emoji: '👍',
      name: 'Like',
      color: ['#4ECDC4', '#44A08D'],
      animation: 'bounce',
      description: 'Give it a thumbs up!'
    },
    {
      id: 'fire',
      emoji: '🔥',
      name: 'Fire',
      color: ['#FF9500', '#FF5722'],
      animation: 'shake',
      description: 'This is fire!'
    },
    {
      id: 'laugh',
      emoji: '😂',
      name: 'Laugh',
      color: ['#FFD93D', '#6BCF7F'],
      animation: 'bounce',
      description: 'So funny!'
    },
    {
      id: 'wow',
      emoji: '😮',
      name: 'Wow',
      color: ['#A8E6CF', '#3D5A80'],
      animation: 'flip',
      description: 'Amazing!'
    },
    {
      id: 'angry',
      emoji: '😡',
      name: 'Angry',
      color: ['#FF6B6B', '#8B0000'],
      animation: 'shake',
      description: 'Not happy about this'
    },
    {
      id: 'sad',
      emoji: '😢',
      name: 'Sad',
      color: ['#667eea', '#764ba2'],
      animation: 'pulse',
      description: 'This makes me sad'
    },
    {
      id: 'celebrate',
      emoji: '🎉',
      name: 'Celebrate',
      color: ['#FF9A9E', '#FECFEF'],
      animation: 'rotate',
      description: 'Time to celebrate!'
    },
    {
      id: 'mind_blown',
      emoji: '🤯',
      name: 'Mind Blown',
      color: ['#667eea', '#764ba2'],
      animation: 'shake',
      description: 'Mind = blown!'
    },
    {
      id: 'star',
      emoji: '⭐',
      name: 'Star',
      color: ['#FFD93D', '#FF9500'],
      animation: 'rotate',
      description: 'You\'re a star!'
    }
  ];

  useEffect(() => {
    // Initialize animations for all reactions
    reactions.forEach(reaction => {
      if (!scaleAnims[reaction.id]) {
        scaleAnims[reaction.id] = new Animated.Value(1);
      }
      if (!rotateAnims[reaction.id]) {
        rotateAnims[reaction.id] = new Animated.Value(0);
      }
      if (!bounceAnims[reaction.id]) {
        bounceAnims[reaction.id] = new Animated.Value(1);
      }
      if (!pulseAnims[reaction.id]) {
        pulseAnims[reaction.id] = new Animated.Value(1);
      }
    });
  }, []);

  const getSizeConfig = () => {
    switch (size) {
      case 'small':
        return { container: 40, emoji: 20, text: 10 };
      case 'large':
        return { container: 80, emoji: 40, text: 16 };
      default:
        return { container: 60, emoji: 30, text: 12 };
    }
  };

  const startAnimation = (reactionId: string, animationType: Reaction['animation']) => {
    const scale = scaleAnims[reactionId];
    const rotate = rotateAnims[reactionId];
    const bounce = bounceAnims[reactionId];
    const pulse = pulseAnims[reactionId];

    switch (animationType) {
      case 'bounce':
        Animated.sequence([
          Animated.timing(bounce, {
            toValue: 1.3,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(bounce, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
        break;

      case 'pulse':
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.2,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
        break;

      case 'rotate':
        Animated.timing(rotate, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          rotate.setValue(0);
        });
        break;

      case 'shake':
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.1, duration: 50, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.9, duration: 50, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.1, duration: 50, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 50, useNativeDriver: true }),
        ]).start();
        break;

      case 'flip':
        Animated.sequence([
          Animated.timing(scale, { toValue: 0, duration: 150, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.2, duration: 150, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }),
        ]).start();
        break;
    }
  };

  const handleReactionPress = (reaction: Reaction) => {
    const isCurrentReaction = selectedReaction === reaction.id;
    
    if (isCurrentReaction) {
      // Remove reaction
      setSelectedReaction(null);
      onReaction('');
    } else {
      // Add/change reaction
      setSelectedReaction(reaction.id);
      onReaction(reaction.id);
      startAnimation(reaction.id, reaction.animation);
    }
    
    setShowReactionPicker(false);
  };

  const handleLongPress = () => {
    setShowReactionPicker(true);
  };

  const getReactionTransform = (reactionId: string, animationType: Reaction['animation']) => {
    const transforms: any[] = [];

    switch (animationType) {
      case 'bounce':
        transforms.push({ scale: bounceAnims[reactionId] });
        break;
      case 'pulse':
        transforms.push({ scale: pulseAnims[reactionId] });
        break;
      case 'rotate':
        transforms.push({
          rotate: rotateAnims[reactionId].interpolate({
            inputRange: [0, 1],
            outputRange: ['0deg', '360deg'],
          }),
        });
        break;
      case 'shake':
      case 'flip':
        transforms.push({ scale: scaleAnims[reactionId] });
        break;
    }

    return transforms;
  };

  const renderQuickReaction = () => {
    const defaultReaction = reactions.find(r => r.id === 'love');
    if (!defaultReaction) return null;

    const sizeConfig = getSizeConfig();
    const isSelected = selectedReaction === defaultReaction.id;

    return (
      <TouchableOpacity
        style={[
          styles.quickReactionButton,
          {
            width: sizeConfig.container,
            height: sizeConfig.container,
          },
          isSelected && { backgroundColor: defaultReaction.color[0] + '20' }
        ]}
        onPress={() => handleReactionPress(defaultReaction)}
        onLongPress={handleLongPress}
      >
        <Animated.View
          style={{
            transform: getReactionTransform(defaultReaction.id, defaultReaction.animation)
          }}
        >
          <Text style={[styles.reactionEmoji, { fontSize: sizeConfig.emoji }]}>
            {isSelected ? defaultReaction.emoji : '❤️'}
          </Text>
        </Animated.View>
        {reactionCounts[defaultReaction.id] > 0 && (
          <Text style={[styles.reactionCount, { fontSize: sizeConfig.text }]}>
            {reactionCounts[defaultReaction.id]}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderReactionRow = () => {
    const sizeConfig = getSizeConfig();
    const topReactions = reactions
      .filter(r => reactionCounts[r.id] > 0)
      .sort((a, b) => (reactionCounts[b.id] || 0) - (reactionCounts[a.id] || 0))
      .slice(0, 5);

    return (
      <View style={styles.reactionRow}>
        {topReactions.map(reaction => {
          const isSelected = selectedReaction === reaction.id;
          return (
            <TouchableOpacity
              key={reaction.id}
              style={[
                styles.reactionRowItem,
                {
                  width: sizeConfig.container * 0.8,
                  height: sizeConfig.container * 0.8,
                },
                isSelected && { backgroundColor: reaction.color[0] + '20' }
              ]}
              onPress={() => handleReactionPress(reaction)}
            >
              <Animated.View
                style={{
                  transform: getReactionTransform(reaction.id, reaction.animation)
                }}
              >
                <Text style={[styles.reactionEmoji, { fontSize: sizeConfig.emoji * 0.8 }]}>
                  {reaction.emoji}
                </Text>
              </Animated.View>
              <Text style={[styles.reactionCount, { fontSize: sizeConfig.text * 0.9 }]}>
                {reactionCounts[reaction.id]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderReactionPicker = () => {
    const sizeConfig = getSizeConfig();

    return (
      <Modal
        visible={showReactionPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReactionPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowReactionPicker(false)}
        >
          <View style={styles.reactionPickerContainer}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.reactionPickerHeader}
            >
              <Text style={styles.reactionPickerTitle}>Choose a Reaction</Text>
            </LinearGradient>
            
            <FlatList
              data={reactions}
              numColumns={5}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.reactionGrid}
              renderItem={({ item }) => {
                const isSelected = selectedReaction === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.reactionPickerItem,
                      isSelected && styles.selectedReactionItem
                    ]}
                    onPress={() => handleReactionPress(item)}
                  >
                    <LinearGradient
                      colors={isSelected ? item.color : ['transparent', 'transparent']}
                      style={styles.reactionPickerGradient}
                    >
                      <Animated.View
                        style={{
                          transform: getReactionTransform(item.id, item.animation)
                        }}
                      >
                        <Text style={styles.reactionPickerEmoji}>{item.emoji}</Text>
                      </Animated.View>
                      <Text style={styles.reactionPickerName}>{item.name}</Text>
                      {reactionCounts[item.id] > 0 && (
                        <Text style={styles.reactionPickerCount}>
                          {reactionCounts[item.id]}
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  if (showAsRow) {
    return (
      <View style={styles.container}>
        {renderReactionRow()}
        {renderReactionPicker()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderQuickReaction()}
      {renderReactionPicker()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  quickReactionButton: {
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  reactionEmoji: {
    textAlign: 'center',
  },
  reactionCount: {
    color: '#666',
    fontWeight: 'bold',
    marginTop: 2,
    textAlign: 'center',
  },
  reactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  reactionRowItem: {
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionPickerContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: width * 0.9,
    maxHeight: height * 0.6,
    overflow: 'hidden',
  },
  reactionPickerHeader: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  reactionPickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  reactionGrid: {
    padding: 20,
  },
  reactionPickerItem: {
    flex: 1,
    margin: 5,
    borderRadius: 15,
    overflow: 'hidden',
  },
  selectedReactionItem: {
    transform: [{ scale: 1.1 }],
  },
  reactionPickerGradient: {
    paddingVertical: 15,
    paddingHorizontal: 10,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  reactionPickerEmoji: {
    fontSize: 30,
    marginBottom: 5,
  },
  reactionPickerName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  reactionPickerCount: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
});

// Hook for managing reactions across the app
export const useEnhancedReactions = () => {
  const [reactions, setReactions] = useState<{ [postId: string]: { [reactionId: string]: number } }>({});
  const [userReactions, setUserReactions] = useState<{ [postId: string]: string }>({});

  const addReaction = useCallback((postId: string, reactionId: string, userId: string) => {
    // Remove previous reaction if exists
    const previousReaction = userReactions[postId];
    if (previousReaction) {
      setReactions(prev => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          [previousReaction]: Math.max(0, (prev[postId]?.[previousReaction] || 0) - 1)
        }
      }));
    }

    // Add new reaction
    if (reactionId) {
      setReactions(prev => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          [reactionId]: (prev[postId]?.[reactionId] || 0) + 1
        }
      }));
      setUserReactions(prev => ({ ...prev, [postId]: reactionId }));
    } else {
      // Remove reaction entirely
      setUserReactions(prev => {
        const newReactions = { ...prev };
        delete newReactions[postId];
        return newReactions;
      });
    }
  }, [userReactions]);

  const getReactionCounts = useCallback((postId: string) => {
    return reactions[postId] || {};
  }, [reactions]);

  const getUserReaction = useCallback((postId: string) => {
    return userReactions[postId];
  }, [userReactions]);

  return {
    addReaction,
    getReactionCounts,
    getUserReaction,
  };
};
