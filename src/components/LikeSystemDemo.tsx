import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { UniversalLikeButton } from '../components/UniversalLikeButton';
import { BeautifulCard } from '../components/BeautifulCard';
import Icon from 'react-native-vector-icons/Ionicons';

interface DemoContent {
  id: string;
  type: 'post' | 'reel' | 'story' | 'comment';
  title: string;
  description: string;
  initialLiked: boolean;
  initialCount: number;
}

export const LikeSystemDemo: React.FC = () => {
  const { colors } = useTheme();
  
  const [demoContents] = useState<DemoContent[]>([
    {
      id: 'demo-post-1',
      type: 'post',
      title: 'Instagram-style Post',
      description: 'Double-tap to like with floating heart animation',
      initialLiked: false,
      initialCount: 127,
    },
    {
      id: 'demo-reel-1',
      type: 'reel',
      title: 'TikTok-style Reel',
      description: 'Vertical reel with pulse animation',
      initialLiked: true,
      initialCount: 2340,
    },
    {
      id: 'demo-story-1',
      type: 'story',
      title: 'Instagram Story',
      description: 'Story with gradient background and particle effects',
      initialLiked: false,
      initialCount: 89,
    },
    {
      id: 'demo-comment-1',
      type: 'comment',
      title: 'Comment Like',
      description: 'Simple like button for comments',
      initialLiked: true,
      initialCount: 15,
    },
  ]);

  const [likeStates, setLikeStates] = useState<{[key: string]: {isLiked: boolean, count: number}}>({});

  const handleLikeChange = (contentId: string, isLiked: boolean, likesCount: number) => {
    setLikeStates(prev => ({
      ...prev,
      [contentId]: { isLiked, count: likesCount }
    }));
    
    Alert.alert(
      'Like Updated',
      `Content ${isLiked ? 'liked' : 'unliked'}! New count: ${likesCount}`,
      [{ text: 'OK' }]
    );
  };

  const renderVariantDemo = (variant: 'default' | 'gradient' | 'minimal' | 'story', title: string) => (
    <BeautifulCard style={StyleSheet.flatten([styles.variantCard, { backgroundColor: colors.card }])}>
      <Text style={[styles.variantTitle, { color: colors.text }]}>{title}</Text>
      <View style={styles.variantRow}>
        {['small', 'medium', 'large'].map(size => (
          <View key={size} style={styles.variantItem}>
            <Text style={[styles.variantLabel, { color: colors.textSecondary }]}>
              {size}
            </Text>
            <UniversalLikeButton
              contentId={`demo-${variant}-${size}`}
              contentType="post"
              initialLiked={false}
              initialCount={Math.floor(Math.random() * 1000)}
              size={size as any}
              variant={variant}
              showCount={true}
              onLikeChange={(isLiked, count) => 
                console.log(`${variant} ${size}: ${isLiked ? 'liked' : 'unliked'} (${count})`)
              }
            />
          </View>
        ))}
      </View>
    </BeautifulCard>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card }]}>
          <Icon name="heart" size={32} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Universal Like System Demo
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Dynamic likes across all content types
          </Text>
        </View>

        {/* Content Type Demos */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Content Types
          </Text>
          {demoContents.map((content) => {
            const currentState = likeStates[content.id];
            return (
              <BeautifulCard key={content.id} style={[styles.contentCard, { backgroundColor: colors.card }]}>
                <View style={styles.contentHeader}>
                  <View>
                    <Text style={[styles.contentTitle, { color: colors.text }]}>
                      {content.title}
                    </Text>
                    <Text style={[styles.contentDescription, { color: colors.textSecondary }]}>
                      {content.description}
                    </Text>
                  </View>
                  <UniversalLikeButton
                    contentId={content.id}
                    contentType={content.type}
                    initialLiked={content.initialLiked}
                    initialCount={content.initialCount}
                    size="large"
                    variant="default"
                    showCount={true}
                    onLikeChange={(isLiked, count) => handleLikeChange(content.id, isLiked, count)}
                  />
                </View>
                
                {currentState && (
                  <View style={[styles.stateDisplay, { backgroundColor: colors.background }]}>
                    <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                      Status: {currentState.isLiked ? '❤️ Liked' : '🤍 Not Liked'} • Count: {currentState.count}
                    </Text>
                  </View>
                )}
              </BeautifulCard>
            );
          })}
        </View>

        {/* Variant Demos */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Button Variants
          </Text>
          {renderVariantDemo('default', 'Default Style')}
          {renderVariantDemo('gradient', 'Gradient Style')}
          {renderVariantDemo('minimal', 'Minimal Style')}
          {renderVariantDemo('story', 'Story Style')}
        </View>

        {/* Animation Features */}
        <BeautifulCard style={[styles.featuresCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Features
          </Text>
          <View style={styles.featuresList}>
            {[
              '✨ Instagram-style floating heart animation',
              '🎆 Particle explosion effects',
              '📳 Haptic feedback on interactions',
              '🔄 Optimistic UI updates',
              '📊 Real-time like count formatting',
              '🎨 Multiple visual variants',
              '⚡ Firebase integration',
              '🎯 TypeScript support',
            ].map((feature, index) => (
              <Text key={index} style={[styles.featureItem, { color: colors.textSecondary }]}>
                {feature}
              </Text>
            ))}
          </View>
        </BeautifulCard>

        {/* Integration Example */}
        <BeautifulCard style={[styles.codeCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Usage Example
          </Text>
          <View style={[styles.codeBlock, { backgroundColor: colors.background }]}>
            <Text style={[styles.codeText, { color: colors.textSecondary }]}>
{`<UniversalLikeButton
  contentId="post-123"
  contentType="post"
  initialLiked={false}
  initialCount={42}
  size="medium"
  variant="gradient"
  onLikeChange={(isLiked, count) => {
    updateLocalState(isLiked, count);
  }}
/>`}
            </Text>
          </View>
        </BeautifulCard>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  contentCard: {
    padding: 16,
    marginBottom: 16,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contentTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  contentDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  stateDisplay: {
    marginTop: 12,
    padding: 8,
    borderRadius: 8,
  },
  stateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  variantCard: {
    padding: 16,
    marginBottom: 16,
  },
  variantTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  variantRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  variantItem: {
    alignItems: 'center',
  },
  variantLabel: {
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  featuresCard: {
    padding: 16,
    marginBottom: 16,
  },
  featuresList: {
    marginTop: 8,
  },
  featureItem: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  codeCard: {
    padding: 16,
    marginBottom: 32,
  },
  codeBlock: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  codeText: {
    fontFamily: 'Courier',
    fontSize: 12,
    lineHeight: 18,
  },
});

export default LikeSystemDemo;
